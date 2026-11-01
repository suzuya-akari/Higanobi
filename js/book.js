"use strict";
/* Book state, loading and opening files */

/* =====================================================================
   Opening a file
   ===================================================================== */
function resetBook(){
  closeReader(true);
  blobUrls.forEach(URL.revokeObjectURL); blobUrls = [];
  R.cache.forEach(URL.revokeObjectURL); R.cache.clear();
  current = null;
}
const mkUrl = blob => { const u = URL.createObjectURL(blob); blobUrls.push(u); return u; };

function showMenuError(text){
  setScreen('menu');
  $('msg').textContent = text;
  updateResume();
}
function updateResume(){
  const b = $('resume');
  b.hidden = !current;
  if(current) b.textContent = 'Back to “' + current.title.slice(0, 40) + '”';
}

async function loadBook(file, key, name, onProgress){
  name = name || file.name;
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if(head[0] === 0x50 && head[1] === 0x4B) return loadZip(file, key, name, onProgress);      // PK: zip / cbz
  if(head[0] === 0x52 && head[1] === 0x61 && head[2] === 0x72) throw new Error('RAR archives (.cbr) aren’t supported. Re-save it as .zip or .cbz and try again.');
  const buf = await file.arrayBuffer();
  const book = parseMobi(buf);
  const doc = new DOMParser().parseFromString(book.html, 'text/html');
  sanitize(doc.body);
  const bodyHTML = doc.body.innerHTML;
  const pages = buildPages(doc.body);
  if(!pages.length) throw new Error('No readable pages were found in this book.');

  // make sure the cover is the first page
  const coverRec = book.coverIndex !== null ? book.coverIndex + 1 : null;
  const coverBlob = coverRec ? book.image(coverRec - 1) : null;
  if(coverBlob && !pages.slice(0, 2).some(p => p.t === 'img' && p.rec === coverRec)) pages.unshift({t:'img', rec:coverRec});

  const imgPages = pages.filter(p => p.t === 'img').length;
  return {
    title: book.title, author: book.author, image: book.image, pages, bodyHTML, key,
    rtl: store.get('mobi:rtl:' + key) !== null ? store.get('mobi:rtl:' + key) === '1' : book.rtl,
    isComic: book.fixed || imgPages / pages.length >= 0.6,
    coverBlob: coverBlob || (pages[0].t === 'img' ? book.image(pages[0].rec - 1) : null),
    coverUrl: null, scrollBuilt: false
  };
}

async function openFile(file, opts){
  opts = opts || {};
  $('msg').textContent = '';
  try{
    const key = opts.key || (file.name + ':' + file.size);
    busy('Opening…');
    const bk = await loadBook(file, key, file.name || (opts.rec && opts.rec.name), (d, n) => busy('Unpacking pages… ' + d + ' / ' + n, d / n));
    if(opts.rec){ bk.title = opts.rec.title || bk.title; if(typeof opts.rec.author === 'string') bk.author = opts.rec.author; }
    resetBook();
    current = bk;
    if(bk.coverBlob) current.coverUrl = mkUrl(bk.coverBlob);
    showBookScreen();
    libRemember(file, bk);
  }catch(err){
    console.error(err);
    showMenuError(err.message || 'Could not read this file.');
  } finally { busy(null); }
}
