/* ============ PlayVerse App — router + boot ============ */
(function(){
'use strict';
const PV = window.PV, U = PV.u, t = PV.t;

const routes = [
  {re:/^#?\/?$/,              id:'home'},
  {re:/^#\/discover$/,        id:'discover'},
  {re:/^#\/game\/([\w-]+)/,   id:'detail'},
  {re:/^#\/auth$/,            id:'auth'},
  {re:/^#\/profile$/,         id:'profile'},
  {re:/^#\/friends$/,         id:'friends'},
  {re:/^#\/boards$/,          id:'boards'},
  {re:/^#\/achievements$/,    id:'ach'},
  {re:/^#\/rewards$/,         id:'rewards'},
  {re:/^#\/notifications$/,   id:'notifs'},
  {re:/^#\/settings$/,        id:'settings'},
  {re:/^#\/room$/,            id:'room'},
  {re:/^#\/room\/([A-Z0-9]+)/,id:'room'},
  {re:/^#\/join\/([A-Z0-9]+)/,id:'join'},
  {re:/^#\/play\/([\w-]+)/,   id:'play'},
  {re:/^#\/admin$/,           id:'admin'},
];

let currentRoute = '';
let renderToken = 0;

async function render(){
  const hash = location.hash || '#/';
  const view = document.getElementById('view');
  const token = ++renderToken;
  let matched = null, m = null;
  for(const r of routes){ m = hash.match(r.re); if(m){ matched = r; break; } }
  const id = matched?.id || 'home';
  currentRoute = hash;
  /* stale-match guard: navigating anywhere except the live match's own play
     route tears the match down (fixes old game DOM leaking into new pages) */
  const live = PV.sdk && PV.sdk.current;
  if(live){
    const sameRoute = matched?.id==='play' && m && m[1]===live.ctx.gameId;
    const launchingThis = matched?.id==='play' && m && PV.sdk.launching && m[1]===PV.sdk.launching;
    if(!sameRoute && !launchingThis) PV.sdk.destroy();
  }
  PV.router.current = hash;
  const screen = PV.screens[id] || PV.screens.home;
  view.innerHTML = `<div style="display:flex;justify-content:center;padding:60px 0"><div class="spinner" style="width:34px;height:34px"></div></div>`;
  try{ await screen.render(view, m, {token, isFresh:()=>token===renderToken}); }
  catch(e){ console.error('screen error', id, e); view.innerHTML = `<div class="empty"><span class="eic">${PV.visuals.icon('info',30)}</span><p>${t('c.retry')}</p></div>`; }
  /* page-in transition */
  view.classList.remove('page-in'); void view.offsetHeight; view.classList.add('page-in');
  PV.ui.renderNav();
  window.scrollTo({top:0});
}

PV.router = { render, refresh: render, current: currentRoute };

document.addEventListener('pv:net', ()=>{ /* net ready */ });

function boot(){
  /* session touch */
  const p = PV.store.me();
  if(p){
    const s = PV.store.touchStreak();
    if(s.isNew){ setTimeout(()=>PV.ui.toast(t('pf.streak')+': '+U.fmt(s.streak)+' 🔥','gold','fire'), 1400); }
  }
  /* cloud probe (non-blocking) */
  PV.cloud.ensure().then(ok=>{ if(ok){ PV.cloud.syncNow(); PV.cloud.getAnnounce().then(a=>{ if(a) PV.ui.notify('sys', a.txt); }); } });
  /* render */
  PV.router.render();
  window.addEventListener('hashchange', ()=>PV.router.render());
  /* splash off */
  setTimeout(()=>{ document.getElementById('splash').classList.add('off'); }, 700);
  /* unlock audio on first touch */
  const unlock = ()=>{ PV.sound.unlock(); document.removeEventListener('pointerdown', unlock); };
  document.addEventListener('pointerdown', unlock);
  /* periodic cloud sync while logged in */
  setInterval(()=>{ if(PV.store.session && !PV.store.isGuest()) PV.cloud.syncNow(); }, 60000);
  /* notifications event refresh */
  document.addEventListener('pv:notif', ()=>PV.ui.renderNav());
  /* language/theme re-render */
  document.addEventListener('pv:relang', ()=>PV.router.render());
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
})();
