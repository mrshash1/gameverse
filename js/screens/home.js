/* ============ Screen: Home ============ */
(function(){
'use strict';
const PV = window.PV, U = PV.u, t = PV.t, V = PV.visuals;
const { esc, icon, fmt, avatarHtml } = U;

const CART_SVG = `<svg viewBox="0 0 120 120"><g transform="translate(60 62)"><ellipse rx="52" ry="18" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="2.5" stroke-dasharray="3 7" transform="rotate(-22)"/><circle cx="44" cy="-22" r="6" fill="#ffb020"/><circle cx="-47" cy="20" r="4.4" fill="#ff5c9d"/><path d="M0-38 L33-19 L33 19 L0 38 L-33 19 L-33-19Z" fill="rgba(255,255,255,.2)" stroke="rgba(255,255,255,.55)" stroke-width="2"/><g transform="translate(0 2)"><path d="M-16-8 C-24-8 -27 1 -27 5.5 C-27 11 -23.5 14.5 -20 14.5 C-17.5 14.5 -16 12 -13 12 L13 12 C16 12 17.5 14.5 20 14.5 C23.5 14.5 27 11 27 5.5 C27 1 24-8 16-8Z" fill="#fff"/><circle cx="-11.5" cy="2.5" r="4" fill="#7c5cff"/><rect x="-14.8" y="1.2" width="6.6" height="2.6" rx="1.3" fill="#fff"/><circle cx="11.5" cy="2.5" r="4" fill="#00c9bd"/><circle cx="11.5" cy="2.5" r="1.8" fill="#fff"/><circle cx="2" cy="-3" r="1.9" fill="#ff5c9d"/><circle cx="7.4" cy="-3" r="1.9" fill="#ffb020"/></g></g></svg>`;

async function render(view){
  const p = PV.store.me();
  const games = PV.registry.all().filter(g=>PV.registry.enabled(g.id));
  const favs = PV.store.settings.favs||[];
  const favGames = games.filter(g=>favs.includes(g.id));
  const trending = [...games].sort((a,b)=>b.plays-a.plays).slice(0,5);
  const continueList = p ? (p.history||[]).slice(0,5).map(h=>PV.registry.get(h.g)).filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).slice(0,4) : [];

  const onlineFriends = p ? PV.net.onlineFriends(p.friends||[]) : [];
  const liveRooms = PV.net.liveRooms().slice(0,6);
  const missions = p? PV.missions.today() : [];
  const topRows = await PV.cloud.globalBoard();

  view.innerHTML = `
  <section class="hero rise">
    <div class="hi">
      <div class="ht">
        <h1>${t('home.h1')}</h1>
        <p>${t('home.p')}</p>
        <div class="hb">
          <button class="btn wt lg" id="q-quick">${icon('zap',20)} ${t('home.quick')}</button>
          <button class="btn ot" id="q-create">${icon('plus',18)} ${t('home.create')}</button>
          <a class="btn ot" href="#/discover">${icon('compass',18)} ${t('home.browse')}</a>
        </div>
      </div>
      <div class="hcart">${CART_SVG}</div>
    </div>
  </section>

  <div class="joinbar rise rise-1">
    ${icon('swords',22)}
    <input class="inp" id="join-code" maxlength="5" placeholder="${t('home.join')}">
    <button class="btn cyan" id="join-go">${t('home.go')}</button>
  </div>

  ${liveRooms.length? `
  <div class="rise rise-1">${PV.ui.sectHead(t('home.liveRooms'), 'wifi', '#/discover')}
    <div class="hrow">${liveRooms.map(r=>roomPill(r)).join('')}</div>
  </div>`:''}

  <div class="rise rise-2">${PV.ui.sectHead(t('home.trend'), null, '#/discover')}
    <div class="hrow" id="trend-row"></div>
  </div>

  ${continueList.length? `<div class="rise rise-2">${PV.ui.sectHead(t('home.continue'), 'clock')}
    <div class="hrow" id="cont-row"></div>
  </div>`:''}

  ${favGames.length? `<div class="rise rise-3">${PV.ui.sectHead(t('disc.favs'), 'heart')}
    <div class="hrow" id="fav-row"></div>
  </div>`:''}

  <div class="rise rise-3">${PV.ui.sectHead(t('home.onlineFr'), 'users', '#/friends')}
    <div class="hrow" id="fr-row">${friendsRow(onlineFriends, p)}</div>
  </div>

  <div class="rise rise-4">${PV.ui.sectHead(t('home.missions'), null, '#/rewards')}
    <div style="display:flex;gap:12px;flex-wrap:wrap">${missions.map(m=>missionMini(m)).join('') || `<div class="card small muted">${t('pf.loginFirst')}</div>`}</div>
  </div>

  <div class="rise rise-5">${PV.ui.sectHead(t('home.top'), null, '#/boards')}
    <div class="col" style="gap:8px">${PV.ui.lbList(topRows.slice(0,5), p?.name)}</div>
  </div>`;

  /* fill rows with cards */
  const card = g=> PV.ui.gameCard(g);
  trending.forEach(g=> view.querySelector('#trend-row').appendChild(card(g)));
  continueList.forEach(g=> view.querySelector('#cont-row')?.appendChild(card(g)));
  favGames.forEach(g=> view.querySelector('#fav-row')?.appendChild(card(g)));

  /* actions */
  view.querySelector('#join-go').onclick = async ()=>{
    const c = view.querySelector('#join-code').value.trim().toUpperCase();
    if(c.length<4){ PV.ui.toast(t('rm.notFound'),'err'); return; }
    joinByCode(c);
  };
  view.querySelector('#q-create').onclick = ()=>{ location.hash='#/room'; };
  view.querySelector('#q-quick').onclick = ()=> quickPlay();

  PV.net.events.on('lobby', onNet);
  function onNet(){
    const el2 = view.querySelector('#fr-row'); if(!el2) return;
    el2.innerHTML = friendsRow(PV.net.onlineFriends(p?.friends||[]), p);
    const rr = view.querySelector('#live-rooms'); 
  }
  const cleanup = ()=>{ PV.net.events.m['lobby'] = (PV.net.events.m['lobby']||[]).filter(f=>f!==onNet); };
  window.addEventListener('hashchange', cleanup, {once:true});

  function roomPill(r){
    const g = r.game? PV.registry.get(r.game) : null;
    return `<div class="room-pill" data-code="${esc(r.code)}">
      <span class="av" style="width:34px;height:34px">${g? V.thumb(r.game) : V.logo}</span>
      <span><b class="rcode">${esc(r.code)}</b><span class="tiny muted" style="display:block">${esc(g? PV.t('g.'+g.id):'…')} · ${fmt(r.n)}/${r.max||8}</span></span>
      <span class="spacer"></span><span style="color:var(--p1)">${icon('next',18)}</span>
    </div>`;
  }
  view.querySelectorAll('.room-pill').forEach(pill=> pill.onclick = ()=> joinByCode(pill.dataset.code));

  function friendsRow(list, me){
    if(!me) return `<div class="card small muted" style="min-width:220px">${t('c.needLogin')} <a href="#/auth" style="color:var(--p1);font-weight:800">${t('nav.login')}</a></div>`;
    if(!list.length) return `<div class="card small muted" style="min-width:220px">${t('home.noFrOnline')}</div>`;
    return list.map(f=>`<div class="fr-card" data-u="${esc(f.u)}">${avatarHtml({avatar:f.av, xp:0, name:f.u},46,{dot:true,lvl:true})}<b>${esc(f.u)}</b><span class="badge ok tiny">${t('c.online')}</span></div>`).join('');
  }
  view.querySelectorAll('.fr-card').forEach(fc=> fc.onclick = ()=> location.hash='#/friends');

  function missionMini(m){
    const def = PV.missions.defs().find(d=>d.id===m.id);
    if(!def) return '';
    const pct = Math.min(100, Math.round(m.prog/def.goal*100));
    return `<div class="mission-mini">
      <span class="mic" style="background:rgba(124,92,255,.12);color:var(--p1)">${icon(def.ic,20)}</span>
      <div class="mt"><b>${esc(t(PV.missions.META[m.id]))}</b>
        <div class="pbar"><i style="width:${pct}%"></i></div>
        <span class="tiny muted">${fmt(Math.min(m.prog,def.goal))}/${fmt(def.goal)}</span>
      </div>
      ${m.claimed? `<span class="badge ok">${t('mi.claimed')}</span>` : m.done? `<button class="btn sm gold" data-claim="${m.id}">${icon('coin',14)} ${t('mi.claim')}</button>`:''}
    </div>`;
  }
  view.querySelectorAll('[data-claim]').forEach(b=> b.onclick = ()=>{
    const rw = PV.missions.claim(b.dataset.claim);
    if(rw){ PV.sound.play('coin'); PV.ui.toast('+'+U.fmt((rw.xp||0))+' XP +'+U.fmt((rw.coins||0))+' 🪙','gold','coin'); PV.router.render(); }
  });
}

/* quick play: matchmake for a random online-friendly game, else open room */
async function quickPlay(){
  const candidates = ['tictactoe','rps','connect4','reaction','quiz','memory','word'];
  const g = candidates[Math.floor(Math.random()*candidates.length)];
  if(PV.net.status!=='ok'){ PV.ui.toast(t('mm.netFail'),'err'); location.hash='#/room'; return; }
  PV.ui.modal({title:t('mm.searching'), body:`<div class="col center" style="padding:18px 0">
    <div class="spinner" style="width:44px;height:44px;border-width:4px"></div>
    <p class="muted small">${t('mm.sub')}</p></div>`, actions:[{label:t('mm.cancel'), cls:'ghost', onClick:()=>{ PV.net.leaveQueue(); }}]});
  const ok = await PV.net.queueUp(g, found=>{
    PV.net.leaveQueue();
    document.querySelector('#modal-root .x')?.click();
    PV.ui.toast(t('mm.found'),'ok','swords');
    const r = PV.net.createRoom();
    location.hash = '#/room';
    setTimeout(()=>{
      if(r.amHost){ r.lobbyState.game = g; r.broadcastLobby(); r.startMatch({gameId:g, seed:Math.floor(Math.random()*1e9), mode:'classic'}); }
    }, 900);
  });
  if(!ok){ document.querySelector('#modal-root .x')?.click(); PV.ui.toast(t('mm.netFail'),'err'); }
}
async function joinByCode(c){
  if(PV.net.status!=='ok'){ PV.ui.toast(t('mm.netFail'),'err'); return; }
  location.hash = '#/room/'+c;
}
PV.screens = PV.screens||{};
PV.screens.home = {render};
PV.homeQuick = {quickPlay, joinByCode};
})();
