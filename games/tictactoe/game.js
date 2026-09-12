/* ============ Game: Tic Tac Toe (solo bot + real online P2P) ============ */
(function(){
'use strict';
const PV = window.PV, U = PV.u, t = PV.t;

const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
function winner(b){ for(const [a,c,d] of LINES){ if(b[a] && b[a]===b[c] && b[a]===b[d]) return {p:b[a], line:[a,c,d]}; } return b.every(Boolean)? {p:'draw'}:null; }
function minimax(b, me, turn){
  const w = winner(b);
  if(w){ return {score: w.p==='draw'?0 : w.p===me? 10 : -10}; }
  let best = null;
  for(let i=0;i<9;i++) if(!b[i]){
    b[i]=turn;
    const r = minimax(b, me, turn==='X'?'O':'X');
    b[i]=null;
    const s = r.score - Math.sign(r.score)*0.1;
    if(!best || (turn===me? s>best.score : s<best.score)) best = {i, score:s};
  }
  return best||{score:0};
}
function botMove(b, me, diff){
  const empty = b.map((v,i)=>v?null:i).filter(v=>v!=null);
  if(diff==='easy') return empty[Math.floor(Math.random()*empty.length)];
  if(diff==='normal' && Math.random()<0.35) return empty[Math.floor(Math.random()*empty.length)];
  return minimax([...b], me, me).i;
}

PV.registry.register({
  id:'tictactoe', cats:['board','classic','family'], players:[2,2], modes:['solo','online'],
  weight:95,
  factory: function(ctx){
    const X='X', O='O';
    let board = Array(9).fill(null);
    let turn = X;
    let over = false;
    const marks = {X:'✕', O:'◯'};
    const root = document.createElement('div');
    root.innerHTML = `<div class="gcenter"><div class="t3" id="t3"></div></div>`;
    ctx.root.appendChild(root);
    const grid = root.querySelector('#t3');

    const isMP = ctx.mode!=='solo';
    const players = ctx.players||[];
    const myIdx = Math.max(0, players.findIndex(pl=>pl.pid===ctx.selfPid));
    const myMark = !isMP ? X : (myIdx===0? X:O);
    const botMark = myMark===X? O:X;
    const isBotTurnNow = ()=> !isMP && !over && turn===botMark;

    function render(){
      grid.innerHTML='';
      const w = winner(board);
      for(let i=0;i<9;i++){
        const c = document.createElement('button');
        c.className = 'cell' + (board[i]===X?' x':board[i]===O?' o':'') + (w&&w.line?.includes(i)?' win':'');
        if(board[i]){
          c.classList.add('pop');
          c.innerHTML = board[i]===X
            ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"><path d="M5 5l14 14M19 5 5 19"/></svg>`
            : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4"><circle cx="12" cy="12" r="7.5"/></svg>`;
        }
        c.onclick = ()=> play(i);
        grid.appendChild(c);
      }
      uiTurn();
    }
    function uiTurn(){
      const w = winner(board);
      if(over || w){ return; }
      const canPlay = !isMP ? true : (turn===myMark);
      if(isBotTurnNow()){ ctx.setTurn(t('pl.botThink')); return; }
      ctx.setTurn(canPlay? t('pl.turnY2')+' — '+marks[turn] : t('pl.turnW'), canPlay?'me':'');
    }
    function apply(i, mark){
      if(board[i] || winner(board)) return;
      board[i]=mark;
      PV.sound.play('place'); U.vibrate();
      if(isMP && ctx.amHost) ctx.broadcast('state', {board:[...board], turn: turn===X?O:X});
      const w = winner(board);
      if(w){ render(); endGame(w); } else { turn = turn===X?O:X; uiTurn(); scheduleBot(); }
      render();
    }
    function play(i){
      if(over || board[i] || winner(board)) return;
      if(isMP){
        if(turn!==myMark) return;
        if(ctx.amHost) apply(i, turn);
        else ctx.send('mv', {i, mark:turn}, hostPid());
      } else apply(i, turn);
    }
    function hostPid(){ return ctx.players?.[0]?.pid; }
    function scheduleBot(){
      if(!isBotTurnNow()) return;
      setTimeout(()=>{ if(!over && isBotTurnNow()){ apply(botMove(board, botMark, ctx.diff), botMark); } }, 550);
    }
    function endGame(w){
      over = true;
      const myWin = w.p==='draw' ? null : (w.p===myMark);
      if(isMP && ctx.amHost){
        const winPid = w.p==='draw'? null : (w.p===X? players[0].pid : (players[1]?.pid||'BOT:1'));
        ctx.broadcast('over', {winPid});
      }
      ctx.setTurn(myWin===null? t('pl.drawT') : (myWin? t('pl.victory'):t('pl.defeat')), myWin===null?'':(myWin?'win':'lose'));
      setTimeout(()=>{
        ctx.finish({
          res: w.p==='draw'?'d':(myWin?'w':'l'),
          scores: scoreMap(w),
          vsHuman: isMP,
          sub: w.p==='draw'? '' : t('g.winner',{n: w.p===X? nameOf(X):nameOf(O)}),
        });
      }, 950);
    }
    function nameOf(mark){ return players[(mark===X)?0:1]?.name || t('g.bot'); }
    function scoreMap(w){
      const s = {};
      for(const pl of players){ s[pl.pid] = (w.p && w.p!=='draw' && ((w.p===X&&pl.pid===players[0]?.pid)||(w.p===O&&pl.pid===players[1]?.pid)))? 1:0; }
      return s;
    }
    if(isMP){
      ctx.on('mv', (d)=>{
        if(!ctx.amHost) return;
        if(d.mark!==turn) return;
        apply(d.i, d.mark);
      });
      ctx.on('state', d=>{ board = d.board; turn = d.turn; render(); });
      ctx.on('over', d=>{
        if(over) return;
        over=true;
        const w = winner(board);
        const myWin = d.winPid==null? null : d.winPid===ctx.selfPid;
        ctx.setTurn(myWin==null? t('pl.drawT'):(myWin? t('pl.victory'):t('pl.defeat')), myWin?'win':'lose');
        setTimeout(()=>ctx.finish({res:myWin==null?'d':(myWin?'w':'l'), scores:scoreMap(w), vsHuman:true}), 800);
      });
    }
    render(); scheduleBot();
    return {
      init(){}, start(){},
      reset(){ board=Array(9).fill(null); turn=X; over=false; render(); scheduleBot(); },
      getState(){ return {board, turn}; },
      end(){ over=true; },
      destroy(){ root.remove(); },
      getScores(){ return scoreMap(winner(board)||{}); },
      getStatus(){ return over? '' : (turn===myMark? t('pl.turnY2'):t('pl.turnW')); },
    };
  }
});
})();
