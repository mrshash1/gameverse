/* ============ Screen: Match (play shell around game modules) ============ */
(function(){
'use strict';
const PV = window.PV, U = PV.u, t = PV.t, V = PV.visuals;
const { esc, icon, fmt, avatarHtml } = U;

async function render(view, m){
  const gid = m[1];
  /* a live match of a DIFFERENT game (or an in-flight launch of one) must die
     before this game's shell mounts — otherwise the old game's DOM is injected
     into this shell and this game never launches (quick-switch bug) */
  const live0 = PV.sdk.current, launching0 = PV.sdk.launching;
  if(launching0!==gid && (live0 || launching0)) PV.sdk.destroy();
  const busy = PV.sdk.launching===gid;
  if(!PV.sdk.current && !busy){
    /* direct deep-link to a play url without options → solo */
    PV.sdk.launch({gameId:gid, mode:'solo'});
  }
  /* render the shell NOW (sdk.launch needs #game-root), then wait for the
     real match context so players/chat/room wiring never fall back to a stub */
  view.innerHTML = `
  <div class="play-wrap">
    <div class="play-main">
      <div class="play-top rise">
        <a class="btn sm ghost" href="#/" id="exitBtn" title="${t('pl.exitC')}">${icon('x',16)}</a>
        <span class="gt"><span class="av" style="width:36px;height:36px;border-radius:12px;overflow:hidden">${V.thumb(gid)}</span> ${esc(PV.t('g.'+gid))}</span>
        <span class="badge pp" id="pl-mode"></span>
        <span class="spacer"></span>
        <button class="btn sm icon ghost" id="soundBtn" title="${t('st.sound')}">${icon(PV.sound.enabled?'vol':'volOff',17)}</button>
        <button class="btn sm icon ghost" id="fsBtn" title="${t('pl.fullscr')}">${icon('expand',17)}</button>
      </div>
      <div class="score-strip rise rise-1" id="pl-scores"></div>
      <div class="board-shell rise rise-2">
        <div class="glowbg"></div>
        <div id="game-root" style="min-height:280px"></div>
      </div>
      <div class="turn-banner rise rise-2" id="pl-turn"></div>
      <div class="tiny muted center" id="pl-status"></div>
    </div>
    <div class="play-side rise rise-3">
      <div class="card" style="padding:14px">
        <b class="small">${t('c.players')}</b>
        <div class="col mt-1" style="gap:9px" id="pl-list"></div>
      </div>
      <div id="pl-chat-slot"></div>
      <div class="card" style="padding:13px">
        <b class="small">${t('gd.how')}</b>
        <p class="tiny muted mt-1">${esc(PV.t('g.'+gid+'.h'))}</p>
      </div>
    </div>
  </div>`;

  /* wait for THIS game's match to attach. Must poll on the match itself, NOT on
     the launching flag: launch() parks at its first await (script load microtask)
     BEFORE setting the flag, so a flag-only check exits early and the shell would
     wire itself to the stub ctx (empty score strip / player list). */
  let iter = 0;
  while(iter++<150 && PV.sdk.current?.ctx?.gameId!==gid) await U.sleep(40);
  const sdk = PV.sdk.current;
  const sdkOk = !!(sdk && sdk.ctx.gameId===gid);   /* never mount another game's match */
  const ctx = sdkOk? sdk.ctx : {gameId:gid, meta:PV.registry.get(gid), mode:'solo', players:[], room:null, selfPid:PV.net.selfId};
  const ctrl = sdkOk? (sdk.ctrl||null) : null;
  const g = ctx.meta;
  const p = PV.store.me();

  const modeEl = view.querySelector('#pl-mode');
  if(modeEl) modeEl.textContent = ctx.mode==='solo'? t('gd.solo') : t('md.'+(ctx.mode||'classic'));

  /* mount ctx.root into the (fresh) #game-root */
  const fresh = document.getElementById('game-root');
  if(ctx.root && ctx.root!==fresh && ctx.root.childNodes.length){ fresh.appendChild?.(ctx.root); }
  if(ctx.root !== fresh){ ctx.root = fresh; if(sdk) sdk.ctx.root = fresh; }

  drawScores();
  view.querySelector('#soundBtn').onclick = e=>{
    PV.store.saveSettings({sound: !PV.sound.enabled});
    e.currentTarget.innerHTML = icon(PV.sound.enabled?'vol':'volOff',17);
    PV.sound.play('tap');
  };
  view.querySelector('#fsBtn').onclick = ()=>{
    const el2 = document.querySelector('.play-main');
    try{ document.fullscreenElement? document.exitFullscreen() : el2.requestFullscreen(); }catch(e){}
  };
  view.querySelector('#exitBtn').onclick = async e=>{
    e.preventDefault();
    if(await PV.ui.confirmDlg(t('pl.exitC'), t('pl.left'))){
      const liveRoom = PV.sdk.current?.ctx?.room || ctx.room;   /* read AFTER launch race resolved */
      PV.sdk.destroy();
      location.hash = liveRoom? '#/room' : '#/';
    }
  };
  function drawScores(){
    const scores = ctrl?.getScores?.() || {};
    const list = ctx.players||[];
    view.querySelector('#pl-list').innerHTML = list.map(pl=>`
      <div class="row" style="gap:9px">
        ${avatarHtml(pl,34,{lvl:!!pl.lvl})}
        <b class="small" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(pl.name)}${pl.pid===PV.net.selfId? ' ('+t('c.you')+')':''}</b>
        <b class="num" style="color:var(--p1)">${fmt(scores[pl.pid]??0)}</b>
      </div>`).join('');
    const strip = view.querySelector('#pl-scores');
    if(list.length<=2){
      const me = list.find(x=>x.pid===PV.net.selfId) || list[0];
      const op = list.find(x=>x.pid && x.pid!==me?.pid) || (list.length===1? {name:'🤖 '+t('g.bot')} : undefined);
      const myScore = scores[me?.pid] ?? scores[ctx.selfPid] ?? 0;   /* solo entries use pid:'me' while games key scores by selfPid */
      strip.innerHTML = `
        <span class="sc">${me? avatarHtml(me,40):''}<b>${esc(me?.name||t('c.you'))}</b><b class="num" style="color:var(--p1)">${fmt(myScore)}</b></span>
        <span class="vs">VS</span>
        <span class="sc">${op? avatarHtml(op,40):''}<b>${esc(op?.name||'—')}</b><b class="num" style="color:var(--p4)">${fmt(scores[op?.pid]??0)}</b></span>`;
    } else {
      /* 3+ players (quiz): compact chips sorted by score */
      const sorted = [...list].sort((a,b)=>(scores[b?.pid]??0)-(scores[a?.pid]??0));
      strip.innerHTML = sorted.map((pl,i)=>`
        <span class="sc mini ${pl.pid===PV.net.selfId?'me':''}">
          <span class="rk">${icon(i===0?'crown':'user',13)}</span>${avatarHtml(pl,30)}
          <b>${esc(pl.name)}</b><b class="num" style="color:var(--p1)">${fmt(scores[pl.pid]??0)}</b>
        </span>`).join('');
    }
  }
  /* live score refresh */
  const iv = setInterval(()=>{
    if(!document.getElementById('pl-scores')){ clearInterval(iv); return; }
    drawScores();
    if(ctrl?.getStatus?.()){ const st=document.getElementById('pl-status'); if(st) st.textContent = ctrl.getStatus(); }
  }, 700);
  if(ctx.room){
    /* room chat mounts lazily once the real ctx is known */
    const slot = view.querySelector('#pl-chat-slot');
    if(slot) slot.innerHTML = `
      <div class="chat-box" style="height:300px">
        <div class="bd-h" style="padding:11px 14px;border-bottom:1.5px solid var(--border);font-weight:900;font-size:.86rem">${icon('chat',15)} ${t('rm.chat')}</div>
        <div class="chat-log" id="clog"></div>
        <div class="chat-inp">
          <input class="inp" id="cin" placeholder="${t('rm.chatPh')}" maxlength="120">
          <button class="btn icon" id="cgo">${icon('send',16)}</button>
        </div>
      </div>`;
    ctx.room.on('chat', c=>{
      const log = document.getElementById('clog'); if(!log) return;
      const me2 = c.pid===PV.net.selfId;
      log.insertAdjacentHTML('beforeend', `<div class="chat-msg ${me2?'me':''}"><span class="bub"><div class="who">${esc(c.from||'؟')}</div>${esc(c.txt)}</span></div>`);
      log.scrollTop = log.scrollHeight;
    });
    const cin = document.getElementById('cin');
    document.getElementById('cgo').onclick = ()=>{ if(cin.value.trim()){ ctx.room.sendChat({txt:cin.value.trim(), from:PV.store.displayName(), av:p?.avatar}); cin.value=''; } };
    cin.onkeydown = e=>{ if(e.key==='Enter' && cin.value.trim()){ ctx.room.sendChat({txt:cin.value.trim(), from:PV.store.displayName(), av:p?.avatar}); cin.value=''; } };
  }
}
PV.screens = PV.screens||{};
PV.screens.play = {render};
})();
