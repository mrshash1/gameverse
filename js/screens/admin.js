/* ============ Screen: Admin panel v2 — REAL server management ============
   • Signed in as mrshash on a live server → full power:
       user list (search), +XP/+coins, ban/unban, delete, admin toggle,
       global announcements, game on/off flags, world stats, local tools.
   • No server → local dashboard (code 1234) with honest labeling.
========================================================================== */
(function(){
'use strict';
const PV = window.PV, U = PV.u, t = PV.t, V = PV.visuals;
const { esc, icon, fmt, avatarHtml } = U;

function isAdminUser(){
  const p = PV.store.me();
  return !!(p && !PV.store.isGuest() && (p.svAdmin || p.u==='mrshash'));
}

async function render(view){
  const serverOn = PV.sapi && PV.sapi.configured() && await PV.sapi.probe();
  if(serverOn && isAdminUser()){
    /* refresh the admin flag from the server before drawing */
    await PV.sapi.syncIntoLocal().catch?.(()=>{});
    if(isAdminUser()) return drawServerDash(view);
  }
  /* not a server admin → legacy local gate */
  if(U.LS.get('admin-auth', false)===true){ return drawLocalDash(view); }
  return drawGate(view, serverOn);
}

/* ------------------------------- gate ------------------------------------ */
function drawGate(view, serverOn){
  view.innerHTML = `
  <div class="auth-wrap rise">
    <div class="card auth-card center">
      <span class="eic" style="width:70px;height:70px;border-radius:22px;background:var(--surface3);display:inline-flex;align-items:center;justify-content:center;color:var(--p1)">${icon('shield',32)}</span>
      <h1 style="font-size:1.3rem;font-weight:900;margin:10px 0 4px">${t('ad.title')}</h1>
      ${serverOn? `<div class="badge warn" style="margin:0 auto 10px">${t('ad.needSv')}</div>`:''}
      <p class="tiny muted" style="margin-bottom:16px">${t('ad.hint')}</p>
      <input class="inp center num" id="ac" type="password" inputmode="numeric" maxlength="8" placeholder="••••" style="letter-spacing:8px;max-width:200px;margin:0 auto 12px">
      <button class="btn" id="go" style="width:100%;max-width:200px">${t('ad.enter')}</button>
    </div>
  </div>`;
  const go = ()=>{
    if(view.querySelector('#ac').value === U.LS.get('admincode', '1234')){ U.LS.set('admin-auth', true); drawLocalDash(view); }
    else PV.ui.toast(t('ad.wrong'),'err');
  };
  view.querySelector('#go').onclick = go;
  view.querySelector('#ac').onkeydown = e=>{ if(e.key==='Enter') go(); };
}

/* --------------------------- server dashboard ----------------------------- */
async function drawServerDash(view){
  let ov = null;
  try{ ov = await PV.sapi.admin.overview(); }
  catch(e){ PV.ui.toast('admin API: '+e.why,'err'); return drawLocalDash(view); }

  let filter = '';
  view.innerHTML = `
  <div class="rise row">
    ${PV.ui.pageHead(t('ad.title'), 'shield')}
    <span class="spacer"></span>
    <span class="badge ok">👑 ${esc(ov.adminUser||'mrshash')}</span>
    <button class="btn sm ghost" id="out">${t('c.close')}</button>
  </div>

  <div class="admin-grid rise rise-1">
    <div class="stat-tile"><b class="num">${fmt(ov.users.length)}</b><span class="lbl">${t('ad.users')}</span></div>
    <div class="stat-tile"><b class="num">${fmt(ov.matches||0)}</b><span class="lbl">${t('ad.matches')}</span></div>
    <div class="stat-tile"><b class="num">${fmt(PV.sapi.onlineNow())}</b><span class="lbl">${t('home.stOn')}</span></div>
    <div class="stat-tile"><b><span class="badge ok">🖥 ${t('c.on')}</span></b><span class="lbl">Server</span></div>
  </div>

  <div class="tabs rise rise-1" id="admtabs" style="margin-top:18px">
    <button data-tab="users" class="on">${t('ad.tabUsers')}</button>
    <button data-tab="world">${t('ad.tabWorld')}</button>
    <button data-tab="local">${t('ad.tabLocal')}</button>
  </div>
  <div id="adm-body"></div>`;

  const body = view.querySelector('#adm-body');
  view.querySelector('#out').onclick = ()=>{ location.hash='#/'; };
  view.querySelectorAll('#admtabs [data-tab]').forEach(b=> b.onclick = ()=>{
    view.querySelectorAll('#admtabs button').forEach(x=>x.classList.toggle('on', x===b));
    drawTab(b.dataset.tab);
  });

  /* ---------- TAB: users ---------- */
  function drawTab(which){
    if(which==='users') drawUsers();
    else if(which==='world') drawWorld();
    else drawLocal();
  }

  function drawUsers(){
    const list = ov.users.filter(u=> !filter || u.u.includes(filter.toLowerCase()) || (u.name||'').toLowerCase().includes(filter.toLowerCase()));
    body.innerHTML = `
      <div class="joinbar mt-2" style="margin:0 0 14px">
        ${icon('search',20)}
        <input class="inp" id="usearch" dir="ltr" placeholder="${t('ad.search')}" value="${esc(filter)}">
      </div>
      ${list.length? `<div class="col" style="gap:9px">${list.map(u=>{
        const isMe = u.u===(ov.adminUser||'mrshash');
        return `<div class="fr-row" style="${u.banned?'opacity:.55;filter:grayscale(.5)':''}">
          ${avatarHtml({avatar:u.avatar||'fox', xp:u.xp}, 42, {lvl:true})}
          <div class="fi">
            <b>${esc(u.name||u.u)} ${isMe?`<span class="badge pp" style="font-size:.62rem">👑 ${t('ad.youTag')}</span>`:''}${u.admin?`<span class="badge" style="font-size:.62rem">${icon('shield',10)} admin</span>`:''}${u.banned?`<span class="badge" style="font-size:.62rem;background:var(--err);color:#fff">${t('ad.ban')}</span>`:''}</b>
            <span class="tiny muted num">${t('c.lvl')} ${fmt(u.lvl)} · ${fmt(u.xp)} XP · ${icon('coin',11)} ${fmt(u.coins)} · ${fmt(u.plays)} ${t('gd.plays')}</span>
          </div>
          <div class="fr-actions">
            ${isMe? `<span class="tiny muted">${t('ad.protected')}</span>` : `
            <button class="btn sm cyan" data-xp="${esc(u.u)}" title="${t('ad.gxp')}">+XP</button>
            <button class="btn sm gold" data-co="${esc(u.u)}" title="${t('ad.gcoin')}">+🪙</button>
            <button class="btn sm ghost" data-adm="${esc(u.u)}" data-on="${u.admin?'':'1'}">${u.admin? t('ad.rmvAdm'):t('ad.mkAdm')}</button>
            ${u.banned? `<button class="btn sm green" data-unban="${esc(u.u)}">${t('ad.unban')}</button>`
                      : `<button class="btn sm warn" data-ban="${esc(u.u)}">${t('ad.ban')}</button>`}
            <button class="btn sm icon danger" data-del="${esc(u.u)}" title="${t('ad.delU')}">${icon('trash',14)}</button>`}
          </div>
        </div>`;
      }).join('')}</div>`
      : `<div class="empty"><span class="eic">${icon('users',30)}</span><p>${t('ad.svEmpty')}</p></div>`}`;

    body.querySelector('#usearch').oninput = e=>{ filter = e.target.value.trim(); drawUsers(); };
    const act = async (u, action, n, on)=>{
      try{ await PV.sapi.admin.userAction(u, action, n, on); PV.ui.toast(t('ad.actDone'),'ok','check'); }
      catch(e){ PV.ui.toast(e.why||'error','err'); }
      ov = await PV.sapi.admin.overview(); drawUsers();
    };
    body.querySelectorAll('[data-xp]').forEach(b=> b.onclick = ()=>{
      PV.ui.modal({title:t('ad.gxp')+' — '+b.dataset.xp, body:`<input class="inp num" id="gxn" dir="ltr" placeholder="100" style="max-width:140px">`,
        actions:[{label:t('c.ok'), onClick:(m)=>{ const n = Math.round(+m.querySelector('#gxn').value||0); if(n) act(b.dataset.xp,'grantxp',n); }}]});
    });
    body.querySelectorAll('[data-co]').forEach(b=> b.onclick = ()=>{
      PV.ui.modal({title:t('ad.gcoin')+' — '+b.dataset.co, body:`<input class="inp num" id="gcn" dir="ltr" placeholder="50" style="max-width:140px">`,
        actions:[{label:t('c.ok'), onClick:(m)=>{ const n = Math.round(+m.querySelector('#gcn').value||0); if(n) act(b.dataset.co,'grantcoins',n); }}]});
    });
    body.querySelectorAll('[data-adm]').forEach(b=> b.onclick = ()=> act(b.dataset.adm,'admin',0, b.dataset.on==='1'));
    body.querySelectorAll('[data-ban]').forEach(b=> b.onclick = ()=> act(b.dataset.ban,'ban'));
    body.querySelectorAll('[data-unban]').forEach(b=> b.onclick = ()=> act(b.dataset.unban,'unban'));
    body.querySelectorAll('[data-del]').forEach(b=> b.onclick = async ()=>{
      if(await PV.ui.confirmDlg(t('ad.delC'), t('ad.delU'))) act(b.dataset.del,'del');
    });
  }

  /* ---------- TAB: world ---------- */
  function drawWorld(){
    const games = PV.registry.all();
    const playsRows = games.map(g=>({l:PV.t('g.'+g.id), v:(ov.byGame&&ov.byGame[g.id])||0})).sort((a,b)=>b.v-a.v);
    const maxV = Math.max(1, ...playsRows.map(r=>r.v));
    body.innerHTML = `
      <div class="card mt-2"><b>${t('ad.playsByGame')}</b>
        <div class="bar-chart mt-2">
          ${playsRows.map(r=>`<div class="bar-row"><span class="bl">${esc(r.l)}</span><span class="btrack"><i style="width:${Math.round(r.v/maxV*100)}%"></i></span><span class="bv num">${fmt(r.v)}</span></div>`).join('')}
        </div>
      </div>
      <div class="card mt-3"><b>${t('ad.announce')}</b>
        <div class="row mt-2 wrap">
          <input class="inp" id="ann" placeholder="${t('ad.announcePh')}" style="flex:1;min-width:200px">
          <button class="btn" id="annGo">${icon('send',16)} ${t('ad.push')}</button>
          <button class="btn ghost" id="annOff">${t('c.off')}</button>
        </div>
      </div>
      <div class="card mt-3"><b>${t('ad.flags')}</b>
        <div class="col mt-2" style="gap:9px">
          ${games.map(g=>`<div class="set-row" style="padding:11px 14px;margin:0">
            <span class="av" style="width:36px;height:36px;border-radius:11px;overflow:hidden">${V.thumb(g.id)}</span>
            <div class="st2"><b class="small">${esc(PV.t('g.'+g.id))}</b></div>
            <label class="sw"><input type="checkbox" data-flag="${g.id}" ${(ov.flags&&ov.flags[g.id])!==false?'checked':''}><i></i></label>
          </div>`).join('')}
        </div>
      </div>`;
    body.querySelector('#annGo').onclick = async ()=>{
      const txt = body.querySelector('#ann').value.trim(); if(!txt) return;
      try{ await PV.sapi.admin.announce(txt); PV.ui.toast(t('ad.pushed'),'ok'); }catch(e){ PV.ui.toast(e.why||'error','err'); }
    };
    body.querySelector('#annOff').onclick = ()=> PV.sapi.admin.announce(null).then(()=>PV.ui.toast(t('c.ok'),'info'));
    body.querySelectorAll('[data-flag]').forEach(sw=> sw.onchange = async ()=>{
      try{ await PV.sapi.admin.flags(sw.dataset.flag, sw.checked); PV.ui.toast((sw.checked? t('c.on'):t('c.off'))+' — '+sw.dataset.flag,'info'); }
      catch(e){ PV.ui.toast(e.why||'error','err'); }
    });
  }

  /* ---------- TAB: local ---------- */
  function drawLocal(){
    body.innerHTML = `
      <div class="card mt-2"><b>${t('ad.endpoint')}</b>
        <div class="row mt-2">
          <input class="inp" id="ep" dir="ltr" placeholder="${t('ad.endpointPh')}" value="${esc(PV.store.settings.endpoint||'')}" style="flex:1">
          <button class="btn sm" id="epGo">${t('c.save')}</button>
        </div>
        <div class="row mt-3 wrap">
          <button class="btn sm ghost" id="exp">${icon('down',14)} ${t('ad.export')}</button>
          <button class="btn sm danger" id="rst">${icon('trash',14)} reset local</button>
        </div>
      </div>`;
    body.querySelector('#epGo').onclick = ()=>{
      PV.store.saveSettings({endpoint: body.querySelector('#ep').value.trim()});
      PV.ui.toast(t('pf.saved'),'ok'); PV.cloud.probe();
    };
    body.querySelector('#exp').onclick = ()=>{
      const blob = new Blob([JSON.stringify(PV.store.exportAll(), null, 2)], {type:'application/json'});
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'playverse-export-'+U.todayKey()+'.json'; a.click();
    };
    body.querySelector('#rst').onclick = async ()=>{
      if(await PV.ui.confirmDlg(t('st.clearC'))){
        Object.keys(localStorage).filter(k=>k.startsWith('pv:')).forEach(k=>localStorage.removeItem(k));
        location.reload();
      }
    };
  }

  drawTab('users');
  /* live online count */
  const iv = setInterval(()=>{ if(!document.body.contains(body)){ clearInterval(iv); return; } }, 5000);
}

/* --------------------------- local dashboard ------------------------------ */
async function drawLocalDash(view){
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
  ${PV.sapi && PV.sapi.configured()? `<div class="card rise rise-1" style="border-inline-start:4px solid var(--warn)"><b class="small">${icon('info',14)} ${t('ad.needSv')}</b></div>`:''}
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
    PV.store.saveSettings({endpoint: view.querySelector('#ep').value.trim()});
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
