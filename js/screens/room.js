/* ============ Screen: Room lobby (host/peer, chat, modes, bots, start) ============ */
(function(){
'use strict';
const PV = window.PV, U = PV.u, t = PV.t, V = PV.visuals;
const { esc, icon, fmt, avatarHtml } = U;

let myRoom = null;

async function render(view, m){
  const wantedCode = m && m[1];
  const p = PV.store.me();
  const name = p? p.name : (PV.store.displayName() || t('c.guest'));

  /* reuse existing room if same code */
  if(PV.net.room && PV.net.room.code === wantedCode){ myRoom = PV.net.room; }
  else if(wantedCode){
    if(PV.net.status!=='ok'){ view.innerHTML = netFail(); return; }
    try{ myRoom = PV.net.joinRoomByCode(wantedCode); }
    catch(e){ view.innerHTML = netFail(); return; }
  }
  else {
    if(PV.net.room){ myRoom = PV.net.room; }
    else {
      if(PV.net.status!=='ok'){ view.innerHTML = netFail(); return; }
      myRoom = PV.net.createRoom();
      if(p && !PV.store.isGuest()){ p.stats.hosted++; PV.store.saveProfile(p); PV.ach.evaluate({event:'hosted', p}); }
    }
  }
  const r = myRoom;
  const preset = sessionStorage.getItem('pv:presetGame');
  if(preset && r.amHost){ r.lobbyState.game = preset; sessionStorage.removeItem('pv:presetGame'); r.broadcastLobby(); }

  view.innerHTML = `<div id="room-shell"></div>`;
  draw();

  /* room event wiring */
  r.on('lobby', ()=> draw());
  r.on('chat', c=> addChat(c));
  r.on('leave', id=>{
    PV.ui.toast(t('rm.opLeft'),'warn','wifiOff');
    /* if the opponent left mid-match, end it honestly instead of freezing */
    const cur = PV.sdk.current;
    if(cur && !cur.ctx._finishing && cur.opts.mode!=='solo' && cur.ctx.players?.some(pl=>pl.pid===id)){
      cur.ctx.finish({res:'d', vsHuman:true, sub:t('pl.oppLeft')});
    }
    if(r.amHost){ /* host fills the seat with a bot if a match is running */
      if(cur){ cur.opts.botTakeover = id; }
    }
    draw();
  });
  r.on('host', ()=>{ PV.ui.toast(t('rm.becameHost'),'ok','crown'); draw(); });
  r.on('start', payload=>{
    PV.sdk.launch({gameId:payload.gameId, mode:payload.mode, seed:payload.seed, room:r, players:payload.players, tournament:payload.tournament});
  });
  r.on('kicked', ()=>{ PV.ui.toast(t('rm.kick'),'err'); PV.net.room = null; myRoom=null; location.hash='#/'; });

  /* persistent nav hook: clean the room up the moment we truly leave it
     (survives room→play→home transitions; never stacks duplicates) */
  if(r._navHook){ window.removeEventListener('hashchange', r._navHook); }
  r._navHook = function onLeaveHash(){
    if(location.hash.startsWith('#/play') || location.hash.startsWith('#/room')) return;
    window.removeEventListener('hashchange', onLeaveHash);
    r._navHook = null;
    try{ r.leave(); }catch(e){}
    if(PV.net.room===r) PV.net.room = null;
  };
  window.addEventListener('hashchange', r._navHook);

  function netFail(){
    return `<div class="empty"><span class="eic">${icon('wifiOff',32)}</span><p>${t('mm.netFail')}</p><a class="btn" href="#/">${t('nav.home')}</a></div>`;
  }

  function draw(){
    if(PV.net.room !== r) return;
    const st = r.lobbyState || r.initLobbyFromOld();
    const isHost = r.amHost;
    const games = PV.registry.all().filter(g=>PV.registry.enabled(g.id) && g.modes.includes('online'));
    const game = st.game? PV.registry.get(st.game) : null;
    const inviteLink = location.origin + location.pathname + '#/join/' + r.code;

    view.querySelector('#room-shell').innerHTML = `
    <div class="rise">${PV.ui.pageHead(t('rm.title'), 'swords', t('rm.youHost'))}</div>
    <div class="room-wrap">
      <div class="room-main">
        <div class="code-hero rise rise-1">
          <div>
            <div class="tiny" style="opacity:.85">${t('rm.codeLbl')}</div>
            <div class="code num">${esc(r.code)}</div>
          </div>
          <span class="spacer"></span>
          <button class="btn wt" id="cpLink">${icon('share',17)} ${t('rm.invite')}</button>
          ${isHost? `<button class="btn ot" id="startBtn">${icon('play',17)} ${t('c.start')}</button>`:`<span class="badge" style="background:rgba(255,255,255,.2);color:#fff">${t('rm.waitHost')}</span>`}
        </div>

        <div class="card rise rise-2">
          <div class="row wrap" style="justify-content:space-between;margin-bottom:12px">
            <b>${game? esc(PV.t('g.'+game.id)) : t('rm.selectGame')}</b>
            ${game? `<span class="av" style="width:40px;height:40px;border-radius:12px;overflow:hidden">${V.thumb(game.id)}</span>`:''}
          </div>
          ${isHost? `<div class="ggrid" style="grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:9px">
            ${games.map(g=>`<button class="chip ${st.game===g.id?'on':''}" data-g="${g.id}" style="justify-content:center;padding:9px 6px">${esc(PV.t('g.'+g.id))}</button>`).join('')}
          </div>` : `<div class="empty" style="padding:18px"><p class="small">${t('rm.waitHost')}</p></div>`}
          <hr class="divider">
          <div class="row wrap" style="gap:10px">
            <span class="small" style="font-weight:800">${t('rm.mode')}:</span>
            ${isHost? ['classic','ranked','casual','quick','tournament'].map(md=>`<button class="chip ${st.mode===md?'on':''}" data-mode="${md}">${t('md.'+md)}</button>`).join('')
              : `<span class="badge pp">${t('md.'+(st.mode||'classic'))}</span>`}
            <span class="spacer"></span>
            <span class="tiny muted">${t('rm.modeHint.'+(st.mode||'classic'))}</span>
          </div>
        </div>

        <div class="card rise rise-3">
          <div class="row" style="justify-content:space-between;margin-bottom:12px">
            <b>${t('c.players')} — ${fmt(st.players.length)}/8</b>
            ${isHost? `<button class="btn sm ghost" id="addBot">${icon('user',14)} ${t('rm.addBot')}</button>`:''}
          </div>
          <div class="pgrid">
            ${st.players.map(pl=>`
              <div class="pslot full ${pl.ready?'ready':''} ${pl.host?'host':''}">
                ${avatarHtml(pl, 48, {lvl:true})}
                <span class="nm">${esc(pl.name)}${pl.pid===PV.net.selfId? ' ('+t('c.you')+')':''}</span>
                <span class="st">${pl.bot? '🤖 '+t('g.bot') : pl.ready? '✓ '+t('c.ready') : '⏳'}</span>
                ${isHost && pl.pid!==PV.net.selfId? `<button class="kick" data-kick="${esc(pl.pid)}">${icon('x',13)}</button>`:''}
              </div>`).join('')}
            ${Array.from({length: Math.max(0, Math.min(8, st.mode==='tournament'?4:2) - st.players.length)}, ()=>`<div class="pslot empty-slot"><span style="font-size:1.6rem;color:var(--tx3)">＋</span><span class="tiny muted">${t('rm.invite')}</span></div>`).join('')}
          </div>
          ${!isHost? `<button class="btn mt-2" id="readyBtn" style="width:100%">${st.players.find(x=>x.pid===PV.net.selfId)?.ready? '✓ '+t('c.ready') : t('c.ready')}</button>`:''}
        </div>
      </div>

      <div class="play-side rise rise-2">
        <div class="chat-box">
          <div class="bd-h" style="padding:12px 14px;border-bottom:1.5px solid var(--border);font-weight:900;font-size:.9rem">${icon('chat',17)} ${t('rm.chat')}</div>
          <div class="chat-log" id="clog"></div>
          <div class="emotes">${['👋','😂','😮','👏','🔥','💪','😈','🎯'].map(e=>`<button data-e="${e}">${e}</button>`).join('')}</div>
          <div class="chat-inp">
            <input class="inp" id="cin" placeholder="${t('rm.chatPh')}" maxlength="140">
            <button class="btn icon" id="cgo">${icon('send',17)}</button>
          </div>
        </div>
        <button class="btn danger" id="leaveBtn" style="width:100%">${icon('logout',17)} ${t('rm.leave')}</button>
      </div>
    </div>`;

    /* wire */
    view.querySelector('#cpLink').onclick = ()=> U.copyText(inviteLink).then(()=>{ PV.ui.toast(t('rm.invited'),'ok','check'); PV.sound.play('pop'); });
    view.querySelector('#leaveBtn').onclick = async ()=>{
      if(await PV.ui.confirmDlg(t('rm.leaveC'))){
        r.leave(); if(PV.net.room===r) PV.net.room=null; myRoom=null;
        location.hash='#/';
      }
    };
    if(isHost){
      view.querySelectorAll('[data-g]').forEach(b=> b.onclick = ()=>{ st.game = b.dataset.g; r.broadcastLobby(); draw(); PV.sound.play('tap'); });
      view.querySelectorAll('[data-mode]').forEach(b=> b.onclick = ()=>{ st.mode = b.dataset.mode; r.broadcastLobby(); draw(); });
      view.querySelectorAll('[data-kick]').forEach(b=> b.onclick = ()=>{ r.sendKick({}, b.dataset.kick); st.players = st.players.filter(x=>x.pid!==b.dataset.kick); r.broadcastLobby(); draw(); });
      view.querySelector('#addBot').onclick = ()=>{
        const n = st.players.filter(x=>x.bot).length;
        if(st.players.length>=8 || n>=3){ PV.ui.toast('max bots','err'); return; }
        st.players.push({pid:'BOT:'+(n+1), name:t('g.bot')+' '+(n+1), av:['robot','alien','wiz'][n%3], lvl:5, ready:true, bot:true});
        r.broadcastLobby(); draw();
      };
      view.querySelector('#startBtn').onclick = ()=> tryStart();
    } else {
      view.querySelector('#readyBtn').onclick = ()=>{
        const me2 = st.players.find(x=>x.pid===PV.net.selfId);
        if(me2){ r.sendReady({ready:!me2.ready}); }
        draw();
      };
    }
    const cin = view.querySelector('#cin');
    const sendChat = txt=>{
      if(!txt) return;
      r.sendChat({txt, from:PV.store.displayName(), av:PV.store.me()?.avatar});
      addChat({txt, from:PV.store.displayName(), av:PV.store.me()?.avatar, pid:PV.net.selfId});
      cin.value='';
      const p2 = PV.store.me();
      if(p2){ p2.stats.msgs++; PV.store.saveProfile(p2); PV.ach.evaluate({event:'chat', p:p2}); PV.missions.track({event:'chat', p:p2}); }
    };
    view.querySelector('#cgo').onclick = ()=> sendChat(cin.value.trim());
    cin.onkeydown = e=>{ if(e.key==='Enter') sendChat(cin.value.trim()); };
    view.querySelectorAll('[data-e]').forEach(b=> b.onclick = ()=> sendChat(b.dataset.e));

    function tryStart(){
      if(!st.game){ PV.ui.toast(t('rm.needGame'),'err'); return; }
      if(st.players.length<2){ PV.ui.toast(t('rm.needPlayers'),'err'); return; }
      if(st.players.some(pl=>!pl.ready && !pl.bot)){ PV.ui.toast(t('c.ready')+'؟','err'); return; }
      if(st.mode==='tournament' && st.players.length!==4){ PV.ui.toast(t('md.tourney')+' = 4','err'); return; }
      const payload = {gameId:st.game, mode:st.mode, seed:Math.floor(Math.random()*1e9), players:st.players};
      if(st.mode==='quick'){ payload.quickTo = 3; }
      r.startMatch(payload);
    }
  }

  function addChat(c){
    const log = view.querySelector('#clog'); if(!log) return;
    const me2 = c.pid===PV.net.selfId;
    log.insertAdjacentHTML('beforeend', `<div class="chat-msg ${me2?'me':''}"><span class="bub"><div class="who">${esc(c.from||'؟')}</div>${esc(c.txt)}</span></div>`);
    log.scrollTop = log.scrollHeight;
  }
}
PV.screens = PV.screens||{};
PV.screens.room = {render};
PV.screens.join = {render: (view,m)=>{ sessionStorage.setItem('pv:joinCode', m[1]); location.hash = '#/room/'+m[1]; PV.screens.room.render(view, m); }};
})();
