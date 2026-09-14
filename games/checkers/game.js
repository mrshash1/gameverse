/* ============ Game: چکرز (Checkers) — American rules, minimax bot, host-authoritative online ============
   • 8×8, 12 discs • men jump/capture forward only, kings both ways • CAPTURES FORCED (highlighted)
   • multi-jump chains must continue (piece locked) • crowning ends move • win = wipe or opponent stuck
   • 50 half-move draw • animated arc jumps + capture pop • Bot: minimax+αβ (easy d2 / normal d4 / hard d6)
   • Online: guest ctx.send('mv' per hop) → host validates forced-legality + applies + broadcasts 'st'/'over'
=================================================================== */
(function(){
'use strict';
const PV = window.PV, U = PV.u, t = PV.t;
const { fmt } = U;

const LANG = ()=> (PV.i18n && PV.i18n.lang) || 'fa';
const L = {
  fa:{
    think:'🤖 دارد فکر می‌کند…', yourTurn:'نوبت شما — مهره‌ای بزنید',
    forced:'گرفتن اجباری!', chain:'پرش را ادامه بده!', crown:'تاج! مهره شاه شد',
    draw50:'مساوی — ۵۰ نیم‌حرکت بدون گرفتن',
    undo:'', moves:'حرکت', you:'شما', bot:'ربات',
    wins:'برد', draws:'مساوی', losses:'باخت', streak:'🔥 پیاپی',
    hint:'مهره را بزن ← خانه‌ی مقصد را بزن', wait:'⏳ در انتظار حریف…',
    winT:'🏆 بردی!', loseT:'😔 باختی',
  },
  en:{
    think:'🤖 Bot is thinking…', yourTurn:'Your turn — pick a disc',
    forced:'Capture is mandatory!', chain:'Continue the jump!', crown:'Crowned!',
    draw50:'Draw — 50 half-moves without capture',
    undo:'', moves:'Move', you:'You', bot:'Bot',
    wins:'Wins', draws:'Draws', losses:'Losses', streak:'🔥 Streak',
    hint:'Tap a disc ← tap a target', wait:'⏳ Waiting for opponent…',
    winT:'🏆 You win!', loseT:'😔 You lost',
  },
};
const tt = k => (L[LANG()] && L[LANG()][k]) || L.fa[k] || k;

/* ============================== ENGINE ============================== */
const UP = [[-1,-1],[-1,1]];          /* seat 0 (bottom) moves up  */
const DN = [[1,-1],[1,1]];            /* seat 1 (top) moves down   */
const DIAG = [[-1,-1],[-1,1],[1,-1],[1,1]];
const MATE = 100000;

function startBoard(){
  const b = new Int8Array(64);
  for(let r=0;r<3;r++) for(let c=0;c<8;c++) if((r+c)%2===1) b[r*8+c] = -1;
  for(let r=5;r<8;r++) for(let c=0;c<8;c++) if((r+c)%2===1) b[r*8+c] = 1;
  return b;
}
/* all jumps available to the piece at index i for side (0 = white/bottom) */
function jumpsFrom(b, i, side){
  const w = side===0, v = b[i];
  if(!v || (v>0)!==w) return [];
  const r=i>>3, c=i&7, king = Math.abs(v)===2;
  const dirs = king? DIAG : (w? UP : DN);
  const out=[];
  for(const d of dirs){
    const mr=r+d[0], mc=c+d[1], lr=r+2*d[0], lc=c+2*d[1];
    if(lr<0||lr>7||lc<0||lc>7) continue;
    const mi=mr*8+mc, tv=b[mi];
    if(!tv || (tv>0)===w) continue;
    if(b[lr*8+lc]!==0) continue;
    out.push({f:i, t:lr*8+lc, cap:mi});
  }
  return out;
}
/* full move set for side to move — captures FORCED, lock restricts to the chained piece */
function movesFor(st){
  const w = st.turn===0;
  if(st.lock!=null){
    const js = jumpsFrom(st.b, st.lock, st.turn);
    if(js.length) return {moves:js, forced:true};
  }
  const jumps=[], steps=[];
  for(let i=0;i<64;i++){
    const v=st.b[i]; if(!v || (v>0)!==w) continue;
    const js = jumpsFrom(st.b, i, st.turn);
    if(js.length){ for(const j of js) jumps.push(j); continue; }
    const r=i>>3, c=i&7, king=Math.abs(v)===2;
    const dirs = king? DIAG : (w? UP : DN);
    for(const d of dirs){
      const rr=r+d[0], cc=c+d[1];
      if(rr<0||rr>7||cc<0||cc>7) continue;
      const ti=rr*8+cc;
      if(st.b[ti]===0) steps.push({f:i, t:ti, cap:null});
    }
  }
  return jumps.length? {moves:jumps, forced:true} : {moves:steps, forced:false};
}
/* one hop; chains keep the turn + lock; crowning always ends the move */
function applyHop(st, m){
  const b = st.b.slice(), w = st.turn===0;
  let v = b[m.f];
  const wasMan = Math.abs(v)===1;
  b[m.f]=0;
  let crowned=false;
  const r = m.t>>3;
  if(wasMan && ((w && r===0) || (!w && r===7))){ v = w? 2 : -2; crowned=true; }
  b[m.t]=v;
  if(m.cap!=null) b[m.cap]=0;
  const half = (m.cap!=null || wasMan)? 0 : st.half+1;
  let turn = 1-st.turn, lock=null;
  if(m.cap!=null && !crowned){
    const more = jumpsFrom(b, m.t, st.turn);
    if(more.length){ turn = st.turn; lock = m.t; }
  }
  return {b, turn, half, lock, seq:(st.seq||0)+1};
}

function evalBoard(b){
  let e=0;
  for(let i=0;i<64;i++){
    const v=b[i]; if(!v) continue;
    const w=v>0, man=Math.abs(v)===1, r=i>>3, c=i&7;
    let s = man? 100 : 165;
    if(man) s += (w? 7-r : r)*4;
    if(man && (w? r===7 : r===0)) s += 8;
    if(c>=2 && c<=5) s += 4;
    if(!man && (r===0 || r===7)) s -= 6;
    e += w? s : -s;
  }
  return e;
}

let _t0 = 0, _nodes = 0;
function negamax(st, depth, alpha, beta){
  const {moves} = movesFor(st);
  if(!moves.length) return -MATE;
  if(st.half>=50) return 0;
  if(depth<=0 || ((++_nodes & 511)===0 && performance.now()-_t0 > 1250))
    return (st.turn===0? 1 : -1)*evalBoard(st.b);
  let best = -Infinity;
  for(const m of moves){
    const child = applyHop(st, m);
    const sc = child.turn===st.turn
      ? negamax(child, depth-1, alpha, beta)             /* chain continues — same maximizer */
      : -negamax(child, depth-1, -beta, -alpha);
    if(sc>best) best=sc;
    if(best>alpha) alpha=best;
    if(alpha>=beta) break;
  }
  return best;
}
function botHop(st, diff, rng){
  const {moves} = movesFor(st);
  if(!moves.length) return null;
  if(diff==='easy' && rng()<.2) return moves[(rng()*moves.length)|0];
  const depth = diff==='easy'? 2 : diff==='normal'? 4 : 6;
  const noise = diff==='hard'? 0 : diff==='normal'? 6 : 30;
  _t0 = performance.now(); _nodes = 0;
  let best=null, bestSc=-Infinity, alpha=-Infinity;
  for(const m of moves){
    const child = applyHop(st, m);
    const base = child.turn===st.turn
      ? negamax(child, depth-1, alpha, Infinity)
      : -negamax(child, depth-1, -Infinity, -alpha);
    const sc = base + (rng()*2-1)*noise;
    if(sc>bestSc){ bestSc=sc; best=m; }
    if(bestSc>alpha) alpha=bestSc;
  }
  return best;
}

/* ============================== GAME MODULE ============================== */
PV.registry.register({
  id:'checkers', cats:['board','classic','family'], players:[2,2], modes:['solo','online'], weight:89,
  factory: function(ctx){
    const isMP = ctx.mode!=='solo';
    const players = ctx.players||[];
    const rng = ctx.rng || Math.random;
    const hostPid = players[0]?.pid;
    const mySeat = isMP? Math.max(0, players.findIndex(p=>p.pid===ctx.selfPid)) : 0;
    const botSeat = 1-mySeat;
    const flip = isMP && mySeat===1;
    const diff = ctx.diff || 'normal';
    const STATS_KEY = 'pv:stats:checkers';

    let state, lastM, caps, plies, sel, over, fin, seq, botTO, paused, busy;

    /* ------------------------------ DOM ------------------------------ */
    const root = document.createElement('div');
    root.innerHTML = `
<style>
.pvchk-wrap{display:flex;flex-direction:column;align-items:center;gap:9px;width:100%;padding:2px 0 10px;font-family:inherit}
.pvchk-strip{display:flex;align-items:center;gap:8px;width:min(92vw,60vh);direction:ltr}
.pvchk-cap{display:flex;align-items:center;flex:1;min-height:18px;flex-wrap:wrap}
.pvchk-cap.r{justify-content:flex-end}
.pvchk-cap b{font-size:.7rem;color:var(--tx2);margin:0 5px;font-variant-numeric:tabular-nums}
.pvchk-mini{display:inline-block;width:12px;height:12px;border-radius:50%;margin:0 1.5px;box-shadow:inset 0 -2px 3px rgba(0,0,0,.3)}
.pvchk-mini.p1{background:radial-gradient(circle at 35% 30%,#ff8fa8,#c22247)}
.pvchk-mini.p2{background:radial-gradient(circle at 35% 30%,#ffedc4,#dfa032)}
.pvchk-tools{display:flex;gap:6px;justify-content:center}
.pvchk-btn{background:var(--surface2);border:1.5px solid var(--border);border-radius:999px;padding:4px 13px;font-size:.78rem;font-weight:800;color:var(--tx2);cursor:pointer;box-shadow:var(--sh-1);transition:transform .12s;font-family:inherit}
.pvchk-btn:active{transform:scale(.93)}
.pvchk-bwrap{position:relative}
.pvchk-board{position:relative;display:grid;grid-template-columns:repeat(8,1fr);width:min(92vw,60vh);aspect-ratio:1;border-radius:14px;overflow:hidden;
  box-shadow:var(--sh-3),0 0 0 1.5px var(--border);direction:ltr;touch-action:manipulation;user-select:none;-webkit-user-select:none}
.pvchk-cell{position:relative;display:flex;align-items:center;justify-content:center;cursor:pointer;-webkit-tap-highlight-color:transparent}
.pvchk-cell.lt{background:linear-gradient(135deg,#f1ecfa,#e6dff5)}
.pvchk-cell.dk{background:linear-gradient(135deg,#585488,#4a4676)}
.pvchk-cell.last::before{content:'';position:absolute;inset:0;background:rgba(255,193,7,.3)}
.pvchk-cell.sel::before{content:'';position:absolute;inset:0;background:rgba(124,92,255,.36);box-shadow:inset 0 0 0 3px rgba(255,255,255,.55)}
.pvchk-cell.dot::after{content:'';position:absolute;width:30%;height:30%;border-radius:50%;
  background:radial-gradient(circle at 35% 32%,#5cf09a,#16a34a);box-shadow:0 2px 7px rgba(22,163,74,.55);z-index:2}
.pvchk-cell.ring::after{content:'';position:absolute;width:82%;height:82%;border-radius:50%;
  border:3.5px solid rgba(239,68,68,.9);box-shadow:0 0 11px rgba(239,68,68,.4),inset 0 0 8px rgba(239,68,68,.25);z-index:2}
.pvchk-d{position:relative;width:76%;height:76%;border-radius:50%;z-index:1;
  box-shadow:0 4px 8px rgba(0,0,0,.38),inset 0 -4px 8px rgba(0,0,0,.28),inset 0 3px 6px rgba(255,255,255,.35);
  transition:transform .15s}
.pvchk-d.p1{background:radial-gradient(circle at 32% 28%,#ff97ac,#e5405f 55%,#a91c3c)}
.pvchk-d.p2{background:radial-gradient(circle at 32% 28%,#fff0cb,#e8ac3e 55%,#c98a1e)}
.pvchk-d.king{box-shadow:0 4px 8px rgba(0,0,0,.38),inset 0 -4px 8px rgba(0,0,0,.28),inset 0 3px 6px rgba(255,255,255,.3),
  0 0 0 2.5px rgba(255,193,7,.85),0 0 14px rgba(255,176,32,.55)}
.pvchk-d.king::after{content:'👑';position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  font-size:calc(min(92vw,60vh)/17);filter:drop-shadow(0 1px 1px rgba(0,0,0,.45))}
.pvchk-cell.must .pvchk-d{animation:pvchk-must 1s ease-in-out infinite}
@keyframes pvchk-must{
  0%,100%{filter:drop-shadow(0 0 5px rgba(255,176,32,.95))}
  50%{filter:drop-shadow(0 0 12px rgba(255,176,32,.45))}}
.pvchk-cell.mvbl .pvchk-d{cursor:pointer;filter:drop-shadow(0 0 5px rgba(124,92,255,.7))}
.pvchk-d.pop{animation:pvchk-pop .32s cubic-bezier(.34,1.56,.64,1)}
@keyframes pvchk-pop{0%{transform:scale(.35)}100%{transform:scale(1)}}
.pvchk-fly{position:absolute;width:12.5%;height:12.5%;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:6}
.pvchk-stats{display:flex;gap:6px;flex-wrap:wrap;justify-content:center}
.pvchk-chip{display:inline-flex;align-items:center;gap:5px;background:var(--surface2);border:1.5px solid var(--border);
  border-radius:999px;padding:3px 11px;font-size:.76rem;font-weight:800;color:var(--tx2);box-shadow:var(--sh-1)}
.pvchk-chip b{font-variant-numeric:tabular-nums;color:var(--tx)}
</style>
<div class="pvchk-wrap">
  <div class="pvchk-strip">
    <span class="pvchk-cap" id="pvchkCapT"></span>
    <span class="pvchk-cap r" id="pvchkNo"></span>
  </div>
  <div class="pvchk-bwrap"><div class="pvchk-board" id="pvchkBoard"></div></div>
  <div class="pvchk-strip">
    <span class="pvchk-cap" id="pvchkCapB"></span>
  </div>
  <div class="pvchk-stats" id="pvchkStats"></div>
</div>`;
    ctx.root.appendChild(root);
    const boardEl = root.querySelector('#pvchkBoard');
    const capT = root.querySelector('#pvchkCapT'), capB = root.querySelector('#pvchkCapB');
    const noEl = root.querySelector('#pvchkNo'), statsEl = root.querySelector('#pvchkStats');

    const cells = [];
    for(let di=0; di<64; di++){
      const i = flip? 63-di : di;
      const d = document.createElement('div');
      d.className = 'pvchk-cell '+((((i>>3)+(i&7))&1)? 'dk':'lt');
      d.dataset.i = i;
      boardEl.appendChild(d);
      cells[i] = d;
    }

    /* ------------------------------ core ------------------------------ */
    function resetState(){
      state = {b:startBoard(), turn:0, half:0, lock:null, seq:0};
      lastM = null; caps = [0,0]; plies = 0;
      sel = null; over = false; fin = false; seq = 0; paused = false; busy = false;
    }
    const discHtml = (v, extra) => `<span class="pvchk-d ${v>0?'p1':'p2'}${Math.abs(v)===2?' king':''}${extra||''}"></span>`;
    function canPlay(){
      if(over||paused||busy) return false;
      if(isMP) return state.turn===mySeat;
      return state.turn!==botSeat;
    }
    function setTurnUI(){
      if(over) return;
      if(!isMP && state.turn===botSeat) ctx.setTurn(tt('think'),'');
      else if(isMP) ctx.setTurn(state.turn===mySeat? t('pl.turnY2') : t('pl.turnW'), state.turn===mySeat? 'me':'');
      else ctx.setTurn(state.lock!=null? tt('chain') : tt('yourTurn'), 'me');
    }
    function render(){
      const {moves, forced} = over? {moves:[],forced:false} : movesFor(state);
      const mustIdx = new Set(forced? moves.map(m=>m.f) : []);
      const canIdx = new Set(moves.map(m=>m.f));
      const selMoves = sel!=null? moves.filter(m=>m.f===sel) : [];
      const mineTurn = canPlay();
      for(let i=0;i<64;i++){
        const cell = cells[i], v = state.b[i];
        cell.innerHTML = v? discHtml(v, (lastM && lastM.t===i)? ' pop':'') : '';
        cell.classList.toggle('last', !!lastM && (lastM.f===i||lastM.t===i));
        cell.classList.toggle('sel', sel===i);
        cell.classList.toggle('must', mineTurn && mustIdx.has(i));
        cell.classList.toggle('mvbl', mineTurn && !mustIdx.size && canIdx.has(i));
        const tm = selMoves.find(m=>m.t===i);
        cell.classList.toggle('dot', !!tm && tm.cap==null);
        cell.classList.toggle('ring', !!tm && tm.cap!=null);
      }
      hud(); setTurnUI();
    }
    function hud(){
      const enemyCls = mySeat===0? 'p2':'p1', myCls = mySeat===0? 'p1':'p2';
      capB.innerHTML = `<b>${tt('you')}</b> ` + Array(caps[mySeat]).fill(`<i class="pvchk-mini ${enemyCls}"></i>`).join('');
      capT.innerHTML = Array(caps[1-mySeat]).fill(`<i class="pvchk-mini ${myCls}"></i>`).join('') + ` <b>${tt('bot')}</b>`;
      noEl.innerHTML = tt('moves')+' <b>'+fmt(Math.floor(plies/2)+1)+'</b>';
      if(!isMP){
        const st = U.LS.get(STATS_KEY, null) || {w:0,d:0,l:0,best:0};
        statsEl.innerHTML = `<span class="pvchk-chip">🏆 <span>${tt('wins')}</span> <b>${fmt(st.w)}</b></span>
          <span class="pvchk-chip">🤝 <span>${tt('draws')}</span> <b>${fmt(st.d)}</b></span>
          <span class="pvchk-chip">💀 <span>${tt('losses')}</span> <b>${fmt(st.l)}</b></span>
          <span class="pvchk-chip">${tt('streak')} <b>${fmt(st.best)}</b></span>`;
      } else statsEl.innerHTML='';
    }
    function bumpStats(myWin){
      const st = U.LS.get(STATS_KEY, null) || {w:0,d:0,l:0,best:0};
      if(myWin===true){ st.w++; st.best=(st.best||0)+1; }
      else if(myWin===false){ st.l++; st.best=0; }
      else st.d++;
      U.LS.set(STATS_KEY, st);
    }
    function pack(m){
      return {q:seq, b:Array.from(state.b), t:state.turn, h:state.half, l:state.lock,
        lf:m.f, lt:m.t, cp:m.cap!=null?1:0, cw:caps[0], cb:caps[1], pl:plies};
    }
    function commitHop(m){
      const mover = state.turn;
      state = applyHop(state, m);
      lastM = {f:m.f, t:m.t};
      if(m.cap!=null) caps[mover]++;
      seq = state.seq; plies++;
      sel = state.lock!=null? state.lock : null;
      const oppMoves = movesFor(state).moves;
      const ended = !oppMoves.length;
      const draw = !ended && state.half>=50;
      if(isMP && ctx.amHost) ctx.broadcast('st', pack(m));
      render();
      PV.sound.play(m.cap!=null? 'pop':'place'); U.vibrate(m.cap!=null? 22:12);
      if(state.lock!=null && state.turn===(isMP? mySeat : 0)) setTimeout(()=>PV.sound.play('go'), 120);
      if(ended) endGame(mover);
      else if(draw) endGame(null);
    }
    async function animateHop(m){
      if(busy) return;
      busy = true;
      const src = cells[m.f], dst = cells[m.t];
      const disc = src.querySelector('.pvchk-d');
      if(disc){
        const fly = document.createElement('div');
        fly.className = 'pvchk-fly';
        fly.innerHTML = discHtml(state.b[m.f]);
        fly.style.left = src.offsetLeft+'px';
        fly.style.top = src.offsetTop+'px';
        boardEl.appendChild(fly);
        disc.style.visibility = 'hidden';
        const dx = dst.offsetLeft-src.offsetLeft, dy = dst.offsetTop-src.offsetTop;
        const anim = fly.animate([
          {transform:'translate(0,0) scale(1)'},
          {transform:`translate(${dx/2}px,${dy/2-26}px) scale(1.25)`, offset:.5},
          {transform:`translate(${dx}px,${dy}px) scale(1)`},
        ], {duration:300, easing:'ease-in-out'});
        await new Promise(res=>{ anim.onfinish=res; setTimeout(res, 340); });
        fly.remove();
      }
      if(m.cap!=null){
        const cd = cells[m.cap].querySelector('.pvchk-d');
        if(cd) cd.animate([{transform:'scale(1)',opacity:1},{transform:'scale(1.6)',opacity:0}],{duration:210,easing:'ease-out'});
        await U.sleep(190);
      }
      commitHop(m);
      busy = false;
    }
    function doHop(m){
      if(isMP && !ctx.amHost){
        sel = null; render();
        ctx.send('mv', {fr:m.f>>3, fc:m.f&7, tr:m.t>>3, tc:m.t&7}, hostPid);
        ctx.setStatus(tt('wait'));
      } else animateHop(m);
    }
    async function runBot(){
      if(botTO){ clearTimeout(botTO); botTO=null; }
      if(isMP || over || paused || state.turn!==botSeat) return;
      await U.sleep(diff==='hard'? 680 : diff==='easy'? 440 : 560);
      while(!over && !paused && state.turn===botSeat){
        const m = botHop(state, diff, rng);
        if(!m) break;
        await animateHop(m);
        if(state.turn===botSeat) await U.sleep(150);
      }
    }
    function endGame(winSeat){
      if(over) return; over = true;
      busy = false;
      if(botTO){ clearTimeout(botTO); botTO=null; }
      const reason = winSeat==null? tt('draw50') : (winSeat===0? tt('winT') : tt('loseT'));
      if(isMP && ctx.amHost) ctx.broadcast('over', {w: winSeat==null? null : (players[winSeat]?.pid||null)});
      const myWin = winSeat==null? null : (isMP? winSeat===mySeat : winSeat===0);
      PV.sound.play(myWin==null? 'drawS' : myWin? 'win' : 'lose');
      U.vibrate(myWin? [40,60,40] : 30);
      ctx.setTurn(myWin==null? t('pl.drawT') : myWin? t('pl.victory') : t('pl.defeat'), myWin==null? '' : myWin? 'win':'lose');
      ctx.setStatus(winSeat==null? tt('draw50') : '');
      if(!isMP) bumpStats(myWin);
      render();
      const nm = i => players[i]?.name || (i===mySeat? tt('you') : tt('bot'));
      setTimeout(()=>{
        if(fin) return; fin = true;
        ctx.finish({
          res: myWin==null? 'd' : myWin? 'w' : 'l',
          scores: {[players[0]?.pid]: winSeat===0?1:0, [players[1]?.pid||'BOT:1']: winSeat===1?1:0},
          stats: {},
          vsHuman: isMP,
          sub: myWin==null? tt('draw50') : (t('g.winner',{n:nm(winSeat)}) ),
        });
      }, 950);
    }

    /* ------------------------------ input ------------------------------ */
    boardEl.addEventListener('click', e=>{
      const cell = e.target.closest('.pvchk-cell');
      if(cell) tap(+cell.dataset.i);
    });
    function tap(i){
      if(!canPlay()) return;
      const {moves, forced} = movesFor(state);
      if(state.lock!=null){
        const m = moves.find(x=>x.t===i);
        if(m) doHop(m);
        else { PV.sound.play('tick'); U.vibrate(24); ctx.setStatus('⚠ '+tt('chain')); }
        return;
      }
      if(sel!=null){
        const m = moves.find(x=>x.f===sel && x.t===i);
        if(m){ doHop(m); return; }
      }
      const v = state.b[i];
      const mine = !!v && ((v>0)===(state.turn===0));
      if(mine && moves.some(x=>x.f===i)){
        sel = sel===i? null : i;
        PV.sound.play('tap'); U.vibrate(10);
        render();
      } else if(mine && forced){
        PV.sound.play('tick'); U.vibrate(26); ctx.setStatus('⚠ '+tt('forced'));
      } else if(sel!=null){ sel=null; render(); }
    }

    /* ------------------------------ online ------------------------------ */
    if(isMP){
      ctx.on('mv', d=>{
        if(!ctx.amHost || over || busy || state.turn!==1) return;
        const f=(d.fr|0)*8+(d.fc|0), tt2=(d.tr|0)*8+(d.tc|0);
        const m = movesFor(state).moves.find(x=>x.f===f && x.t===tt2);
        if(m) animateHop(m);
      });
      ctx.on('st', d=>{
        if(d.q==null || d.q<seq) return;
        seq = d.q;
        state = {b:Int8Array.from(d.b), turn:d.t, half:d.h, lock:d.l??null, seq};
        lastM = {f:d.lf, t:d.lt};
        caps = [d.cw||0, d.cb||0]; plies = d.pl||seq;
        sel = state.lock!=null && state.turn===mySeat? state.lock : null;
        PV.sound.play(d.cp? 'pop':'place'); U.vibrate(d.cp? 22:12);
        render();
        if(!movesFor(state).moves.length){ over = true; render(); } /* display only — host owns 'over' */
      });
      ctx.on('over', d=>{
        if(over && fin) return;
        over = true;
        const myWin = d.w==null? null : d.w===ctx.selfPid;
        PV.sound.play(myWin==null? 'drawS' : myWin? 'win' : 'lose');
        U.vibrate(myWin? [40,60,40] : 30);
        ctx.setTurn(myWin==null? t('pl.drawT') : myWin? t('pl.victory') : t('pl.defeat'), myWin==null? '' : myWin? 'win':'lose');
        setTimeout(()=>{
          if(fin) return; fin = true;
          ctx.finish({
            res: myWin==null? 'd' : myWin? 'w' : 'l',
            scores: {[players[0]?.pid]: d.w===players[0]?.pid?1:0, [players[1]?.pid]: d.w===players[1]?.pid?1:0},
            stats: {},
            vsHuman: true,
            sub: myWin==null? tt('draw50') : (myWin? tt('winT') : tt('loseT')),
          });
        }, 850);
      });
    }

    /* ------------------------------ lifecycle ------------------------------ */
    resetState(); render(); runBot();
    ctx.setStatus('⚫ '+tt('hint'));
    return {
      init(){}, start(){},
      pause(){ paused=true; if(botTO){clearTimeout(botTO); botTO=null;} },
      resume(){ paused=false; if(!isMP && !over && state.turn===botSeat) runBot(); },
      end(){ over=true; if(botTO){clearTimeout(botTO); botTO=null;} },
      reset(){ resetState(); render(); runBot(); },
      getState(){ return {b:Array.from(state.b), turn:state.turn, half:state.half, lock:state.lock}; },
      getScores(){ return {[players[0]?.pid]: caps[0], [players[1]?.pid||'BOT:1']: caps[1]}; },
      getStatus(){
        if(over) return '';
        const forced = !isMP || true ? movesFor(state).forced : false;
        return (forced && state.turn===(isMP? mySeat : 0)? '⚠ '+tt('forced')+' • ':'') + tt('moves')+' '+fmt(Math.floor(plies/2)+1);
      },
      destroy(){ if(botTO){clearTimeout(botTO); botTO=null;} root.remove(); },
    };
  }
});
})();
