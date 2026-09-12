/* ============ PlayVerse Utilities ============ */
(function(){
'use strict';
const PV = window.PV = window.PV || {};

const esc = s => String(s??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];

function el(html){ const d=document.createElement('div'); d.innerHTML=html.trim(); return d.firstElementChild; }

const uid = (n=8)=> Array.from(crypto.getRandomValues(new Uint8Array(n))).map(b=>'abcdefghijklmnopqrstuvwxyz0123456789'[b%36]).join('');
const code = (n=5)=>{ const A='ABCDEFGHJKMNPQRSTUVWXYZ23456789'; const a=Array.from(crypto.getRandomValues(new Uint8Array(n))); return Array.from(a,b=>A[b%A.length]).join(''); };

function mulberry32(seed){ let a=seed>>>0; return function(){ a|=0; a=(a+0x6D2B79F5)|0; let t=Math.imul(a^(a>>>15),1|a); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }; }
function hashStr(s){ let h=2166136261; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619);} return h>>>0; }
function shuffle(arr, rng=Math.random){ const a=[...arr]; for(let i=a.length-1;i>0;i--){ const j=Math.floor(rng()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }

async function sha256hex(str){
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
const randomSalt = ()=> uid(6);

function fmt(n){ try{ return Number(n||0).toLocaleString('fa'); }catch(e){ return String(n); } }
function fmtEn(n){ return Number(n||0).toLocaleString('en-US'); }
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

function todayKey(){
  try{ return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran'}).format(new Date()); }
  catch(e){ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
}
function isNight(){ const h = new Date().getHours(); return h>=0 && h<5; }
function timeAgo(ts){
  const s = Math.max(1,(Date.now()-ts)/1000);
  if(s<60) return t('c.loading').includes('…') ? 'همین حالا' : 'now';
  const m=s/60; if(m<60) return fmt(Math.floor(m))+' دقیقه پیش';
  const h=m/60; if(h<24) return fmt(Math.floor(h))+' ساعت پیش';
  const d=h/24; if(d<30) return fmt(Math.floor(d))+' روز پیش';
  return new Date(ts).toLocaleDateString('fa-IR');
}
function debounce(fn, ms){ let to; return (...a)=>{ clearTimeout(to); to=setTimeout(()=>fn(...a), ms); }; }

async function copyText(txt){
  try{ await navigator.clipboard.writeText(txt); return true; }
  catch(e){
    try{ const ta=document.createElement('textarea'); ta.value=txt; ta.style.cssText='position:fixed;opacity:0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); return true; }catch(e2){ return false; }
  }
}
function vibrate(ms=18){ try{ navigator.vibrate && navigator.vibrate(ms); }catch(e){} }

const LS = {
  get(k, def){ try{ const v=localStorage.getItem('pv:'+k); return v==null?def:JSON.parse(v); }catch(e){ return def; } },
  set(k, v){ try{ localStorage.setItem('pv:'+k, JSON.stringify(v)); }catch(e){} },
  del(k){ try{ localStorage.removeItem('pv:'+k); }catch(e){} }
};

/* XP / Level / Rank math */
const xpForLevel = l => Math.round(80 * Math.pow(l, 1.35));
function levelFromXp(xp){
  let l=1, need=xpForLevel(1), acc=0;
  while(xp >= acc+need && l<99){ acc+=need; l++; need=xpForLevel(l); }
  return {level:l, into:Math.round(xp-acc), need, pct:Math.min(100, Math.round((xp-acc)/need*100))};
}
function elo(a, b, sA, K=32){
  const eA = 1/(1+Math.pow(10,(b-a)/400));
  return Math.round(a + K*(sA-eA));
}
function tierOf(rating){
  if(rating>=1900) return 'tier.master';
  if(rating>=1700) return 'tier.diamond';
  if(rating>=1500) return 'tier.plat';
  if(rating>=1350) return 'tier.gold1';
  if(rating>=1200) return 'tier.gold3';
  if(rating>=1100) return 'tier.silver3';
  if(rating>=1000) return 'tier.silver2';
  if(rating>=925)  return 'tier.silver1';
  if(rating>=850)  return 'tier.bronze3';
  if(rating>=775)  return 'tier.bronze2';
  return 'tier.bronze1';
}

function matchXp({won, draw, base=20, mode='classic', perf=0}){
  const mult = {classic:1, ranked:1.25, casual:.8, quick:1.1, tournament:1.5}[mode] ?? 1;
  let xp = base + Math.round(perf);
  if(won) xp += 30; if(draw) xp += 12;
  return Math.max(5, Math.round(xp*mult));
}
function matchCoins(won){ return won?15:5; }

const sleep = ms => new Promise(r=>setTimeout(r, ms));

PV.u = { esc, $, $$, el, uid, code, mulberry32, hashStr, shuffle, sha256hex, randomSalt, fmt, fmtEn, clamp, todayKey, isNight, timeAgo, debounce, copyText, vibrate, LS, xpForLevel, levelFromXp, elo, tierOf, matchXp, matchCoins, sleep };
})();
