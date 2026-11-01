"use strict";
/* ZIP / CBZ reader */

/* =====================================================================
   ZIP / CBZ reader (no libraries): central directory + stored/deflate entries
   ===================================================================== */
const u64 = (dv, o) => dv.getUint32(o + 4, true) * 4294967296 + dv.getUint32(o, true);
async function zipEntries(file){
  const size = file.size, tailLen = Math.min(size, 65557);
  const tail = new DataView(await file.slice(size - tailLen).arrayBuffer());
  let e = -1;
  for(let i = tailLen - 22; i >= 0; i--) if(tail.getUint32(i, true) === 0x06054b50){ e = i; break; }
  if(e < 0) throw new Error('This doesn’t look like a valid ZIP file.');
  let total = tail.getUint16(e + 10, true), cdSize = tail.getUint32(e + 12, true), cdOff = tail.getUint32(e + 16, true);
  if(total === 0xFFFF || cdSize === 0xFFFFFFFF || cdOff === 0xFFFFFFFF){          // ZIP64
    if(e >= 20 && tail.getUint32(e - 20, true) === 0x07064b50){
      const o64 = u64(tail, e - 12);
      const h = new DataView(await file.slice(o64, o64 + 56).arrayBuffer());
      if(h.getUint32(0, true) === 0x06064b50){ total = u64(h, 32); cdSize = u64(h, 40); cdOff = u64(h, 48); }
    }
  }
  const cd = new DataView(await file.slice(cdOff, cdOff + cdSize).arrayBuffer());
  const bytes = new Uint8Array(cd.buffer), dec = new TextDecoder('utf-8'), out = [];
  let p = 0;
  while(p + 46 <= cd.byteLength && cd.getUint32(p, true) === 0x02014b50){
    const flags = cd.getUint16(p + 8, true), method = cd.getUint16(p + 10, true);
    let comp = cd.getUint32(p + 20, true), unc = cd.getUint32(p + 24, true), off = cd.getUint32(p + 42, true);
    const nl = cd.getUint16(p + 28, true), el = cd.getUint16(p + 30, true), cl = cd.getUint16(p + 32, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nl));
    if(comp === 0xFFFFFFFF || unc === 0xFFFFFFFF || off === 0xFFFFFFFF){
      let q = p + 46 + nl; const end = q + el;
      while(q + 4 <= end){
        const id = cd.getUint16(q, true), len = cd.getUint16(q + 2, true);
        if(id === 1){
          let r = q + 4;
          if(unc === 0xFFFFFFFF){ unc = u64(cd, r); r += 8; }
          if(comp === 0xFFFFFFFF){ comp = u64(cd, r); r += 8; }
          if(off === 0xFFFFFFFF){ off = u64(cd, r); r += 8; }
        }
        q += 4 + len;
      }
    }
    out.push({name, method, comp, unc, off, enc: !!(flags & 1)});
    p += 46 + nl + el + cl;
  }
  return out;
}
async function zipBlob(file, e, mime){
  const h = new DataView(await file.slice(e.off, e.off + 30).arrayBuffer());
  if(h.getUint32(0, true) !== 0x04034b50) throw new Error('The archive is damaged.');
  const start = e.off + 30 + h.getUint16(26, true) + h.getUint16(28, true);
  const raw = file.slice(start, start + e.comp);
  if(e.method === 0) return raw.slice(0, raw.size, mime);
  if(e.method === 8){
    if(typeof DecompressionStream === 'undefined') throw new Error('This browser can’t unpack compressed ZIPs. Please update it.');
    const out = await new Response(raw.stream().pipeThrough(new DecompressionStream('deflate-raw'))).blob();
    return new Blob([out], {type: mime});
  }
  throw new Error('Unsupported ZIP compression method (' + e.method + ').');
}
const IMG_MIME = {jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', gif:'image/gif', webp:'image/webp', bmp:'image/bmp', avif:'image/avif'};
async function loadZip(file, key, name, onProgress){
  if(file.size < 22) throw new Error('This ZIP file is empty.');
  const all = await zipEntries(file);
  const ext = n => (n.match(/\.([a-z0-9]+)$/i) || [])[1] ? n.match(/\.([a-z0-9]+)$/i)[1].toLowerCase() : '';
  const skip = n => n.includes('__MACOSX/') || n.split('/').some(seg => seg.startsWith('.'));
  const imgs = all.filter(e => !e.name.endsWith('/') && IMG_MIME[ext(e.name)] && !skip(e.name));
  const col = new Intl.Collator(undefined, {numeric:true, sensitivity:'base'});
  imgs.sort((a, b) => col.compare(a.name, b.name));
  if(!imgs.length) throw new Error('No images were found in this archive. If it contains other ZIP files, extract those first.');
  if(imgs.some(e => e.enc)) throw new Error('This archive is password-protected.');

  let info = {};
  const ci = all.find(e => /(^|\/)comicinfo\.xml$/i.test(e.name) && !e.enc);
  if(ci){
    try{
      const xml = new DOMParser().parseFromString(await (await zipBlob(file, ci, 'text/xml')).text(), 'text/xml');
      const g = t => { const n = xml.getElementsByTagName(t)[0]; return n ? n.textContent.trim() : ''; };
      info = {title:g('Title'), series:g('Series'), number:g('Number'), writer:g('Writer'), manga:g('Manga')};
    }catch(err){}
  }

  const got = new Array(imgs.length).fill(null);
  let next = 0, done = 0;
  const worker = async () => {
    while(next < imgs.length){
      const i = next++;
      try{ got[i] = await zipBlob(file, imgs[i], IMG_MIME[ext(imgs[i].name)]); }catch(err){ console.warn('skipped', imgs[i].name, err); }
      if(onProgress) onProgress(++done, imgs.length);
    }
  };
  await Promise.all(Array.from({length: Math.min(4, imgs.length)}, worker));
  const blobs = got.filter(Boolean);
  if(!blobs.length) throw new Error('None of the images in this archive could be read.');

  const base = (name || 'Untitled').replace(/\.[^.]+$/, '').replace(/_+/g, ' ').trim() || 'Untitled';
  const saved = store.get('mobi:rtl:' + key);
  return {
    title: info.title || (info.series ? info.series + (info.number ? ' #' + info.number : '') : base),
    author: info.writer || '', image: k => blobs[k] || null,
    pages: blobs.map((_, n) => ({t:'img', rec:n + 1})), bodyHTML: '', key,
    rtl: saved !== null ? saved === '1' : /righttoleft/i.test(info.manga || ''),
    isComic: true, coverBlob: blobs[0], coverUrl: null, scrollBuilt: false
  };
}
