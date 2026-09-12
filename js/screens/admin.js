/* ============ Screen: Admin panel ============ */
(function(){
'use strict';
const PV = window.PV, U = PV.u, t = PV.t, V = PV.visuals;
const { esc, icon, fmt } = U;

const ADMIN_KEY = 'pv:admin';
function code(){ return U.LS.get('admincode', '1234'); }

async function render(view){
  if(U.LS.get('admin-auth', false)===true){ drawDash(view); return; }
  view.innerHTML = `
  <div class="auth-wrap rise">
    <div class="card auth-card center">
      <span class="eic" style="width:70px;height:70px;border-radius:22px;background:var(--surface3);display:inline-flex;align-items:center;justify-content:center;color:var(--p1)">${icon('shield',32)}</span>
      <h1 style="font-size:1.3rem;font-weight:900;margin:10px 0 4px">${t('ad.title')}</h1>
      <p class="tiny muted" style="margin-bottom:16px">${t('ad.hint')}</p>
      <input class="inp center num" id="ac" type="password" inputmode="numeric" maxlength="8" placeholder="••••" style="letter-spacing:8px;max-width:200px;margin:0 auto 12px">
      <button class="btn" id="go" style="width:100%;max-width:200px">${t('ad.enter')}</button>
    </div>
  </div>`;
  const go = ()=>{
    if(view.querySelector('#ac').value === code()){ U.LS.set('admin-auth', true); drawDash(view); }
    else { PV.ui.toast(t('ad.wrong'),'err'); }
  };
  view.querySelector('#go').onclick = go;
  view.querySelector('#ac').onkeydown = e=>{ if(e.key==='Enter') go(); };
}

async function drawDash(view){
  const info = await PV.cloud.worldInfo();
  const games = PV.registry.all();
  const playsRows = games.map(g=>({l:PV.t('g.'+g.id), v:g.plays||0})).sort((a,b)=>b.v-a.v);
  const maxV = Math.max(1, ...playsRows.map(r=>r.v));
  const cats = await PV.registry.customCats();
  const flags = U.LS.get('flags', {});
  const liveRooms = PV.net.liveRooms();

  view.innerHTML = `
  <div class="rise row">${PV.ui.pageHead(t('ad.title'), 'shield')}
    <span class="spacer"></span>
    <button class="btn sm ghost" id="out">${t('c.close')}</button>
  </div>
  <div class="admin-grid rise rise-1">
    <div class="stat-tile"><b class="num">${fmt(info.users)}</b><span class="lbl">${t('ad.users')}</span></div>
    <div class="stat-tile"><b class="num">${fmt(info.matches)}</b><span class="lbl">${t('ad.matches')}</span></div>
    <div class="stat-tile"><b class="num">${fmt(liveRooms.length)}</b><span class="lbl">${t('home.liveRooms')}</span></div>
    <div class="stat-tile"><b><span class="badge ${PV.cloud.state==='ok'?'ok':'warn'}">${PV.cloud.state==='ok'? '☁️ '+t('c.on') : '📴 '+t('c.off')}</span></b><span class="lbl">Cloud</span></div>
  </div>

  <div class="card rise rise-2 mt-3">
    <b>${t('ad.playsByGame')}</b>
    <div class="bar-chart mt-2">
      ${playsRows.map(r=>`<div class="bar-row"><span class="bl">${esc(r.l)}</span><span class="btrack"><i style="width:${Math.round(r.v/maxV*100)}%"></i></span><span class="bv num">${fmt(r.v)}</span></div>`).join('')}
    </div>
  </div>

  <div class="card rise rise-2 mt-3">
    <b>${t('ad.announce')}</b>
    <div class="row mt-2 wrap">
      <input class="inp" id="ann" placeholder="${t('ad.announcePh')}" style="flex:1;min-width:200px">
      <button class="btn" id="annGo">${icon('send',16)} ${t('ad.push')}</button>
      <button class="btn ghost" id="annOff">${t('c.off')}</button>
    </div>
  </div>

  <div class="card rise rise-3 mt-3">
    <b>${t('ad.flags')}</b>
    <div class="col mt-2" style="gap:9px">
      ${games.map(g=>`<div class="set-row" style="padding:11px 14px;margin:0">
        <span class="av" style="width:36px;height:36px;border-radius:11px;overflow:hidden">${V.thumb(g.id)}</span>
        <div class="st2"><b class="small">${esc(PV.t('g.'+g.id))}</b></div>
        <label class="sw"><input type="checkbox" data-flag="${g.id}" ${flags[g.id]!==false?'checked':''}><i></i></label>
      </div>`).join('')}
    </div>
  </div>

  <div class="card rise rise-3 mt-3">
    <b>${t('ad.cats')}</b>
    <div class="row mt-2 wrap" style="gap:8px">
      ${PV.registry.BASE_CATS.map(c=>`<span class="chip on" style="cursor:default">${esc(PV.registry.catLabel(c))}</span>`).join('')}
      ${(cats||[]).map(c=>`<span class="chip">${esc(typeof c==='string'?c:c.id)}</span>`).join('')}
    </div>
    <div class="row mt-2">
      <input class="inp" id="ncat" placeholder="${t('ad.addCat')}" style="flex:1">
      <button class="btn sm" id="ncatGo">${t('ad.add')}</button>
    </div>
  </div>

  <div class="card rise rise-4 mt-3">
    <b>${t('ad.endpoint')}</b>
    <p class="tiny muted mt-1">Cloudflare Workers / any GET-PUT JSON API — <span dir="ltr">docs/worker.js</span></p>
    <div class="row mt-2">
      <input class="inp" id="ep" dir="ltr" placeholder="${t('ad.endpointPh')}" value="${esc(PV.store.settings.endpoint||'')}" style="flex:1">
      <button class="btn sm" id="epGo">${t('c.save')}</button>
    </div>
    <div class="row mt-3 wrap">
      <button class="btn sm ghost" id="exp">${icon('down',14)} ${t('ad.export')}</button>
      <button class="btn sm danger" id="rst">${icon('trash',14)} reset local</button>
    </div>
  </div>`;

  view.querySelector('#out').onclick = ()=>{ U.LS.set('admin-auth', false); location.hash='#/'; };
  view.querySelector('#annGo').onclick = async ()=>{
    const txt = view.querySelector('#ann').value.trim();
    if(!txt) return;
    const ok = await PV.cloud.setAnnounce(txt);
    PV.ui.toast(ok? t('ad.pushed') : t('st.cloud')+' '+t('c.off'), ok?'ok':'err');
  };
  view.querySelector('#annOff').onclick = ()=> PV.cloud.setAnnounce(null).then(()=>PV.ui.toast(t('c.ok'),'info'));
  view.querySelectorAll('[data-flag]').forEach(sw=> sw.onchange = async ()=>{
    const f = U.LS.get('flags', {}); f[sw.dataset.flag] = sw.checked; U.LS.set('flags', f);
    await PV.cloud.setFlag(sw.dataset.flag, sw.checked);
    PV.ui.toast((sw.checked? t('c.on'):t('c.off'))+' — '+sw.dataset.flag,'info');
  });
  view.querySelector('#ncatGo').onclick = async ()=>{
    const v = view.querySelector('#ncat').value.trim(); if(!v) return;
    const arr = [...(cats||[]), v];
    await PV.cloud.setCats(arr);
    PV.ui.toast(t('ad.add')+' ✓','ok'); PV.router.render();
  };
  view.querySelector('#epGo').onclick = ()=>{
    const v = view.querySelector('#ep').value.trim();
    PV.store.saveSettings({endpoint:v});
    PV.ui.toast(t('pf.saved'),'ok'); PV.cloud.probe();
  };
  view.querySelector('#exp').onclick = ()=>{
    const blob = new Blob([JSON.stringify(PV.store.exportAll(), null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'playverse-export-'+U.todayKey()+'.json'; a.click();
  };
  view.querySelector('#rst').onclick = async ()=>{
    if(await PV.ui.confirmDlg(t('st.clearC'))){
      Object.keys(localStorage).filter(k=>k.startsWith('pv:')).forEach(k=>localStorage.removeItem(k));
      location.reload();
    }
  };
}
PV.screens = PV.screens||{};
PV.screens.admin = {render};
})();
