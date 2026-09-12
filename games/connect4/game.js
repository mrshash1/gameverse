/* ============ Game: Connect Four — host-authoritative, bot heuristic ============ */
(function(){
'use strict';
const PV = window.PV, U = PV.u, t = PV.t;

const COLS=7, ROWS=6;
function dropRow(board, col){
  for(let r=ROWS-1;r>=0;r--) if(board[r][col]==null) return r;
  return -1;
}
function findWin(board, p){
  const dirs=[[0,1],[1,0],[1,1],[1,-1]];
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    if(board[r][c]!==p) continue;
    for(const [dr,dc] of dirs){
      let n=1;
      let rr=r+dr, cc=c+dc;
      while(rr>=0&&rr<ROWS&&cc>=0&&cc<COLS&&board[rr][cc]===p){ n++; rr+=dr; cc+=dc; }
      if(n>=4){
        const line=[]; for(let k=0;k<4;k++) line.push([r+dr*k, c+dc*k]);
        return {line};
      }
    }
  }
  return null;
}
function botCol(board, diff){
  const me=1, op=0;
  const valid = [...Array(COLS).keys()].filter(c=>dropRow(board,c)>=0);
  if(!valid.length) return 0;
  const rand = ()=> valid[Math.floor(Math.random()*valid.length)];
  if(diff==='easy' && Math.random()<.5) return rand();
  if(diff==='normal' && Math.random()<.25) return rand();
  /* 1) winning move */
  for(const c of valid){ const r=dropRow(board,c); board[r][c]=me; if(findWin(board,me)){ board[r][c]=null; return c; } board[r][c]=null; }
  /* 2) block */
  for(const c of valid){ const r=dropRow(board,c); board[r][c]=op; if(findWin(board,op)){ board[r][c]=null; return c; } board[r][c]=null; }
  /* 3) center preference, avoid giving win on top */
  const pref=[3,2,4,1,5,0,6].filter(c=>valid.includes(c));
  for(const c of pref){ const r=dropRow(board,c); board[r][c]=me; const oppWouldWin = valid.some(c2=>{ const r2=dropRow(board,c2); board[r2][c2]=op; const w=findWin(board,op); board[r2][c2]=null; return !!w; }); board[r][c]=null; if(!oppWouldWin) return c; }
  return pref[0] ?? rand();
}

PV.registry.register({
  id:'connect4', cats:['board','classic','family'], players:[2,2], modes:['solo','online'],
  weight:90,
  factory: function(ctx){
    let board = Array.from({length:ROWS},()=>Array(COLS).fill(null));
    let turn = 0;
    let over = false;
    const isMP = ctx.mode!=='solo';
    const players = ctx.players||[];
    const mySeat = isMP? Math.max(0, players.findIndex(pl=>pl.pid===ctx.selfPid)) : 0;
    const botSeat = 1-mySeat;
    const root = document.createElement('div');
    root.innerHTML = `<div class="c4b">
      <div class="c4-cols" id="c4cols">${[...Array(COLS).keys()].map(c=>`<button data-c="${c}">▼</button>`).join('')}</div>
      <div class="c4-grid" id="c4grid"></div>
      <div class="gmsg" id="c4msg"></div>
    </div>`;
    ctx.root.appendChild(root);
    const grid = root.querySelector('#c4grid');
    const colsBar = root.querySelector('#c4cols');

    function render(){
      grid.innerHTML='';
      const w = findWin(board,0)||findWin(board,1);
      for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
        const cell = document.createElement('button');
        cell.className='c4-cell'+(board[r][c]!=null?' taken':'');
        if(board[r][c]!=null){
          const disc = document.createElement('span');
          disc.className='c4-disc p'+board[r][c];
          if(w && w.line.some(([lr,lc])=>lr===r&&lc===c)) disc.classList.add('win');
          cell.appendChild(disc);
        } else {
          cell.onclick = ()=>play(c);
        }
        grid.appendChild(cell);
      }
      uiTurn();
    }
    function uiTurn(){
      if(over) return;
      const can = !isMP? true : turn===mySeat;
      const isBot = !isMP && turn===botSeat;
      if(isBot){ ctx.setTurn(t('pl.botThink')); return; }
      ctx.setTurn(can? t('pl.turnY2') : t('pl.turnW'), can?'me':'');
    }
    function play(c){
      if(over || dropRow(board,c)<0) return;
      if(isMP){ if(turn!==mySeat) return; if(!ctx.amHost){ ctx.send('mv',{c},hostPid()); return; } }
      if(!isMP && turn===botSeat) return;
      apply(c);
    }
    function hostPid(){ return players[0]?.pid; }
    function apply(c){
      const r = dropRow(board,c); if(r<0||over) return;
      board[r][c]=turn;
      PV.sound.play('place'); U.vibrate();
      if(isMP && ctx.amHost) ctx.broadcast('state',{b: board.map(r=>[...r]), t: turn? 0:1});
      const w = findWin(board, turn);
      const full = board[0].every(x=>x!=null);
      if(w || full){ render(); endGame(w? turn : null); }
      else { turn = turn?0:1; render(); scheduleBot(); }
    }
    function scheduleBot(){
      if(isMP || over || turn!==botSeat) return;
      setTimeout(()=>{ if(!over && turn===botSeat) apply(botCol(board, ctx.diff)); }, 620);
    }
    function endGame(winSeat){
      over = true;
      const myWin = winSeat==null? null : winSeat===mySeat;
      if(isMP && ctx.amHost){
        const winPid = winSeat==null? null : (players[winSeat]?.pid || 'BOT:1');
        ctx.broadcast('over',{winPid});
      }
      ctx.setTurn(myWin==null? t('pl.drawT'):(myWin? t('pl.victory'):t('pl.defeat')), myWin==null?'':(myWin?'win':'lose'));
      const names = players.map(p=>p?.name||t('g.bot'));
      setTimeout(()=>ctx.finish({
        res: winSeat==null? 'd' : (myWin?'w':'l'),
        vsHuman:isMP,
        scores:{[players[0]?.pid]: winSeat===0?1:0, [players[1]?.pid||'BOT:1']: winSeat===1?1:0},
        sub: winSeat==null? '' : t('g.winner',{n:names[winSeat]}),
      }), 950);
    }
    if(isMP){
      ctx.on('mv', d=>{ /* host authority: only seat 1 may move, and only on their turn */
        if(!ctx.amHost || over || d.c==null) return;
        if(turn!==1) return;
        apply(d.c|0);
      });
      ctx.on('state', d=>{ board=d.b; turn=d.t; render(); });
      ctx.on('over', d=>{
        if(over) return; over=true;
        const myWin = d.winPid==null? null : d.winPid===ctx.selfPid;
        ctx.setTurn(myWin==null? t('pl.drawT'):(myWin? t('pl.victory'):t('pl.defeat')), myWin?'win':'lose');
        setTimeout(()=>ctx.finish({res:myWin==null?'d':(myWin?'w':'l'), vsHuman:true, scores:{[players[0]?.pid]:d.winPid===players[0]?.pid?1:0, [players[1]?.pid]:d.winPid===players[1]?.pid?1:0}}), 800);
      });
    }
    colsBar.querySelectorAll('[data-c]').forEach(b=> b.onclick = ()=>play(+b.dataset.c));
    render(); scheduleBot();
    return {
      init(){}, start(){},
      reset(){ board=Array.from({length:ROWS},()=>Array(COLS).fill(null)); turn=0; over=false; render(); scheduleBot(); },
      getState(){ return {board, turn}; }, end(){ over=true; }, destroy(){ root.remove(); },
      getScores(){ return {[players[0]?.pid]: findWin(board,0)?1:0, [players[1]?.pid||'BOT:1']: findWin(board,1)?1:0}; },
      getStatus(){ return over? '' : (turn===mySeat||!isMP? t('pl.turnY2'):t('pl.turnW')); },
    };
  }
});
})();
