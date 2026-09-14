/* ============ Game: شطرنج (Chess) — full FIDE rules, minimax bot, host-authoritative online ============
   • 8×8, Unicode pieces • en passant, promotion modal, castling (rights + through-check), 50-move,
     insufficient material • check/checkmate/stalemate • tap-tap UI, dots/rings, check glow, undo (solo)
   • Bot: minimax + αβ, material + piece-square tables (easy d1+15% rnd / normal d2 / hard d3)
   • Online: guest ctx.send('mv') → host validates + applies + broadcasts 'st' + 'over'
=================================================================== */
(function(){
'use strict';
const PV = window.PV, U = PV.u, t = PV.t;
const { fmt } = U;

const LANG = ()=> (PV.i18n && PV.i18n.lang) || 'fa';
const L = {
  fa:{
    think:'🤖 دارد فکر می‌کند…', yourTurn:'نوبت شما — مهره‌ای بزنید',
    check:'کیش!', checkmate:'کیش و مات!', stalemate:'آچ‌مات (پات) — مساوی',
    draw50:'مساوی — قانون ۵۰ حرکت', drawMat:'مساوی — ماتریال ناکافی',
    undo:'↶ برگشت', moves:'حرکت', promoT:'ارتقای سرباز — انتخاب کنید',
    q:'وزیر', r:'رخ', b:'فیل', n:'اسب', you:'شما', bot:'ربات',
    wins:'برد', draws:'مساوی', losses:'باخت', streak:'🔥 پیاپی',
    hint:'مهره را بزن ← مقصد را بزن', wait:'⏳ در انتظار حریف…',
  },
  en:{
    think:'🤖 Bot is thinking…', yourTurn:'Your turn — pick a piece',
    check:'Check!', checkmate:'Checkmate!', stalemate:'Stalemate — draw',
    draw50:'Draw — 50-move rule', drawMat:'Draw — insufficient material',
    undo:'↶ Undo', moves:'Move', promoT:'Promote pawn — choose',
    q:'Queen', r:'Rook', b:'Bishop', n:'Knight', you:'You', bot:'Bot',
    wins:'Wins', draws:'Draws', losses:'Losses', streak:'🔥 Streak',
    hint:'Tap a piece ← tap a target', wait:'⏳ Waiting for opponent…',
  },
};
const tt = k => (L[LANG()] && L[LANG()][k]) || L.fa[k] || k;

/* ============================== ENGINE ============================== */
const P=1, N=2, B=3, R=4, Q=5, K=6;
const GLYPH = ['','♟','♞','♝','♜','♛','♚'];
const VAL = [0,100,320,330,500,900,0];
const PTS = [0,1,3,3,5,9,0];
const PROMO = {q:Q, r:R, b:B, n:N};
const PROMOCH = {5:'q', 4:'r', 3:'b', 2:'n'};
const CO = 'abcdefgh';
const alg = i => CO[i&7] + (8-(i>>3));
const KN = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
const KG = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
const DIAG = [[-1,-1],[-1,1],[1,-1],[1,1]];
const ORTH = [[-1,0],[1,0],[0,-1],[0,1]];
const MATE = 100000;

const PST = {
  1:[  0,  0,  0,  0,  0,  0,  0,  0,
      50, 50, 50, 50, 50, 50, 50, 50,
      10, 10, 20, 30, 30, 20, 10, 10,
       5,  5, 10, 25, 25, 10,  5,  5,
       0,  0,  0, 20, 20,  0,  0,  0,
       5, -5,-10,  0,  0,-10, -5,  5,
       5, 10, 10,-20,-20, 10, 10,  5,
       0,  0,  0,  0,  0,  0,  0,  0],
  2:[-50,-40,-30,-30,-30,-30,-40,-50,
     -40,-20,  0,  0,  0,  0,-20,-40,
     -30,  0, 10, 15, 15, 10,  0,-30,
     -30,  5, 15, 20, 20, 15,  5,-30,
     -30,  0, 15, 20, 20, 15,  0,-30,
     -30,  5, 10, 15, 15, 10,  5,-30,
     -40,-20,  0,  5,  5,  0,-20,-40,
     -50,-40,-30,-30,-30,-30,-40,-50],
  3:[-20,-10,-10,-10,-10,-10,-10,-20,
     -10,  0,  0,  0,  0,  0,  0,-10,
     -10,  0,  5, 10, 10,  5,  0,-10,
     -10,  5,  5, 10, 10,  5,  5,-10,
     -10,  0, 10, 10, 10, 10,  0,-10,
     -10, 10, 10, 10, 10, 10, 10,-10,
     -10,  5,  0,  0,  0,  0,  5,-10,
     -20,-10,-10,-10,-10,-10,-10,-20],
  4:[  0,  0,  0,  0,  0,  0,  0,  0,
       5, 10, 10, 10, 10, 10, 10,  5,
      -5,  0,  0,  0,  0,  0,  0, -5,
      -5,  0,  0,  0,  0,  0,  0, -5,
      -5,  0,  0,  0,  0,  0,  0, -5,
      -5,  0,  0,  0,  0,  0,  0, -5,
      -5,  0,  0,  0,  0,  0,  0, -5,
       0,  0,  0,  5,  5,  0,  0,  0],
  5:[-20,-10,-10, -5, -5,-10,-10,-20,
     -10,  0,  0,  0,  0,  0,  0,-10,
     -10,  0,  5,  5,  5,  5,  0,-10,
      -5,  0,  5,  5,  5,  5,  0, -5,
       0,  0,  5,  5,  5,  5,  0, -5,
     -10,  5,  5,  5,  5,  5,  0,-10,
     -10,  0,  5,  0,  0,  0,  0,-10,
     -20,-10,-10, -5, -5,-10,-10,-20],
  6:[-30,-40,-40,-50,-50,-40,-40,-30,
     -30,-40,-40,-50,-50,-40,-40,-30,
     -30,-40,-40,-50,-50,-40,-40,-30,
     -30,-40,-40,-50,-50,-40,-40,-30,
     -20,-30,-30,-40,-40,-30,-30,-20,
     -10,-20,-20,-20,-20,-20,-20,-10,
      20, 20,  0,  0,  0,  0, 20, 20,
      20, 30, 10,  0,  0, 10, 30, 20],
};

function startBoard(){
  const b = new Int8Array(64), back = [R,N,B,Q,K,B,N,R];
  for(let c=0;c<8;c++){ b[c]=-back[c]; b[8+c]=-P; b[48+c]=P; b[56+c]=back[c]; }
  return b;
}
function kingSq(b, white){ const k = white? K : -K; for(let i=0;i<64;i++) if(b[i]===k) return i; return -1; }

function attacked(b, sq, byWhite){
  const r=sq>>3, c=sq&7, s=byWhite?1:-1;
  const pr = byWhite? r+1 : r-1;
  if(pr>=0 && pr<8){
    if(c>0 && b[pr*8+c-1]===s*P) return true;
    if(c<7 && b[pr*8+c+1]===s*P) return true;
  }
  for(let k=0;k<8;k++){
    const rr=r+KN[k][0], cc=c+KN[k][1];
    if(rr>=0&&rr<8&&cc>=0&&cc<8&&b[rr*8+cc]===s*N) return true;
    const r2=r+KG[k][0], c2=c+KG[k][1];
    if(r2>=0&&r2<8&&c2>=0&&c2<8&&b[r2*8+c2]===s*K) return true;
  }
  for(const d of DIAG){
    let rr=r+d[0], cc=c+d[1];
    while(rr>=0&&rr<8&&cc>=0&&cc<8){ const v=b[rr*8+cc]; if(v){ if(v===s*B||v===s*Q) return true; break; } rr+=d[0]; cc+=d[1]; }
  }
  for(const d of ORTH){
    let rr=r+d[0], cc=c+d[1];
    while(rr>=0&&rr<8&&cc>=0&&cc<8){ const v=b[rr*8+cc]; if(v){ if(v===s*R||v===s*Q) return true; break; } rr+=d[0]; cc+=d[1]; }
  }
  return false;
}

function genPseudo(st){
  const b=st.b, w=st.turn===0, out=[];
  for(let i=0;i<64;i++){
    const v=b[i]; if(!v || (v>0)!==w) continue;
    const r=i>>3, c=i&7, a=v>0? v : -v;
    if(a===P){
      const dr = w? -1 : 1, startR = w? 6 : 1, lastR = w? 0 : 7;
      const f1 = i + dr*8;
      if(f1>=0 && f1<64 && b[f1]===0){
        if((f1>>3)===lastR){ for(const pm of [Q,R,B,N]) out.push({f:i,t:f1,cap:0,promo:pm}); }
        else{
          out.push({f:i,t:f1,cap:0,promo:0});
          if(r===startR && b[i+dr*16]===0) out.push({f:i,t:i+dr*16,cap:0,promo:0,dbl:1});
        }
      }
      for(const dc of [-1,1]){
        const cc=c+dc; if(cc<0||cc>7) continue;
        const ti=(r+dr)*8+cc; if(ti<0||ti>63) continue;
        const tv=b[ti];
        if(tv && (tv>0)!==w){
          if((ti>>3)===lastR){ for(const pm of [Q,R,B,N]) out.push({f:i,t:ti,cap:tv,promo:pm}); }
          else out.push({f:i,t:ti,cap:tv,promo:0});
        } else if(ti===st.ep && !tv) out.push({f:i,t:ti,cap:-s0(w)*P,promo:0,ep:1});
      }
    } else if(a===N || a===K){
      const offs = a===N? KN : KG;
      for(const d of offs){
        const rr=r+d[0], cc=c+d[1]; if(rr<0||rr>7||cc<0||cc>7) continue;
        const ti=rr*8+cc, tv=b[ti];
        if(!tv || (tv>0)!==w) out.push({f:i,t:ti,cap:tv,promo:0});
      }
      if(a===K){
        if(w && i===60){
          if(st.cast[0] && !b[61]&&!b[62]&&b[63]===R && !attacked(b,60,false)&&!attacked(b,61,false)&&!attacked(b,62,false)) out.push({f:60,t:62,cap:0,promo:0,cast:1});
          if(st.cast[1] && !b[59]&&!b[58]&&!b[57]&&b[56]===R && !attacked(b,60,false)&&!attacked(b,59,false)&&!attacked(b,58,false)) out.push({f:60,t:58,cap:0,promo:0,cast:2});
        } else if(!w && i===4){
          if(st.cast[2] && !b[5]&&!b[6]&&b[7]===-R && !attacked(b,4,true)&&!attacked(b,5,true)&&!attacked(b,6,true)) out.push({f:4,t:6,cap:0,promo:0,cast:1});
          if(st.cast[3] && !b[3]&&!b[2]&&!b[1]&&b[0]===-R && !attacked(b,4,true)&&!attacked(b,3,true)&&!attacked(b,2,true)) out.push({f:4,t:2,cap:0,promo:0,cast:2});
        }
      }
    } else {
      const dirs = a===B? DIAG : a===R? ORTH : DIAG.concat(ORTH);
      for(const d of dirs){
        let rr=r+d[0], cc=c+d[1];
        while(rr>=0&&rr<8&&cc>=0&&cc<8){
          const ti=rr*8+cc, tv=b[ti];
          if(!tv) out.push({f:i,t:ti,cap:0,promo:0});
          else { if((tv>0)!==w) out.push({f:i,t:ti,cap:tv,promo:0}); break; }
          rr+=d[0]; cc+=d[1];
        }
      }
    }
  }
  return out;
}
const s0 = w => w? 1 : -1;

function makeMove(st, m){
  const b = st.b.slice(), w = st.turn===0, s = w?1:-1, cast = st.cast.slice();
  const moving = b[m.f];
  b[m.f]=0;
  b[m.t] = m.promo? s*m.promo : moving;
  if(m.ep) b[m.t + (w?8:-8)] = 0;
  if(m.cast===1){ const rf=w?63:7; b[w?61:5]=b[rf]; b[rf]=0; }
  if(m.cast===2){ const rf=w?56:0; b[w?59:3]=b[rf]; b[rf]=0; }
  if(moving===K){ cast[0]=cast[1]=false; }
  if(moving===-K){ cast[2]=cast[3]=false; }
  if(m.f===63||m.t===63) cast[0]=false;
  if(m.f===56||m.t===56) cast[1]=false;
  if(m.f===7 ||m.t===7 ) cast[2]=false;
  if(m.f===0 ||m.t===0 ) cast[3]=false;
  const half = (Math.abs(moving)===P || m.cap || m.dbl)? 0 : st.half+1;
  return { b, turn:1-st.turn, cast, ep: m.dbl? (m.f+m.t)>>1 : -1, half, full: st.full + (w?0:1) };
}
function legalMoves(st){
  const w = st.turn===0;
  return genPseudo(st).filter(m=>{
    const ns = makeMove(st, m);
    return !attacked(ns.b, kingSq(ns.b, w), !w);
  });
}
function hasAnyLegal(st){
  const w = st.turn===0, ms = genPseudo(st);
  for(const m of ms){ const ns = makeMove(st,m); if(!attacked(ns.b, kingSq(ns.b,w), !w)) return true; }
  return false;
}
function inCheck(st){ const w = st.turn===0; return attacked(st.b, kingSq(st.b,w), !w); }

function insufficient(b){
  let minors=0, wb=0, bb=0, wcol=-1, bcol=-1;
  for(let i=0;i<64;i++){
    const v=b[i]; if(!v) continue;
    const a=v>0? v : -v;
    if(a===K) continue;
    if(a===P||a===R||a===Q) return false;
    minors++;
    if(a===B){ const col=((i>>3)+(i&7))&1; if(v>0){ wb++; wcol=col; } else { bb++; bcol=col; } }
  }
  if(minors<=1) return true;
  return minors===2 && wb===1 && bb===1 && wcol===bcol;
}
function checkEnd(st){
  if(!hasAnyLegal(st)) return inCheck(st)? {win:1-st.turn, mate:true} : {win:null, draw:true, reason:'stale'};
  if(st.half>=100) return {win:null, draw:true, reason:'50'};
  if(insufficient(st.b)) return {win:null, draw:true, reason:'mat'};
  return null;
}

function evalBoard(b){
  let e=0;
  for(let i=0;i<64;i++){
    const v=b[i]; if(!v) continue;
    const a=v>0? v : -v;
    if(v>0) e += VAL[a] + PST[a][i];
    else e -= VAL[a] + PST[a][i^56];
  }
  return e;
}
const orderMoves = ms => ms.sort((a,b)=>
  ((b.cap? VAL[Math.abs(b.cap)] : 0) + (b.promo? 800:0)) - ((a.cap? VAL[Math.abs(a.cap)] : 0) + (a.promo? 800:0)));

function negamax(st, depth, alpha, beta, ply){
  if(st.half>=100) return 0;
  if(depth===0) return hasAnyLegal(st)? (st.turn===0?1:-1)*evalBoard(st.b) : (inCheck(st)? -MATE+ply : 0);
  const moves = legalMoves(st);
  if(!moves.length) return inCheck(st)? -MATE+ply : 0;
  orderMoves(moves);
  let best = -Infinity;
  for(const m of moves){
    const sc = -negamax(makeMove(st,m), depth-1, -beta, -alpha, ply+1);
    if(sc>best) best=sc;
    if(best>alpha) alpha=best;
    if(alpha>=beta) break;
  }
  return best;
}
function botMove(st, diff, rng){
  const moves = legalMoves(st);
  if(!moves.length) return null;
  if(diff==='easy' && rng()<.15) return moves[(rng()*moves.length)|0];
  const depth = diff==='easy'? 1 : diff==='normal'? 2 : 3;
  const noise = diff==='hard'? 4 : diff==='normal'? 12 : 30;
  orderMoves(moves);
  let best=null, bestSc=-Infinity, alpha=-Infinity;
  for(const m of moves){
    const sc = -negamax(makeMove(st,m), depth-1, -Infinity, -alpha, 1) + (rng()*2-1)*noise;
    if(sc>bestSc){ bestSc=sc; best=m; }
    if(bestSc>alpha) alpha=bestSc;
  }
  return best;
}

/* ============================== GAME MODULE ============================== */
PV.registry.register({
  id:'chess', cats:['board','classic','brain'], players:[2,2], modes:['solo','online'], weight:96,
  factory: function(ctx){
    const isMP = ctx.mode!=='solo';
    const players = ctx.players||[];
    const rng = ctx.rng || Math.random;
    const hostPid = players[0]?.pid;
    const mySeat = isMP? Math.max(0, players.findIndex(p=>p.pid===ctx.selfPid)) : 0;
    const botSeat = 1-mySeat;
    const flip = isMP && mySeat===1;
    const diff = ctx.diff || 'normal';
    const STATS_KEY = 'pv:stats:chess';

    let state, lastM, rows, caps, capsV, history, sel, over, fin, seq, botTO, paused, promoPending;

    /* ------------------------------ DOM ------------------------------ */
    const root = document.createElement('div');
    root.innerHTML = `
<style>
.pvchess-wrap{display:flex;flex-direction:column;align-items:center;gap:8px;width:100%;padding:2px 0 10px;font-family:inherit}
.pvchess-strip{display:flex;align-items:center;gap:8px;width:min(92vw,60vh);direction:ltr}
.pvchess-cap{display:flex;align-items:center;min-height:22px;flex:1;font-size:1.02rem;letter-spacing:2px;line-height:1;overflow:hidden;white-space:nowrap}
.pvchess-cap.r{justify-content:flex-end}
.pvchess-cap b{font-size:.7rem;color:var(--tx2);margin:0 5px;font-variant-numeric:tabular-nums}
.pvchess-tools{display:flex;gap:6px;justify-content:center}
.pvchess-btn{background:var(--surface2);border:1.5px solid var(--border);border-radius:999px;padding:4px 13px;font-size:.78rem;font-weight:800;color:var(--tx2);cursor:pointer;box-shadow:var(--sh-1);transition:transform .12s;font-family:inherit}
.pvchess-btn:active{transform:scale(.93)}
.pvchess-btn:disabled{opacity:.4;pointer-events:none}
.pvchess-bwrap{position:relative}
.pvchess-board{display:grid;grid-template-columns:repeat(8,1fr);width:min(92vw,60vh);aspect-ratio:1;border-radius:14px;overflow:hidden;
  box-shadow:var(--sh-3),0 0 0 1.5px var(--border);direction:ltr;touch-action:manipulation;user-select:none;-webkit-user-select:none}
.pvchess-cell{position:relative;display:flex;align-items:center;justify-content:center;cursor:pointer;-webkit-tap-highlight-color:transparent}
.pvchess-cell.lt{background:linear-gradient(135deg,#f6ecda,#eedfc6)}
.pvchess-cell.dk{background:linear-gradient(135deg,#b28e63,#a07c50)}
.pvchess-cell.last::before{content:'';position:absolute;inset:0;background:rgba(255,193,7,.34)}
.pvchess-cell.sel::before{content:'';position:absolute;inset:0;background:rgba(124,92,255,.38);box-shadow:inset 0 0 0 3px rgba(255,255,255,.55)}
.pvchess-cell.dot::after{content:'';position:absolute;width:27%;height:27%;border-radius:50%;
  background:radial-gradient(circle at 35% 32%,#5cf09a,#16a34a);box-shadow:0 2px 7px rgba(22,163,74,.55)}
.pvchess-cell.ring::after{content:'';position:absolute;width:80%;height:80%;border-radius:50%;
  border:3.5px solid rgba(239,68,68,.9);box-shadow:0 0 11px rgba(239,68,68,.4),inset 0 0 8px rgba(239,68,68,.25)}
.pvchess-cell.chk::before{content:'';position:absolute;inset:0;background:radial-gradient(circle,rgba(239,68,68,.6),rgba(239,68,68,.12) 72%);animation:pvchess-chk 1s ease-in-out infinite}
@keyframes pvchess-chk{0%,100%{opacity:1}50%{opacity:.45}}
.pvchess-p{position:relative;z-index:1;line-height:1;font-size:calc(min(92vw,60vh)/10.6)}
.pvchess-p.pw{color:#fdfcf7;text-shadow:0 1.6px 0 #6b6154,0 0 5px rgba(0,0,0,.42),0 3px 7px rgba(0,0,0,.3)}
.pvchess-p.pb{color:#2e3048;text-shadow:0 1.6px 0 rgba(255,255,255,.34),0 3px 7px rgba(0,0,0,.28)}
.pvchess-cell.movable .pvchess-p{filter:drop-shadow(0 0 5px rgba(124,92,255,.75))}
.pvchess-p.pop{animation:pvchess-pop .32s cubic-bezier(.34,1.56,.64,1)}
@keyframes pvchess-pop{0%{transform:scale(.35)}100%{transform:scale(1)}}
.pvchess-promo{position:absolute;inset:0;display:none;align-items:center;justify-content:center;z-index:9;
  background:rgba(15,18,40,.5);backdrop-filter:blur(3px);border-radius:14px}
.pvchess-promo.on{display:flex}
.pvchess-promo-card{background:var(--surface);border-radius:18px;padding:14px 18px;box-shadow:var(--sh-3);text-align:center}
.pvchess-promo-card>b{display:block;font-size:.86rem;margin-bottom:9px;color:var(--tx)}
.pvchess-promo-row{display:flex;gap:8px;direction:ltr}
.pvchess-promo-row button{width:54px;height:54px;font-size:2rem;line-height:1;border-radius:14px;border:1.5px solid var(--border);
  background:var(--surface2);color:var(--tx);cursor:pointer;transition:transform .12s;box-shadow:var(--sh-1)}
.pvchess-promo-row button:active{transform:scale(.9);border-color:var(--p1)}
.pvchess-moves{direction:ltr;width:min(92vw,60vh);max-height:86px;overflow-y:auto;background:var(--surface2);
  border:1.5px solid var(--border);border-radius:12px;padding:6px 11px;font-size:.8rem;display:flex;flex-wrap:wrap;gap:1px 12px;color:var(--tx)}
.pvchess-mv i{font-style:normal;color:var(--tx3);margin-right:3px}
.pvchess-stats{display:flex;gap:6px;flex-wrap:wrap;justify-content:center}
.pvchess-chip{display:inline-flex;align-items:center;gap:5px;background:var(--surface2);border:1.5px solid var(--border);
  border-radius:999px;padding:3px 11px;font-size:.76rem;font-weight:800;color:var(--tx2);box-shadow:var(--sh-1)}
.pvchess-chip b{font-variant-numeric:tabular-nums;color:var(--tx)}
</style>
<div class="pvchess-wrap">
  <div class="pvchess-strip">
    <span class="pvchess-cap" id="pvchessCapT"></span>
    <span class="pvchess-tools">
      <button class="pvchess-btn" id="pvchessUndo">${tt('undo')}</button>
    </span>
  </div>
  <div class="pvchess-bwrap">
    <div class="pvchess-board" id="pvchessBoard"></div>
    <div class="pvchess-promo" id="pvchessPromo">
      <div class="pvchess-promo-card">
        <b>${tt('promoT')}</b>
        <div class="pvchess-promo-row">
          <button data-p="q" title="${tt('q')}">♕</button>
          <button data-p="r" title="${tt('r')}">♖</button>
          <button data-p="b" title="${tt('b')}">♗</button>
          <button data-p="n" title="${tt('n')}">♘</button>
        </div>
      </div>
    </div>
  </div>
  <div class="pvchess-strip">
    <span class="pvchess-cap" id="pvchessCapB"></span>
    <span class="pvchess-cap r" id="pvchessMat"></span>
  </div>
  <div class="pvchess-moves" id="pvchessMoves"></div>
  <div class="pvchess-stats" id="pvchessStats"></div>
</div>`;
    ctx.root.appendChild(root);
    const boardEl = root.querySelector('#pvchessBoard');
    const capT = root.querySelector('#pvchessCapT'), capB = root.querySelector('#pvchessCapB');
    const matEl = root.querySelector('#pvchessMat'), mvEl = root.querySelector('#pvchessMoves');
    const promoEl = root.querySelector('#pvchessPromo'), statsEl = root.querySelector('#pvchessStats');
    const undoBtn = root.querySelector('#pvchessUndo');
    undoBtn.style.display = isMP? 'none':'';

    const cells = [];
    for(let di=0; di<64; di++){
      const i = flip? 63-di : di;
      const d = document.createElement('div');
      d.className = 'pvchess-cell '+((((i>>3)+(i&7))&1)? 'dk':'lt');
      d.dataset.i = i;
      boardEl.appendChild(d);
      cells[i] = d;
    }

    /* ------------------------------ core ------------------------------ */
    function resetState(){
      state = { b:startBoard(), turn:0, cast:[true,true,true,true], ep:-1, half:0, full:0 };
      lastM = null; rows = []; caps = [[],[]]; capsV = [0,0]; history = [];
      sel = null; over = false; fin = false; seq = 0; paused = false; promoPending = null;
    }
    function snap(){
      return { state:{b:state.b.slice(), turn:state.turn, cast:state.cast.slice(), ep:state.ep, half:state.half, full:state.full},
        lastM, rows:rows.slice(), caps:[caps[0].slice(),caps[1].slice()], capsV:[capsV[0],capsV[1]] };
    }
    function pack(m, chk){
      return { q:seq, b:Array.from(state.b), t:state.turn, c:state.cast, e:state.ep, h:state.half, f:state.full,
        lf:m.f, lt:m.t, cp:m.cap?1:0, ck:chk?1:0, n:rows[rows.length-1]||'', cw:caps[0].join(''), cb:caps[1].join(''),
        vw:capsV[0], vb:capsV[1] };
    }
    function canPlay(){
      if(over||paused) return false;
      if(isMP) return state.turn===mySeat;
      return state.turn!==botSeat;
    }
    function setTurnUI(){
      if(over) return;
      if(!isMP && state.turn===botSeat) ctx.setTurn(tt('think'),'');
      else if(isMP) ctx.setTurn(state.turn===mySeat? t('pl.turnY2') : t('pl.turnW'), state.turn===mySeat? 'me':'');
      else ctx.setTurn(tt('yourTurn'),'me');
    }
    function render(){
      const legal = over? [] : legalMoves(state);
      const chkSq = (!over && inCheck(state))? kingSq(state.b, state.turn===0) : -1;
      const selMoves = sel!=null? legal.filter(m=>m.f===sel) : [];
      const mineTurn = canPlay();
      for(let i=0;i<64;i++){
        const cell = cells[i], v = state.b[i];
        cell.innerHTML = v? `<span class="pvchess-p ${v>0?'pw':'pb'}">${GLYPH[v>0?v:-v]}</span>` : '';
        cell.classList.toggle('sel', sel===i);
        cell.classList.toggle('last', !!lastM && (lastM.f===i||lastM.t===i));
        cell.classList.toggle('chk', i===chkSq);
        const tm = selMoves.find(m=>m.t===i);
        cell.classList.toggle('dot', !!tm && !tm.cap);
        cell.classList.toggle('ring', !!tm && !!tm.cap);
        cell.classList.toggle('movable', mineTurn && !!v && ((v>0)===(state.turn===0)) && legal.some(m=>m.f===i));
        if(v && lastM && lastM.t===i){ const p=cell.firstChild; if(p) p.classList.add('pop'); }
      }
      hud(); setTurnUI();
    }
    function hud(){
      const myCaps = caps[mySeat], opCaps = caps[1-mySeat];
      capB.innerHTML = myCaps.join('') + (capsV[mySeat]>capsV[1-mySeat]? `<b>+${fmt(capsV[mySeat]-capsV[1-mySeat])}</b>`:'');
      capT.innerHTML = opCaps.join('') + (capsV[1-mySeat]>capsV[mySeat]? `<b>+${fmt(capsV[1-mySeat]-capsV[mySeat])}</b>`:'');
      matEl.innerHTML = tt('moves')+' <b>'+fmt(state.full+1)+'</b>';
      mvEl.innerHTML = rows.map((s,idx)=> idx%2===0? `<span class="pvchess-mv"><i>${fmt(idx/2+1)}.</i>${s}</span>` : `<span class="pvchess-mv">${s}</span>`).join('');
      mvEl.scrollTop = mvEl.scrollHeight;
      undoBtn.disabled = isMP || over || !history.some(s=>s.state.turn===0);
      if(!isMP){
        const st = U.LS.get(STATS_KEY, null) || {w:0,d:0,l:0,best:0};
        statsEl.innerHTML = `<span class="pvchess-chip">🏆 <span>${tt('wins')}</span> <b>${fmt(st.w)}</b></span>
          <span class="pvchess-chip">🤝 <span>${tt('draws')}</span> <b>${fmt(st.d)}</b></span>
          <span class="pvchess-chip">💀 <span>${tt('losses')}</span> <b>${fmt(st.l)}</b></span>
          <span class="pvchess-chip">${tt('streak')} <b>${fmt(st.best)}</b></span>`;
      } else statsEl.innerHTML='';
    }
    function bumpStats(myWin){
      const st = U.LS.get(STATS_KEY, null) || {w:0,d:0,l:0,best:0};
      if(myWin===true){ st.w++; st.best=(st.best||0)+1; }
      else if(myWin===false){ st.l++; st.best=0; }
      else st.d++;
      U.LS.set(STATS_KEY, st);
    }
    function notate(before, m, endT, chk){
      const suf = endT? (endT.mate? '#' : '') : (chk? '+' : '');
      if(m.cast) return (m.cast===1? 'O-O' : 'O-O-O') + suf;
      const g = GLYPH[Math.abs(before.b[m.f])];
      return g+' '+alg(m.f)+(m.cap? '×':'–')+alg(m.t)+(m.promo? '='+GLYPH[m.promo]:'') + suf;
    }
    function applyMove(m){
      const before = state;
      history.push(snap());
      const mover = before.turn;
      state = makeMove(before, m);
      lastM = {f:m.f, t:m.t};
      if(m.cap){ caps[mover].push(GLYPH[Math.abs(m.cap)]); capsV[mover]+=PTS[Math.abs(m.cap)]; }
      seq++;
      const endT = checkEnd(state);
      const chk = inCheck(state);
      rows.push(notate(before, m, endT, chk));
      if(isMP && ctx.amHost) ctx.broadcast('st', pack(m, chk));
      sel = null;
      render();
      PV.sound.play(m.cap? 'pop':'place'); U.vibrate(m.cap? 24:12);
      if(chk && !endT) setTimeout(()=>PV.sound.play('urgent'), 150);
      if(endT) endGame(endT);
      else scheduleBot();
    }
    function scheduleBot(){
      if(botTO){ clearTimeout(botTO); botTO=null; }
      if(isMP || over || paused || state.turn!==botSeat) return;
      const delay = diff==='hard'? 720 : diff==='easy'? 460 : 600;
      botTO = setTimeout(()=>{
        botTO=null;
        if(over||paused||state.turn!==botSeat) return;
        const m = botMove(state, diff, rng);
        if(m) applyMove(m);
        else { const e2 = checkEnd(state); if(e2) endGame(e2); }
      }, delay);
    }
    function endGame(endT){
      if(over) return; over = true;
      if(botTO){ clearTimeout(botTO); botTO=null; }
      const winSeat = endT.win;
      const reason = endT.mate? tt('checkmate') : endT.reason==='stale'? tt('stalemate') : endT.reason==='50'? tt('draw50') : tt('drawMat');
      if(isMP && ctx.amHost) ctx.broadcast('over', {w: winSeat==null? null : (players[winSeat]?.pid||null)});
      const myWin = winSeat==null? null : (isMP? winSeat===mySeat : winSeat===0);
      PV.sound.play(myWin==null? 'drawS' : myWin? 'win' : 'lose');
      U.vibrate(myWin? [40,60,40] : 30);
      ctx.setTurn(myWin==null? t('pl.drawT') : myWin? t('pl.victory') : t('pl.defeat'), myWin==null? '' : myWin? 'win':'lose');
      ctx.setStatus(reason);
      if(!isMP) bumpStats(myWin);
      render();
      const nm = i => players[i]?.name || (i===mySeat? tt('you') : tt('bot'));
      setTimeout(()=>{
        if(fin) return; fin = true;
        ctx.finish({
          res: myWin==null? 'd' : myWin? 'w' : 'l',
          scores: {[players[0]?.pid]: winSeat===0?1:0, [players[1]?.pid||'BOT:1']: winSeat===1?1:0},
          stats: endT.mate? {mate:1} : {},
          vsHuman: isMP,
          sub: myWin==null? reason : (t('g.winner',{n:nm(winSeat)})+' • '+reason),
        });
      }, 950);
    }

    /* ------------------------------ input ------------------------------ */
    boardEl.addEventListener('click', e=>{
      const cell = e.target.closest('.pvchess-cell');
      if(cell) tap(+cell.dataset.i);
    });
    function tap(i){
      if(!canPlay() || promoPending) return;
      const legal = legalMoves(state);
      if(sel!=null){
        const opts = legal.filter(m=>m.f===sel && m.t===i);
        if(opts.length){
          if(opts[0].promo){ promoPending = opts; promoEl.classList.add('on'); PV.sound.play('tap'); return; }
          commit(opts[0]);
          return;
        }
      }
      const v = state.b[i];
      if(v && ((v>0)===(state.turn===0)) && legal.some(m=>m.f===i)){
        sel = sel===i? null : i;
        PV.sound.play('tap'); U.vibrate(10);
        render();
      } else if(sel!=null){ sel=null; render(); }
    }
    function commit(m){
      if(isMP && !ctx.amHost){
        sel = null; render();
        ctx.send('mv', {fr:m.f>>3, fc:m.f&7, tr:m.t>>3, tc:m.t&7, pr:m.promo? PROMOCH[m.promo] : ''}, hostPid);
        ctx.setStatus(tt('wait'));
      } else applyMove(m);
    }
    promoEl.addEventListener('click', e=>{
      const b = e.target.closest('button[data-p]');
      if(!b || !promoPending) return;
      const m = promoPending.find(x=>x.promo===PROMO[b.dataset.p]);
      promoPending = null; promoEl.classList.remove('on');
      if(m) commit(m);
    });
    undoBtn.addEventListener('click', ()=>{
      if(isMP || over) return;
      if(botTO){ clearTimeout(botTO); botTO=null; }
      while(history.length){
        const s = history.pop();
        if(s.state.turn===0){
          state=s.state; lastM=s.lastM; rows=s.rows; caps=s.caps; capsV=s.capsV;
          sel=null; render();
          PV.sound.play('flip'); U.vibrate();
          return;
        }
      }
    });

    /* ------------------------------ online ------------------------------ */
    if(isMP){
      ctx.on('mv', d=>{
        if(!ctx.amHost || over || state.turn!==1) return;
        const f=(d.fr|0)*8+(d.fc|0), tt2=(d.tr|0)*8+(d.tc|0);
        const cand = legalMoves(state).filter(m=>m.f===f && m.t===tt2);
        if(!cand.length) return;
        const m = d.pr? cand.find(x=>x.promo===PROMO[d.pr]) : cand.find(x=>!x.promo);
        if(m) applyMove(m);
      });
      ctx.on('st', d=>{
        if(d.q==null || d.q<seq) return;
        seq = d.q;
        state = { b:Int8Array.from(d.b), turn:d.t, cast:d.c.slice(), ep:d.e, half:d.h, full:d.f };
        lastM = {f:d.lf, t:d.lt};
        rows.push(d.n||'');
        if(d.cp) PV.sound.play('pop'); else PV.sound.play('place');
        if(d.ck) setTimeout(()=>PV.sound.play('urgent'), 150);
        U.vibrate(d.cp? 22:12);
        caps = [String(d.cw||'').split(''), String(d.cb||'').split('')];
        capsV = [d.vw||0, d.vb||0];
        sel = null;
        render();
        const e2 = checkEnd(state); /* display only — host owns 'over' */
        if(e2){ over=true; render(); }
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
            stats: d.mate? {mate:1} : {},
            vsHuman: true,
            sub: myWin==null? '' : t('g.winner',{n: myWin? (players[mySeat]?.name||tt('you')) : (players[1-mySeat]?.name||tt('bot'))}),
          });
        }, 850);
      });
    }

    /* ------------------------------ lifecycle ------------------------------ */
    resetState(); render(); scheduleBot();
    ctx.setStatus('♟ '+tt('hint'));
    return {
      init(){}, start(){},
      pause(){ paused=true; if(botTO){clearTimeout(botTO); botTO=null;} },
      resume(){ paused=false; scheduleBot(); },
      end(){ over=true; if(botTO){clearTimeout(botTO); botTO=null;} },
      reset(){ resetState(); render(); scheduleBot(); },
      getState(){ return {b:Array.from(state.b), turn:state.turn, cast:state.cast, ep:state.ep, half:state.half, full:state.full}; },
      getScores(){ return {[players[0]?.pid]: capsV[0], [players[1]?.pid||'BOT:1']: capsV[1]}; },
      getStatus(){ if(over) return ''; return (inCheck(state)? '⚠ '+tt('check')+' • ':'') + tt('moves')+' '+fmt(state.full+1); },
      destroy(){ if(botTO){clearTimeout(botTO); botTO=null;} root.remove(); },
    };
  }
});
})();
