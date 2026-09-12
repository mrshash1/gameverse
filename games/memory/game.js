/* ============ Game: Memory — shared-seed deck, solo clock / 2P online ============ */
(function(){
'use strict';
const PV = window.PV, U = PV.u, t = PV.t;

const EMOJIS = ['🦊','🐼','🐸','🦄','🐧','🦁','🐵','🐙','🦋','🐝','🌵','🍕','🎸','🚀','⚽','🎲','🧩','🌈','🍩','🦖'];

PV.registry.register({
  id:'memory', cats:['brain','family','party'], players:[1,2], modes:['solo','online'],
  weight:84, dynamicScore:true,
  factory: function(ctx){
    const isMP = ctx.mode!=='solo';
    const P = isMP? 4 : 4;   /* 4x4 = 8 pairs */
    const deck = [];
    const rng = U.mulberry32(ctx.seed ?? 12345);
    const picks = U.shuffle(EMOJIS.slice(0,20), rng).slice(0, P*P/2);
    picks.forEach(e=>{ deck.push(e,e); });
    const board = U.shuffle(deck, rng);
    let open = [];             /* indices */
    let matched = new Array(board.length).fill(false);
    let mine = new Array(board.length).fill(null); /* who matched */
    let scoreMe = 0, scoreOp = 0;
    let miss = 0, flips = 0;
    let lock = false;
    let over = false;
    let turn = 0;              /* 0 = my turn */
    let t0 = Date.now();
    const players = ctx.players||[];
    const myIdx = Math.max(0, players.findIndex(pl=>pl.pid===ctx.selfPid));
    const myTurnIdx = isMP? myIdx : 0;
    const opPid = ()=> players.find(pl=>pl.pid!==ctx.selfPid)?.pid || 'BOT:1';

    const root = document.createElement('div');
    root.innerHTML = `<div class="gcenter">
      <div class="mem c4" id="mgrid"></div>
      <div class="gmsg" id="mmsg"></div>
    </div>`;
    ctx.root.appendChild(root);
    const grid = root.querySelector('#mgrid');

    function isMyTurn(){ return !isMP || (turn%players.length)===myTurnIdx; }
    function render(){
      grid.innerHTML='';
      board.forEach((em,i)=>{
        const c = document.createElement('button');
        const isOpen = open.includes(i) || matched[i];
        c.className = 'mem-card' + (isOpen?' flip':'') + (matched[i]?' matched done':'');
        c.innerHTML = `<span class="f"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 21v-9M4 7.5l8 4.5 8-4.5"/></svg></span><span class="b">${em}</span>`;
        c.onclick = ()=>flip(i);
        grid.appendChild(c);
      });
      hud();
    }
    function hud(){
      if(isMP){
        const names = players.map(pl=>pl.name||'؟');
        ctx.setScores ? null : null;
        const sEl = document.getElementById('pl-turn');
        ctx.setTurn((isMyTurn()? t('pl.turnY2') : t('pl.turnOf',{n:names[turn%players.length]})), isMyTurn()?'me':'');
      }
      const elapsed = over? 0 : Math.floor((Date.now()-t0)/1000);
      ctx.setStatus(isMP? `${fmt(scoreMe)} : ${fmt(scoreOp)}` : '⏱ '+fmt(elapsed)+'s · ✕ '+fmt(miss));
    }
    async function flip(i){
      if(over || lock || open.includes(i) || matched[i] || !isMyTurn()) return;
      open.push(i); flips++;
      PV.sound.play('flip'); U.vibrate();
      render();
      if(open.length===2){
        lock = true;
        const [a,b] = open;
        if(board[a]===board[b]){
          setTimeout(()=>{
            matched[a]=matched[b]=true; mine[a]=mine[b]= myTurnIdx;
            if(!isMP || myTurnIdx===myIdx) scoreMe++; else scoreOp++;
            PV.sound.play('pop');
            if(isMP && ctx.amHost) ctx.broadcast('st', {m:[...matched], mi:myTurnIdx});
            open=[];
            lock=false; render();
            checkEnd();
            /* match keeps the turn */
            if(!over) hud();
          }, 450);
        } else {
          miss++;
          setTimeout(()=>{
            open=[]; lock=false;
            turn++;
            if(isMP && ctx.amHost) ctx.broadcast('tn', {turn});
            render(); hud();
          }, 750);
        }
      }
    }
    function checkEnd(){
      if(matched.every(Boolean)){
        over = true;
        const secs = Math.floor((Date.now()-t0)/1000);
        let res = 'd';
        if(isMP){ res = scoreMe>scoreOp? 'w': scoreMe<scoreOp? 'l':'d'; }
        else { res = 'w'; }
        if(isMP && ctx.amHost) ctx.broadcast('over', {scoreMe, scoreOp});
        setTimeout(()=>ctx.finish({
          res, vsHuman:isMP,
          scores: isMP? {[ctx.selfPid]:scoreMe, [opPid()]:scoreOp} : {[ctx.selfPid]: Math.max(10, 200 - secs*2 - miss*10)},
          stats:{misses: isMP? undefined: miss},
          sub: isMP? (scoreMe+' : '+scoreOp) : '⏱ '+fmt(secs)+'s',
        }), 700);
      }
    }
    if(isMP){
      ctx.on('st', d=>{ matched=d.m; mine=d.mi!=null? d.mi:0; if(d.mi!==myIdx) scoreOp++; else scoreMe++; open=[]; render(); checkEnd(); });
      ctx.on('tn', d=>{ turn=d.turn; open=[]; lock=false; render(); });
      ctx.on('over', ()=>{ if(!over){ over=true; ctx.finish({res: scoreMe>scoreOp?'w':'l', vsHuman:true, scores:{[ctx.selfPid]:scoreMe, [opPid()]:scoreOp}}); } });
    }
    render();
    const tick = setInterval(()=>{ if(!over && !isMP){ hud(); } if(over) clearInterval(tick); }, 1000);
    return {
      init(){}, start(){},
      reset(){ /* reshuffle with new seed */ },
      getState(){ return {board, matched}; },
      end(){ over=true; clearInterval(tick); },
      destroy(){ root.remove(); clearInterval(tick); },
      getScores(){ return isMP? {[ctx.selfPid]:scoreMe, [opPid()]:scoreOp} : {[ctx.selfPid]: Math.max(0, 200 - miss*10)}; },
      getStatus(){ return isMP? fmt(scoreMe)+' : '+fmt(scoreOp) : '✕ '+fmt(miss); },
    };
  }
});
})();
