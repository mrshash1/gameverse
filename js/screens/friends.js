/* ============ Screen: Friends ============ */
(function(){
'use strict';
const PV = window.PV, U = PV.u, t = PV.t, V = PV.visuals;
const { esc, icon, fmt, avatarHtml } = U;

async function render(view){
  const p = PV.store.me();
  if(!p){ view.innerHTML = `<div class="empty"><span class="eic">${icon('users',30)}</span><p>${t('pf.loginFirst')}</p><a class="btn" href="#/auth">${t('nav.login')}</a></div>`; return; }

  view.innerHTML = `
  <div class="rise">${PV.ui.pageHead(t('fr.title'), 'users')}</div>
  <div class="joinbar rise rise-1" style="margin:0 0 16px">
    ${icon('search',20)}
    <input class="inp" id="fu" dir="ltr" placeholder="${t('fr.addPh')}" style="letter-spacing:0">
    <button class="btn" id="fadd">${icon('plus',16)} ${t('fr.reqSent').split(' ')[0]==='درخواست'?'درخواست':'Add'}</button>
  </div>
  <div id="fr-content"></div>
  <div id="dm-root"></div>`;

  view.querySelector('#fadd').onclick = addFriend;
  view.querySelector('#fu').onkeydown = e=>{ if(e.key==='Enter') addFriend(); };

  async function addFriend(){
    const u = view.querySelector('#fu').value.trim();
    if(!u) return;
    if(u.toLowerCase()===p.u.toLowerCase()){ PV.ui.toast(t('fr.self'),'err'); return; }
    if(p.friends.includes(u)){ PV.ui.toast(t('fr.already'),'info'); return; }
    if(p.reqsOut.includes(u)){ PV.ui.toast(t('fr.already'),'info'); return; }
    const sent = await PV.cloud.sendFriendReq(p, u);
    if(sent){
      p.reqsOut.push(u); PV.store.saveProfile(p);
      PV.ui.toast(t('fr.reqSent'),'ok','check');
      view.querySelector('#fu').value='';
      draw();
    } else {
      PV.ui.toast(PV.cloud.state==='ok'? t('fr.notFound') : t('c.needLogin')+' (☁️)','err');
    }
  }

  function draw(){
    const online = PV.net.onlineFriends(p.friends||[]);
    const onlineNames = new Set(online.map(f=>f.u.toLowerCase()));
    const reqs = U.LS.get('notifs:'+p.u, []).filter(n=>n.type==='req' && !n.read);
    view.querySelector('#fr-content').innerHTML = `
      ${reqs.length? `<div class="rise">${PV.ui.sectHead(t('fr.reqIn'),'bell')}
        <div class="col" style="gap:8px">${reqs.map(n=>`
          <div class="fr-row">
            ${avatarHtml({avatar:n.av||'fox', xp:0},42)}
            <div class="fi"><b>${esc(n.name||n.from)}</b><span>${t('fr.reqIn')}</span></div>
            <div class="fr-actions">
              <button class="btn sm green" data-acc="${esc(n.from)}" data-av="${esc(n.av||'fox')}" data-nm="${esc(n.name||n.from)}" data-id="${esc(n.id)}">${t('fr.accept')}</button>
              <button class="btn sm ghost" data-rej="${esc(n.id)}">${t('fr.reject')}</button>
            </div>
          </div>`).join('')}
        </div>
      </div>`:''}

      <div class="rise rise-1">${PV.ui.sectHead(online.length? t('home.onlineFr')+' — '+fmt(online.length) : t('fr.title'),'wifi')}
        <div class="col" style="gap:8px">
        ${p.friends.length? p.friends.map(fname=>{
          const on = onlineNames.has(String(fname).toLowerCase());
          const prof = PV.store.loadProfile(fname.toLowerCase());
          return `<div class="fr-row">
            ${avatarHtml({avatar:prof?.avatar||'fox', xp:prof?.xp||0},42,{dot:on})}
            <div class="fi"><b>${esc(fname)}</b><span>${on? '<span class="pill-live"><i></i>'+t('c.online')+'</span>' : t('c.offline')}</span></div>
            <div class="fr-actions">
              <button class="btn sm cyan" data-inv="${esc(fname)}" ${on?'':'disabled'}>${icon('swords',14)} ${t('fr.invite')}</button>
              <button class="btn sm ghost" data-dm="${esc(fname)}">${icon('chat',14)} ${t('fr.dm')}</button>
              <button class="btn sm icon danger" data-rm="${esc(fname)}" title="${t('fr.remove')}">${icon('trash',14)}</button>
            </div>
          </div>`;
        }).join('') : `<div class="empty"><span class="eic">${icon('users',30)}</span><p>${t('fr.empty')}</p></div>`}
        </div>
      </div>`;

    view.querySelectorAll('[data-acc]').forEach(b=> b.onclick = async ()=>{
      const from = b.dataset.acc, nm = b.dataset.nm;
      if(!p.friends.includes(from)) p.friends.push(from);
      p.reqsOut = p.reqsOut.filter(x=>x!==from);
      PV.store.saveProfile(p);
      await PV.cloud.cloudFriendsBoth(p, from);
      const notifs = U.LS.get('notifs:'+p.u, []).map(n=> n.id===b.dataset.id? {...n, read:true}:n);
      U.LS.set('notifs:'+p.u, notifs);
      PV.ui.notify('sys', t('fr.accepted',{n:nm}) || nm);
      PV.ui.toast(t('fr.accepted',{n:nm}),'ok','check');
      PV.sound.play('ach');
      PV.cloud.pushProfile();
      draw();
    });
    view.querySelectorAll('[data-rej]').forEach(b=> b.onclick = ()=>{
      const notifs = U.LS.get('notifs:'+p.u, []).filter(n=>n.id!==b.dataset.rej);
      U.LS.set('notifs:'+p.u, notifs);
      draw();
    });
    view.querySelectorAll('[data-rm]').forEach(b=> b.onclick = async ()=>{
      if(await PV.ui.confirmDlg(t('fr.remove')+'؟')){
        p.friends = p.friends.filter(f=>f!==b.dataset.rm);
        PV.store.saveProfile(p); PV.cloud.pushProfile(); draw();
      }
    });
    view.querySelectorAll('[data-dm]').forEach(b=> b.onclick = ()=> dmModal(b.dataset.dm));
    view.querySelectorAll('[data-inv]').forEach(b=> b.onclick = ()=> inviteModal(b.dataset.inv));
  }

  function inviteModal(f){
    const code = PV.net.room? PV.net.room.code : null;
    PV.ui.modal({title:t('fr.invite'), body: code?
      `<p class="muted small">${f}</p><div class="card center mt-2" style="font-size:1.4rem;font-weight:900;letter-spacing:5px">${esc(code)}</div>` :
      `<p class="muted small">${t('rm.title')+'؟'}</p>`,
      actions: code? [{label:t('c.send'), onClick:()=>{ PV.ui.toast(t('fr.reqSent'),'ok'); }}] : [{label:t('home.create'), onClick:()=>{ location.hash='#/room'; }}]});
  }

  /* simple P2P DM via lobby presence targets */
  function dmModal(f){
    const m = PV.ui.modal({title:t('fr.dmTo',{n:f}), lg:false, body:`
      <div class="chat-box" style="height:320px">
        <div class="chat-log" id="dlog"><div class="center tiny muted" style="padding:10px">P2P · ${t('c.online')}</div></div>
        <div class="chat-inp">
          <input class="inp" id="din" placeholder="${t('rm.chatPh')}">
          <button class="btn icon" id="dgo">${icon('send',18)}</button>
        </div>
      </div>`, actions:[]});
    const log = m.root.querySelector('#dlog'), inp = m.root.querySelector('#din');
    const push = (who, txt, me)=> log.insertAdjacentHTML('beforeend', `<div class="chat-msg ${me?'me':''}"><span class="bub"><div class="who">${esc(who)}</div>${esc(txt)}</span></div>`);
    /* send via lobby room targeted action if peer found */
    const peer = [...PV.net.lobby.peers.values()].find(x=>String(x.u).toLowerCase()===String(f).toLowerCase());
    const send = txt=>{
      if(!txt) return;
      push(PV.store.displayName(), txt, true);
      if(PV.net.lobby._sendDm && peer) PV.net.lobby._sendDm({from:PV.store.displayName(), txt}, peer.id);
      else PV.ui.toast(t('c.offline')+' — P2P','err');
    };
    m.root.querySelector('#dgo').onclick = ()=>{ send(inp.value.trim()); inp.value=''; };
    inp.onkeydown = e=>{ if(e.key==='Enter'){ send(inp.value.trim()); inp.value=''; } };
  }

  /* live refresh */
  const onLobby = ()=>{ if(document.contains(view)) draw(); };
  PV.net.events.on('lobby', onLobby);
  window.addEventListener('hashchange', ()=>{ PV.net.events.m['lobby'] = (PV.net.events.m['lobby']||[]).filter(f=>f!==onLobby); }, {once:true});
  draw();
}
PV.screens = PV.screens||{};
PV.screens.friends = {render};
})();
