"use strict";
/* Page-flip sound (Web Audio, synthesized) */

/* =====================================================================
   Page-flip sound: synthesized with Web Audio (no audio files)
   ===================================================================== */
const Sfx = {
  ctx:null, buf:null, out:null, on: store.get('mobi:sfx') !== '0',
  init(){
    if(!this.ctx){
      const AC = window.AudioContext || window.webkitAudioContext; if(!AC) return null;
      try{ this.ctx = new AC(); }catch(e){ return null; }
      const c = this.ctx, n = c.sampleRate * 2, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
      let lp = 0;
      for(let i = 0; i < n; i++){ const w = Math.random() * 2 - 1; lp += (w - lp) * .35; d[i] = w * .55 + lp * .9; }
      this.buf = b;
      this.out = c.createGain(); this.out.gain.value = .9; this.out.connect(c.destination);
    }
    if(this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  },
  noise(t0, dur, o){
    const {type = 'bandpass', f0 = 2000, q = 1, gain = .3, att = .01, hp = 0} = o, f1 = o.f1 || f0;
    const c = this.ctx, src = c.createBufferSource(); src.buffer = this.buf; src.loop = true;
    const f = c.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(att, dur * .9)); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    src.connect(f); let node = f;
    if(hp){ const h = c.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = hp; f.connect(h); node = h; }
    node.connect(g); g.connect(this.out);
    src.start(t0, Math.random() * 1.5); src.stop(t0 + dur + .05);
  },
  thump(t0, vol){
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(150, t0); o.frequency.exponentialRampToValueAtTime(55, t0 + .12);
    g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(.35 * vol, t0 + .006); g.gain.exponentialRampToValueAtTime(.0001, t0 + .16);
    o.connect(g); g.connect(this.out); o.start(t0); o.stop(t0 + .2);
  },
  flip(dur = .6, vol = 1, soft = false){
    if(!this.on) return;
    const c = this.init(); if(!c || !this.buf) return;
    const t0 = c.currentTime + .005;
    this.noise(t0, dur * .95, {f0:900, f1:3800, q:.7, gain:.3 * vol, att:dur * .3, hp:300});          // air over paper, rising
    this.noise(t0 + dur * .2, dur * .7, {type:'highpass', f0:4200, f1:6500, q:.5, gain:.07 * vol, att:dur * .25});
    for(let i = 0; i < 9; i++)                                                                          // paper crackle
      this.noise(t0 + Math.random() * dur * .75, .012 + Math.random() * .02, {type:'highpass', f0:2500 + Math.random() * 3000, q:.8, gain:(.05 + Math.random() * .1) * vol, att:.002});
    if(!soft){                                                                                          // landing slap + soft thud
      const tl = t0 + dur * .9;
      this.noise(tl, .07, {f0:1800, f1:900, q:.9, gain:.28 * vol, att:.004, hp:200});
      this.thump(tl, vol);
    }
  }
};
addEventListener('pointerdown', () => Sfx.init(), {once:true, capture:true});
addEventListener('keydown', () => Sfx.init(), {once:true, capture:true});
