"use strict";
/* MOBI / AZW parsing */

/* =====================================================================
   MOBI parsing
   ===================================================================== */
const u16 = (d,o) => d.getUint16(o), u32 = (d,o) => d.getUint32(o);
const ascii = (b,o,n) => String.fromCharCode(...b.subarray(o,o+n));

function trailingEntrySize(d, psize){
  let bitpos = 0, result = 0;
  for(;;){
    const v = d[psize-1];
    result |= (v & 0x7F) << bitpos;
    bitpos += 7; psize--;
    if((v & 0x80) || bitpos >= 28 || psize === 0) return result;
  }
}
function trailingSize(d, flags){
  let num = 0, f = flags >> 1;
  while(f){
    if(f & 1) num += trailingEntrySize(d, d.length - num);
    f >>= 1;
  }
  if(flags & 1) num += (d[d.length - num - 1] & 3) + 1;
  return num;
}
function palmDocDecompress(src, cap){
  const out = new Uint8Array(cap);
  let i = 0, o = 0;
  while(i < src.length && o < cap){
    let c = src[i++];
    if(c === 0 || (c >= 9 && c <= 0x7F)){ out[o++] = c; }
    else if(c >= 1 && c <= 8){ while(c-- && i < src.length && o < cap) out[o++] = src[i++]; }
    else if(c >= 0xC0){ out[o++] = 0x20; if(o < cap) out[o++] = c ^ 0x80; }
    else {
      c = (c << 8) | src[i++];
      const dist = (c >> 3) & 0x7FF, len = (c & 7) + 3;
      for(let k = 0; k < len && o < cap; k++, o++) out[o] = out[o - dist];
    }
  }
  return out.subarray(0, o);
}
function imageMime(b){
  if(b[0] === 0xFF && b[1] === 0xD8) return 'image/jpeg';
  if(b[0] === 0x89 && b[1] === 0x50) return 'image/png';
  if(b[0] === 0x47 && b[1] === 0x49) return 'image/gif';
  if(b[0] === 0x42 && b[1] === 0x4D) return 'image/bmp';
  return null;
}

function parseMobi(buf){
  const bytes = new Uint8Array(buf), dv = new DataView(buf);
  if(bytes.length < 100) throw new Error('This file is too small to be a MOBI book.');
  const type = ascii(bytes, 60, 8);
  if(type !== 'BOOKMOBI' && type !== 'TEXtREAd') throw new Error('This does not look like a MOBI/AZW file.');

  const n = u16(dv, 76), offs = [];
  for(let i = 0; i < n; i++) offs.push(u32(dv, 78 + i * 8));
  offs.push(buf.byteLength);
  const rec = i => bytes.subarray(offs[i], offs[i+1]);

  const r0 = offs[0];
  const compression = u16(dv, r0), textRecs = u16(dv, r0 + 8), recSize = u16(dv, r0 + 10), encryption = u16(dv, r0 + 12);
  if(ascii(bytes, r0 + 16, 4) !== 'MOBI') throw new Error('This file has no MOBI header (it may be a plain PalmDOC file).');
  if(encryption !== 0) throw new Error('This book is protected by DRM and cannot be read here.');
  if(compression === 17480) throw new Error('This book uses HUFF/CDIC compression, which Higanobi does not support yet.');
  if(compression !== 1 && compression !== 2) throw new Error('Unknown compression type (' + compression + ').');

  const hdrLen = u32(dv, r0 + 20), encoding = u32(dv, r0 + 28);
  const nameOff = u32(dv, r0 + 84), nameLen = u32(dv, r0 + 88);
  const firstImage = u32(dv, r0 + 108), exthFlags = u32(dv, r0 + 128);
  const extra = hdrLen >= 0xE4 ? u16(dv, r0 + 0xF2) : 0;
  const textDec = new TextDecoder(encoding === 65001 ? 'utf-8' : 'windows-1252');

  // EXTH metadata
  const exth = {};
  if(exthFlags & 0x40){
    let p = r0 + 16 + hdrLen;
    if(ascii(bytes, p, 4) === 'EXTH'){
      const cnt = u32(dv, p + 8); p += 12;
      for(let k = 0; k < cnt && p + 8 <= bytes.length; k++){
        const t = u32(dv, p), l = u32(dv, p + 4);
        if(l < 8) break;
        (exth[t] = exth[t] || []).push(bytes.subarray(p + 8, p + l));
        p += l;
      }
    }
  }
  const utf8 = new TextDecoder('utf-8');
  const str = t => exth[t] ? utf8.decode(exth[t][0]) : '';
  const num = t => { if(!exth[t] || exth[t][0].length < 4) return null; const d = exth[t][0]; return new DataView(d.buffer, d.byteOffset, d.byteLength).getUint32(0); };
  const title = str(503) || textDec.decode(bytes.subarray(r0 + nameOff, r0 + nameOff + nameLen)) || 'Untitled';
  const author = exth[100] ? exth[100].map(d => utf8.decode(d)).join(', ') : '';

  // Text
  const chunks = [];
  for(let i = 1; i <= textRecs && i < n; i++){
    let d = rec(i);
    d = d.subarray(0, d.length - trailingSize(d, extra));
    chunks.push(compression === 2 ? palmDocDecompress(d, Math.max(recSize, 4096) * 2) : d);
  }
  let s = '';
  for(const c of chunks) for(let i = 0; i < c.length; i += 8192) s += String.fromCharCode.apply(null, c.subarray(i, i + 8192));

  // Internal links: byte offsets (filepos) -> anchors
  const pos = new Set();
  s.replace(/filepos\s*=\s*["']?0*(\d+)/gi, (m, p) => { pos.add(+p); return m; });
  let html = '', last = 0;
  [...pos].map(p => {
    const lt = s.lastIndexOf('<', p - 1), gt = s.lastIndexOf('>', p - 1);
    return { id: p, at: lt > gt ? lt : p };
  }).filter(x => x.at <= s.length).sort((a,b) => a.at - b.at).forEach(x => {
    html += s.slice(last, x.at) + '<a id="fp' + x.id + '"></a>'; last = x.at;
  });
  html += s.slice(last);
  html = html.replace(/filepos\s*=\s*["']?0*(\d+)["']?/gi, 'href="#fp$1"')
             .replace(/(\s)recindex\s*=\s*["']?0*(\d+)["']?/gi, '$1data-rec="$2"')
             .replace(/<mbp:pagebreak\s*\/?>/gi, '<hr class="pb">')
             .replace(/<\/?(mbp|idx):[^>]*>/gi, '');
  const u8 = new Uint8Array(html.length);
  for(let i = 0; i < html.length; i++) u8[i] = html.charCodeAt(i);
  html = textDec.decode(u8);

  const image = k => {            // k = 0-based index into the book's image records
    const i = firstImage + k;
    if(k < 0 || !firstImage || firstImage === 0xFFFFFFFF || i >= n) return null;
    const d = rec(i), mime = imageMime(d);
    return mime ? new Blob([d], {type: mime}) : null;
  };
  return {
    html, title, author, image,
    coverIndex: num(201),
    rtl: str(527).toLowerCase() === 'rtl',
    fixed: str(122).toLowerCase() === 'true'
  };
}
