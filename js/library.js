"use strict";
/* Library: IndexedDB storage, library screen, edit dialog, import */

/* =====================================================================
   Library: books are stored in this browser (IndexedDB), nothing is uploaded
   ===================================================================== */
const Lib = {
  ok: !!window.indexedDB, dbp: null,
  open(){
    if(!this.dbp) this.dbp = new Promise((res, rej) => {
      let r; try{ r = indexedDB.open('higanobi', 1); }catch(e){ rej(e); return; }
      r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('books', {keyPath:'key'}); d.createObjectStore('files'); };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
      r.onblocked = () => rej(new Error('Storage is blocked'));
    });
    return this.dbp;
  },
  async run(stores, mode, fn){
    const db = await this.open();
    return new Promise((res, rej) => {
      const t = db.transaction(stores, mode); let out;
      const rq = fn(t); if(rq) rq.onsuccess = () => { out = rq.result; };
      t.oncomplete = () => res(out);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error || new Error('Storage was blocked'));
    });
  },
  list(){ return this.run('books', 'readonly', t => t.objectStore('books').getAll()).then(r => r || []); },
  get(k){ return this.run('books', 'readonly', t => t.objectStore('books').get(k)); },
  file(k){ return this.run('files', 'readonly', t => t.objectStore('files').get(k)); },
  save(rec, file){ return this.run(file ? ['books', 'files'] : 'books', 'readwrite', t => { if(file) t.objectStore('files').put(file, rec.key); return t.objectStore('books').put(rec); }); },
  del(k){ return this.run(['books', 'files'], 'readwrite', t => { t.objectStore('files').delete(k); return t.objectStore('books').delete(k); }); }
};

async function makeThumb(blob, maxW){
  maxW = maxW || 360;
  const url = URL.createObjectURL(blob);
  try{
    const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('bad image')); i.src = url; });
    const sc = Math.min(1, maxW / im.naturalWidth);
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(im.naturalWidth * sc)); c.height = Math.max(1, Math.round(im.naturalHeight * sc));
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    return await new Promise(r => c.toBlob(b => r(b || blob), 'image/jpeg', .85));
  } finally { URL.revokeObjectURL(url); }
}

async function libAdd(file, bk, opened){
  const now = Date.now();
  const rec = {
    key: bk.key, name: file.name || bk.key, size: file.size, title: bk.title, author: bk.author,
    added: now, opened: opened ? now : 0, pages: bk.pages.length, isComic: bk.isComic,
    thumb: bk.coverBlob ? await makeThumb(bk.coverBlob).catch(() => null) : null, cover: null
  };
  await Lib.save(rec, file);
  try{ if(navigator.storage && navigator.storage.persist) navigator.storage.persist(); }catch(e){}
  return rec;
}
async function libRemember(file, bk){
  const note = t => { if(current && current.key === bk.key) $('bsSaved').textContent = t; };
  if(!Lib.ok){ note('Library storage isn’t available in this browser.'); return; }
  try{
    const rec = await Lib.get(bk.key);
    if(rec){ rec.opened = Date.now(); rec.pages = bk.pages.length; await Lib.save(rec); note('In your library.'); }
    else { await libAdd(file, bk, true); note('Saved to your library. You can reopen it without uploading again.'); }
    refreshLibCount();
  }catch(e){
    console.warn(e); note('Couldn’t save this book to the library (storage may be full or blocked).');
  }
}
async function refreshLibCount(){
  const b = $('libBtn');
  if(!Lib.ok){ b.hidden = true; $('libBtn2').hidden = true; return; }
  try{
    const n = (await Lib.list()).length;
    b.textContent = n ? 'Library (' + n + ')' : 'Library';
    b.classList.toggle('primary', n > 0); $('openBtn2').classList.toggle('primary', n === 0);
  }catch(e){ Lib.ok = false; b.hidden = true; $('libBtn2').hidden = true; }
}

let libUrls = [];
function makeCard(rec, i){
  const card = document.createElement('div'); card.className = 'card';
  card.style.setProperty('--i', Math.min(i, 14)); card.dataset.q = (rec.title + ' ' + rec.author).toLowerCase();
  const cov = document.createElement('button'); cov.className = 'cover'; cov.setAttribute('aria-label', 'Open ' + rec.title);
  const blob = rec.cover || rec.thumb;
  if(blob){
    const im = new Image(); im.alt = ''; im.draggable = false;
    const u = URL.createObjectURL(blob); libUrls.push(u); im.src = u; cov.append(im);
  } else {
    const ph = document.createElement('div'); ph.className = 'ph';
    const b = document.createElement('b'); b.textContent = rec.title; ph.append(b); cov.append(ph);
  }
  const saved = parseInt(store.get('mobi:pg:' + rec.key) || '-1', 10);
  if(saved < 0){ const bd = document.createElement('span'); bd.className = 'badge'; bd.textContent = 'NEW'; cov.append(bd); }
  else if(rec.pages > 1){ const pr = document.createElement('span'); pr.className = 'prog'; pr.style.width = Math.min(100, saved / (rec.pages - 1) * 100) + '%'; cov.append(pr); }
  cov.onclick = () => openFromLibrary(rec);
  const more = document.createElement('button'); more.className = 'more'; more.textContent = '⋯'; more.setAttribute('aria-label', 'Edit ' + rec.title);
  more.onclick = e => { e.stopPropagation(); openEdit(rec); };
  const t = document.createElement('div'); t.className = 't'; t.textContent = rec.title;
  card.append(cov, more, t);
  if(rec.author){ const a = document.createElement('div'); a.className = 'a'; a.textContent = rec.author; card.append(a); }
  return card;
}
function filterLibrary(){
  const q = $('libFilter').value.trim().toLowerCase();
  document.querySelectorAll('#libGrid .card').forEach(c => { c.hidden = !!q && !c.dataset.q.includes(q); });
}
$('libFilter').addEventListener('input', filterLibrary);

async function renderLibrary(){
  let list = [];
  try{ list = await Lib.list(); }catch(e){ Lib.ok = false; }
  libUrls.forEach(URL.revokeObjectURL); libUrls = [];
  list.sort((a, b) => Math.max(b.opened || 0, b.added || 0) - Math.max(a.opened || 0, a.added || 0));
  const grid = $('libGrid'); grid.replaceChildren();
  list.forEach((rec, i) => grid.append(makeCard(rec, i)));
  $('libEmpty').hidden = list.length > 0;
  $('libFilter').hidden = list.length < 6;
  filterLibrary();
  let info = list.length + (list.length === 1 ? ' book' : ' books');
  $('libInfo').textContent = info;
  try{
    if(navigator.storage && navigator.storage.estimate){
      const e = await navigator.storage.estimate();
      if(e.usage) $('libInfo').textContent = info + ' · ' + (e.usage / 1048576 < 10 ? (e.usage / 1048576).toFixed(1) : Math.round(e.usage / 1048576)) + ' MB stored on this device';
    }
  }catch(e){}
  refreshLibCount();
}
async function showLibrary(){
  $('libStatus').textContent = '';
  await renderLibrary();
  setScreen('library');
}
async function openFromLibrary(rec){
  try{
    const blob = await Lib.file(rec.key);
    if(!blob) throw new Error('This book’s file is missing from storage. Please add it again.');
    await openFile(blob, {key: rec.key, rec});
  }catch(e){ showMenuError(e.message || 'Could not open this book.'); }
}

/* ---- edit dialog: title, author and portrait ---- */
let editRec = null, editUrl = null, delT = null;
function setEditPreview(){
  if(editUrl){ URL.revokeObjectURL(editUrl); editUrl = null; }
  const blob = editRec && (editRec.cover || editRec.thumb);
  if(blob){ editUrl = URL.createObjectURL(blob); $('edPrev').style.backgroundImage = 'url("' + editUrl + '")'; }
  else $('edPrev').style.backgroundImage = '';
  $('edReset').disabled = !(editRec && editRec.cover);
}
function openEdit(rec){
  editRec = rec;
  $('edTitle').value = rec.title; $('edAuthor').value = rec.author || '';
  $('edNote').textContent = ''; $('edDel').textContent = 'Remove from library';
  setEditPreview();
  $('editDlg').showModal();
}
$('edPick').onclick = () => $('portraitFile').click();
$('portraitFile').onchange = async e => {
  const f = e.target.files[0]; e.target.value = '';
  if(!f || !editRec) return;
  try{ editRec.cover = await makeThumb(f, 420); await Lib.save(editRec); $('edNote').textContent = ''; setEditPreview(); }
  catch(err){ $('edNote').textContent = 'That image couldn’t be read.'; }
};
$('edReset').onclick = async () => {
  if(!editRec) return;
  try{ editRec.cover = null; await Lib.save(editRec); setEditPreview(); }catch(e){}
};
$('edDel').onclick = async () => {
  if(!editRec) return;
  if($('edDel').textContent !== 'Tap again to remove'){
    $('edDel').textContent = 'Tap again to remove';
    clearTimeout(delT); delT = setTimeout(() => { $('edDel').textContent = 'Remove from library'; }, 3000);
    return;
  }
  const rec = editRec; editRec = null;
  try{
    await Lib.del(rec.key);
    ['pg', 'rtl', 'pos'].forEach(k => { try{ localStorage.removeItem('mobi:' + k + ':' + rec.key); }catch(e){} });
  }catch(e){ console.warn(e); }
  $('editDlg').close();
};
$('edDone').onclick = () => $('editDlg').close();
$('editDlg').addEventListener('click', e => { if(e.target === $('editDlg')) $('editDlg').close(); });
$('editDlg').addEventListener('close', async () => {
  clearTimeout(delT);
  const rec = editRec; editRec = null;
  if(editUrl){ URL.revokeObjectURL(editUrl); editUrl = null; }
  if(rec){
    const t = $('edTitle').value.trim() || rec.title, a = $('edAuthor').value.trim();
    if(t !== rec.title || a !== (rec.author || '')){ rec.title = t; rec.author = a; try{ await Lib.save(rec); }catch(e){} }
  }
  renderLibrary();
});

/* ---- adding files (one opens straight away, several go into the library) ---- */
async function importMany(files){
  if(!Lib.ok){ showMenuError('Library storage isn’t available in this browser, so open one book at a time.'); return; }
  $('msg').textContent = '';
  await renderLibrary(); setScreen('library');
  const st = $('libStatus'); let ok = 0; const fail = [];
  for(let i = 0; i < files.length; i++){
    st.textContent = 'Importing ' + (i + 1) + ' of ' + files.length + '…';
    try{
      const key = files[i].name + ':' + files[i].size;
      if(!(await Lib.get(key))){ const bk = await loadBook(files[i], key); await libAdd(files[i], bk, false); }
      ok++;
    }catch(e){ console.warn(e); fail.push(files[i].name); }
    await new Promise(r => setTimeout(r));
  }
  st.textContent = ok + ' added' + (fail.length ? ' · couldn’t read: ' + fail.join(', ') : '');
  await renderLibrary();
}
function handleFiles(list){
  const files = [...list].filter(f => f && f.size);
  if(!files.length) return;
  if(files.length === 1) openFile(files[0]); else importMany(files);
}
