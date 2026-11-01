"use strict";
/* Turning book markup into pages */

/* =====================================================================
   Turning the markup into pages
   ===================================================================== */
function sanitize(body){
  body.querySelectorAll('script,iframe,object,embed,link,meta,style,form,input,button,base,title,head,audio,video,source,svg').forEach(e => e.remove());
  const drop = new Set(['style','color','bgcolor','face','size','width','height','background']);
  body.querySelectorAll('*').forEach(el => {
    for(const a of [...el.attributes]){
      const name = a.name.toLowerCase();
      if(name.startsWith('on') || drop.has(name)) el.removeAttribute(a.name);
    }
    if(el.tagName === 'A'){
      const h = (el.getAttribute('href') || '').trim();
      if(/^https?:|^mailto:/i.test(h)){ el.target = '_blank'; el.rel = 'noopener noreferrer'; }
      else if(!h.startsWith('#')) el.removeAttribute('href');
    }
    if(el.tagName === 'IMG' && el.hasAttribute('src')) el.removeAttribute('src');
  });
}

// Splits at page breaks. Image-only sections become one page per image (comics);
// everything else becomes scrollable text pages of a screenful or so.
function buildPages(body){
  const secs = [[]];
  for(const n of [...body.childNodes]){
    if(n.nodeType === 1 && n.matches('hr.pb')) secs.push([]); else secs[secs.length - 1].push(n);
  }
  const pages = [];
  for(const nodes of secs){
    const w = document.createElement('div');
    nodes.forEach(n => w.append(n));
    const imgs = [...w.querySelectorAll('img[data-rec]')];
    const text = w.textContent.replace(/\s+/g, '').length;
    if(imgs.length && text <= 30 * imgs.length){ imgs.forEach(i => pages.push({t:'img', rec:+i.dataset.rec})); continue; }
    if(!text && !imgs.length) continue;
    let chunk = document.createElement('div'), acc = 0;
    const flush = () => {
      if(acc > 0 || chunk.querySelector('img')) pages.push({t:'html', html: chunk.innerHTML});
      chunk = document.createElement('div'); acc = 0;
    };
    for(const n of [...w.childNodes]){
      const len = (n.textContent || '').length;
      if(acc > 0 && acc + len > 4000) flush();
      chunk.append(n); acc += len;
    }
    flush();
  }
  return pages;
}
