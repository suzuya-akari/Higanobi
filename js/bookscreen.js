"use strict";
/* Book screen (cover, double-click to read) */

/* =====================================================================
   Book screen: double-click the first page to read
   ===================================================================== */
function showBookScreen(){
  const f = $('first'); f.replaceChildren();
  if(current.coverUrl){
    const im = document.createElement('img'); im.src = current.coverUrl; im.alt = 'First page'; f.append(im);
  } else {
    const c = document.createElement('div'); c.className = 'titlecard';
    const b = document.createElement('b'); b.textContent = current.title; c.append(b);
    if(current.author){ const s = document.createElement('span'); s.textContent = current.author; c.append(s); }
    f.append(c);
  }
  $('bsTitle').textContent = current.title;
  $('bsBy').textContent = current.author;
  $('hdrTitle').textContent = current.title;
  document.title = current.title + ' · Higanobi';
  $('scrollBtn').hidden = current.isComic;
  const touch = matchMedia('(pointer: coarse)').matches;
  $('bsHint').textContent = (touch ? 'Double-tap' : 'Double-click') + ' the first page to start reading.';
  $('tocBtn').hidden = true;
  $('bsSaved').textContent = '';
  setScreen('book');
}

let lastFirstTap = 0;
$('first').addEventListener('pointerup', e => {
  if(e.pointerType === 'mouse' && e.button !== 0) return;
  const now = performance.now();
  if(now - lastFirstTap < 400){ lastFirstTap = 0; startReading(); } else lastFirstTap = now;
});
$('first').addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); startReading(); } });
$('readBtn').onclick = () => startReading();
$('scrollBtn').onclick = () => enterScroll();
