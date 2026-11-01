"use strict";
/* Fullscreen paged reader: state, layout, rendering, paging */

/* =====================================================================
   Fullscreen paged reader
   ===================================================================== */
const R = {
  open:false, views:[], v:0, rtl:false, spread:false, fitw:false,
  scale:1, tx:0, ty:0, view:null, cache:new Map(), hideT:null,
  fx:true, run:null, turn:null
};
const EASE = 'cubic-bezier(.22,.8,.3,1)';
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const animOn = () => R.fx && !reduced();
const stage = $('stage');

function fsElement(){ return document.fullscreenElement || document.webkitFullscreenElement; }
function enterFullscreen(){
  const el = $('rd');
  try{
    const p = (el.requestFullscreen || el.webkitRequestFullscreen || (() => null)).call(el);
    if(p && p.catch) p.catch(() => {});
  }catch(e){}
}
function exitFullscreen(){
  if(!fsElement()) return;
  try{
    const p = (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    if(p && p.catch) p.catch(() => {});
  }catch(e){}
}
function onFsChange(){ $('rdFs').setAttribute('aria-pressed', !!fsElement()); relayoutSoon(); }
document.addEventListener('fullscreenchange', onFsChange);
document.addEventListener('webkitfullscreenchange', onFsChange);

function startReading(){
  if(!current || R.open) return;
  enterFullscreen();                       // must run inside the user's click/tap
  Sfx.init(); Sfx.flip(.5, .55);
  R.open = true;
  R.rtl = current.rtl;
  R.spread = store.get('mobi:spread') === '1';
  R.fitw = store.get('mobi:fitw') === '1';
  R.fx = store.get('mobi:fx') !== '0';
  $('rd').classList.add('open');
  document.body.style.overflow = 'hidden';
  $('rdTitle').textContent = current.title;
  stage.classList.toggle('fitw', R.fitw);
  buildViews();
  const saved = parseInt(store.get('mobi:pg:' + current.key) || '0', 10) || 0;
  R.v = Math.max(0, R.views.findIndex(vw => vw.includes(Math.min(saved, current.pages.length - 1))));
  render();
  showChrome(true); scheduleHide(2800);
}
function closeReader(silent){
  if(!R.open) return;
  if(R.run) R.run.finish();
  R.open = false;
  clearTimeout(R.hideT);
  $('rd').classList.remove('open');
  document.body.style.overflow = '';
  stage.replaceChildren();
  exitFullscreen();
}
$('rdClose').onclick = () => closeReader();
$('rdFs').onclick = () => fsElement() ? exitFullscreen() : enterFullscreen();

function spreadActive(){ return R.spread && innerWidth > innerHeight; }
function buildViews(){
  const pg = current.pages, vs = [[0]];
  let i = 1;
  while(i < pg.length){
    if(spreadActive() && pg[i].t === 'img' && i + 1 < pg.length && pg[i+1].t === 'img'){ vs.push([i, i+1]); i += 2; }
    else { vs.push([i]); i++; }
  }
  R.views = vs;
}
function relayout(){
  if(!R.open) return;
  if(R.run) R.run.finish();
  const first = R.views[R.v] ? R.views[R.v][0] : 0;
  buildViews();
  R.v = Math.max(0, R.views.findIndex(vw => vw.includes(first)));
  render();
}
let relayoutT = null;
function relayoutSoon(){ clearTimeout(relayoutT); relayoutT = setTimeout(relayout, 150); }
addEventListener('resize', relayoutSoon);

function urlFor(rec){
  if(R.cache.has(rec)){ const u = R.cache.get(rec); R.cache.delete(rec); R.cache.set(rec, u); return u; }
  const blob = current.image(rec - 1);
  if(!blob) return null;
  const u = URL.createObjectURL(blob);
  R.cache.set(rec, u);
  return u;
}
function evict(keep){
  while(R.cache.size > 16){
    let victim = null;
    for(const k of R.cache.keys()) if(!keep.has(k)){ victim = k; break; }
    if(victim === null) break;
    URL.revokeObjectURL(R.cache.get(victim)); R.cache.delete(victim);
  }
}
function pageNode(p){
  if(p.t === 'img'){
    const im = new Image(); im.alt = ''; im.draggable = false;
    const u = urlFor(p.rec);
    if(u) im.src = u;
    return im;
  }
  const d = document.createElement('div'); d.className = 'txt';
  const inner = document.createElement('div'); inner.className = 'in'; inner.innerHTML = p.html;
  inner.querySelectorAll('a').forEach(a => { if((a.getAttribute('href') || '').startsWith('#')) a.removeAttribute('href'); });
  inner.querySelectorAll('img[data-rec]').forEach(i => { const u = urlFor(+i.dataset.rec); if(u) i.src = u; else i.remove(); });
  d.append(inner);
  return d;
}
function buildView(v){
  const idxs = R.views[v], pg = current.pages;
  const view = document.createElement('div');
  view.className = 'view' + (R.rtl ? ' rtl' : '') + (idxs.length > 1 ? ' two' : '');
  idxs.forEach(i => view.append(pageNode(pg[i])));
  return view;
}
function render(pre){
  const idxs = R.views[R.v], pg = current.pages;
  const view = pre || buildView(R.v);
  stage.replaceChildren(view);
  R.view = view; stage.scrollTop = 0;
  R.scale = 1; R.tx = R.ty = 0;
  updateUI();
  // warm neighbours and trim the cache
  const keep = new Set();
  [R.v - 1, R.v, R.v + 1].forEach(v => (R.views[v] || []).forEach(i => {
    const p = pg[i];
    if(p.t === 'img'){ keep.add(p.rec); if(v !== R.v){ const u = urlFor(p.rec); if(u){ const im = new Image(); im.src = u; } } }
  }));
  evict(keep);
  store.set('mobi:pg:' + current.key, String(idxs[0]));
}
function updateUI(){
  const idxs = R.views[R.v], total = current.pages.length;
  const a = idxs[0] + 1, b = idxs[idxs.length - 1] + 1;
  $('rdCount').textContent = (a === b ? a : a + '–' + b) + ' / ' + total;
  const s = $('rdSlider');
  s.max = R.views.length; s.value = R.v + 1;
  s.style.direction = R.rtl ? 'rtl' : 'ltr';
  $('rdFit').setAttribute('aria-pressed', R.fitw);
  $('rdSpread').setAttribute('aria-pressed', R.spread);
  $('rdDir').setAttribute('aria-pressed', R.rtl);
  $('rdFs').setAttribute('aria-pressed', !!fsElement());
  $('rdFx').setAttribute('aria-pressed', R.fx);
  $('rdSfx').setAttribute('aria-pressed', Sfx.on);
  const c = $('rdCount'); c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop');
}
function show(v, fade){
  if(R.run) R.run.finish();
  R.v = Math.max(0, Math.min(R.views.length - 1, v)); render();
  if(fade && animOn() && R.view.animate) R.view.animate([{opacity:0, transform:'scale(.96)'},{opacity:1, transform:'none'}], {duration:260, easing:EASE});
}
function step(d){
  if(g.drag) return;
  if(R.run) R.run.finish();
  const nv = R.v + d;
  if(nv < 0 || nv >= R.views.length){
    toast(nv < 0 ? 'First page' : 'End of book');
    if(animOn() && R.view.animate){
      const s = (R.rtl ? 1 : -1) * (nv < 0 ? -1 : 1) * 22;
      R.view.animate([{transform:'translateX(0)'},{transform:'translateX(' + s + 'px)'},{transform:'translateX(0)'}], {duration:320, easing:'cubic-bezier(.3,1.6,.5,1)'});
    }
    return;
  }
  if(!animOn()){ Sfx.flip(.28, .7); show(nv); return; }
  Sfx.flip(.62);
  settle(setupTurn(nv), 1, 620, easeIO);
}
