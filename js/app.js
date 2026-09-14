/* ============ PlayVerse App — router + boot + navbar account menu ============ */
(function(){
'use strict';
const PV = window.PV, U = PV.u, t = PV.t;
const { esc, icon, fmt, el, levelFromXp } = U;

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

/* =========================================================================
   NAVBAR ACCOUNT SYSTEM (task 3-g)
   • Logged-in  → user chip (avatar + name + level) with dropdown:
       پروفایل / تنظیمات / اعلان‌ها / [مدیریت — only for admins] /
       red prominent «خروج از حساب» (confirm → store.logout + sapi token reset)
   • Guest      → primary «ورود / ثبت‌نام» button
   The base navbar markup comes from PV.ui.renderNav(); this layer upgrades it.
   ========================================================================= */

/* runtime-injected styles for the chip + menu (kept OUT of css/ files) */
const NAV_CSS = `
.pv-uwrap{position:relative;display:inline-flex}
.pv-uchip{display:flex;align-items:center;gap:8px;padding:3px 11px 3px 4px;border-radius:999px;background:var(--surface2);border:1.5px solid var(--border);cursor:pointer;transition:border-color .2s,box-shadow .2s,transform .2s;max-width:220px}
[dir="ltr"] .pv-uchip{padding:3px 4px 3px 11px}
.pv-uchip:hover{border-color:var(--p1);box-shadow:var(--glow-p);transform:translateY(-1px)}
.pv-uchip.open{border-color:var(--p1);box-shadow:var(--glow-p)}
.pv-uchip .nm{font-weight:800;font-size:.85rem;max-width:96px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pv-uchip .lv{min-width:22px;height:19px;padding:0 6px;border-radius:99px;background:var(--grad-gold);color:#fff;font-size:.66rem;font-weight:900;display:flex;align-items:center;justify-content:center}
.pv-uchip .chev{color:var(--tx2);display:flex;transition:transform .25s}
.pv-uchip.open .chev{transform:rotate(180deg)}
.pv-umenu{position:absolute;top:calc(100% + 12px);inset-inline-end:0;width:min(320px,92vw);z-index:130;background:var(--surface);border:1.5px solid var(--border2);border-radius:20px;box-shadow:var(--sh-3);overflow:hidden;transform-origin:top;animation:pvMenuIn .3s cubic-bezier(.2,.9,.3,1.25)}
@keyframes pvMenuIn{from{opacity:0;transform:translateY(-12px) scale(.95)}to{opacity:1;transform:none}}
.pv-um-head{display:flex;align-items:center;gap:11px;padding:15px 16px;background:linear-gradient(135deg,rgba(124,92,255,.13),rgba(0,201,189,.09));border-bottom:1.5px solid var(--border)}
.pv-um-head .pvi{flex:1;min-width:0}
.pv-um-head .pvi b{display:block;font-size:.95rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pv-lvlchip{flex-shrink:0;padding:4px 10px;border-radius:99px;background:var(--grad-gold);color:#fff;font-size:.7rem;font-weight:900;white-space:nowrap}
.pv-um-it{display:flex;align-items:center;gap:12px;padding:11px 15px;font-weight:700;font-size:.9rem;color:var(--tx);transition:background .15s,color .15s;cursor:pointer}
.pv-um-it:hover{background:rgba(124,92,255,.09);color:var(--p1)}
.pv-um-it .ic{width:34px;height:34px;border-radius:11px;background:var(--surface3);color:var(--p1);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.pv-um-dot{width:9px;height:9px;border-radius:50%;background:var(--err);margin-inline-start:auto;animation:pulse 1.6s infinite}
.pv-um-sep{height:1.5px;background:var(--border);margin:5px 0}
.pv-um-out{width:100%;display:flex;align-items:center;gap:12px;padding:13px 15px;background:rgba(239,68,103,.07);color:var(--err);font-weight:800;font-size:.92rem;transition:background .15s;text-align:start}
.pv-um-out:hover{background:rgba(239,68,103,.17)}
.pv-um-out .ic{width:34px;height:34px;border-radius:11px;background:rgba(239,68,103,.13);display:flex;align-items:center;justify-content:center;flex-shrink:0}
@media(max-width:600px){
  .pv-umenu{position:fixed;top:calc(var(--nav-h) + 8px);inset-inline:10px;width:auto}
  .pv-uchip .nm{display:none}
  .pv-uchip{padding:3px}
}
`;
function injectNavCss(){
  if(document.getElementById('pv-navcss')) return;
  const s = document.createElement('style');
  s.id = 'pv-navcss'; s.textContent = NAV_CSS;
  document.head.appendChild(s);
}

/* same admin gate as js/screens/admin.js → isAdminUser() */
function isAdminUser(){
  const p = PV.store.me();
  return !!(p && !PV.store.isGuest() && (p.svAdmin || p.u==='mrshash'));
}

function closeUserMenu(){
  const m = document.querySelector('.pv-umenu');
  if(m) m.remove();
  const c = document.querySelector('.pv-uchip');
  if(c) c.classList.remove('open');
}

/* full logout: confirm → reset server session (sapi token + WS) + local
   session (PV.store keeps no other auth state; PV.cloud keeps none) → #/auth */
async function logoutFlow(){
  if(!await PV.ui.confirmDlg(t('nav.logout')+'؟', t('nav.logoutFull'))) return;
  try{ PV.sapi && PV.sapi.logoutSapi && PV.sapi.logoutSapi(); }catch(e){}
  PV.store.logout();
  closeUserMenu();
  PV.ui.toast(t('au.bye'),'ok','check');
  if(location.hash === '#/auth') PV.router.render();
  else location.hash = '#/auth';
}
PV.logoutFlow = logoutFlow;

function userMenuHtml(p){
  const unread = PV.ui.hasUnread();
  return `
  <div class="pv-um-head">
    ${PV.ui.avatarHtml(p, 46)}
    <div class="pvi"><b>${esc(p.name)}</b><span class="tiny muted" dir="ltr">@${esc(p.u)}</span></div>
    <span class="pv-lvlchip">${t('c.lvl')} ${fmt(levelFromXp(p.xp).level)}</span>
  </div>
  <a class="pv-um-it" href="#/profile"><span class="ic">${icon('user',17)}</span><span>${t('nav.prof')}</span></a>
  <a class="pv-um-it" href="#/settings"><span class="ic">${icon('gear',17)}</span><span>${t('nav.settings')}</span></a>
  <a class="pv-um-it" href="#/notifications"><span class="ic">${icon('bell',17)}</span><span>${t('nav.notif')}</span>${unread?'<i class="pv-um-dot"></i>':''}</a>
  ${isAdminUser()?`<a class="pv-um-it" href="#/admin"><span class="ic">${icon('shield',17)}</span><span>${t('nav.admin')}</span></a>`:''}
  <div class="pv-um-sep"></div>
  <button class="pv-um-out" id="pvOutBtn"><span class="ic">${icon('logout',17)}</span><span>${t('nav.logoutFull')}</span></button>`;
}

function enhanceNav(){
  const nb = document.getElementById('navbar');
  if(!nb) return;
  const right = nb.querySelector('.nav-right');
  if(!right) return;
  const p = PV.store.me();
  if(!p){
    closeUserMenu();
    /* guest → prominent primary CTA «ورود / ثبت‌نام» */
    const a = right.querySelector('a.btn[href="#/auth"]');
    if(a){ a.classList.add('pink'); a.innerHTML = `${icon('user',15)} <span>${t('nav.loginUp')}</span>`; }
    return;
  }
  if(nb.querySelector('.pv-uchip')) return;             /* already enhanced */
  const old = right.querySelector('a.avbtn[href="#/profile"]');
  if(!old) return;
  const lv = levelFromXp(p.xp).level;
  const wrap = el(`<span class="pv-uwrap">
    <button class="pv-uchip" id="pvUserBtn" aria-haspopup="true" title="${t('nav.account')}">
      ${PV.ui.avatarHtml(p, 32, {dot:true})}
      <span class="nm">${esc(p.name)}</span>
      <span class="lv">${fmt(lv)}</span>
      <span class="chev">${icon('down',15)}</span>
    </button></span>`);
  old.replaceWith(wrap);
  const chip = wrap.querySelector('#pvUserBtn');
  chip.addEventListener('click', (e)=>{
    e.stopPropagation();
    if(wrap.querySelector('.pv-umenu')){ closeUserMenu(); return; }
    closeUserMenu();
    const menu = el(`<div class="pv-umenu">${userMenuHtml(p)}</div>`);
    wrap.appendChild(menu);
    chip.classList.add('open');
    menu.querySelector('#pvOutBtn').addEventListener('click', (ev)=>{ ev.stopPropagation(); logoutFlow(); });
    menu.querySelectorAll('a.pv-um-it').forEach(a=>a.addEventListener('click', ()=>closeUserMenu()));
    setTimeout(()=>{
      const cleanup = ()=>{ document.removeEventListener('click', closer); document.removeEventListener('keydown', escaper); };
      const closer = (ev)=>{ if(!menu.contains(ev.target) && !chip.contains(ev.target)){ closeUserMenu(); cleanup(); } };
      const escaper = (ev)=>{ if(ev.key==='Escape'){ closeUserMenu(); cleanup(); } };
      document.addEventListener('click', closer);
      document.addEventListener('keydown', escaper);
    }, 10);
  });
}

/* wrap the base renderer (immediate upgrade) + observer safety-net for
   internal ui.js renderNav calls (e.g. bell "mark all read") */
const _renderNav = PV.ui.renderNav.bind(PV.ui);
PV.ui.renderNav = function(){
  _renderNav();
  try{ enhanceNav(); }catch(e){ console.error('nav enhance', e); }
  /* v5 regression fix: index.html ships #navbar/#bottomnav with class="hidden"
     (anti-flash) but nothing ever removed it → the whole navbar stayed
     display:none. Unhide both after every render. */
  const nb = document.getElementById('navbar');   if(nb) nb.classList.remove('hidden');
  const bn = document.getElementById('bottomnav'); if(bn) bn.classList.remove('hidden');
};
document.addEventListener('DOMContentLoaded', ()=>{
  injectNavCss();
  const nb = document.getElementById('navbar');
  if(nb && 'MutationObserver' in window){
    const obs = new MutationObserver(U.debounce(()=>{
      if(PV.store.me()){
        if(!document.querySelector('.pv-uchip')){ try{ enhanceNav(); }catch(e){} }
      } else closeUserMenu();
    }, 60));
    obs.observe(nb, {childList:true});
  }
});

document.addEventListener('pv:net', ()=>{ /* net ready */ });

function boot(){
  injectNavCss();
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
