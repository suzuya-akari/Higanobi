"use strict";
/* Real-book 3D page-flip engine */

/* ---- real-book page flip: a rigid leaf hinged on the spine, rotating in 3D with live shading ---- */
const easeIO  = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const easeOut = x => 1 - Math.pow(1 - x, 3);
const sgn = () => R.rtl ? -1 : 1;               // 1 = left-to-right book, -1 = right-to-left (manga)
const side = () => R.rtl ? 1 : -1;              // screen direction of a forward swipe
function mk(cls, css){ const d = document.createElement('div'); d.className = cls; if(css) d.style.cssText = css; return d; }
function flipView(vi, W, shift, clip){
  const v = buildView(vi);
  v.style.width = W + 'px'; v.style.left = shift + 'px';
  if(clip) v.style.clipPath = clip;
  return v;
}
function setupTurn(nv){
  const fwd = nv > R.v, old = R.view;
  const fi = fwd ? R.v : nv, ti = fwd ? nv : R.v;      // the flip always runs forward fi -> ti
  const W = stage.clientWidth, H = stage.clientHeight, s = sgn(), half = W / 2, P = Math.max(2200, W * 3);
  const spine = R.views[fi].length > 1 && R.views[ti].length > 1;
  const scene = mk('flip', 'top:' + stage.scrollTop + 'px;height:' + H + 'px;perspective:' + P + 'px');
  const leaf = mk('leaf'), front = mk('face'), back = mk('face back');
  const t = {nv, fwd, old, scene, leaf, spine, W, s, P, p:0, dir:''};
  if(spine){
    const startR = s === 1;                              // leaf starts on the right half in a left-to-right book
    leaf.style.cssText = 'left:' + (startR ? half : 0) + 'px;width:' + half + 'px;transform-origin:' + (startR ? '0' : '100%') + ' 50%';
    scene.append(flipView(ti, W, 0, startR ? 'inset(0 0 0 50%)' : 'inset(0 50% 0 0)'),   // revealed page
                 flipView(fi, W, 0, startR ? 'inset(0 50% 0 0)' : 'inset(0 0 0 50%)'));  // page the leaf lands on
    front.append(flipView(fi, W, startR ? -half : 0));
    back.append(flipView(ti, W, startR ? 0 : -half));
    scene.append(mk('gutter'));
  } else {                                               // single page: hinged on the outer edge
    leaf.style.cssText = 'left:0;width:' + W + 'px;transform-origin:' + (s === 1 ? '0' : '100%') + ' 50%';
    scene.append(flipView(ti, W, 0));
    front.append(flipView(fi, W, 0));
    back.style.background = '#0d0a12';
  }
  t.fs = mk('shade'); t.bs = mk('shade'); t.fh = mk('sheen'); t.bh = mk('sheen');
  front.append(t.fh, t.fs); back.append(t.bh, t.bs);
  leaf.append(front, back);
  t.cast = mk('cast');
  scene.append(t.cast, leaf);
  stage.append(scene);
  old.style.visibility = 'hidden';
  R.turn = t; paint(t, 0);
  return t;
}
function paint(t, p){                           // p: 0 = old page showing, 1 = new page showing
  t.p = p;
  const q = t.fwd ? p : 1 - p;                  // q: how far the leaf has turned (0 = flat on the right, 1 = landed)
  const th = q * Math.PI, c = Math.cos(th), sn = Math.sin(th), W = t.W, s = t.s, half = W / 2;
  t.leaf.style.transform = 'rotateY(' + (-s * 180 * q).toFixed(2) + 'deg)';
  t.fs.style.opacity = (.16 * q).toFixed(3);
  t.bs.style.opacity = (.16 * (1 - q)).toFixed(3);
  t.fh.style.opacity = t.bh.style.opacity = (.22 * sn).toFixed(3);
  // cast shadow along the leaf's free edge, projected through the same perspective as the leaf
  const x0 = t.spine ? half + s * half * c : (s === 1 ? W * c : W - W * c);
  const z = (t.spine ? half : W) * sn;
  const edge = half + (x0 - half) * t.P / (t.P - z);
  const w = W * (t.spine ? .06 : .08) * sn;
  const right = t.spine ? ((s === 1) === (q < .5)) : (s === 1);
  const k = t.cast.style;
  k.opacity = (t.spine ? Math.min(1, sn * 1.5) : Math.pow(Math.max(0, c), .5)).toFixed(3);
  k.width = w.toFixed(1) + 'px';
  k.left = (right ? edge : edge - w).toFixed(1) + 'px';
  const dir = right ? 'to right' : 'to left';
  if(t.dir !== dir){ t.dir = dir; k.background = 'linear-gradient(' + dir + ',rgba(0,0,0,.22),rgba(0,0,0,0))'; }
}
function endTurn(t, commit){
  t.scene.remove(); t.old.style.visibility = ''; R.turn = null;
  if(commit){ R.v = t.nv; render(); }
}
function abortTurn(t){ t.scene.remove(); t.old.style.visibility = ''; R.turn = null; }
function settle(t, to, dur, ease){
  ease = ease || easeOut;
  const from = t.p, t0 = performance.now();
  let done = false, raf = 0;
  const finish = () => { if(done) return; done = true; cancelAnimationFrame(raf); R.run = null; endTurn(t, to === 1); };
  const frame = now => {
    if(done) return;
    const k = Math.min(1, (now - t0) / dur);
    paint(t, from + (to - from) * ease(k));
    if(k < 1) raf = requestAnimationFrame(frame); else finish();
  };
  R.run = {finish};
  raf = requestAnimationFrame(frame);
}
