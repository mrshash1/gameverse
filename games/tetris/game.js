/* ============ Game: Tetris (تتریس) — modern rules ============
   7-bag randomizer • SRS wall-kick rotation • ghost piece • hold slot
   next-3 preview • lock-delay • combo • line-clear FX • DAS/ARR keyboard
   + full mobile control bar & swipe gestures. No libraries.
=============================================================== */
(function(){
'use strict';
const PV = window.PV, U = PV.u, t = PV.t;
const { clamp, fmt } = U;

/* ---------- local dict (fa/en) + resolver ---------- */
const L = {
  fa:{
    score:'امتیاز', best:'رکورد', lines:'خط', level:'سطح',
    hold:'نگه‌داشتن', next:'بعدی', pause:'مکث', resume:'ادامه',
    left:'چپ', right:'راست', rot:'چرخش', drop:'رها کردن',
    paused:'مکث', over:'پایان بازی', lvlup:'🔥 سطح', combo:'کمبو',
    hint:'⬅➡ حرکت • ⬇ نرم • Space رها • ⬆/X چرخش • Z خلاف‌گرد • C نگه‌داشتن • P مکث',
    mhint:'کشیدن روی صفحه = حرکت • ضربه = چرخش • کشیدن تند به پایین = رها کردن',
    ready:'آماده؟ برو! 🚀',
  },
  en:{
    score:'Score', best:'Best', lines:'Lines', level:'Level',
    hold:'Hold', next:'Next', pause:'Pause', resume:'Resume',
    left:'Left', right:'Right', rot:'Rotate', drop:'Drop',
    paused:'Paused', over:'Game Over', lvlup:'🔥 Level', combo:'Combo',
    hint:'⬅➡ move • ⬇ soft • Space drop • ⬆/X rotate • Z ccw • C hold • P pause',
    mhint:'Swipe to move • tap to rotate • fast swipe down = hard drop',
    ready:'Ready? Go! 🚀',
  }
};
const tt = k => { const lg=(PV.i18n&&PV.i18n.lang)||'fa'; return (L[lg]&&L[lg][k]) || L.fa[k] || t(k); };
const num = n => ((PV.i18n&&PV.i18n.lang)==='en') ? String(n) : fmt(n);

/* ---------- constants ---------- */
const COLS=10, ROWS=20, LOCK_MS=450, CLEAR_MS=300, DAS=160, ARR=40;
const TYPES=['I','O','T','S','Z','J','L'];
const SHAPES={
  I:{m:[[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], c:'#22d3ee'},
  O:{m:[[1,1],[1,1]],                             c:'#facc15'},
  T:{m:[[0,1,0],[1,1,1],[0,0,0]],                 c:'#c084fc'},
  S:{m:[[0,1,1],[1,1,0],[0,0,0]],                 c:'#4ade80'},
  Z:{m:[[1,1,0],[0,1,1],[0,0,0]],                 c:'#fb7185'},
  J:{m:[[1,0,0],[1,1,1],[0,0,0]],                 c:'#60a5fa'},
  L:{m:[[0,0,1],[1,1,1],[0,0,0]],                 c:'#fb923c'},
};
/* SRS wall kicks — table coords are (x, y-up); screen flip on apply */
const KICKS={
  JLSTZ:{
    '0>1':[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]], '1>0':[[0,0],[1,0],[1,-1],[0,2],[1,2]],
    '1>2':[[0,0],[1,0],[1,-1],[0,2],[1,2]],     '2>1':[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
    '2>3':[[0,0],[1,0],[1,1],[0,-2],[1,-2]],    '3>2':[[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
    '3>0':[[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],  '0>3':[[0,0],[1,0],[1,1],[0,-2],[1,-2]],
  },
  I:{
    '0>1':[[0,0],[-2,0],[1,0],[-2,-1],[1,2]],   '1>0':[[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
    '1>2':[[0,0],[-1,0],[2,0],[-1,2],[2,-1]],   '2>1':[[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
    '2>3':[[0,0],[2,0],[-1,0],[2,1],[-1,-2]],   '3>2':[[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
    '3>0':[[0,0],[1,0],[-2,0],[1,-2],[-2,1]],   '0>3':[[0,0],[-1,0],[2,0],[-1,2],[2,-1]],
  }
};

/* ---------- small helpers ---------- */
function rotCW(m){ const N=m.length, r=Array.from({length:N},()=>Array(N).fill(0));
  for(let y=0;y<N;y++) for(let x=0;x<N;x++) r[x][N-1-y]=m[y][x]; return r; }
function rotCCW(m){ const N=m.length, r=Array.from({length:N},()=>Array(N).fill(0));
  for(let y=0;y<N;y++) for(let x=0;x<N;x++) r[N-1-x][y]=m[y][x]; return r; }
function shade(hex,amt){ const n=parseInt(hex.slice(1),16);
  let r=(n>>16)&255,g=(n>>8)&255,b=n&255;
  if(amt>=0){ r+=(255-r)*amt; g+=(255-g)*amt; b+=(255-b)*amt; }
  else { r*=1+amt; g*=1+amt; b*=1+amt; }
  return 'rgb('+(r|0)+','+(g|0)+','+(b|0)+')'; }
function hexA(hex,a){ const n=parseInt(hex.slice(1),16);
  return 'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+','+a+')'; }
function rr(c,x,y,w,h,r){ r=Math.min(r,w/2,h/2); c.beginPath();
  c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r);
  c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath(); }

PV.registry.register({
  id:'tetris', cats:['classic','speed','family'], players:[1,1], modes:['solo'], weight:87,
  factory: function(ctx){
    const rng = ctx.rng || Math.random;
    const diff = ctx.diff || 'normal';
    const selfPid = ctx.selfPid || 'me';
    const bestKey = 'best:tetris:' + ((PV.store && PV.store.me && PV.store.me()?.u) || 'guest');

    /* ---------- DOM ---------- */
    const styleEl = document.createElement('style');
    styleEl.textContent = `
.pvtrs-root{width:100%;display:flex;justify-content:center}
.pvtrs-wrap{width:100%;max-width:560px;display:flex;flex-direction:column;gap:10px;animation:pvtrsIn .55s cubic-bezier(.2,.9,.3,1.15) both}
@keyframes pvtrsIn{from{opacity:0;transform:translateY(16px) scale(.985)}to{opacity:1;transform:none}}
.pvtrs-hud{display:grid;grid-template-columns:repeat(4,1fr) 42px;gap:8px}
.pvtrs-stat{position:relative;background:var(--surface);border:1.5px solid var(--border);border-radius:14px;padding:7px 10px 7px;display:flex;flex-direction:column;gap:0;box-shadow:var(--sh-1);overflow:hidden}
.pvtrs-stat::before{content:'';position:absolute;top:0;inset-inline:10px;height:3px;border-radius:0 0 4px 4px}
.pvtrs-s-score::before{background:var(--grad-p)} .pvtrs-s-best::before{background:var(--grad-gold)}
.pvtrs-s-lines::before{background:var(--grad-cyan)} .pvtrs-s-level::before{background:var(--grad-green)}
.pvtrs-k{font-size:.64rem;color:var(--tx3);font-weight:800;letter-spacing:.02em}
.pvtrs-v{font-size:1.02rem;font-weight:900;line-height:1.3;font-variant-numeric:tabular-nums}
.pvtrs-s-score .pvtrs-v{background:var(--grad-p);-webkit-background-clip:text;background-clip:text;color:transparent}
.pvtrs-s-best .pvtrs-v{color:var(--gold)}
.pvtrs-s-lines .pvtrs-v{color:#0ea5b7} .pvtrs-s-level .pvtrs-v{color:#16a34a}
.pvtrs-bump{animation:pvtrsBump .35s cubic-bezier(.2,.9,.3,1.4)}
@keyframes pvtrsBump{40%{transform:scale(1.25)}}
.pvtrs-lbar{position:absolute;bottom:0;inset-inline:0;height:3px;background:var(--border);opacity:.6;border-radius:0 0 12px 12px}
.pvtrs-lbar i{display:block;height:100%;width:0;background:var(--grad-green);transition:width .4s ease;border-radius:0 3px 3px 0}
.pvtrs-pbtn{border-radius:14px;background:var(--surface);border:1.5px solid var(--border);font-size:1rem;box-shadow:var(--sh-1);transition:transform .15s;display:flex;align-items:center;justify-content:center}
.pvtrs-pbtn:active{transform:scale(.9)}
.pvtrs-stage{display:flex;gap:10px;justify-content:center;align-items:stretch}
.pvtrs-side{display:flex;flex-direction:column;gap:8px;width:58px;flex:none}
@media(min-width:560px){.pvtrs-side{width:84px}}
.pvtrs-box{background:var(--surface);border:1.5px solid var(--border);border-radius:14px;padding:6px 4px;display:flex;flex-direction:column;align-items:center;gap:4px;box-shadow:var(--sh-1);flex:1;justify-content:flex-start}
.pvtrs-bk{font-size:.58rem;color:var(--tx3);font-weight:800}
.pvtrs-box canvas{display:block}
.pvtrs-boardbox{position:relative;border-radius:18px;padding:7px;background:linear-gradient(160deg,#283063,#151a3a 55%,#1c1245);box-shadow:0 16px 38px -14px rgba(22,22,70,.6),inset 0 0 0 1px rgba(255,255,255,.07);flex:none}
.pvtrs-boardbox canvas{display:block;border-radius:12px;touch-action:none}
.pvtrs-shake{animation:pvtrsShake .2s ease}
@keyframes pvtrsShake{30%{transform:translateY(4px)}65%{transform:translateY(-2px)}}
.pvtrs-paused{position:absolute;inset:7px;border-radius:12px;background:rgba(8,10,26,.74);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;z-index:4}
.pvtrs-pcard{display:flex;flex-direction:column;align-items:center;gap:10px;color:#fff}
.pvtrs-pcard b{font-size:2.1rem;filter:drop-shadow(0 4px 10px rgba(124,92,255,.6))}
.pvtrs-pcard span{font-weight:800;font-size:.95rem;opacity:.9}
.pvtrs-resume{background:var(--grad-p);color:#fff;border-radius:999px;padding:9px 26px;font-weight:900;box-shadow:var(--sh-p);transition:transform .15s}
.pvtrs-resume:active{transform:scale(.93)}
.pvtrs-controls{display:none;gap:7px}
.pvtrs-controls button{flex:1;min-height:58px;border-radius:16px;background:var(--surface);border:1.5px solid var(--border);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;box-shadow:var(--sh-1);transition:transform .12s,background .2s;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;touch-action:manipulation}
.pvtrs-controls button i{font-style:normal;font-size:1.28rem;line-height:1.1}
.pvtrs-controls button span{font-size:.6rem;color:var(--tx2);font-weight:800}
.pvtrs-controls button:active{transform:scale(.93);background:var(--surface3)}
.pvtrs-controls .pvtrs-b-drop{background:linear-gradient(135deg,rgba(255,92,157,.14),rgba(124,92,255,.14));border-color:var(--p2)}
.pvtrs-controls .pvtrs-b-drop span{color:var(--p4)}
@media(hover:none),(max-width:720px){.pvtrs-controls{display:flex}}
.pvtrs-mhint{display:block;text-align:center;font-size:.66rem;color:var(--tx3);line-height:1.8}
.pvtrs-hint{display:none;text-align:center;font-size:.68rem;color:var(--tx3);line-height:1.9}
@media(hover:hover) and (min-width:721px){.pvtrs-hint{display:block}.pvtrs-mhint{display:none}}
`;
    const root = document.createElement('div');
    root.className='pvtrs-root';
    root.appendChild(styleEl);
    root.insertAdjacentHTML('beforeend', `
      <div class="pvtrs-wrap">
        <div class="pvtrs-hud" id="trHud">
          <div class="pvtrs-stat pvtrs-s-score"><span class="pvtrs-k">${tt('score')}</span><b class="pvtrs-v" id="trScore">۰</b></div>
          <div class="pvtrs-stat pvtrs-s-best"><span class="pvtrs-k">${tt('best')}</span><b class="pvtrs-v" id="trBest">۰</b></div>
          <div class="pvtrs-stat pvtrs-s-lines"><span class="pvtrs-k">${tt('lines')}</span><b class="pvtrs-v" id="trLines">۰</b></div>
          <div class="pvtrs-stat pvtrs-s-level"><span class="pvtrs-k">${tt('level')}</span><b class="pvtrs-v" id="trLevel">۱</b><span class="pvtrs-lbar"><i id="trLbar"></i></span></div>
          <button class="pvtrs-pbtn" id="trPause" title="${tt('pause')}">⏸</button>
        </div>
        <div class="pvtrs-stage">
          <div class="pvtrs-side"><div class="pvtrs-box"><span class="pvtrs-bk">${tt('hold')}</span><canvas id="trHold"></canvas></div></div>
          <div class="pvtrs-boardbox" id="trBox">
            <canvas id="trBoard"></canvas>
            <div class="pvtrs-paused hidden" id="trPaused"><div class="pvtrs-pcard"><b>⏸</b><span>${tt('paused')}</span><button class="pvtrs-resume" id="trResume">▶ ${tt('resume')}</button></div></div>
          </div>
          <div class="pvtrs-side"><div class="pvtrs-box"><span class="pvtrs-bk">${tt('next')}</span><div id="trNexts" style="display:flex;flex-direction:column;gap:6px;align-items:center"></div></div></div>
        </div>
        <div class="pvtrs-controls" id="trCtrl">
          <button data-a="left"><i>◀</i><span>${tt('left')}</span></button>
          <button data-a="rot"><i>⟳</i><span>${tt('rot')}</span></button>
          <button data-a="drop" class="pvtrs-b-drop"><i>⤓</i><span>${tt('drop')}</span></button>
          <button data-a="hold"><i>⤴</i><span>${tt('hold')}</span></button>
          <button data-a="right"><i>▶</i><span>${tt('right')}</span></button>
        </div>
        <div class="pvtrs-mhint">${tt('mhint')}</div>
        <div class="pvtrs-hint">${tt('hint')}</div>
      </div>`);
    ctx.root.appendChild(root);

    const $ = s=>root.querySelector(s);
    const boardCv=$('#trBoard'), boxEl=$('#trBox'), holdCv=$('#trHold'), nextWrap=$('#trNexts');
    const scoreEl=$('#trScore'), bestEl=$('#trBest'), linesEl=$('#trLines'), levelEl=$('#trLevel');
    const lbarEl=$('#trLbar'), pausedEl=$('#trPaused'), hudEl=$('#trHud'), ctrlEl=$('#trCtrl');
    const pauseBtn=$('#trPause');
    const nextCvs=[]; for(let i=0;i<3;i++){ const c=document.createElement('canvas'); nextWrap.appendChild(c); nextCvs.push(c); }

    if(('ontouchstart' in window) || navigator.maxTouchPoints>0) ctrlEl.classList.add('pvtrs-is-touch');

    /* ---------- state ---------- */
    let grid=[], cur=null, queue=[], bag=[], holdType=null, canHold=true;
    let score=0, best=U.LS.get(bestKey,0)||0, lines=0, level=1, combo=0;
    let over=false, paused=false, started=false, finishSent=false;
    let acc=0, lockAcc=0, resets=0, softHeld=false;
    let clearing=false, clearRows=[], clearT0=0;
    let raf=0, lastTs=0, toastTO=null, fitTO=null;
    let cell=24, mini=12, dpr=Math.max(1, window.devicePixelRatio||1);
    let bx=null, hx=null, nxs=[null,null,null];
    const timers=new Set();
    function after(ms,fn){ const to=setTimeout(()=>{ timers.delete(to); fn(); },ms); timers.add(to); return to; }

    /* ---------- bag / pieces ---------- */
    function drawBag(){ if(!bag.length) bag=U.shuffle(TYPES,rng); return bag.pop(); }
    function makePiece(type){ const m=SHAPES[type].m.map(r=>[...r]);
      return {type, m, rot:0, x:Math.floor((COLS-m.length)/2), y:-1}; }
    function spawn(){
      cur = makePiece(queue.shift()); queue.push(drawBag());
      acc=0; lockAcc=0; resets=0;
      drawHold(); drawNexts();
      if(hit(cur.x, cur.y, cur.m)){ over=true; gameOver(); }
    }
    function hit(x,y,m){
      for(let cy=0;cy<m.length;cy++) for(let cx=0;cx<m[cy].length;cx++){
        if(!m[cy][cx]) continue;
        const gx=x+cx, gy=y+cy;
        if(gx<0||gx>=COLS||gy>=ROWS) return true;
        if(gy>=0 && grid[gy][gx]) return true;
      }
      return false;
    }
    function dropDist(){ let d=0; while(!hit(cur.x,cur.y+d+1,cur.m)) d++; return d; }
    function active(){ return started && !over && !paused && !clearing && !!cur; }
    function resetLock(){ lockAcc=0; resets++; }

    /* ---------- actions ---------- */
    function tryMove(dir, silent){
      if(!active()) return false;
      if(hit(cur.x+dir, cur.y, cur.m)) return false;
      cur.x+=dir; resetLock();
      if(!silent){ PV.sound.play('tick'); U.vibrate(6); }
      return true;
    }
    function rotate(dir){
      if(!active()) return;
      if(cur.type==='O'){ PV.sound.play('flip'); return; }
      const from=cur.rot, to=(cur.rot+(dir>0?1:3))%4;
      const m2 = dir>0? rotCW(cur.m):rotCCW(cur.m);
      const table = cur.type==='I'? KICKS.I : KICKS.JLSTZ;
      const kicks = table[from+'>'+to] || [[0,0]];
      for(const k of kicks){
        const nx=cur.x+k[0], ny=cur.y-k[1];        /* SRS y-up → screen y-down */
        if(!hit(nx,ny,m2)){
          cur.x=nx; cur.y=ny; cur.m=m2; cur.rot=to;
          PV.sound.play('flip'); U.vibrate(6); resetLock();
          return;
        }
      }
    }
    function softStep(){
      if(!active()) return false;
      if(hit(cur.x,cur.y+1,cur.m)) return false;
      cur.y++; score+=1; lockAcc=0; hudScore();
      return true;
    }
    function hardDrop(){
      if(!active()) return;
      const d=dropDist();
      cur.y+=d; if(d>0) score+=2*d;
      PV.sound.play('whoosh'); U.vibrate(16);
      boxEl.classList.remove('pvtrs-shake'); void boxEl.offsetWidth; boxEl.classList.add('pvtrs-shake');
      hudAll(); lock();
    }
    function doHold(){
      if(!active() || !canHold || !cur) return;
      PV.sound.play('flip'); U.vibrate(10);
      const prev=holdType; holdType=cur.type; canHold=false;
      if(prev){
        cur=makePiece(prev);
        if(hit(cur.x,cur.y,cur.m)){ over=true; gameOver(); return; }
        acc=0; lockAcc=0; resets=0;
      } else spawn();
      drawHold(); drawNexts();
    }

    /* ---------- lock / clears ---------- */
    function lock(){
      let above=false;
      const col=SHAPES[cur.type].c;
      for(let cy=0;cy<cur.m.length;cy++) for(let cx=0;cx<cur.m[cy].length;cx++){
        if(!cur.m[cy][cx]) continue;
        const gy=cur.y+cy;
        if(gy<0){ above=true; continue; }
        grid[gy][cur.x+cx]=col;
      }
      cur=null;
      if(above){ over=true; gameOver(); return; }
      const full=[];
      for(let r=0;r<ROWS;r++) if(grid[r].every(c=>c)) full.push(r);
      canHold=true;
      if(full.length){
        clearing=true; clearRows=full; clearT0=performance.now();
        combo++;
        PV.sound.play(full.length===4?'ach':'pop');
        U.vibrate(full.length>=3?45:25);
      } else {
        combo=0;
        PV.sound.play('place'); U.vibrate(12);
        spawn();
      }
      hudAll();
    }
    function finishClear(){
      clearing=false;
      const n=clearRows.length;
      clearRows.sort((a,b)=>a-b).forEach(r=>{ grid.splice(r,1); grid.unshift(Array(COLS).fill(null)); });
      lines+=n;
      let gained=[0,100,300,500,800][n]*level;
      if(combo>1){ gained+=50*(combo-1)*level; toast('🔥 '+tt('combo')+' ×'+num(combo-1)); }
      score+=gained;
      const nl=(diff==='hard'?3:1)+Math.floor(lines/10);
      if(nl>level){ level=nl; PV.sound.play('coin'); toast(tt('lvlup')+' '+num(level)); }
      if(score>best){ best=score; U.LS.set(bestKey,best); bump(bestEl); }
      clearRows=[];
      spawn(); hudAll();
    }
    function gameOver(){
      over=true; softHeld=false; stopRepeat();
      if(score>best){ best=score; U.LS.set(bestKey,best); }
      ctx.setTurn('🏁 '+tt('over'),'lose');
      ctx.setStatus('🏁 '+tt('over')+' — '+tt('score')+': '+num(score));
      hudAll();
      after(1100, ()=>{ if(!finishSent){ finishSent=true;
        ctx.finish({ res:'w', scores:{[selfPid]:score}, stats:{lines, level}, vsHuman:false,
          sub: tt('score')+': '+num(score) }); } });
    }

    /* ---------- pause ---------- */
    function setPaused(v){
      if(over || !started || paused===v) return;
      paused=v;
      pausedEl.classList.toggle('hidden',!v);
      pauseBtn.textContent = v? '▶':'⏸';
      stopRepeat(); softHeld=false;
      if(v) ctx.setStatus('⏸ '+tt('paused'));
      else { lastTs=0; ctx.setStatus(''); }
      PV.sound.play(v?'tap':'go');
    }

    /* ---------- gravity / loop ---------- */
    function gravityMs(){
      const mul = diff==='easy'? 1.4 : diff==='hard'? .78 : 1;
      return Math.max(60, 1000*Math.pow(.85, level-1)*mul);
    }
    function loop(ts){
      raf=requestAnimationFrame(loop);
      if(!lastTs) lastTs=ts;
      let dt=ts-lastTs; lastTs=ts;
      if(dt>250) dt=250;
      if(started && !paused && !over){
        if(clearing){
          if(performance.now()-clearT0>=CLEAR_MS) finishClear();
        } else if(cur){
          const g=gravityMs();
          const eff=softHeld? Math.min(g,38):g;
          acc+=dt;
          while(acc>=eff){ acc-=eff;
            if(cur && !hit(cur.x,cur.y+1,cur.m)){ cur.y++; lockAcc=0; if(softHeld){ score+=1; hudScore(); } }
            if(!cur||over) break;
          }
          if(cur && hit(cur.x,cur.y+1,cur.m)){
            lockAcc+=dt;
            if(lockAcc>=(resets>15?120:LOCK_MS)) lock();
          } else if(cur) lockAcc=0;
        }
      }
      draw();
    }

    /* ---------- rendering ---------- */
    function setupCanvas(cv,wCells,hCells,cs){
      cv.width=Math.round(wCells*cs*dpr); cv.height=Math.round(hCells*cs*dpr);
      cv.style.width=(wCells*cs)+'px'; cv.style.height=(hCells*cs)+'px';
      const c2=cv.getContext('2d'); c2.setTransform(dpr,0,0,dpr,0,0);
      return c2;
    }
    function drawBlock(c2,x,y,s,color,alpha){
      c2.save(); c2.globalAlpha=alpha==null?1:alpha;
      const g=c2.createLinearGradient(x,y,x,y+s);
      g.addColorStop(0,shade(color,.42)); g.addColorStop(.45,color); g.addColorStop(1,shade(color,-.3));
      c2.fillStyle=g;
      rr(c2,x+.8,y+.8,s-1.6,s-1.6,Math.max(2,s*.2)); c2.fill();
      c2.fillStyle='rgba(255,255,255,.32)';
      rr(c2,x+s*.16,y+s*.13,s*.68,s*.28,Math.max(1.5,s*.12)); c2.fill();
      c2.strokeStyle='rgba(0,0,0,.28)'; c2.lineWidth=1;
      rr(c2,x+.8,y+.8,s-1.6,s-1.6,Math.max(2,s*.2)); c2.stroke();
      c2.restore();
    }
    function draw(){
      if(!bx||!grid.length) return;
      const W=COLS*cell, H=ROWS*cell, now=performance.now();
      bx.clearRect(0,0,W,H);
      bx.fillStyle='#0b0e1e'; rr(bx,0,0,W,H,12); bx.fill();
      bx.strokeStyle='rgba(255,255,255,.05)'; bx.lineWidth=1; bx.beginPath();
      for(let c=1;c<COLS;c++){ bx.moveTo(c*cell+.5,0); bx.lineTo(c*cell+.5,H); }
      for(let r=1;r<ROWS;r++){ bx.moveTo(0,r*cell+.5); bx.lineTo(W,r*cell+.5); }
      bx.stroke();
      const ck=clearing? (now-clearT0)/CLEAR_MS : 0;
      for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
        const col=grid[r][c]; if(!col) continue;
        const fading = clearing && clearRows.indexOf(r)>=0;
        drawBlock(bx,c*cell,r*cell,cell,col, fading? Math.max(.12,1-ck) : .94);
      }
      if(clearing){
        const a=ck<.5? ck*2 : Math.max(0,2-ck*2);
        for(const r of clearRows){
          bx.fillStyle='rgba(255,255,255,'+(0.92*a).toFixed(3)+')';
          rr(bx,1,r*cell+1,W-2,cell-2,6); bx.fill();
        }
      } else {
        let top=ROWS;
        outer: for(let r=0;r<ROWS;r++){ for(let c=0;c<COLS;c++) if(grid[r][c]){ top=r; break outer; } }
        if(top<=4){
          const a2=(4-top)/4*(0.10+0.06*Math.sin(now/200));
          const gr=bx.createLinearGradient(0,0,0,cell*3);
          gr.addColorStop(0,'rgba(255,60,90,'+a2.toFixed(3)+')'); gr.addColorStop(1,'rgba(255,60,90,0)');
          bx.fillStyle=gr; bx.fillRect(0,0,W,cell*3);
        }
      }
      if(cur && !clearing && !over){
        const d=dropDist(), col=SHAPES[cur.type].c;
        if(d>0){
          bx.save();
          for(let cy=0;cy<cur.m.length;cy++) for(let cx=0;cx<cur.m[cy].length;cx++){
            if(!cur.m[cy][cx]) continue;
            const gy=cur.y+d+cy; if(gy<0) continue;
            const gx=(cur.x+cx)*cell, gyy=gy*cell;
            bx.fillStyle=hexA(col,.09); rr(bx,gx+1.5,gyy+1.5,cell-3,cell-3,cell*.2); bx.fill();
            bx.strokeStyle=hexA(col,.55); bx.lineWidth=1.5;
            rr(bx,gx+1.5,gyy+1.5,cell-3,cell-3,cell*.2); bx.stroke();
          }
          bx.restore();
        }
        bx.save(); bx.shadowColor=hexA(col,.5); bx.shadowBlur=cell*.38;
        for(let cy=0;cy<cur.m.length;cy++) for(let cx=0;cx<cur.m[cy].length;cx++){
          if(!cur.m[cy][cx]) continue;
          const gy=cur.y+cy; if(gy<0) continue;
          drawBlock(bx,(cur.x+cx)*cell,gy*cell,cell,col,1);
        }
        bx.restore();
      }
    }
    function drawMini(c2,cv,type){
      if(!c2||!cv) return;
      const w=parseFloat(cv.style.width)||cv.width/dpr, h=parseFloat(cv.style.height)||cv.height/dpr;
      c2.clearRect(0,0,w,h);
      if(!type) return;
      const m=SHAPES[type].m;
      let minX=9,maxX=-1,minY=9,maxY=-1;
      for(let y=0;y<m.length;y++) for(let x=0;x<m[y].length;x++) if(m[y][x]){
        if(x<minX)minX=x; if(x>maxX)maxX=x; if(y<minY)minY=y; if(y>maxY)maxY=y; }
      const bw=maxX-minX+1, bh=maxY-minY+1;
      const ox=(4-bw)/2-minX, oy=(2-bh)/2-minY;
      for(let y=0;y<m.length;y++) for(let x=0;x<m[y].length;x++) if(m[y][x])
        drawBlock(c2,(x+ox)*mini,(y+oy)*mini,mini,SHAPES[type].c,1);
    }
    function drawHold(){ drawMini(hx,holdCv,holdType); }
    function drawNexts(){ queue.slice(0,3).forEach((tp,i)=>drawMini(nxs[i],nextCvs[i],tp)); }

    /* ---------- HUD ---------- */
    function setTxt(node,v){ if(node.textContent!==v) node.textContent=v; }
    function bump(node){ node.classList.remove('pvtrs-bump'); void node.offsetWidth; node.classList.add('pvtrs-bump'); }
    let lastScore=-1;
    function hudScore(){ setTxt(scoreEl,num(score)); }
    function hudScoreBump(){ hudScore(); if(score!==lastScore){ bump(scoreEl); lastScore=score; } }
    function hudAll(){
      hudScoreBump();
      setTxt(bestEl,num(best));
      setTxt(linesEl,num(lines));
      setTxt(levelEl,num(level));
      lbarEl.style.width=((lines%10)*10)+'%';
    }
    function toast(msg){
      ctx.setTurn(msg,'me');
      if(toastTO) clearTimeout(toastTO);
      toastTO=setTimeout(()=>{ toastTO=null; if(!over) ctx.setTurn(''); },2200);
    }

    /* ---------- fit (crisp canvas, fits viewport) ---------- */
    function fit(){
      dpr=Math.max(1, window.devicePixelRatio||1);
      const w=root.clientWidth;
      if(!w){ after(80,fit); return; }
      const sideW = w<560? 58:84;
      const availW = w-(sideW*2+10*2+16);
      const chrome = hudEl.offsetHeight + ctrlEl.offsetHeight + 150;
      const availH = Math.max(320, window.innerHeight-chrome);
      cell=clamp(Math.floor(Math.min(availW/COLS, availH/ROWS)),12,34);
      mini = cell<18? 10:13;
      bx=setupCanvas(boardCv,COLS,ROWS,cell);
      hx=setupCanvas(holdCv,4,2,mini);
      nextCvs.forEach((c,i)=>{ nxs[i]=setupCanvas(c,4,2,mini); });
      drawHold(); drawNexts();
    }
    function onResize(){ if(fitTO) clearTimeout(fitTO); fitTO=setTimeout(()=>{ fitTO=null; fit(); },90); }

    /* ---------- keyboard (DAS/ARR) ---------- */
    let repDir=0, repTO=null, repIv=null;
    function stopRepeat(){ repDir=0; if(repTO){clearTimeout(repTO); repTO=null;} if(repIv){clearInterval(repIv); repIv=null;} }
    function startRepeat(dir){
      if(!active()) return;
      stopRepeat(); repDir=dir;
      tryMove(dir,false);
      repTO=setTimeout(()=>{ repIv=setInterval(()=>tryMove(repDir,true),ARR); },DAS);
    }
    function onKeyDown(e){
      if(e.target && (e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA')) return;
      const k=e.code;
      if(['ArrowLeft','ArrowRight','ArrowDown','ArrowUp','Space'].indexOf(k)>=0) e.preventDefault();
      if(e.repeat) return;
      if(over) return;
      switch(k){
        case 'ArrowLeft': startRepeat(-1); break;
        case 'ArrowRight': startRepeat(1); break;
        case 'ArrowDown': softHeld=true; break;
        case 'Space': hardDrop(); break;
        case 'ArrowUp': case 'KeyX': rotate(1); break;
        case 'KeyZ': rotate(-1); break;
        case 'KeyC': case 'ShiftLeft': case 'ShiftRight': doHold(); break;
        case 'KeyP': case 'Escape': setPaused(!paused); break;
      }
    }
    function onKeyUp(e){
      if(e.code==='ArrowLeft'||e.code==='ArrowRight') stopRepeat();
      if(e.code==='ArrowDown') softHeld=false;
    }

    /* ---------- on-screen buttons ---------- */
    ctrlEl.querySelectorAll('button').forEach(b=>{
      const a=b.dataset.a;
      const down=e=>{
        e.preventDefault();
        if(a==='left') startRepeat(-1);
        else if(a==='right') startRepeat(1);
        else if(a==='rot') rotate(1);
        else if(a==='drop') hardDrop();
        else if(a==='hold') doHold();
      };
      const up=()=>{ if(a==='left'||a==='right') stopRepeat(); };
      b.addEventListener('pointerdown',down);
      b.addEventListener('pointerup',up);
      b.addEventListener('pointercancel',up);
      b.addEventListener('pointerleave',up);
      b.addEventListener('contextmenu',e=>e.preventDefault());
    });

    /* ---------- canvas gestures (swipe/tap) ---------- */
    let tS=null;
    boardCv.addEventListener('touchstart',e=>{
      const t0=e.changedTouches[0];
      tS={x:t0.clientX,y:t0.clientY,t:performance.now(),cx:0,cy:0,moved:false,dropped:false};
    },{passive:true});
    boardCv.addEventListener('touchmove',e=>{
      if(!tS) return;
      e.preventDefault();
      if(!active()) return;
      const t0=e.changedTouches[0];
      const dx=t0.clientX-tS.x, dy=t0.clientY-tS.y;
      const step=Math.max(20,cell);
      while(dx-tS.cx>=step){ tryMove(1,true); tS.cx+=step; tS.moved=true; }
      while(tS.cx-dx>=step){ tryMove(-1,true); tS.cx-=step; tS.moved=true; }
      while(dy-tS.cy>=step){ softStep(); tS.cy+=step; tS.moved=true; }
      const dur=performance.now()-tS.t;
      if(!tS.dropped && dy>70 && dy/dur>.55){ tS.dropped=true; tS.moved=true; hardDrop(); }
    },{passive:false});
    boardCv.addEventListener('touchend',()=>{
      if(!tS) return;
      if(!tS.moved && performance.now()-tS.t<260) rotate(1);
      tS=null;
    },{passive:true});
    boardCv.addEventListener('pointerdown',e=>{ if(e.pointerType==='mouse') rotate(1); });

    /* ---------- misc listeners ---------- */
    pauseBtn.addEventListener('click',()=>setPaused(!paused));
    $('#trResume').addEventListener('click',()=>setPaused(false));
    function onVis(){ if(document.hidden && started && !over) setPaused(true); }
    document.addEventListener('keydown',onKeyDown);
    document.addEventListener('keyup',onKeyUp);
    document.addEventListener('visibilitychange',onVis);
    window.addEventListener('resize',onResize);
    window.addEventListener('orientationchange',onResize);

    /* ---------- reset / controller ---------- */
    function reset(){
      grid=Array.from({length:ROWS},()=>Array(COLS).fill(null));
      queue=[]; bag=[];
      for(let i=0;i<4;i++) queue.push(drawBag());
      holdType=null; canHold=true; score=0; lines=0; level=diff==='hard'?3:1; combo=0;
      over=false; paused=false; clearing=false; clearRows=[]; finishSent=false;
      acc=0; lockAcc=0; resets=0; softHeld=false; lastScore=-1;
      pausedEl.classList.add('hidden'); pauseBtn.textContent='⏸';
      spawn(); hudAll();
    }
    started=true; reset();
    if(!raf){ raf=requestAnimationFrame(loop); }
    after(60,fit);
    after(400,()=>{ if(!over) toast(tt('ready')); });

    return {
      init(){},
      start(){ if(!started){ started=true; reset(); } fit(); if(!raf){ raf=requestAnimationFrame(loop); } },
      pause(){ setPaused(true); },
      resume(){ setPaused(false); },
      end(){ over=true; stopRepeat(); },
      reset(){ reset(); },
      getState(){ return {score, lines, level, over}; },
      getScores(){ return {[selfPid]: score}; },
      getStatus(){ return (over||paused)? '' : tt('score')+': '+num(score)+' • '+tt('level')+' '+num(level); },
      destroy(){
        if(raf){ cancelAnimationFrame(raf); raf=0; }
        stopRepeat();
        if(toastTO){ clearTimeout(toastTO); toastTO=null; }
        if(fitTO){ clearTimeout(fitTO); fitTO=null; }
        timers.forEach(to=>clearTimeout(to)); timers.clear();
        document.removeEventListener('keydown',onKeyDown);
        document.removeEventListener('keyup',onKeyUp);
        document.removeEventListener('visibilitychange',onVis);
        window.removeEventListener('resize',onResize);
        window.removeEventListener('orientationchange',onResize);
        root.remove();
      },
    };
  }
});
})();
