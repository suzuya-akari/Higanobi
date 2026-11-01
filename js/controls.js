"use strict";
/* Reader controls: toast, buttons, chrome, zoom and pan */

let toastT = null;
function toast(msg){
  const t = $('toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 1100);
}

/* ---- controls ---- */
$('rdSlider').addEventListener('input', e => {
  const v = +e.target.value - 1, idxs = R.views[v];
  $('rdCount').textContent = (idxs[0] + 1) + ' / ' + current.pages.length;
});
$('rdSlider').addEventListener('change', e => { show(+e.target.value - 1, true); scheduleHide(2800); });
$('rdFit').onclick = () => {
  R.fitw = !R.fitw; store.set('mobi:fitw', R.fitw ? '1' : '0');
  stage.classList.toggle('fitw', R.fitw); render();
};
$('rdSpread').onclick = () => {
  R.spread = !R.spread; store.set('mobi:spread', R.spread ? '1' : '0');
  if(R.spread && !(innerWidth > innerHeight)) toast('Two pages show in landscape');
  relayout();
};
$('rdFx').onclick = () => { R.fx = !R.fx; store.set('mobi:fx', R.fx ? '1' : '0'); $('rdFx').setAttribute('aria-pressed', R.fx); toast(R.fx ? 'Page effects on' : 'Page effects off'); };
$('rdSfx').onclick = () => { Sfx.on = !Sfx.on; store.set('mobi:sfx', Sfx.on ? '1' : '0'); $('rdSfx').setAttribute('aria-pressed', Sfx.on); if(Sfx.on) Sfx.flip(.4, .8); toast(Sfx.on ? 'Sound on' : 'Sound off'); };
$('rdPortrait').onclick = async () => {
  const pg = current.pages[R.views[R.v][0]];
  if(!pg || pg.t !== 'img'){ toast('Go to an image page to use it as the portrait'); return; }
  try{
    const rec = await Lib.get(current.key);
    if(!rec){ toast('This book isn’t in your library'); return; }
    rec.cover = await makeThumb(current.image(pg.rec - 1), 420);
    await Lib.save(rec); toast('Library portrait set from this page');
  }catch(e){ toast('Couldn’t set the portrait'); }
};
$('rdDir').onclick = () => {
  R.rtl = !R.rtl; current.rtl = R.rtl; store.set('mobi:rtl:' + current.key, R.rtl ? '1' : '0'); render();
};

function showChrome(on){ $('rd').classList.toggle('nochrome', !on); }
function scheduleHide(ms){ clearTimeout(R.hideT); R.hideT = setTimeout(() => showChrome(false), ms); }
function toggleChrome(){
  const hidden = $('rd').classList.contains('nochrome');
  showChrome(hidden);
  if(hidden) scheduleHide(4000); else clearTimeout(R.hideT);
}

/* ---- zoom / pan ---- */
function applyT(){
  R.view.style.transform = R.scale === 1 ? '' : 'translate(' + R.tx + 'px,' + R.ty + 'px) scale(' + R.scale + ')';
}
function clampPan(){
  const sw = stage.clientWidth, sh = stage.clientHeight, w = R.view.offsetWidth, h = R.view.offsetHeight;
  R.tx = Math.min(0, Math.max(Math.min(0, sw - w * R.scale), R.tx));
  R.ty = Math.min(0, Math.max(Math.min(0, sh - h * R.scale), R.ty));
}
function zoomAt(cx, cy, ns){
  if(R.fitw) return;
  ns = Math.max(1, Math.min(5, ns));
  const k = ns / R.scale;
  R.tx = cx - (cx - R.tx) * k; R.ty = cy - (cy - R.ty) * k; R.scale = ns;
  if(ns === 1) R.tx = R.ty = 0;
  clampPan(); applyT();
}
