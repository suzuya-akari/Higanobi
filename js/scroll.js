"use strict";
/* Scroll mode for text books */

/* =====================================================================
   Scroll mode (text books)
   ===================================================================== */
function buildToc(bookEl){
  const toc = $('toc'); toc.replaceChildren();
  const heads = [...bookEl.querySelectorAll('h1,h2,h3')].filter(h => h.textContent.trim());
  heads.forEach((h, i) => {
    h.id = h.id || 'toc-' + i;
    const a = document.createElement('a');
    a.href = '#' + h.id; a.className = 'l' + h.tagName[1];
    a.textContent = h.textContent.trim().replace(/\s+/g, ' ').slice(0, 120);
    toc.append(a);
  });
  if(!heads.length){ const d = document.createElement('div'); d.className = 'none'; d.textContent = 'This book has no headings to list.'; toc.append(d); }
  $('tocBtn').hidden = false;
}
function enterScroll(){
  if(!current) return;
  const bookEl = $('book');
  if(!current.scrollBuilt){
    bookEl.innerHTML = current.bodyHTML;
    bookEl.querySelectorAll('img[data-rec]').forEach(img => {
      const blob = current.image(+img.dataset.rec - 1);
      if(blob){ img.src = mkUrl(blob); img.loading = 'lazy'; } else img.remove();
    });
    const head = $('head'); head.replaceChildren();
    if(current.coverUrl){ const im = document.createElement('img'); im.src = current.coverUrl; im.alt = 'Cover'; head.append(im); }
    const t = document.createElement('div');
    const h = document.createElement('h2'); h.textContent = current.title; t.append(h);
    if(current.author){ const p = document.createElement('p'); p.className = 'by'; p.textContent = current.author; t.append(p); }
    head.append(t);
    buildToc(bookEl);
    current.scrollBuilt = true;
  }
  $('tocBtn').hidden = false;
  setScreen('scroll');
  const saved = parseFloat(store.get('mobi:pos:' + current.key));
  if(saved > 0) setTimeout(() => window.scrollTo(0, saved * (document.documentElement.scrollHeight - innerHeight)), 150);
}
document.addEventListener('click', e => {
  const a = e.target.closest('#book a[href^="#"], #toc a');
  if(!a) return;
  e.preventDefault();
  const el = document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)));
  if(el) el.scrollIntoView();
  if(a.closest('#toc')){ $('toc').classList.remove('open'); $('tocBtn').setAttribute('aria-expanded', 'false'); }
});
let ticking = false;
addEventListener('scroll', () => {
  if(ticking || document.body.dataset.screen !== 'scroll') return; ticking = true;
  requestAnimationFrame(() => {
    const max = document.documentElement.scrollHeight - innerHeight;
    const f = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
    $('progress').style.width = (f * 100) + '%';
    if(current) store.set('mobi:pos:' + current.key, f.toFixed(4));
    ticking = false;
  });
}, {passive:true});
