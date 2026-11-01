"use strict";
/* Shared helpers, app state, screen switching and the busy overlay */

const $ = id => document.getElementById(id);
const root = document.documentElement;
const store = {
  get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } },
  set(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
};
let current = null;      // the loaded book
let blobUrls = [];       // object URLs owned by the book/scroll screens

function setScreen(s){ document.body.dataset.screen = s; window.scrollTo(0,0); }
let busyT = 0;
function busy(text, frac){
  const b = $('busy');
  if(text == null){ clearTimeout(busyT); busyT = 0; b.hidden = true; return; }
  $('busyT').textContent = text;
  $('busyBar').hidden = frac == null;
  if(frac != null) $('busyB').style.width = Math.round(frac * 100) + '%';
  if(b.hidden && !busyT) busyT = setTimeout(() => { busyT = 0; b.hidden = false; }, 180);
}
