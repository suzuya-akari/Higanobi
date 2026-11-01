"use strict";
/* Navigation, file input, drag and drop, cover tilt, startup */

/* =====================================================================
   Navigation, file input, drag & drop
   ===================================================================== */
const input = $('file');
$('openBtn').onclick = $('openBtn2').onclick = $('libAdd').onclick = () => input.click();
input.onchange = () => { const fs = [...input.files]; input.value = ''; handleFiles(fs); };
$('libBtn').onclick = $('libBtn2').onclick = () => showLibrary();
$('libMenu').onclick = () => { $('msg').textContent = ''; updateResume(); setScreen('menu'); };
$('homeBtn').onclick = () => { $('msg').textContent = ''; updateResume(); setScreen('menu'); };
$('resume').onclick = () => { if(current) showBookScreen(); };
['dragenter','dragover'].forEach(t => addEventListener(t, e => { e.preventDefault(); document.body.classList.add('drag'); }));
['dragleave','drop'].forEach(t => addEventListener(t, e => { e.preventDefault(); document.body.classList.remove('drag'); }));
addEventListener('drop', e => { handleFiles([...e.dataTransfer.files]); });

/* =====================================================================
   Ambient polish: cover tilt
   ===================================================================== */
(function(){
  const bs = $('bookscreen'), first = $('first');
  bs.addEventListener('pointermove', e => {
    if(e.pointerType !== 'mouse' || reduced()) return;
    const r = first.getBoundingClientRect();
    const nx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (innerWidth / 2)));
    const ny = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (innerHeight / 2)));
    first.style.setProperty('--ry', (nx * 10).toFixed(1) + 'deg'); first.style.setProperty('--rx', (-ny * 8).toFixed(1) + 'deg');
  });
  bs.addEventListener('pointerleave', () => { first.style.removeProperty('--ry'); first.style.removeProperty('--rx'); });
})();

applySettings();
refreshLibCount();
