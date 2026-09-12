/* ============ PlayVerse SDK — match shell, lifecycle, rewards, overlay ============ */
(function(){
'use strict';
const PV = window.PV, U = PV.u, t = PV.t, V = PV.visuals;
const { el, esc, icon, fmt } = U;

let current = null;
let launching = null;
let activeGm = null;   /* message handlers of the ACTIVE match only (no leaks) */

async function launch(opts){
  /* opts: {gameId, mode:'solo'|'online', diff, room, tournament:{round} } */
  const meta = PV.registry.get(opts.gameId);
  if(!meta) { PV.ui.toast('game not found','err'); return; }
  const factory = await PV.registry.ensureLoaded(opts.gameId);
  if(!factory){ PV.ui.toast('module missing: '+opts.gameId,'err'); return; }
  if(current){ try{ current.ctrl?.destroy?.(); }catch(e){} try{ current.ctrl?.end?.(); }catch(e){} current=null; }
  launching = opts.gameId;
  location.hash = '#/play/'+opts.gameId;
  /* wait for the play screen shell to mount */
  let rootEl = null;
  for(let i=0;i<80 && !rootEl;i++){
    rootEl = document.getElementById('game-root');
    if(!rootEl) await U.sleep(40);
  }
  if(!rootEl){ PV.ui.toast(t('c.retry'),'err'); return; }
  await U.sleep(10);

  const p = PV.store.me();
  const room = opts.room || PV.net.room || null;
  const players = opts.players || (room? room.players() : [{pid:'me', name:PV.store.displayName(), av:p?.avatar, lvl:1}]);
  const seed = opts.seed ?? Math.floor(Math.random()*1e9);
  const ctx = {
    root: document.getElementById('game-root'),
    gameId: opts.gameId, meta,
    mode: opts.mode || 'solo',
    diff: opts.diff || 'normal',
    room, players, seed,
    rng: U.mulberry32(seed),
    amHost: opts.mode==='solo' ? true : (room ? room.amHost : true),
    selfPid: PV.net.selfId,
    botPid: null,
    _finishing: false,
    /* ui helpers */
    setStatus(txt){ const n=document.getElementById('pl-status'); if(n) n.textContent=txt; },
    setTurn(txt, cls){ const n=document.getElementById('pl-turn'); if(n){ n.innerHTML=txt; n.className='turn-banner '+(cls||''); } },
    setScores(html){ const n=document.getElementById('pl-scores'); if(n) n.innerHTML=html; },
    send(k, d, to){ if(room) room.gameMsg(k, d, to); },
    /* handlers live in a per-match map; ONE room dispatcher routes to the active match.
       Old matches never receive new messages (fixes phantom-move bugs on rematch). */
    on(k, fn){ (ctx._gm ||= {})[k] = fn; },
    broadcast(k, d){ if(room) room.gameMsg(k, d); },
    _gm: null,
    finish: (result)=> finishMatch(opts, ctx, result),
    destroy: null,
  };
  let ctrl = null;
  try{ ctrl = factory(ctx); }catch(e){ console.error(e); }
  ctx.destroy = ()=>{ try{ ctrl?.destroy?.(); }catch(e){} try{ ctrl?.end?.(); }catch(e){} };
  current = {ctx, ctrl, opts, started:Date.now()};
  activeGm = ctx._gm || (ctx._gm = {});
  if(room){
    room.on('gm', m=>{ /* single dispatcher → only the ACTIVE match reacts */
      const fn = activeGm?.[m.k];
      if(fn){ try{ fn(m.d, m.from); }catch(e){ console.error('gm', m.k, e); } }
    });
  }
  try{ ctrl?.init?.(); ctrl?.start?.(); }catch(e){ console.error(e); }
  launching = null;
  PV.sound.play('whoosh');
  return ctx;
}

function finishMatch(opts, ctx, result){
  if(ctx._finishing) return;
  ctx._finishing = true;
  const {res, scores, perf=0, stats, vsHuman} = result||{};
  const g = opts.gameId;
  const p = PV.store.me();
  const online = opts.mode!=='solo' && vsHuman!==false;
  const won = res==='w', draw = res==='d';

  /* XP & coins */
  let xp=0, coins=0, ratingDelta=0;
  if(p && !PV.store.isGuest()){
    xp = U.matchXp({won, draw, mode:opts.tournament?'tournament':(opts.mode==='ranked'?'ranked':'classic'), perf});
    coins = U.matchCoins(won);
    if(online && opts.mode==='ranked'){
      const opp = (ctx.players||[]).find(x=>x.pid!==ctx.selfPid && x.pid!=='BOT');
      const myR = PV.store.rating(g), oppR = opp?.rating ?? (myR||1000);
      ratingDelta = U.elo(myR, oppR, won?1:draw?.5:0) - myR;
      PV.store.setRating(g, myR + ratingDelta);
    }
    PV.store.addCoins(coins);
    PV.store.addHistory({g, mode:opts.mode, res:res||'d', score:scores?.[ctx.selfPid]??null, ts:Date.now(), xp});
    const lp = PV.store.addXP(xp);
    if(lp?.levelUp){ PV.ui.toast(t('c.lvl')+' '+fmt(lp.levelUp)+' 🎉','gold','crown'); PV.sound.play('fanfare'); }
    /* win streak */
    if(won){
      const s = (PV.U.LS.get('wstreak:'+p.u, 0)||0)+1;
      PV.U.LS.set('wstreak:'+p.u, s);
      PV.ach.evaluate({event:'streak', n:s, p});
      if(s>=(p.stats.bestWinStreak||0)){ p.stats.bestWinStreak = s; PV.store.saveProfile(p); }
    } else if(!draw){ PV.U.LS.set('wstreak:'+p.u, 0); }
    /* achievements + missions */
    if(stats) for(const [k,v] of Object.entries(stats)) PV.ach.evaluate({event:'stat', g, stat:k, val:v, p});
    PV.ach.evaluate({event:'match:end', g, res, mode:opts.mode, vsHuman:online, p});
    PV.missions.track({event:'match:end', g, res, mode:opts.mode, vsHuman:online});
    PV.missions.track({event:'xp', n:xp});
    /* cloud score */
    const myScore = scores?.[ctx.selfPid];
    if(myScore!=null){ PV.store.pushScore(g, myScore); if(online||opts.mode==='solo') PV.cloud.postScore(g, myScore); }
    PV.cloud.pushProfile();
    PV.registry.bumpPlays(g);
    PV.cloud.bumpMatches();
  }

  /* overlay */
  const title = draw? t('pl.drawT') : won? t('pl.victory') : t('pl.defeat');
  const cls = draw? '' : won? 'win':'lose';
  PV.sound.play(won?'win':draw?'drawS':'lose');
  if(won) PV.ui.confetti();

  const board = document.querySelector('.board-shell');
  if(board && !board.querySelector('.overlay')){
    const trophy = won? V.tierIcon('tier.gold1', 90) : V.icon(draw?'dice':'swords', 80, 1.4);
    const ov = el(`<div class="overlay"><div class="ov-card">
      <div class="ov-trophy ${won?'':'ov-trophy'}">${won?V.tierIcon('tier.gold1',96):`<span style="color:${draw?'#3ba9ff':'#ff7a95'};display:inline-block">${icon(draw?'clock':'swords',84,1.3)}</span>`}</div>
      <div class="otitle">${title}</div>
      <div class="osub">${esc(result?.sub||'')}</div>
      ${p&&!PV.store.isGuest()?`<div class="ov-rewards">
        ${xp?`<span class="rw">${icon('spark',16)} ${t('pl.xp',{n:fmt(xp)})}</span>`:''}
        ${coins?`<span class="rw">${icon('coin',16)} ${t('pl.coins',{n:fmt(coins)})}</span>`:''}
        ${ratingDelta?`<span class="rw">${icon('medal',16)} ${ratingDelta>0?'+':''}${fmt(ratingDelta)}</span>`:''}
      </div>`:''}
      <div class="ov-btns">
        ${opts.mode==='solo'?`<button class="btn" id="ov-again">${icon('refresh',17)} ${t('pl.again')}</button>`:''}
        ${opts.mode!=='solo'?`<button class="btn" id="ov-lobby">${icon('users',17)} ${t('pl.toLobby')}</button>`:''}
        <button class="btn ghost" id="ov-home">${t('nav.home')}</button>
      </div>
    </div></div>`);
    board.appendChild(ov);
    ov.querySelector('#ov-again')?.addEventListener('click', ()=>{ ov.remove(); launch({...opts}); });
    ov.querySelector('#ov-lobby')?.addEventListener('click', ()=>{ location.hash = '#/room'; });
    ov.querySelector('#ov-home')?.addEventListener('click', ()=>{ location.hash = '#/'; });
  }
  document.dispatchEvent(new CustomEvent('pv:matchover', {detail:{g, res, won}}));
}

function destroy(){
  if(current){ try{ current.ctrl?.destroy?.(); }catch(e){} current=null; }
  activeGm = null;
  launching = null;
}

/* solo quick helper used by detail screen */
function solo(gameId, diff){ return launch({gameId, mode:'solo', diff: diff||'normal'}); }

PV.sdk = { launch, finishMatch, destroy, get current(){return current;}, get launching(){return launching;} };
})();
