"use strict";
/* Reader input: touch / mouse gestures, wheel, keyboard */

/* ---- touch / mouse gestures ---- */
const ptrs = new Map();
let g = {}, lastTap = null, tapT = null;
stage.addEventListener('pointerdown', e => {
  if(e.pointerType === 'mouse' && e.button !== 0) return;
  ptrs.set(e.pointerId, {x:e.clientX, y:e.clientY});
  if(ptrs.size === 1){
    if(R.run) R.run.finish();
    g = {x0:e.clientX, y0:e.clientY, t0:performance.now(), moved:false, tx0:R.tx, ty0:R.ty, pinch:false, drag:null, noDrag:false, lx:e.clientX, lt:performance.now(), vx:0};
    if(!e.target.closest('.txt')) try{ stage.setPointerCapture(e.pointerId); }catch(_){}
  } else if(ptrs.size === 2){
    const [a, b] = [...ptrs.values()];
    if(g.drag){ const t = g.drag; g.drag = null; if(t.edge) t.old.style.transform = ''; else abortTurn(t); }
    g.pinch = true; g.moved = true; g.d0 = Math.hypot(a.x - b.x, a.y - b.y) || 1;
  }
});
stage.addEventListener('pointermove', e => {
  const p = ptrs.get(e.pointerId); if(!p) return;
  p.x = e.clientX; p.y = e.clientY;
  if(ptrs.size === 2 && g.pinch){
    const [a, b] = [...ptrs.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    const target = Math.max(1, Math.min(5, R.scale * d / g.d0));
    g.d0 = d;
    zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, target);
  } else if(ptrs.size === 1){
    const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    if(Math.hypot(dx, dy) > 10) g.moved = true;
    if(R.scale > 1){ R.tx = g.tx0 + dx; R.ty = g.ty0 + dy; clampPan(); applyT(); }
    else if(animOn()){
      const now = performance.now();
      if(now - g.lt > 0){ g.vx = .6 * g.vx + .4 * (e.clientX - g.lx) / (now - g.lt); g.lx = e.clientX; g.lt = now; }
      if(!g.drag && !g.noDrag){
        if(Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.2) startDrag(e, dx);
        else if(Math.abs(dy) > 12) g.noDrag = true;
      }
      if(g.drag) moveDrag(dx);
    }
  }
});
function startDrag(e, dx){
  try{ stage.setPointerCapture(e.pointerId); }catch(_){}
  try{ getSelection().removeAllRanges(); }catch(_){}
  const sign = dx > 0 ? 1 : -1, fwd = dx * side() > 0, nv = R.v + (fwd ? 1 : -1);
  if(nv < 0 || nv >= R.views.length){ g.drag = {edge:true, old:R.view, sign, p:0, fwd}; return; }
  g.drag = Object.assign(setupTurn(nv), {sign});
}
function moveDrag(dx){
  const t = g.drag, W = stage.clientWidth || 1;
  if(t.edge){
    const r = Math.max(0, dx * t.sign);
    t.old.style.transform = 'translateX(' + (t.sign * Math.min(70, Math.sqrt(r) * 5)) + 'px)';
    return;
  }
  paint(t, Math.max(0, Math.min(1, dx * t.sign / (W * .85))));
}
function endDrag(cancelled){
  const t = g.drag; g.drag = null;
  if(t.edge){
    t.old.style.transition = 'transform .45s cubic-bezier(.3,1.6,.5,1)'; t.old.style.transform = '';
    setTimeout(() => { if(t.old.style.transition) t.old.style.transition = ''; }, 480);
    if(!cancelled) toast(t.fwd ? 'End of book' : 'First page');
    return;
  }
  R.turn = t;
  const commit = !cancelled && (t.p > .3 || (g.vx * t.sign > .45 && t.p > .03));
  const dur = Math.round(220 + (commit ? 1 - t.p : t.p) * 380);
  if(commit) Sfx.flip(dur / 1000); else if(t.p > .08) Sfx.flip(dur / 1000, .3, true);
  settle(t, commit ? 1 : 0, dur);
}
function endPointer(e, cancelled){
  if(!ptrs.delete(e.pointerId)) return;
  if(g.pinch){ if(!ptrs.size) g.pinch = false; return; }
  if(ptrs.size) return;
  if(g.drag){ endDrag(cancelled); return; }
  if(cancelled) return;
  const dx = e.clientX - g.x0, dy = e.clientY - g.y0, dt = performance.now() - g.t0;
  if(R.scale === 1 && innerWidth > innerHeight && Math.abs(dy) > 60 && Math.abs(dy) > Math.abs(dx) * 1.5 && dt < 900){
    if(dy > 0){ showChrome(true); scheduleHide(5000); } else { showChrome(false); clearTimeout(R.hideT); }
    return;
  }
  if(R.scale === 1 && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < 800){
    step((dx < 0 ? 1 : -1) * (R.rtl ? -1 : 1));
  } else if(!g.moved && dt < 500){
    tap(e.clientX, e.clientY);
  }
}
stage.addEventListener('pointerup', e => endPointer(e, false));
stage.addEventListener('pointercancel', e => endPointer(e, true));

function tap(x, y){
  const now = performance.now();
  if(lastTap && now - lastTap.t < 300 && Math.hypot(x - lastTap.x, y - lastTap.y) < 30){
    clearTimeout(tapT); lastTap = null;
    zoomAt(x, y, R.scale > 1 ? 1 : 2.5);
    return;
  }
  lastTap = {t:now, x, y};
  tapT = setTimeout(() => { lastTap = null; singleTap(x); }, 260);
}
function singleTap(x){
  if(R.scale > 1){ toggleChrome(); return; }
  const w = stage.clientWidth;
  if(x < w * 0.33) step(R.rtl ? 1 : -1);
  else if(x > w * 0.67) step(R.rtl ? -1 : 1);
  else toggleChrome();
}

let wheelAt = 0;
stage.addEventListener('wheel', e => {
  if(e.ctrlKey){ e.preventDefault(); zoomAt(e.clientX, e.clientY, R.scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15)); return; }
  if(R.scale > 1){ e.preventDefault(); R.tx -= e.deltaX; R.ty -= e.deltaY; clampPan(); applyT(); return; }
  if(R.fitw || e.target.closest('.txt')) return;
  e.preventDefault();
  const now = performance.now();
  if(now - wheelAt < 280 || Math.abs(e.deltaY) < 4) return;
  wheelAt = now; step(e.deltaY > 0 ? 1 : -1);
}, {passive:false});

document.addEventListener('keydown', e => {
  if(!R.open) return;
  if(e.target.matches('input[type="range"]') && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return;
  const k = e.key;
  if(k === 'ArrowRight'){ step(R.rtl ? -1 : 1); }
  else if(k === 'ArrowLeft'){ step(R.rtl ? 1 : -1); }
  else if(k === 'PageDown' || (k === ' ' && !e.shiftKey)){ e.preventDefault(); step(1); }
  else if(k === 'PageUp' || (k === ' ' && e.shiftKey)){ e.preventDefault(); step(-1); }
  else if(k === 'Home'){ show(0, true); }
  else if(k === 'End'){ show(R.views.length - 1, true); }
  else if(k === 'f' || k === 'F'){ fsElement() ? exitFullscreen() : enterFullscreen(); }
  else if(k === 'Escape'){ if(!fsElement()) closeReader(); }
  else return;
});
