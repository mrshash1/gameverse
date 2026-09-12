/* ============ Screen: Auth (login / register / guest) ============ */
(function(){
'use strict';
const PV = window.PV, U = PV.u, t = PV.t, V = PV.visuals;
const { esc, icon } = U;

async function render(view){
  if(PV.store.session){ location.hash='#/profile'; return; }
  view.innerHTML = `
  <div class="auth-wrap">
    <div class="auth-card card glass rise">
      <div class="auth-logo">${V.logo}</div>
      <h1 class="center" style="font-size:1.35rem;font-weight:900;margin-bottom:4px">پلی‌ورس</h1>
      <p class="center muted small" style="margin-bottom:16px">${t('home.p')}</p>
      <div class="seg" style="margin-bottom:18px">
        <button id="tab-in" class="on">${t('au.in')}</button>
        <button id="tab-up">${t('au.up')}</button>
      </div>
      <div class="col" style="gap:13px">
        <div class="field"><label>${t('au.user')}</label><input class="inp" id="au" autocomplete="username" dir="ltr" placeholder="ali_gamer"></div>
        <div class="field" id="namef" style="display:none"><label>${t('au.name')}</label><input class="inp" id="an" placeholder="علی"></div>
        <div class="field"><label>${t('au.pw')}</label><input class="inp" id="ap" type="password" autocomplete="current-password" dir="ltr" placeholder="••••••"></div>
        <div class="tiny muted" id="hint"></div>
        <button class="btn lg" id="go">${t('au.in')}</button>
        <button class="btn ghost" id="guest">${icon('zap',16)} ${t('au.guest')}</button>
      </div>
      <div class="auth-note" id="cloudnote">${icon('info',17)}<span>${t('au.cloudOff')}</span></div>
    </div>
  </div>`;

  let mode = 'in';
  const $au = view.querySelector('#au'), $an = view.querySelector('#an'), $ap = view.querySelector('#ap');
  const $hint = view.querySelector('#hint'), $go = view.querySelector('#go'), $note = view.querySelector('#cloudnote');

  /* cloud status */
  PV.cloud.ensure().then(ok=>{
    if(ok && !PV.store.settings.endpoint){ $note.innerHTML = icon('wifi',17)+`<span>${t('au.cloudOn')}</span>`; }
  });
  /* also consider auto-created jsonblob */
  setTimeout(async ()=>{
    const info = await PV.cloud.worldInfo();
    if(info.state==='ok') $note.innerHTML = icon('wifi',17)+`<span>${t('au.cloudOn')}</span>`;
  }, 600);

  view.querySelector('#tab-in').onclick = ()=> setMode('in');
  view.querySelector('#tab-up').onclick = ()=> setMode('up');
  function setMode(m){
    mode = m;
    view.querySelector('#tab-in').classList.toggle('on', m==='in');
    view.querySelector('#tab-up').classList.toggle('on', m==='up');
    view.querySelector('#namef').style.display = m==='up'?'flex':'none';
    $hint.textContent = m==='up'? t('au.userHint') : t('au.pwHint');
    $go.textContent = m==='up'? t('au.up') : t('au.in');
  }
  setMode('in');

  $go.onclick = submit;
  $ap.onkeydown = e=>{ if(e.key==='Enter') submit(); };
  async function submit(){
    const u = $au.value.trim(), pw = $ap.value, name = $an.value.trim() || u;
    if(!/^[a-zA-Z0-9_]{3,20}$/.test(u)){ PV.ui.toast(t('au.userHint'),'err'); return; }
    if(pw.length<6){ PV.ui.toast(t('au.pwHint'),'err'); return; }
    $go.disabled = true; $go.innerHTML = '<span class="spin"></span>';
    try{
      if(mode==='up'){
        const r = await PV.cloud.register(u, name, pw);
        if(!r.ok){ PV.ui.toast(t('au.taken'),'err'); }
        else { PV.ui.toast(t('au.made'),'ok','check'); if(r.localOnly) PV.ui.toast(t('au.cloudOff'),'info'); done(); }
      } else {
        const r = await PV.cloud.login(u, pw);
        if(!r.ok){ PV.ui.toast(r.why==='nf'? t('au.nf') : t('au.badPw'),'err'); }
        else { PV.ui.toast(t('au.done')+'، '+(PV.store.me()?.name||u)+' 👋','ok','check'); done(); }
      }
    } finally { $go.disabled=false; $go.textContent = mode==='up'? t('au.up'):t('au.in'); }
  }
  function done(){
    setTimeout(()=>{ location.hash = PV.store.session? '#/' : '#/auth'; }, 500);
  }
  view.querySelector('#guest').onclick = ()=>{
    const u = 'guest-'+U.uid(5);
    PV.store.login(u, t('c.guest')+' '+Math.floor(Math.random()*900+100), {guest:true});
    PV.ui.toast(t('au.done'),'ok','check');
    location.hash = '#/';
  };
}
PV.screens = PV.screens||{};
PV.screens.auth = {render};
})();
