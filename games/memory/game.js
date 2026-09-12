/* ============ Game: Memory — shared-seed deck, solo clock / 2P online ============
   v3: HOST-AUTHORITATIVE sync. Every flip (host or guest) goes through the host,
   which validates turns and broadcasts full state — boards can never desync. */
(function(){
'use strict';
const PV = window.PV, U = PV.u, t = PV.t;
const { fmt } = U;

const EMOJIS = ['🦊','🐼','🐸','🦄','🐧','🦁','🐵','🐙','🦋','🐝','🌵','🍕','🎸','🚀','⚽','🎲','🧩','🌈','🍩','🦖'];

PV.registry.register({
  id:'memory', cats:['brain','family','party'], players:[1,2], modes:['solo','online'],
  weight:84, dynamicScore:true,
  factory: function(ctx){
    const isMP = ctx.mode!=='solo';
    const P = 4;   /* 4x4 = 8 pairs */
    const deck = [];
    const rng = U.mulberry32(ctx.seed ?? 12345);
    const picks = U.shuffle(EMOJIS.slice(0,20), rng).slice(0, P*P/2);
    picks.forEach(e=>{ deck.push(e,e); });
    const board = U.shuffle(deck, rng);
    let open = [], matched = new Array(board.length).fill(false);
    let mine = new Array(board.length).fill(null);
    let seatScore = [0,0];
    let miss = 0, flips = 0;
    let lock = false, over = false;
    let turn = 0;              /* seat index: 0 = host / solo me */
    let t0 = Date.now();
    let endTO = null, flipTO = null;
    const players = ctx.players||[];
    const myIdx = isMP? Math.max(0, players.findIndex(pl=>pl.pid===ctx.selfPid)) : 0;
    const hostPid = ()=> players[0]?.pid;

    const root = document.createElement('div');
    root.innerHTML = `<div class="gcenter">
      <div class="mem c4" id="mgrid"></div>
      <div class="gmsg" id="mmsg"></div>
    </div>`;
    ctx.root.appendChild(root);
    const grid = root.querySelector('#mgrid');

    function isMyTurn(){ return !isMP || (turn===myIdx); }
    function myScore(){ return seatScore[myIdx]||0; }
    function opScore(){ return seatScore[1-myIdx]||0; }

    function render(){
      grid.innerHTML='';
      board.forEach((em,i)=>{
        const c = document.createElement('button');
        const isOpen = open.includes(i) || matched[i];
        c.className = 'mem-card' + (isOpen?' flip':'') + (matched[i]?' matched done':'') + (mine[i]===myIdx&&matched[i]? ' mine':'');
        c.innerHTML = `<span class="f"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 21v-9M4 7.5l8 4.5 8-4.5"/></svg></span><span class="b">${em}</span>`;
        c.onclick = ()=>requestFlip(i);
        grid.appendChild(c);
      });
      hud();
    }
    function hud(){
      if(isMP){
        const names = players.map(pl=>pl.name||'؟');
        ctx.setTurn(isMyTurn()? t('pl.turnY2') : t('pl.turnOf',{n:names[turn]||'؟'}), isMyTurn()?'me':'');
        ctx.setStatus(fmt(myScore())+' : '+fmt(opScore()));
      } else {
        const elapsed = over? Math.floor((Date.now()-t0)/1000) : Math.floor((Date.now()-t0)/1000);
        ctx.setStatus('⏱ '+fmt(elapsed)+'s · ✕ '+fmt(miss));
      }
    }
    /* ---------- shared flip pipeline (host = authority) ---------- */
    function requestFlip(i){
      if(over || lock || open.includes(i) || matched[i] || !isMyTurn()) return;
      if(isMP && !ctx.amHost){ ctx.send('fl', {i}, hostPid()); return; }
      hostFlip(i, myIdx);
    }
    function hostFlip(i, seat){
      if(over || lock || open.includes(i) || matched[i]) return;
      if(isMP && seat!==turn) return;           /* turn enforced by the host */
      open.push(i); flips++;
      PV.sound.play('flip'); U.vibrate();
      if(isMP) sync({o:open});
      render();
      if(open.length===2){
        lock = true;
        const [a,b] = open;
        if(board[a]===board[b]){
          flipTO = setTimeout(()=>{
            matched[a]=matched[b]=true; mine[a]=mine[b]= seat;
            seatScore[seat] = (seatScore[seat]||0)+1;
            PV.sound.play('pop');
            open=[]; lock=false;
            if(isMP) sync(); else render();
            checkEnd();
            if(!over) render();
          }, 450);
        } else {
          miss++;
          flipTO = setTimeout(()=>{
            open=[]; lock=false;
            turn = isMP? 1-turn : 0;
            if(isMP) sync(); else render();
          }, 750);
        }
      }
    }
    /* broadcast the full authoritative snapshot (host only) + re-render host board */
    function sync(extra){
      if(!isMP || !ctx.amHost) return;
      ctx.broadcast('st', {m:[...matched], mi:[...mine], o:[...open], t:turn, s:[seatScore[0]||0, seatScore[1]||0], x:extra?.o!=null?1:0});
      render();
    }
    function adoptState(d){
      matched = [...d.m]; mine = [...(d.mi||[])]; open = [...(d.o||[])];
      turn = d.t|0; seatScore = [...(d.s||[0,0])];
      lock = open.length>=2;
      render();
    }
    function checkEnd(){
      if(!matched.every(Boolean)) return;
      over = true;
      if(isMP && ctx.amHost){
        clearTimeout(endTO);
        ctx.broadcast('over', {s:[seatScore[0]||0, seatScore[1]||0]});
        endTO = setTimeout(()=>finishMP(), 650);
      } else if(!isMP){
        clearTimeout(endTO);
        endTO = setTimeout(()=>finishSolo(), 700);
      }
    }
    function finishSolo(){
      const secs = Math.floor((Date.now()-t0)/1000);
      ctx.finish({res:'w', vsHuman:false, scores:{[ctx.selfPid]: Math.max(10, 200 - secs*2 - miss*10)},
        stats:{misses: miss}, sub:'⏱ '+fmt(secs)+'s'});
    }
    function finishMP(){
      const me = myScore(), op = opScore();
      ctx.finish({res: me>op? 'w': me<op? 'l':'d', vsHuman:true,
        scores:{[ctx.selfPid]:me, [players.find(pl=>pl.pid!==ctx.selfPid)?.pid||'BOT:1']:op},
        sub: fmt(me)+' : '+fmt(op)});
    }
    if(isMP){
      ctx.on('fl', (d, from)=>{
        if(!ctx.amHost || over) return;
        const seat = players.findIndex(pl=>pl.pid===from);
        if(seat<0) return;
        hostFlip(d.i|0, seat);
      });
      ctx.on('st', d=>{ if(ctx.amHost) return; adoptState(d); });
      ctx.on('over', d=>{
        if(over || ctx.amHost) return;
        over = true;
        seatScore = [...(d.s||[0,0])];
        render();
        setTimeout(finishMP, 600);
      });
    }
    render();
    const tick = setInterval(()=>{ if(!over && !isMP) hud(); if(over) clearInterval(tick); }, 1000);
    return {
      init(){}, start(){},
      reset(){ /* fresh match gets a fresh seed from the SDK */ },
      getState(){ return {board, matched}; },
      end(){ over=true; clearInterval(tick); clearTimeout(endTO); clearTimeout(flipTO); },
      destroy(){ over=true; root.remove(); clearInterval(tick); clearTimeout(endTO); clearTimeout(flipTO); },
      getScores(){ return isMP? {[ctx.selfPid]:myScore(), [players.find(pl=>pl.pid!==ctx.selfPid)?.pid||'BOT:1']:opScore()} : {[ctx.selfPid]: Math.max(0, 200 - miss*10)}; },
      getStatus(){ return isMP? fmt(myScore())+' : '+fmt(opScore()) : '✕ '+fmt(miss); },
    };
  }
});
})();
