/* ============ Game: مار و پله (Snakes & Ladders) — premium family board ============
   • 10×10 boustrophedon board (1 bottom-left … 100 top-left), Persian digits
   • Fixed classic layout: ladders as CSS diagonal rails+rungs, snakes as SVG
     curved bodies with head, eyes and forked tongue; endpoints tinted
   • 1 human + 1–3 Persian-named bots; seeded dice via ctx.rng
   • 3D-ish dot-face dice roll (~700ms) → hop-by-hop token animation (120ms)
   • Ladder slide-up (whoosh) / snake slide-down (wobble); overshoot = stay
   • First to exactly 100 wins → finish with ranks (others ranked by progress)
=================================================================================== */
(function(){
'use strict';
const PV = window.PV, U = PV.u, t = PV.t;
const { esc, fmt, clamp } = U;

const LANG = ()=> (PV.i18n && PV.i18n.lang) || 'fa';
const L = {
  fa:{
    roll:'تاس بریز', rolling:'…', standings:'🏁 جدول رده‌بندی', house:'خانه',
    turnYou:'🎲 نوبت توست — تاس بریز!', turnBot:'🤖 {n} در حال بازی…',
    ladder:'🪜 پله!', snake:'🐍 مار!', exact:'دقیقاً ۱۰۰ لازم است!',
    rank:['رتبه: اول!','رتبه: دوم!','رتبه: سوم!','رتبه: چهارم!'],
    bots:['بات پونه','بات بهار','بات باران'], goal:'🏁 پایان', start:'شروع',
    winner:'🏆 {n} برد!', yourWin:'🏆 بردی!',
  },
  en:{
    roll:'Roll dice', rolling:'…', standings:'🏁 Standings', house:'Cell',
    turnYou:'🎲 Your turn — roll!', turnBot:'🤖 {n} is playing…',
    ladder:'🪜 Ladder!', snake:'🐍 Snake!', exact:'Need exactly 100!',
    rank:['Rank: 1st!','Rank: 2nd!','Rank: 3rd!','Rank: 4th!'],
    bots:['Bot Pooneh','Bot Bahar','Bot Baran'], goal:'🏁 Finish', start:'Start',
    winner:'🏆 {n} wins!', yourWin:'🏆 You win!',
  },
};
const tt = k => {
  const d = L[LANG()] || L.fa;
  let s = (d[k]!=null)? d[k] : (L.fa[k]!=null? L.fa[k] : k);
  return s;
};
const ttn = (k, vars)=>{ let s = tt(k); if(vars) for(const [key,val] of Object.entries(vars)) s = s.replaceAll('{'+key+'}', val); return s; };

/* ------------------------------ board data ------------------------------ */
const LADDERS = [[4,14],[9,31],[20,38],[28,84],[40,59],[51,67],[63,81],[71,91]];
const SNAKES  = [[17,7],[54,34],[62,19],[64,60],[87,24],[93,73],[95,75],[98,79]];
const LAD_MAP = {}, SNK_MAP = {};
LADDERS.forEach(([a,b])=> LAD_MAP[a]=b);
SNAKES.forEach(([a,b])=> SNK_MAP[a]=b);
const SEAT_COL = ['#7c5cff','#00b8a9','#ff5c9d','#f0a020'];
const SNAKE_COL = ['#8e5cf7','#ef5c8d','#00b8a9','#ff8f38','#5c8df7'];

function rc(n){ /* cell number → {r:row-from-bottom, c:col} */
  const i = n-1, r = Math.floor(i/10), k = i%10;
  return { r, c: (r%2)? 9-k : k };
}
function posPct(n){ /* → {x,y} in % of board (y from top) */
  const {r,c} = rc(n);
  return { x:(c+0.5)*10, y:((9-r)+0.5)*10 };
}
function smoothPath(pts){
  let d = 'M'+pts[0].x.toFixed(2)+' '+pts[0].y.toFixed(2);
  for(let i=0;i<pts.length-1;i++){
    const p0 = pts[Math.max(0,i-1)], p1 = pts[i], p2 = pts[i+1], p3 = pts[Math.min(pts.length-1,i+2)];
    d += ' C'+(p1.x+(p2.x-p0.x)/6).toFixed(2)+' '+(p1.y+(p2.y-p0.y)/6).toFixed(2)
       + ' '+(p2.x-(p3.x-p1.x)/6).toFixed(2)+' '+(p2.y-(p3.y-p1.y)/6).toFixed(2)
       + ' '+p2.x.toFixed(2)+' '+p2.y.toFixed(2);
  }
  return d;
}

PV.registry.register({
  id:'snakesladders', cats:['family','luck','party'], players:[2,4], modes:['solo'], weight:75,
  factory: function(ctx){
    /* ------------------------------ players ----------------------------- */
    const isMP = ctx.mode!=='solo';
    const players = (ctx.players||[]).filter(p=>p && p.pid);
    if(!players.length) players.push({pid:'me', name:'You'});
    const BOT_AV = ['robot','alien','dragon'];
    const desired = isMP? clamp(players.length,2,4) : (ctx.diff==='easy'? 2 : ctx.diff==='hard'? 4 : 3);
    const seats = desired;
    for(let b=players.length; b<seats; b++){
      const bi = b-1;
      players.push({pid:'BOT:'+(bi+1), name:(tt('bots')[bi]||('BOT:'+(bi+1))), av:BOT_AV[bi%3], lvl:5+bi*3});
    }
    const rng = ctx.rng || Math.random;
    const mySeat = Math.max(0, players.findIndex(p=>p.pid===ctx.selfPid));
    const humanSeat = 0;
    const isBot = s => !isMP ? s!==humanSeat : (players[s]?.pid||'').startsWith('BOT:');

    /* ------------------------------- state ------------------------------ */
    let pos = new Array(seats).fill(1);
    let turn = 0, over = false, busy = false, destroyed = false;
    let moveGen = 0;
    const timers = new Set();
    function later(fn, ms){ const id = setTimeout(()=>{ timers.delete(id); if(!destroyed) fn(); }, ms); timers.add(id); return id; }
    function clearTimers(){ for(const id of timers) clearTimeout(id); timers.clear(); }

    /* -------------------------------- DOM ------------------------------- */
    const root = document.createElement('div');
    root.innerHTML = `
<style>
.pvsl-wrap{display:flex;gap:16px;align-items:flex-start;justify-content:center;width:100%;font-family:inherit;padding:2px 0 8px}
.pvsl-main{display:flex;flex-direction:column;align-items:center;gap:12px;flex:1;min-width:0}
.pvsl-board{position:relative;width:min(92vw,560px,62vh);aspect-ratio:1/1;border-radius:18px;overflow:hidden;
  box-shadow:var(--sh-3),0 0 0 1.5px var(--border);background:var(--surface2);direction:ltr}
.pvsl-grid{position:absolute;inset:0;display:grid;grid-template-columns:repeat(10,1fr);grid-template-rows:repeat(10,1fr)}
.pvsl-cell{position:relative;display:flex;align-items:flex-start;justify-content:flex-start;padding:3px 5px;
  background:#f8f9ff;animation:pvsl-in .5s both;border:0.5px solid rgba(120,110,220,.08)}
@keyframes pvsl-in{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:scale(1)}}
.pvsl-cell.alt{background:#edeffb}
.pvsl-cell.ladB{background:linear-gradient(135deg,#d7f4e0,#c2ecd2)}
.pvsl-cell.ladT{background:linear-gradient(135deg,#e7f9ee,#d9f4e2)}
.pvsl-cell.snkH{background:linear-gradient(135deg,#fde0e7,#fbcdd8)}
.pvsl-cell.snkT{background:linear-gradient(135deg,#ffefe2,#ffe6d2)}
.pvsl-cell.goal{background:linear-gradient(135deg,#ffe9b8,#ffd884)}
.pvsl-cell.strt{background:linear-gradient(135deg,#e6e1ff,#dcd4ff)}
.pvsl-cell.hl{box-shadow:inset 0 0 0 2.5px var(--p1),inset 0 0 14px rgba(124,92,255,.35);z-index:2}
.pvsl-num{font-size:clamp(8px,1.9vw,13px);font-weight:800;color:#6a6fa3;font-variant-numeric:tabular-nums;opacity:.85;line-height:1}
.pvsl-mark{position:absolute;bottom:2%;inset-inline-end:5%;font-size:clamp(9px,2.4vw,16px);opacity:.85;line-height:1;filter:drop-shadow(0 1px 1px rgba(0,0,0,.15))}
.pvsl-goal-flag{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:clamp(14px,4vw,26px)}
.pvsl-ladders{position:absolute;inset:0;pointer-events:none;z-index:3}
.pvsl-lad{position:absolute;transform-origin:0 50%;border-radius:99px;opacity:.92;
  background:
    linear-gradient(#b97c40,#8a5a2b) left 0 top 0/100% 9% no-repeat,
    linear-gradient(#b97c40,#8a5a2b) left 0 bottom 0/100% 9% no-repeat,
    repeating-linear-gradient(90deg,#c98a4b 0 7%,transparent 7% 17%);
  box-shadow:0 2px 6px rgba(90,60,20,.25)}
.pvsl-snakes{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:4}
.pvsl-tokens{position:absolute;inset:0;pointer-events:none;z-index:6}
.pvsl-token{position:absolute;width:11%;aspect-ratio:1/1.12;transition:left .135s linear,top .135s linear;will-change:left,top}
.pvsl-token.slide{transition:left .5s cubic-bezier(.5,.05,.3,1),top .5s cubic-bezier(.5,.05,.3,1)}
.pvsl-token svg{width:100%;height:100%;filter:drop-shadow(0 3px 4px rgba(30,20,80,.35))}
.pvsl-token svg.wob{animation:pvsl-wob .55s ease-in-out}
.pvsl-token svg.hop{animation:pvsl-hop .14s ease-out}
@keyframes pvsl-wob{0%,100%{transform:rotate(0)}25%{transform:rotate(-14deg)}55%{transform:rotate(12deg)}80%{transform:rotate(-6deg)}}
@keyframes pvsl-hop{0%{transform:translateY(0) scale(1)}55%{transform:translateY(-46%) scale(1.08)}100%{transform:translateY(0) scale(1)}}
.pvsl-callout{position:absolute;z-index:8;transform:translate(-50%,-50%);font-weight:900;font-size:clamp(12px,3vw,19px);
  color:#fff;background:var(--grad-p);padding:5px 14px;border-radius:999px;box-shadow:var(--sh-2);pointer-events:none;
  animation:pvsl-float 1.15s ease-out both;white-space:nowrap}
.pvsl-callout.bad{background:linear-gradient(135deg,#ff5c7a,#ef4467)}
.pvsl-callout.good{background:var(--grad-green)}
@keyframes pvsl-float{0%{opacity:0;transform:translate(-50%,-30%) scale(.6)}18%{opacity:1;transform:translate(-50%,-55%) scale(1.06)}70%{opacity:1}100%{opacity:0;transform:translate(-50%,-135%) scale(1)}}
.pvsl-under{display:flex;align-items:center;gap:12px;background:var(--surface2);border:1.5px solid var(--border);
  border-radius:18px;padding:9px 14px;box-shadow:var(--sh-2)}
.pvsl-dice{width:58px;height:58px;background:linear-gradient(145deg,#ffffff,#e7e9f8);border:2px solid #cdd2ee;border-radius:14px;
  display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);padding:7px;gap:2px;box-shadow:inset 0 -3px 6px rgba(90,90,160,.18),0 4px 10px rgba(80,80,160,.2)}
.pvsl-dice.rolling{animation:pvsl-droll .7s ease-in-out}
@keyframes pvsl-droll{0%{transform:rotate(0) scale(1)}22%{transform:rotate(-18deg) scale(1.12) translateY(-6px)}45%{transform:rotate(16deg) scale(1.14) translateY(-10px)}68%{transform:rotate(-12deg) scale(1.1) translateY(-5px)}86%{transform:rotate(8deg) scale(1.03)}100%{transform:rotate(0) scale(1)}}
.pvsl-dice .pip{border-radius:50%;visibility:hidden}
.pvsl-dice .pip.on{visibility:visible;background:radial-gradient(circle at 35% 30%,#5a5f8f,#23264a);box-shadow:inset 0 -1px 2px rgba(0,0,0,.4)}
.pvsl-roll{background:var(--grad-p);color:#fff;border:none;border-radius:14px;padding:12px 24px;font-weight:900;font-size:1.02rem;
  box-shadow:var(--sh-p);cursor:pointer;transition:transform .15s,opacity .2s;white-space:nowrap}
.pvsl-roll:active{transform:scale(.93)}
.pvsl-roll:disabled{opacity:.45;cursor:not-allowed;transform:none}
.pvsl-lastroll{min-width:86px;text-align:center;font-size:.8rem;color:var(--tx2);font-weight:700}
.pvsl-lastroll b{font-size:1.5rem;color:var(--p1);font-variant-numeric:tabular-nums;display:block;line-height:1.2}
.pvsl-side{width:230px;display:flex;flex-direction:column;gap:8px}
.pvsl-side-t{font-weight:900;font-size:.9rem}
.pvsl-stand{display:flex;flex-direction:column;gap:7px}
.pvsl-strow{display:flex;align-items:center;gap:8px;background:var(--surface2);border:1.5px solid var(--border);
  border-radius:13px;padding:7px 11px;transition:box-shadow .25s,border-color .25s;animation:pvsl-in .4s both}
.pvsl-strow.on{border-color:var(--p1);box-shadow:var(--glow-p)}
.pvsl-strow.lead{background:linear-gradient(135deg,#fff8e6,#ffefc8);border-color:#f3d489}
.pvsl-dot{width:13px;height:13px;border-radius:50%;flex:none;box-shadow:inset 0 -2px 3px rgba(0,0,0,.25)}
.pvsl-strow b{flex:1;font-size:.84rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pvsl-strow .num{font-weight:900;color:var(--tx2);font-size:.8rem}
@media (max-width:860px){
  .pvsl-wrap{flex-direction:column;align-items:center}
  .pvsl-side{width:min(92vw,560px)}
  .pvsl-stand{flex-direction:row;flex-wrap:wrap}
  .pvsl-strow{flex:1 1 40%;min-width:150px}
  .pvsl-under{position:fixed;bottom:calc(var(--bnav-h,64px) + 10px);inset-inline-start:50%;transform:translateX(-50%);z-index:40;
    background:var(--glass);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
  [dir="rtl"] .pvsl-under{transform:translateX(50%)}
  .pvsl-main{padding-bottom:86px}
}
</style>
<div class="pvsl-wrap">
  <div class="pvsl-main">
    <div class="pvsl-board" id="pvslBoard">
      <div class="pvsl-grid" id="pvslGrid"></div>
      <svg class="pvsl-snakes" id="pvslSnakes" viewBox="0 0 100 100" preserveAspectRatio="none"></svg>
      <div class="pvsl-ladders" id="pvslLadders"></div>
      <div class="pvsl-tokens" id="pvslTokens"></div>
    </div>
    <div class="pvsl-under">
      <div class="pvsl-dice" id="pvslDice"></div>
      <button class="pvsl-roll" id="pvslRoll">🎲 ${tt('roll')}</button>
      <div class="pvsl-lastroll" id="pvslLast"><b>—</b>🎲</div>
    </div>
  </div>
  <aside class="pvsl-side">
    <div class="pvsl-side-t">${tt('standings')}</div>
    <div class="pvsl-stand" id="pvslStand"></div>
  </aside>
</div>`;
    ctx.root.appendChild(root);
    const $ = s => root.querySelector(s);
    const boardEl = $('#pvslBoard'), gridEl = $('#pvslGrid'), standEl = $('#pvslStand');
    const rollBtn = $('#pvslRoll'), diceEl = $('#pvslDice'), lastEl = $('#pvslLast');
    const NS = 'http://www.w3.org/2000/svg';

    /* ----------------------------- board build --------------------------- */
    const marks = {};
    LADDERS.forEach(([a])=> marks[a] = {cls:'ladB', mark:'🪜'});
    LADDERS.forEach(([,b])=> { if(!marks[b]) marks[b] = {cls:'ladT', mark:''}; });
    SNAKES.forEach(([a])=> marks[a] = {cls:'snkH', mark:'🐍'});
    SNAKES.forEach(([,b])=> { if(!marks[b]) marks[b] = {cls:'snkT', mark:''}; });

    (function buildGrid(){
      const frag = document.createDocumentFragment();
      for(let r=9;r>=0;r--){
        for(let c=0;c<10;c++){
          const k = (r%2)? 9-c : c;
          const n = r*10 + k + 1;
          const cell = document.createElement('div');
          const m = marks[n] || {};
          cell.className = 'pvsl-cell' + ((r+c)%2? ' alt':'') + (m.cls? ' '+m.cls:'')
            + (n===100? ' goal':'') + (n===1? ' strt':'');
          cell.dataset.n = n;
          cell.style.animationDelay = ((99-r)*6 + (r%2? c : 9-c)*4)+'ms';
          let inner = '<span class="pvsl-num">'+fmt(n)+'</span>';
          if(m.mark) inner += '<span class="pvsl-mark">'+m.mark+'</span>';
          if(n===100) inner += '<span class="pvsl-goal-flag">🏁</span>';
          cell.innerHTML = inner;
          frag.appendChild(cell);
        }
      }
      gridEl.appendChild(frag);
    })();

    function cellEl(n){ return gridEl.querySelector('.pvsl-cell[data-n="'+n+'"]'); }

    /* --------------------------- snakes (SVG) ---------------------------- */
    (function buildSnakes(){
      const svg = $('#pvslSnakes');
      SNAKES.forEach(([head, tail], idx)=>{
        const col = SNAKE_COL[idx % SNAKE_COL.length];
        const p1 = posPct(head), p2 = posPct(tail);
        const dx = p2.x-p1.x, dy = p2.y-p1.y;
        const len = Math.hypot(dx,dy)||1;
        const nx = -dy/len, ny = dx/len;
        const amp = Math.min(7, len*0.16);
        const offs = [0, amp, -amp*0.75, amp*0.8, 0];
        const pts = offs.map((o,i)=>{
          const tt2 = i/(offs.length-1);
          return { x: p1.x+dx*tt2+nx*o, y: p1.y+dy*tt2+ny*o };
        });
        const d = smoothPath(pts);
        const mk = (w, c2, extra)=>{
          const p = document.createElementNS(NS,'path');
          p.setAttribute('d', d); p.setAttribute('fill','none');
          p.setAttribute('stroke', c2); p.setAttribute('stroke-width', w);
          p.setAttribute('stroke-linecap','round');
          if(extra) for(const [k2,v2] of Object.entries(extra)) p.setAttribute(k2,v2);
          svg.appendChild(p);
          return p;
        };
        mk(4.4, 'rgba(40,20,60,.35)');                       /* soft shadow */
        mk(3.6, '#2d1b4e');                                  /* outline */
        mk(2.9, col);                                        /* body */
        mk(1.15, 'rgba(255,255,255,.55)', {'stroke-dasharray':'1.1 2.3'});  /* belly pattern */
        /* head */
        const hd = document.createElementNS(NS,'g');
        const ang = Math.atan2(p1.y-pts[1].y, p1.x-pts[1].x);
        hd.setAttribute('transform', `translate(${p1.x} ${p1.y}) rotate(${(ang*180/Math.PI).toFixed(1)})`);
        hd.innerHTML =
          '<circle r="3.2" fill="'+col+'" stroke="#2d1b4e" stroke-width="0.75"/>'+
          '<circle cx="0.4" cy="-1.35" r="0.62" fill="#fff"/><circle cx="0.62" cy="-1.35" r="0.3" fill="#1c1030"/>'+
          '<circle cx="0.4" cy="1.35" r="0.62" fill="#fff"/><circle cx="0.62" cy="1.35" r="0.3" fill="#1c1030"/>'+
          '<path d="M 3.1 0 L 5.3 0 M 5.3 0 L 6.3 -0.75 M 5.3 0 L 6.3 0.75" stroke="#ff4d6d" stroke-width="0.55" fill="none" stroke-linecap="round"/>';
        svg.appendChild(hd);
        const tp = document.createElementNS(NS,'circle');
        tp.setAttribute('cx', p2.x); tp.setAttribute('cy', p2.y); tp.setAttribute('r', '1.1');
        tp.setAttribute('fill', col); tp.setAttribute('stroke', '#2d1b4e'); tp.setAttribute('stroke-width', '0.5');
        svg.appendChild(tp);
      });
    })();

    /* --------------------------- ladders (CSS) --------------------------- */
    const ladEls = [];
    (function buildLadders(){
      const box = $('#pvslLadders');
      LADDERS.forEach(([a,b])=>{
        const d = document.createElement('div');
        d.className = 'pvsl-lad';
        box.appendChild(d);
        ladEls.push({el:d, a, b});
      });
    })();
    function layoutLadders(){
      const w = boardEl.clientWidth; if(!w) return;
      for(const {el,a,b} of ladEls){
        const p1 = posPct(a), p2 = posPct(b);
        const x1 = p1.x/100*w, y1 = p1.y/100*w, x2 = p2.x/100*w, y2 = p2.y/100*w;
        const len = Math.hypot(x2-x1, y2-y1);
        const ang = Math.atan2(y2-y1, x2-x1)*180/Math.PI;
        const thick = clamp(w*0.036, 12, 20);
        el.style.left = x1+'px'; el.style.top = y1+'px';
        el.style.width = len+'px'; el.style.height = thick+'px';
        el.style.transform = 'translateY(-50%) rotate('+ang.toFixed(2)+'deg)';
      }
    }

    /* ------------------------------ tokens ------------------------------- */
    const PAWN = c =>
      '<svg viewBox="0 0 24 27" xmlns="http://www.w3.org/2000/svg">'+
      '<ellipse cx="12" cy="24.6" rx="8.4" ry="1.9" fill="rgba(20,15,50,.28)"/>'+
      '<rect x="3.6" y="20.6" width="16.8" height="3.6" rx="1.8" fill="'+c+'" stroke="rgba(255,255,255,.85)" stroke-width="1"/>'+
      '<path d="M6 21 C6.6 16.4 9 14.2 10.3 13.4 A4.4 4.4 0 1 1 13.7 13.4 C15 14.2 17.4 16.4 18 21 Z" fill="'+c+'" stroke="rgba(255,255,255,.85)" stroke-width="1"/>'+
      '<ellipse cx="9.6" cy="7.4" rx="2.5" ry="1.5" fill="rgba(255,255,255,.4)"/>'+
      '</svg>';
    const tokens = [];
    (function buildTokens(){
      const box = $('#pvslTokens');
      for(let s=0;s<seats;s++){
        const d = document.createElement('div');
        d.className = 'pvsl-token';
        d.innerHTML = PAWN(SEAT_COL[s % SEAT_COL.length]);
        box.appendChild(d);
        tokens.push(d);
      }
      relayoutStacks(true);
    })();
    function tokenTransform(seat){
      const cell = pos[seat];
      const group = [0,1,2,3].filter(s2 => pos[s2]===cell && s2<seats);
      const j = group.indexOf(seat), m = group.length;
      const cw = boardEl.clientWidth/10 || 40;
      const dx = (j-(m-1)/2) * cw*0.26;
      const sc = m>1? 0.86 : 1;
      return 'translate(calc(-50% + '+dx.toFixed(1)+'px), -74%) scale('+sc+')';
    }
    function placeToken(seat){
      const p = posPct(pos[seat]);
      const tk = tokens[seat];
      tk.style.left = p.x+'%'; tk.style.top = p.y+'%';
      tk.style.transform = tokenTransform(seat);
      tk.style.zIndex = 6 + (pos[seat]%5);
    }
    function relayoutStacks(skipAnim){
      for(let s=0;s<seats;s++){
        if(skipAnim) tokens[s].style.transition = 'none';
        placeToken(s);
        if(skipAnim){ void tokens[s].offsetWidth; tokens[s].style.transition = ''; }
      }
    }

    /* ------------------------------- dice -------------------------------- */
    const PIP_MAP = {1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
    (function buildDice(){
      let h = '';
      for(let i=0;i<9;i++) h += '<span class="pip"></span>';
      diceEl.innerHTML = h;
    })();
    function diceFace(v){
      diceEl.querySelectorAll('.pip').forEach((p,i)=> p.classList.toggle('on', PIP_MAP[v].includes(i)));
    }
    diceFace(6);
    let rollIv = 0;
    function rollAnim(val, done){
      diceEl.classList.remove('rolling'); void diceEl.offsetWidth;
      diceEl.classList.add('rolling');
      let n = 0;
      if(rollIv) clearInterval(rollIv);
      rollIv = setInterval(()=>{ if(destroyed){ clearInterval(rollIv); return; } diceFace(1+Math.floor(rng()*6)); PV.sound.play('tick'); if(++n>6) clearInterval(rollIv); }, 95);
      later(()=>{
        clearInterval(rollIv); rollIv = 0;
        diceFace(val);
        diceEl.classList.remove('rolling');
        PV.sound.play('place'); U.vibrate(14);
        later(done, 190);
      }, 700);
    }

    /* ----------------------------- UI helpers ---------------------------- */
    function callout(n, txt, cls){
      const p = posPct(n);
      const d = document.createElement('div');
      d.className = 'pvsl-callout '+(cls||'');
      d.textContent = txt;
      d.style.left = p.x+'%'; d.style.top = (p.y-4)+'%';
      boardEl.appendChild(d);
      later(()=> d.remove(), 1200);
    }
    function highlight(n){
      gridEl.querySelectorAll('.pvsl-cell.hl').forEach(c=> c.classList.remove('hl'));
      const c = cellEl(n); if(c) c.classList.add('hl');
    }
    function standings(){
      const order = [...Array(seats).keys()].sort((a,b)=> pos[b]-pos[a]);
      const lead = pos[order[0]];
      standEl.innerHTML = order.map((s,i)=>{
        const pl = players[s]||{};
        return '<div class="pvsl-strow '+(s===turn && !over? 'on':'')+(pos[s]===lead && lead>1? ' lead':'')+'" style="animation-delay:'+(i*50)+'ms">'+
          '<span class="pvsl-dot" style="background:'+SEAT_COL[s%SEAT_COL.length]+'"></span>'+
          '<b>'+esc(pl.name||('P'+s))+(s===mySeat? ' ('+esc(t('c.you'))+')':'')+'</b>'+
          '<span class="num">'+(s===turn && !over? '🎲 ':'')+tt('house')+' '+fmt(pos[s])+(pos[s]===lead&&lead>1?' 👑':'')+'</span>'+
        '</div>';
      }).join('');
    }
    function startTurn(){
      if(over || destroyed) return;
      standings();
      if(isBot(turn)){
        ctx.setTurn(ttn('turnBot', {n:esc(players[turn]?.name||'')}));
        rollBtn.disabled = true;
        const s = turn;
        later(()=>{ if(!over && !busy && !destroyed && turn===s) roll(s); }, 800);
      } else {
        ctx.setTurn(tt('turnYou'), 'me');
        rollBtn.disabled = false;
      }
    }

    /* ------------------------------ game flow ---------------------------- */
    function roll(seat){
      if(over || busy || destroyed) return;
      if(seat!==turn) return;
      busy = true; rollBtn.disabled = true;
      const val = 1 + Math.floor(rng()*6);
      rollAnim(val, ()=> doMove(seat, val));
    }
    async function doMove(seat, val){
      const gen = ++moveGen;
      lastEl.innerHTML = '<b>'+fmt(val)+'</b>'+esc(players[seat]?.name||'');
      let p = pos[seat];
      if(p + val > 100){
        PV.ui.toast(tt('exact'), 'warn');
        PV.sound.play('falseStart'); U.vibrate(30);
        callout(p, '↩ ' + tt('exact'), 'bad');
        await U.sleep(650); if(gen!==moveGen||destroyed) return;
        return endTurn(seat);
      }
      const tk = tokens[seat];
      for(let k=1;k<=val;k++){
        p++;
        pos[seat] = p;
        tk.querySelector('svg').classList.remove('hop'); void tk.offsetWidth;
        tk.querySelector('svg').classList.add('hop');
        placeToken(seat);
        highlight(p);
        PV.sound.play('tap'); U.vibrate(8);
        standings();
        await U.sleep(140);
        if(gen!==moveGen||destroyed) return;
      }
      await U.sleep(170); if(gen!==moveGen||destroyed) return;
      const lad = LAD_MAP[p], snk = SNK_MAP[p];
      if(lad){
        callout(p, tt('ladder'), 'good');
        PV.sound.play('whoosh');
        tk.classList.add('slide');
        await U.sleep(30); if(gen!==moveGen||destroyed) return;
        pos[seat] = lad; placeToken(seat); highlight(lad);
        await U.sleep(520); if(gen!==moveGen||destroyed) return;
        PV.sound.play('coin'); U.vibrate(24);
        tk.classList.remove('slide');
      } else if(snk){
        callout(p, tt('snake'), 'bad');
        PV.sound.play('whoosh');
        tk.querySelector('svg').classList.add('wob');
        tk.classList.add('slide');
        await U.sleep(30); if(gen!==moveGen||destroyed) return;
        pos[seat] = snk; placeToken(seat); highlight(snk);
        await U.sleep(560); if(gen!==moveGen||destroyed) return;
        PV.sound.play('falseStart'); U.vibrate([30,30,30]);
        tk.classList.remove('slide');
        tk.querySelector('svg').classList.remove('wob');
      }
      relayoutStacks();
      standings();
      if(pos[seat] >= 100) return win(seat);
      endTurn(seat);
    }
    function endTurn(seat){
      if(over || destroyed) return;
      if(turn!==seat) return;
      busy = false;
      turn = (turn+1)%seats;
      startTurn();
      ctx.setStatus(tt('house')+': '+fmt(pos[mySeat]));
    }
    function win(wseat){
      over = true; busy = false;
      rollBtn.disabled = true;
      const order = [...Array(seats).keys()].sort((a,b)=> pos[b]-pos[a]);
      const myRank = order.indexOf(mySeat)+1;
      ctx.setTurn(
        wseat===mySeat? tt('yourWin') : ttn('winner', {n:esc(players[wseat]?.name||'')}),
        wseat===mySeat? 'win' : 'lose'
      );
      highlight(100);
      const scores = {};
      order.forEach((s,i)=>{ const v = (seats-i)*25; scores[players[s].pid] = v; if(s===mySeat && players[s].pid!==ctx.selfPid) scores[ctx.selfPid] = v; });
      later(()=>{
        ctx.finish({
          res: myRank===1? 'w' : myRank===seats? 'l' : 'd',
          scores, vsHuman: false,
          sub: tt('rank')[clamp(myRank,1,4)-1],
          stats: {house: pos[mySeat]},
        });
      }, 950);
    }

    /* ------------------------------ wiring ------------------------------- */
    rollBtn.addEventListener('click', ()=> roll(turn));
    const ro = (typeof ResizeObserver!=='undefined')? new ResizeObserver(()=>{ layoutLadders(); relayoutStacks(true); }) : null;
    if(ro) ro.observe(boardEl); else window.addEventListener('resize', ()=>{ layoutLadders(); relayoutStacks(true); });

    /* ------------------------------- boot -------------------------------- */
    layoutLadders();
    relayoutStacks(true);
    startTurn();
    highlight(1);
    ctx.setStatus(tt('house')+': '+fmt(1));

    return {
      init(){}, start(){},
      pause(){}, resume(){},
      reset(){ clearTimers(); pos = new Array(seats).fill(1); turn = 0; over = false; busy = false; moveGen++; if(rollIv){clearInterval(rollIv); rollIv=0;} diceFace(6); lastEl.innerHTML='<b>—</b>🎲'; rollBtn.disabled = false; highlight(1); relayoutStacks(true); startTurn(); },
      end(){ over = true; },
      destroy(){ destroyed = true; over = true; if(rollIv){clearInterval(rollIv); rollIv=0;} clearTimers(); moveGen++; if(ro) ro.disconnect(); root.remove(); },
      getState(){ return {pos:[...pos], turn}; },
      getScores(){ const o={}; for(let s=0;s<seats;s++){ o[players[s].pid] = pos[s]; } if(players[mySeat] && players[mySeat].pid!==ctx.selfPid) o[ctx.selfPid] = pos[mySeat]; return o; },
      getStatus(){ return over? '' : (isBot(turn)? (players[turn]?.name||'')+' …' : tt('turnYou')); },
    };
  }
});
})();
