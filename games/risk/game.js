/* ============ Game: فتح سرزمین‌ها (Risk-like) — hex map conquest ============
   • 30 lands / 5 regions (region bonus armies), classic dice battles
   • Solo vs smart bots (easy/normal/hard) + ONLINE host-authoritative
   • Phases: deploy → attack → fortify → end turn
   • Win: eliminate every other commander
========================================================================== */
(function(){
'use strict';
const PV = window.PV, U = PV.u, t = PV.t;
const { esc, fmt, icon } = U;

/* ---------------------------- map definition ----------------------------- */
/* rows of an odd-r offset hex grid; letters = region (A..E) */
const ROWS = [
  'AABB',
  'AAABB',
  'ACCCBB',
  'CCCEEE',
  'DDEEE',
  'DDDD',
];
const REGIONS = {
  A:{name:{fa:'جنگل سبز',en:'Green Woods',ar:'الغابة الخضراء'}, col:'#22c55e', bonus:2},
  B:{name:{fa:'دشت طلایی',en:'Golden Plains',ar:'السهول الذهبية'}, col:'#f0b429', bonus:2},
  C:{name:{fa:'کوهستان',en:'Highlands',ar:'المرتفعات'}, col:'#3ba9ff', bonus:3},
  D:{name:{fa:'کویر سرخ',en:'Red Desert',ar:'الصحراء الحمراء'}, col:'#ff6b57', bonus:3},
  E:{name:{fa:'جزایر فیروزه',en:'Turquoise Isles',ar:'الجزر الفيروزية'}, col:'#00c9bd', bonus:4},
};
const N = 30, HEX = 40;
const LANDS = (function(){
  const arr = [];
  ROWS.forEach((row,r)=>{
    [...row].forEach((reg,c)=>{
      const x = HEX*Math.sqrt(3)*(c + 0.5*(r&1)) + 46;
      const y = HEX*1.5*r + 44;
      arr.push({i:arr.length, r, c, reg, x, y});
    });
  });
  /* neighbors (odd-r offset) */
  for(const L of arr){
    L.nb = [];
    const sh = L.r & 1;
    const deltas = sh? [[1,0],[-1,0],[1,-1],[0,-1],[1,1],[0,1]] : [[1,0],[-1,0],[0,-1],[-1,-1],[0,1],[-1,1]];
    for(const [dc,dr] of deltas){
      const n = arr.find(o=>o.r===L.r+dr && o.c===L.c+dc);
      if(n) L.nb.push(n.i);
    }
  }
  return arr;
})();
const REGION_LIST = ['A','B','C','D','E'];
const SEAT_COL = ['#7c5cff','#00b8a9','#ff5c9d','#f0a020'];

function hexPath(cx, cy, size){
  let pts = [];
  for(let k=0;k<6;k++){
    const a = Math.PI/180*(60*k - 30);
    pts.push((cx + size*Math.cos(a)).toFixed(1)+','+(cy + size*Math.sin(a)).toFixed(1));
  }
  return 'M'+pts.join(' L')+' Z';
}

/* ------------------------------ game logic ------------------------------- */
function newGameState(seats, rng){
  /* seats = number of players; distribute lands + starting armies (seeded) */
  const owner = new Array(N).fill(0);
  const armies = new Array(N).fill(1);
  const order = U.shuffle([...Array(N).keys()], rng);
  order.forEach((land, idx)=>{ owner[land] = idx % seats; });
  const startArmies = seats===2? 40 : seats===3? 30 : 25;
  let left = seats*startArmies - N;
  while(left > 0){
    for(let s=0; s<seats && left>0; s++){
      const mine = [...Array(N).keys()].filter(i=>owner[i]===s);
      armies[mine[Math.floor(rng()*mine.length)]]++;
      left--;
    }
  }
  return {owner, armies, turn:0, phase:'deploy', deployLeft:0, alive:seats, over:false};
}
function regionBonus(state, seat){
  let b = 0;
  for(const R of REGION_LIST){
    const cells = LANDS.filter(l=>l.reg===R);
    if(cells.every(l=>state.owner[l.i]===seat)) b += REGIONS[R].bonus;
  }
  return b;
}
function deployFor(state, seat){
  const n = state.owner.reduce((a,o)=>a+(o===seat?1:0), 0);
  return Math.max(3, Math.floor(n/3)) + regionBonus(state, seat);
}
function roll(rng, n){ return Array.from({length:n}, ()=> 1+Math.floor(rng()*6)).sort((a,b)=>b-a); }
function resolveBattle(aRoll, dRoll){
  /* classic: compare sorted pairs; tie → defender */
  let aLoss=0, dLoss=0;
  const pairs = Math.min(aRoll.length, dRoll.length);
  for(let k=0;k<pairs;k++){
    if(aRoll[k] > dRoll[k]) dLoss++; else aLoss++;
  }
  return {aLoss, dLoss};
}
function connectedOwn(state, from, seat){
  /* BFS over own lands to find reachability for fortify */
  const seen = new Set([from]), q=[from];
  while(q.length){
    const cur = q.pop();
    for(const nb of LANDS[cur].nb){
      if(state.owner[nb]===seat && !seen.has(nb)){ seen.add(nb); q.push(nb); }
    }
  }
  return seen;
}

/* --------------------------------- bot ----------------------------------- */
function botDeploy(state, seat, rng){
  const mine = [...Array(N).keys()].filter(i=>state.owner[i]===seat);
  const frontier = mine.filter(i=>LANDS[i].nb.some(nb=>state.owner[nb]!==seat));
  const threat = i=> LANDS[i].nb.filter(nb=>state.owner[nb]!==seat).reduce((a,nb)=>a+state.armies[nb],0);
  const pool = frontier.length? frontier : mine;
  pool.sort((a,b)=> (threat(b)+rng()*3) - (threat(a)+rng()*3));
  let left = state.deployLeft;
  while(left>0){
    const top = Math.min(pool.length, 3);
    const pick = pool[Math.floor(rng()*top)] || pool[0];
    state.armies[pick]++; left--;
  }
}
function botAttack(state, seat, diff, rng, onBattle){
  const thr = diff==='easy'? 1.9 : diff==='hard'? 1.18 : 1.45;
  let guard = 60;
  while(guard-- > 0){
    let best = null, bestScore = 0;
    for(let i=0;i<N;i++){
      if(state.owner[i]!==seat || state.armies[i]<2) continue;
      for(const nb of LANDS[i].nb){
        if(state.owner[nb]===seat) continue;
        const ratio = (state.armies[i]-1)/Math.max(1, state.armies[nb]);
        const bonus = LANDS[i].nb.concat(LANDS[nb].nb).some(x=>state.owner[x]===seat && LANDS[x].reg===LANDS[nb].reg)? 0.15:0;
        const score = ratio + bonus;
        if(score>bestScore){ bestScore = score; best = {from:i, to:nb}; }
      }
    }
    if(!best || bestScore < thr) break;
    const from = best.from, to = best.to;
    const a = state.armies[from], d = state.armies[to];
    const aR = roll(rng, Math.min(3, a-1)), dR = roll(rng, Math.min(2, d));
    const {aLoss, dLoss} = resolveBattle(aR, dR);
    state.armies[from]-=aLoss; state.armies[to]-=dLoss;
    if(onBattle) onBattle(from, to, aR, dR, aLoss, dLoss);
    if(state.armies[to]===0){
      state.owner[to] = seat;
      state.armies[to] = state.armies[from]-1;
      state.armies[from] = 1;
    }
    if(state.armies[from]<2) continue;
  }
}
function botFortify(state, seat, rng){
  const mine = [...Array(N).keys()].filter(i=>state.owner[i]===seat && state.armies[i]>=2);
  for(const i of U.shuffle(mine, rng)){
    const hasEnemyNb = LANDS[i].nb.some(nb=>state.owner[nb]!==seat);
    if(hasEnemyNb) continue;
    const reach = connectedOwn(state, i, seat);
    const frontier = [...reach].filter(x=>LANDS[x].nb.some(nb=>state.owner[nb]!==seat));
    if(frontier.length){
      const to = frontier[Math.floor(rng()*frontier.length)];
      state.armies[to] += state.armies[i]-1;
      state.armies[i] = 1;
      return;
    }
  }
}

/* ------------------------------- module ---------------------------------- */
PV.registry.register({
  id:'risk', cats:['strategy','board','classic'], players:[2,4], modes:['solo','online'],
  weight:86, dynamicScore:false,
  factory: function(ctx){
    const isMP = ctx.mode!=='solo';
    const rng = ctx.rng;
    /* players list: solo adds bots */
    const players = (ctx.players||[]).filter(p=>p && p.pid!==null);
    if(!isMP){
      const nBots = ctx.diff==='easy'? 1 : ctx.diff==='hard'? 3 : 2;
      for(let b=0;b<nBots;b++){
        players.push({pid:'BOT:'+(b+1), name:t('g.bot')+' '+(b+1), av:['robot','alien','dragon'][b%3], lvl:5+b*3});
      }
    }
    const seats = Math.min(4, Math.max(2, players.length));
    const mySeat = Math.max(0, players.findIndex(p=>p.pid===ctx.selfPid));
    const amHost = !isMP || ctx.amHost;

    let st = newGameState(seats, rng);
    st.deployLeft = deployFor(st, 0);
    let over = false, selFrom = null, fortSel = null, busy = false;
    let localTurnCache = -1;

    const root = document.createElement('div');
    root.innerHTML = `
      <div class="riskb">
        <div class="rk-top">
          <div class="rk-phase" id="rkPhase"></div>
          <div class="rk-deploy num" id="rkDeploy"></div>
        </div>
        <div class="rk-map-wrap"><svg id="rkMap" viewBox="0 0 478 400" role="img"></svg></div>
        <div class="rk-actions row wrap" id="rkActs"></div>
        <div class="rk-dice" id="rkDice" style="display:none"></div>
      </div>`;
    ctx.root.appendChild(root);
    const svg = root.querySelector('#rkMap');
    const acts = root.querySelector('#rkActs');
    const NS = 'http://www.w3.org/2000/svg';

    /* build hex nodes once */
    const nodes = LANDS.map(L=>{
      const g = document.createElementNS(NS,'g');
      g.setAttribute('transform', `translate(${L.x} ${L.y})`);
      g.style.cursor = 'pointer';
      const path = document.createElementNS(NS,'path');
      path.setAttribute('d', hexPath(0,0,HEX-3));
      path.setAttribute('stroke', 'rgba(0,0,0,.18)');
      path.setAttribute('stroke-width', '1.5');
      const regBadge = document.createElementNS(NS,'circle');
      regBadge.setAttribute('cx', -(HEX-16)); regBadge.setAttribute('cy', -(HEX-18));
      regBadge.setAttribute('r', 6.5);
      regBadge.setAttribute('fill', REGIONS[L.reg].col);
      regBadge.setAttribute('opacity', '.9');
      const army = document.createElementNS(NS,'g');
      g.appendChild(path); g.appendChild(regBadge); g.appendChild(army);
      g.addEventListener('click', ()=> onLand(L.i));
      svg.appendChild(g);
      return {g, path, army};
    });

    function seatColor(s){ return SEAT_COL[s % SEAT_COL.length]; }
    function pname(s){ return players[s]?.name || ('P'+s); }

    function render(){
      /* hexes */
      for(let i=0;i<N;i++){
        const n = nodes[i], seat = st.owner[i];
        const sel = (selFrom===i || fortSel===i);
        n.path.setAttribute('fill', seatColor(seat));
        n.path.setAttribute('opacity', sel? '1' : '.88');
        n.path.setAttribute('stroke', sel? '#fff' : 'rgba(0,0,0,.18)');
        n.path.setAttribute('stroke-width', sel? '3.4' : '1.5');
        const a = st.armies[i];
        n.army.innerHTML = `<circle cx="0" cy="0" r="13.5" fill="rgba(255,255,255,.94)"/>
          <text x="0" y="5.2" text-anchor="middle" font-size="14.5" font-weight="900" fill="${seatColor(seat)}">${a}</text>`;
        if(a>=10) n.army.querySelector('text').setAttribute('font-size','12.5');
      }
      /* header */
      const cur = st.turn;
      const phaseName = st.phase==='deploy'? t('rk.deploy') : st.phase==='attack'? t('rk.attack') : t('rk.fortify');
      root.querySelector('#rkPhase').innerHTML = players.map((p,s)=>
        `<span class="rk-seat ${s===cur?'on':''} ${!isAlive(s)?'dead':''}" style="--sc:${seatColor(s)}">${esc(p.name)}<i class="num">${countLands(s)}</i></span>`
      ).join('') + `<span class="rk-pnum tiny muted">${phaseName}</span>`;
      root.querySelector('#rkDeploy').innerHTML = st.phase==='deploy'?
        `🎖 ${t('rk.reinforce')}: <b>${fmt(st.deployLeft)}</b>` : (st.phase==='attack'? `⚔ ${t('rk.attack')}` : `🛡 ${t('rk.fortify')}`);
      drawActions();
    }
    function isAlive(s){ return LANDS.some(l=>st.owner[l.i]===s); }
    function countLands(s){ return st.owner.reduce((a,o)=>a+(o===s?1:0), 0); }
    function isMyTurn(){
      if(over) return false;
      if(!isMP) return true;                    /* solo: local sim drives both */
      return st.turn===mySeat;
    }

    function drawActions(){
      acts.innerHTML = '';
      if(over) return;
      if(!isMP && st.turn!==0){ acts.innerHTML = `<span class="tiny muted">${t('pl.botThink')}</span>`; return; }
      if(!isMyTurn()){ acts.innerHTML = `<span class="tiny muted">${t('pl.turnW')}</span>`; return; }
      const mk = (label, ic, fn, cls='')=>{
        const b = document.createElement('button');
        b.className = 'btn sm '+cls;
        b.innerHTML = (ic? icon(ic,15):'')+' '+label;
        b.onclick = fn; acts.appendChild(b);
      };
      if(st.phase==='deploy'){
        mk(t('rk.auto'), 'zap', ()=> act({type:'auto'}), 'cyan');
        mk(t('rk.attack'), 'swords', ()=>{
          if(st.deployLeft>0){ PV.ui.toast(t('rk.reinforce')+': <b>'+fmt(st.deployLeft)+'</b>','info'); return; }
          act({type:'toAttack'});
        }, 'danger');
      } else if(st.phase==='attack'){
        mk(t('rk.fortify'), 'next', ()=> act({type:'toFortify'}), 'ghost');
        mk(t('rk.endTurn'), 'check', ()=> act({type:'end'}), '');
      } else if(st.phase==='fortify'){
        mk(t('rk.skip'), 'next', ()=> act({type:'end'}), 'ghost');
      }
    }

    /* -------- action funnel: solo executes locally, online routes to host -------- */
    function act(a){
      if(over || busy) return;
      if(!isMP){ hostApply(a, 0); return; }
      const payload = {...a, from: ctx.selfPid};
      if(amHost) hostApply(payload, mySeat);
      else ctx.send('rkAct', payload, hostPid());
    }
    function hostPid(){ return players[0]?.pid; }

    /* host-side authoritative executor (seat = acting player) */
    function hostApply(a, seat){
      if(over) return;
      if(isMP && a.type!=='over' && seat!==st.turn) return;
      if(!isMP && a.type!=='over' && seat!==st.turn) return;
      switch(a.type){
        case 'deploy': {
          if(st.phase!=='deploy' || st.deployLeft<=0 || st.owner[a.i]!==seat) return;
          st.armies[a.i]++; st.deployLeft--;
          break;
        }
        case 'auto': {
          if(st.phase!=='deploy') return;
          const mine = [...Array(N).keys()].filter(i=>st.owner[i]===seat);
          const frontier = mine.filter(i=>LANDS[i].nb.some(nb=>st.owner[nb]!==seat));
          const pool = frontier.length? frontier : mine;
          while(st.deployLeft>0){ st.armies[pool[Math.floor(rng()*pool.length)]]++; st.deployLeft--; }
          break;
        }
        case 'toAttack': {
          if(st.phase!=='deploy' || st.deployLeft>0) return;
          st.phase = 'attack'; selFrom=null; break;
        }
        case 'toFortify': {
          if(st.phase!=='attack') return;
          st.phase = 'fortify'; selFrom=null; break;
        }
        case 'attack': {
          if(st.phase!=='attack') return;
          const {from, to} = a;
          if(st.owner[from]!==seat || st.owner[to]===seat || st.armies[from]<2) return;
          if(!LANDS[from].nb.includes(to)) return;
          const av = st.armies[from], dv = st.armies[to];
          const aR = roll(rng, Math.min(3, av-1)), dR = roll(rng, Math.min(2, dv));
          const {aLoss, dLoss} = resolveBattle(aR, dR);
          st.armies[from]-=aLoss; st.armies[to]-=dLoss;
          showDice(from, to, aR, dR, aLoss, dLoss);
          if(amHost && isMP) ctx.broadcast('rkDice', {from, to, aR, dR, aLoss, dLoss});
          if(st.armies[to]<=0){
            st.owner[to] = seat;
            st.armies[to] = st.armies[from]-1;
            st.armies[from] = 1;
            PV.ui.toast(t('rk.wonLand'),'ok','flag');
          }
          checkElim();
          break;
        }
        case 'fortify': {
          if(st.phase!=='fortify') return;
          const {from, to, n} = a;
          if(st.owner[from]!==seat || st.owner[to]!==seat || st.armies[from]<2) return;
          if(!connectedOwn(st, from, seat).has(to)) return;
          const mv = U.clamp(n|0, 1, st.armies[from]-1);
          st.armies[from]-=mv; st.armies[to]+=mv;
          endTurn();
          return;      /* fortify always ends the turn */
        }
        case 'end': endTurn(); break;
        default: return;
      }
      pushState();
    }

    function endTurn(){
      if(over) return;
      /* advance to next alive seat */
      let guard = seats;
      do{ st.turn = (st.turn+1)%seats; guard--; } while(!isAlive(st.turn) && guard>0);
      st.phase = 'deploy';
      st.deployLeft = deployFor(st, st.turn);
      selFrom = null; fortSel = null;
      pushState();
      scheduleBot();
      /* win check */
      const alive = players.map((p,s)=>isAlive(s)? s : -1).filter(s=>s>=0);
      if(alive.length<=1){ finish(alive[0]); }
    }

    function checkElim(){
      const before = players.map((p,s)=>isAlive(s)? s:-1).filter(s=>s>=0).length;
      if(before < st.alive){
        const dead = players.find((p,s)=>!isAlive(s) && p);
        st.alive = before;
        if(dead) PV.ui.toast(t('rk.elim',{n:dead.name}),'info');
      }
    }

    /* ---------------- click routing by phase ---------------- */
    function onLand(i){
      if(over || busy) return;
      if(!isMyTurn()) return;
      const seat = isMP? mySeat : st.turn;
      if(!isMP && st.turn!==0) return;   /* bot turn */
      const own = st.owner[i]===seat;
      if(st.phase==='deploy'){
        if(own) act({type:'deploy', i});
        return;
      }
      if(st.phase==='attack'){
        if(own && st.armies[i]>=2){ selFrom = i; render(); return; }
        if(selFrom!=null && !own && LANDS[selFrom].nb.includes(i)){ act({type:'attack', from:selFrom, to:i}); selFrom=null; render(); }
        return;
      }
      if(st.phase==='fortify'){
        if(own && st.armies[i]>=2 && fortSel==null){ fortSel = i; render(); return; }
        if(fortSel!=null && own && fortSel!==i && connectedOwn(st, fortSel, seat).has(i)){
          askFortify(fortSel, i);
        } else { fortSel = null; render(); }
      }
    }
    function askFortify(from, to){
      const max = st.armies[from]-1;
      PV.ui.modal({title:t('rk.mvQ'), body:`
        <div class="center"><b class="num big">${fmt(max)}</b> ${t('rk.armies')}</div>
        <input type="range" min="1" max="${max}" value="${max}" id="fvr" style="width:100%;accent-color:var(--p1);margin-top:10px">
        <div class="center num" id="fvv" style="font-weight:900;color:var(--p1)">${fmt(max)}</div>`,
        actions:[
          {label:t('c.ok'), onClick:(m)=>{ const n = +m.querySelector('#fvr').value||1; act({type:'fortify', from, to, n}); }},
        ]});
      const r = document.getElementById('fvr');
      r && (r.oninput = ()=>{ document.getElementById('fvv').textContent = fmt(+r.value); });
    }

    /* ---------------- dice overlay ---------------- */
    function dieFace(v){
      const dots = {1:[[0,0]],2:[[-1,-1],[1,1]],3:[[-1,-1],[0,0],[1,1]],4:[[-1,-1],[1,-1],[-1,1],[1,1]],5:[[-1,-1],[1,-1],[0,0],[-1,1],[1,1]],6:[[-1,-1],[1,-1],[-1,0],[1,0],[-1,1],[1,1]]}[v];
      return `<svg width="30" height="30" viewBox="-2 -2 4 4">${dots.map(([x,y])=>`<circle cx="${x*0.9}" cy="${y*0.9}" r="0.42" fill="currentColor"/>`).join('')}</svg>`;
    }
    function showDice(from, to, aR, dR, aLoss, dLoss){
      if(!isMP && st.turn!==undefined){ /* show for solo too */ }
      busy = true;
      const box = root.querySelector('#rkDice');
      box.style.display = 'flex';
      box.innerHTML = `
        <div class="rk-dice-card">
          <div class="rk-dice-t">${t('rk.battle')} — ${esc(pname(st.owner[from]))} ⚔ ${esc(pname(st.owner[to]))}</div>
          <div class="rk-dice-row">
            <div><small>${t('rk.reinf')} (${aR.length})</small><div class="rk-dice-red">${aR.map(dieFace).join('')}</div><b class="num">−${fmt(aLoss)}</b></div>
            <div><small>${t('rk.defend')} (${dR.length})</small><div class="rk-dice-blu">${dR.map(dieFace).join('')}</div><b class="num">−${fmt(dLoss)}</b></div>
          </div>
        </div>`;
      render();
      setTimeout(()=>{ box.style.display='none'; busy=false; render(); }, 1250);
    }

    /* ---------------- state sync (online) ---------------- */
    function snapshot(){
      return {o:[...st.owner], a:[...st.armies], t:st.turn, ph:st.phase, dl:st.deployLeft, al:st.alive, v:(st._v=(st._v||0)+1)};
    }
    function applySnap(s){
      st.owner = [...s.o]; st.armies = [...s.a]; st.turn = s.t; st.phase = s.ph;
      st.deployLeft = s.dl; st.alive = s.al;
      selFrom = null; fortSel = null;
      render();
    }
    function pushState(){
      render();
      if(isMP && amHost) ctx.broadcast('rkState', snapshot());
    }

    /* ---------------- bots (solo) ---------------- */
    function scheduleBot(){
      if(isMP || over) return;
      if(st.turn===0) return;
      setTimeout(()=>{
        if(over || st.turn===0) return;
        const botSeat = st.turn;
        const diff = ctx.diff||'normal';
        botDeploy(st, botSeat, rng);
        st.deployLeft = 0;
        botAttack(st, botSeat, diff, rng, (from,to,aR,dR,al,dl)=>{ showDice(from,to,aR,dR,al,dl); });
        botFortify(st, botSeat, rng);
        checkElim();
        const alive = players.map((p,s)=>isAlive(s)? s:-1).filter(s=>s>=0);
        if(alive.length<=1){ pushState(); finish(alive[0]); return; }
        endTurn();
      }, 900);
    }

    /* ---------------- finish ---------------- */
    function finish(winSeat){
      if(over) return;
      over = true;
      const winner = players[winSeat];
      const myWin = winSeat===mySeat;
      if(isMP && amHost){
        ctx.broadcast('rkOver', {winPid: winner?.pid||null});
      }
      ctx.setTurn(myWin? t('pl.victory') : t('pl.defeat'), myWin? 'win':'lose');
      const score = countLands(mySeat)*10 + (myWin? 500:0);
      const scores = {};
      players.forEach((p,s)=>{ scores[p.pid] = (s===winSeat? 500:0) + countLands(s)*10; });
      if(!isMP && players[0]) scores[ctx.selfPid] = scores[players[0].pid];   /* solo: key by real pid too */
      setTimeout(()=>ctx.finish({
        res: myWin? 'w':'l', vsHuman:isMP, scores,
        sub: t('g.winner',{n:winner?.name||''}),
        stats: {lands: countLands(mySeat)},
      }), isMP? 800: 1400);
    }

    /* ---------------- incoming messages ---------------- */
    if(isMP){
      ctx.on('rkState', s=>{ if(!amHost && s) applySnap(s); });
      ctx.on('rkDice', d=>{ if(!amHost && d) showDice(d.from, d.to, d.aR, d.dR, d.aLoss, d.dLoss); });
      ctx.on('rkAct', a=>{
        if(!amHost || !a || over) return;
        const seat = players.findIndex(p=>p && p.pid===a.from);
        if(seat<0) return;
        hostApply(a, seat);
      });
      ctx.on('rkOver', d=>{
        if(over) return;
        const winSeat = players.findIndex(p=>p && p.pid===d.winPid);
        over = true;
        const myWin = winSeat===mySeat;
        ctx.setTurn(myWin? t('pl.victory'):t('pl.defeat'), myWin?'win':'lose');
        const scores = {};
        players.forEach((p,s)=>{ scores[p.pid] = s===winSeat? 500+countLands(s)*10 : countLands(s)*10; });
        setTimeout(()=>ctx.finish({res:myWin?'w':'l', vsHuman:true, scores}), 800);
      });
    }

    render();
    scheduleBot();

    return {
      init(){}, start(){},
      getState(){ return snapshot(); },
      getScores(){ return Object.fromEntries(players.map((p,s)=>[p.pid, countLands(s)])); },
      getStatus(){ return over? '' : (isMyTurn()? t('pl.turnY2') : t('pl.turnW')); },
      end(){ over = true; },
      destroy(){ root.remove(); },
      reset(){ st = newGameState(seats, rng); st.deployLeft = deployFor(st, 0); over=false; render(); scheduleBot(); },
    };
  }
});
})();
