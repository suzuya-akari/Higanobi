"use strict";
/* Text settings used by scroll mode */

/* =====================================================================
   Text settings (scroll mode)
   ===================================================================== */
function applySettings(){
  const theme = store.get('mobi:theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'paper');
  const font  = store.get('mobi:font') || 'serif';
  const size  = +(store.get('mobi:size') || 19);
  if(theme === 'paper') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', theme);
  root.setAttribute('data-font', font);
  root.style.setProperty('--fs', size + 'px');
  $('size').value = size;
  document.querySelectorAll('#themeSeg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === theme));
  document.querySelectorAll('#fontSeg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === font));
}
$('size').addEventListener('input', e => { store.set('mobi:size', e.target.value); applySettings(); });
$('themeSeg').addEventListener('click', e => { const b = e.target.closest('button'); if(b){ store.set('mobi:theme', b.dataset.v); applySettings(); } });
$('fontSeg').addEventListener('click', e => { const b = e.target.closest('button'); if(b){ store.set('mobi:font', b.dataset.v); applySettings(); } });

function togglePanel(panel, btn, other, otherBtn){
  const open = !panel.classList.contains('open');
  other.classList.remove('open'); otherBtn.setAttribute('aria-expanded','false');
  panel.classList.toggle('open', open); btn.setAttribute('aria-expanded', open);
}
$('tocBtn').onclick = () => togglePanel($('toc'), $('tocBtn'), $('settings'), $('setBtn'));
$('setBtn').onclick = () => togglePanel($('settings'), $('setBtn'), $('toc'), $('tocBtn'));
document.addEventListener('click', e => {
  if(!e.target.closest('#toc,#settings,#tocBtn,#setBtn')){
    $('toc').classList.remove('open'); $('settings').classList.remove('open');
    $('tocBtn').setAttribute('aria-expanded','false'); $('setBtn').setAttribute('aria-expanded','false');
  }
});
