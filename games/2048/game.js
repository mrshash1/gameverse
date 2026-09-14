/* ============ Game: 2048 (۲۰۴۸) — classic rules, premium DOM tiles ============
   Real merge rule (each tile merges once per move) • 120ms slide + merge pop
   + spawn pop • swipe/arrows/WASD • one-step undo (3 per game) • win overlay
   («بردی! ادامه بده؟») • +N score floaters • best in LS. No libraries.
================================================================================ */
(function(){
'use strict';
const PV = window.PV, U = PV.u, t = PV.t;
const { clamp, fmt } = U;

/* ---------- local dict (fa/en) + resolver ---------- */
const L = {
  fa:{
    score:'امتیاز', best:'رکورد', moves:'حرکت',
    undo:'واگرد', newG:'جدید', finish:'🏁 اتمام بازی',
    winT:'🏆 بردی!', winQ:'به کاشی ۲۰۴۸ رسیدی — ادامه بده؟',
    keep:'ادامه بده', end:'اتمام و ثبت امتیاز',
    overT:'بازی تمام شد', noMove:'حرکتی نماند!',
    paused:'⏸ مکث', resume:'ادامه',
    hint:'کشیدن روی صفحه یا کلیدهای جهت / WASD • واگرد: Z',
  },
  en:{
    score:'Score', best:'Best', moves:'Moves',
    undo:'Undo', newG:'New', finish:'🏁 Finish game',
    winT:'🏆 You win!', winQ:'You reached the 2048 tile — keep going?',
    keep:'Keep going', end:'Finish & save score',
    overT:'Game Over', noMove:'No moves left!',
    paused:'⏸ Paused', resume:'Resume',
    hint:'Swipe or arrow keys / WASD • undo: Z',
  }
};
const tt = k => { const lg=(PV.i18n&&PV.i18n.lang)||'fa'; return (L[lg]&&L[lg][k]) || L.fa[k] || t(k); };
const num = n => ((PV.i18n&&PV.i18n.lang)==='en') ? String(n) : fmt(n);

const N=4;
PV.registry.register({
  id:'2048', cats:['brain','classic'], players:[1,1], modes:['solo'], weight:81,
  factory: function(ctx){
    const rng = ctx.rng || Math.random;
    const diff = ctx.diff || 'normal';
    const selfPid = ctx.selfPid || 'me';
    const bestKey = 'best:2048:' + ((PV.store && PV.store.me && PV.store.me()?.u) || 'guest');
    const fourChance = diff==='hard'? .25 : .1;   /* hard spawns more 4s */
    const initTiles  = diff==='hard'? 3 : 2;

    /* ---------- DOM ---------- */
    const styleEl=document.createElement('style');
    styleEl.textContent=`
.pv2048-root{width:100%;display:flex;justify-content:center}
.pv2048-wrap{width:100%;max-width:480px;display:flex;flex-direction:column;gap:11px;animation:pv2048In .5s cubic-bezier(.2,.9,.3,1.15) both}
@keyframes pv2048In{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
.pv2048-hud{display:flex;gap:8px;align-items:stretch}
.pv2048-chip{position:relative;flex:1;background:var(--surface);border:1.5px solid var(--border);border-radius:14px;padding:6px 12px 5px;display:flex;flex-direction:column;align-items:center;box-shadow:var(--sh-1)}
.pv2048-chip::before{content:'';position:absolute;top:0;inset-inline:12px;height:3px;border-radius:0 0 4px 4px;background:var(--grad-p)}
.pv2048-chip.pv2048-best::before{background:var(--grad-gold)}
.pv2048-chip span{font-size:.63rem;color:var(--tx3);font-weight:800}
.pv2048-chip b{font-size:1.04rem;font-weight:900;line-height:1.35;font-variant-numeric:tabular-nums}
.pv2048-best b{color:var(--gold)}
.pv2048-bump{animation:pv2048Bump .35s cubic-bezier(.2,.9,.3,1.4)}
@keyframes pv2048Bump{40%{transform:scale(1.22)}}
.pv2048-floats{position:absolute;inset:0;pointer-events:none}
.pv2048-float{position:absolute;left:50%;top:26%;transform:translateX(-50%);font-weight:900;font-size:.95rem;color:#18b566;animation:pv2048Float .8s ease-out both;text-shadow:0 1px 0 var(--surface)}
@keyframes pv2048Float{from{opacity:0;transform:translate(-50%,8px) scale(.75)}25%{opacity:1}to{opacity:0;transform:translate(-50%,-28px) scale(1.12)}}
.pv2048-ubtn,.pv2048-nbtn{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;min-width:58px;padding:4px 12px;border-radius:14px;background:var(--surface);border:1.5px solid var(--border);box-shadow:var(--sh-1);font-weight:800;transition:transform .13s,opacity .2s;user-select:none}
.pv2048-ubtn i,.pv2048-nbtn i{font-style:normal;font-size:1.05rem;line-height:1.3}
.pv2048-ubtn span,.pv2048-nbtn span{font-size:.58rem;color:var(--tx2)}
.pv2048-ubtn:active,.pv2048-nbtn:active{transform:scale(.92)}
.pv2048-ubtn:disabled{opacity:.4}
.pv2048-fbtn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:10px;border-radius:14px;font-weight:900;color:#fff;background:var(--grad-gold);box-shadow:0 8px 22px -8px rgba(255,176,32,.65);animation:pv2048In .4s both;transition:transform .13s}
.pv2048-fbtn:active{transform:scale(.97)}
.pv2048-board{--gap:9px;--cell:80px;position:relative;width:min(100%,440px);margin-inline:auto;aspect-ratio:1;background:linear-gradient(150deg,#cdc0ae,#ab9a89);border-radius:20px;padding:var(--gap);box-shadow:0 18px 40px -16px rgba(120,100,70,.55),inset 0 1px 0 rgba(255,255,255,.35);touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
.pv2048-cells{display:grid;grid-template-columns:repeat(4,var(--cell));grid-template-rows:repeat(4,var(--cell));gap:var(--gap)}
.pv2048-cell{background:rgba(0,0,0,.13);border-radius:12px;box-shadow:inset 0 1px 3px rgba(0,0,0,.06)}
.pv2048-tiles{position:absolute;inset:var(--gap)}
.pv2048-tile{position:absolute;top:0;left:0;width:var(--cell);height:var(--cell);transform:translate(calc(var(--x)*(var(--cell) + var(--gap))),calc(var(--y)*(var(--cell) + var(--gap))));transition:transform .12s cubic-bezier(.25,.8,.35,1);will-change:transform;z-index:2}
.pv2048-tile.pv2048-merged{z-index:3}
.pv2048-face{width:100%;height:100%;display:flex;align-items:center;justify-content:center;border-radius:12px;font-weight:900;font-size:calc(var(--cell)*.44);font-variant-numeric:tabular-nums;box-shadow:0 3px 10px -3px rgba(0,0,0,.3),inset 0 -2px 0 rgba(0,0,0,.09)}
.pv2048-face.d3{font-size:calc(var(--cell)*.36)}
.pv2048-face.d4{font-size:calc(var(--cell)*.29)}
.pv2048-tile.pv2048-new .pv2048-face{animation:pv2048Spawn .2s .07s cubic-bezier(.2,.9,.3,1.45) both}
@keyframes pv2048Spawn{from{transform:scale(0)}to{transform:scale(1)}}
.pv2048-tile.pv2048-merged .pv2048-face{animation:pv2048Pop .24s cubic-bezier(.2,.9,.3,1.5)}
@keyframes pv2048Pop{0%{transform:scale(.55)}55%{transform:scale(1.22)}100%{transform:scale(1)}}
.pv2048-tile.pv2048-undo .pv2048-face{animation:pv2048Spawn .16s both}
.v2{background:#eee4da;color:#776e65}.v4{background:#ede0c8;color:#776e65}
.v8{background:#f2b179;color:#fff}.v16{background:#f59563;color:#fff}
.v32{background:#f67c5f;color:#fff}.v64{background:#f65e3b;color:#fff}
.v128{background:#edcf72;color:#fff;box-shadow:0 0 16px rgba(243,215,116,.4),inset 0 -2px 0 rgba(0,0,0,.09)}
.v256{background:#edcc61;color:#fff;box-shadow:0 0 18px rgba(243,215,116,.45),inset 0 -2px 0 rgba(0,0,0,.09)}
.v512{background:#edc850;color:#fff;box-shadow:0 0 20px rgba(243,215,116,.5),inset 0 -2px 0 rgba(0,0,0,.09)}
.v1024{background:#edc53f;color:#fff;box-shadow:0 0 24px rgba(243,215,116,.55),inset 0 -2px 0 rgba(0,0,0,.09)}
.v2048{background:#edc22e;color:#fff;box-shadow:0 0 30px rgba(243,215,116,.65),inset 0 -2px 0 rgba(0,0,0,.09)}
.vbig{background:#3c3a32;color:#fff;box-shadow:0 0 24px rgba(60,58,50,.5),inset 0 -2px 0 rgba(0,0,0,.09)}
.pv2048-ov{position:absolute;inset:var(--gap);z-index:6;border-radius:16px;background:rgba(247,241,229,.9);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;text-align:center;padding:16px;animation:pv2048OvIn .4s cubic-bezier(.2,.9,.3,1.2) both}
@keyframes pv2048OvIn{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:none}}
.pv2048-ov b.pv2048-ovt{font-size:1.5rem;color:#6b5b45;font-weight:900}
.pv2048-ov p{font-size:.85rem;color:#8a7a63;font-weight:700;margin:0}
.pv2048-ov .pv2048-ovs{font-size:1.05rem;font-weight:900;color:#edc22e}
.pv2048-ovb{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:6px}
.pv2048-ovb button{padding:9px 20px;border-radius:999px;font-weight:900;color:#fff;background:var(--grad-p);box-shadow:var(--sh-p);transition:transform .13s}
.pv2048-ovb button.pv2048-gold{background:var(--grad-gold);box-shadow:0 8px 20px -8px rgba(255,176,32,.7)}
.pv2048-ovb button:active{transform:scale(.93)}
.pv2048-hint{text-align:center;font-size:.67rem;color:var(--tx3);line-height:1.8}
`;
    const root=document.createElement('div');
    root.className='pv2048-root';
    root.appendChild(styleEl);
    const cellsHtml=Array.from({length:16},()=>'<div class="pv2048-cell"></div>').join('');
    root.insertAdjacentHTML('beforeend',`
      <div class="pv2048-wrap">
        <div class="pv2048-hud">
          <div class="pv2048-chip"><span>${tt('score')}</span><b id="gScore">۰</b><div class="pv2048-floats" id="gFloats"></div></div>
          <div class="pv2048-chip pv2048-best"><span>${tt('best')}</span><b id="gBest">۰</b></div>
          <button class="pv2048-ubtn" id="gUndo"><i>↶</i><span>${tt('undo')} <b id="gUndoN">۳</b></span></button>
          <button class="pv2048-nbtn" id="gNew"><i>🔄</i><span>${tt('newG')}</span></button>
        </div>
        <button class="pv2048-fbtn hidden" id="gFinish">${tt('finish')}</button>
        <div class="pv2048-board" id="gBoard">
          <div class="pv2048-cells">${cellsHtml}</div>
          <div class="pv2048-tiles" id="gTiles"></div>
          <div class="pv2048-ov hidden" id="gOv"></div>
        </div>
        <div class="pv2048-hint">${tt('hint')}</div>
      </div>`);
    ctx.root.appendChild(root);

    const $=s=>root.querySelector(s);
    const boardEl=$('#gBoard'), tilesEl=$('#gTiles'), ovEl=$('#gOv'), floatsEl=$('#gFloats');
    const scoreEl=$('#gScore'), bestEl=$('#gBest'), undoBtn=$('#gUndo'), undoNEl=$('#gUndoN');
    const newBtn=$('#gNew'), finishBtn=$('#gFinish');

    /* ---------- state ---------- */
    let tiles=[], score=0, best=U.LS.get(bestKey,0)||0, moves=0;
    let undoLeft=3, history=null;
    let over=false, won=false, wonShown=false, ended=false, paused=false, ovOpen=false;
    let uidc=0, gen=0, pendingDead=false;
    const timers=new Set();
    function after(ms,fn){ const to=setTimeout(()=>{ timers.delete(to); fn(); },ms); timers.add(to); return to; }

    /* ---------- geometry ---------- */
    function measure(){
      const w=boardEl.clientWidth; if(!w) return;
      const gap=Math.round(clamp(w*.025,7,12));
      const cs=Math.floor((w-gap*2-gap*3)/4);
      boardEl.style.setProperty('--gap',gap+'px');
      boardEl.style.setProperty('--cell',cs+'px');
    }

    /* ---------- tiles ---------- */
    function buildGrid(){
      const g=Array.from({length:N},()=>Array(N).fill(null));
      tiles.forEach(tl=>{ if(!tl.dead) g[tl.y][tl.x]=tl; });
      return g;
    }
    function setPos(tl,x,y){ tl.x=x; tl.y=y; tl.el.style.setProperty('--x',x); tl.el.style.setProperty('--y',y); }
    function setVal(tl){
      const s=String(tl.val);
      tl.sp.textContent=num(tl.val);
      tl.sp.className='pv2048-face v'+(tl.val<=2048?tl.val:'big')+(s.length>=4?' d4':s.length===3?' d3':'');
    }
    function makeTile(x,y,val,fresh){
      const el=document.createElement('div'); el.className='pv2048-tile';
      const sp=document.createElement('span'); el.appendChild(sp);
      const tl={id:++uidc,x,y,val,el,sp,merged:false,dead:false};
      setVal(tl); setPos(tl,x,y);
      tilesEl.appendChild(el); tiles.push(tl);
      if(fresh){ el.classList.add('pv2048-new'); after(320,()=>el.classList.remove('pv2048-new')); }
      return tl;
    }
    function spawnTile(){
      const g=buildGrid(), empties=[];
      for(let y=0;y<N;y++) for(let x=0;x<N;x++) if(!g[y][x]) empties.push([x,y]);
      if(!empties.length) return;
      const [x,y]=empties[Math.floor(rng()*empties.length)];
      makeTile(x,y, rng()<fourChance?4:2, true);
    }

    /* remove tiles that already merged into a target (deferred slide finished) */
    function flushDead(){
      if(!pendingDead) return;
      pendingDead=false;
      tiles=tiles.filter(tl=>{ if(tl.dead){ tl.el.remove(); return false; } return true; });
    }
    /* ---------- core move (real 2048: merge once per tile per move) ---------- */
    function move(dx,dy){
      if(over||paused||ended||ovOpen) return;
      flushDead();
      const prevHistory=history;
      history=snapshot();
      const myGen=gen;
      const g=buildGrid();
      const xs=[0,1,2,3], ys=[0,1,2,3];
      if(dx>0) xs.reverse(); if(dy>0) ys.reverse();
      let moved=false, gained=0; const merges=[];
      for(const y of ys) for(const x of xs){
        const tl=g[y][x]; if(!tl) continue;
        let cx=x, cy=y;
        while(true){
          const nx=cx+dx, ny=cy+dy;
          if(nx<0||nx>=N||ny<0||ny>=N||g[ny][nx]) break;
          cx=nx; cy=ny;
        }
        const nx=cx+dx, ny=cy+dy;
        const nb=(nx>=0&&nx<N&&ny>=0&&ny<N)? g[ny][nx] : null;
        if(nb && nb.val===tl.val && !nb.merged && !tl.merged){
          g[y][x]=null; g[ny][nx]=nb;
          nb.merged=true; nb.val*=2; gained+=nb.val;
          tl.dead=true; setPos(tl,nx,ny);
          merges.push(nb); moved=true; pendingDead=true;
        } else if(cx!==x||cy!==y){
          g[y][x]=null; g[cy][cx]=tl; setPos(tl,cx,cy); moved=true;
        }
      }
      if(!moved){ history=prevHistory; return; }
      moves++;
      hud();
      PV.sound.play('tap');
      after(125,()=>{
        if(myGen!==gen) return;            /* undo/reset happened meanwhile */
        merges.forEach(nb=>{
          nb.merged=false;
          setVal(nb);
          nb.el.classList.remove('pv2048-merged'); void nb.el.offsetWidth;
          nb.el.classList.add('pv2048-merged');
          after(320,()=>nb.el.classList.remove('pv2048-merged'));
        });
        if(gained>0){
          addScore(gained);
          PV.sound.play(gained>=128?'coin':'pop');
          U.vibrate(merges.some(m=>m.val>=128)?32:14);
        }
      });
      after(145,()=>{
        if(myGen!==gen) return;
        spawnTile();
        if(!wonShown && tiles.some(tl=>tl.val>=2048)){ won=true; wonShown=true; showWin(); }
        else if(!canMoveAny()) showOver();
      });
    }
    function canMoveAny(){
      const g=buildGrid();
      for(let y=0;y<N;y++) for(let x=0;x<N;x++){
        if(!g[y][x]) return true;
        if(x<N-1 && g[y][x+1] && g[y][x+1].val===g[y][x].val) return true;
        if(y<N-1 && g[y+1][x] && g[y+1][x].val===g[y][x].val) return true;
      }
      return false;
    }

    /* ---------- score / hud ---------- */
    function addScore(n){
      score+=n;
      scoreEl.textContent=num(score);
      scoreEl.classList.remove('pv2048-bump'); void scoreEl.offsetWidth; scoreEl.classList.add('pv2048-bump');
      const f=document.createElement('b'); f.className='pv2048-float'; f.textContent='+'+num(n);
      floatsEl.appendChild(f); after(850,()=>f.remove());
      if(score>best){ best=score; U.LS.set(bestKey,best); bestEl.textContent=num(best);
        bestEl.classList.remove('pv2048-bump'); void bestEl.offsetWidth; bestEl.classList.add('pv2048-bump'); }
    }
    function hud(){
      scoreEl.textContent=num(score);
      bestEl.textContent=num(best);
      undoNEl.textContent=num(undoLeft);
      undoBtn.disabled = !history || undoLeft<=0 || ended;
    }

    /* ---------- undo (one step back, 3 per game) ---------- */
    function snapshot(){ return {score, moves, tiles: tiles.filter(tl=>!tl.dead).map(tl=>({x:tl.x,y:tl.y,val:tl.val}))}; }
    function undo(){
      if(!history||undoLeft<=0||ended||ovOpen) return;
      undoLeft--;
      gen++; pendingDead=false;
      const h=history; history=null;
      tiles.forEach(tl=>tl.el.remove()); tiles=[];
      score=h.score; moves=h.moves;
      h.tiles.forEach(t2=>{ const tl=makeTile(t2.x,t2.y,t2.val,false); tl.el.classList.add('pv2048-undo'); after(250,()=>tl.el.classList.remove('pv2048-undo')); });
      over=false; hideOv(); hud();
      PV.sound.play('flip'); U.vibrate(12);
    }

    /* ---------- overlays ---------- */
    function showWin(){
      ovOpen=true;
      ovEl.innerHTML=`
        <b class="pv2048-ovt">${tt('winT')}</b>
        <p>${tt('winQ')}</p>
        <div class="pv2048-ovs">${tt('score')}: ${num(score)}</div>
        <div class="pv2048-ovb">
          <button id="gKeep">${tt('keep')}</button>
          <button id="gEnd" class="pv2048-gold">${tt('end')}</button>
        </div>`;
      ovEl.classList.remove('hidden');
      finishBtn.classList.remove('hidden');
      PV.sound.play('win'); U.vibrate([40,60,40]);
      $('#gKeep').onclick=()=>{ hideOv(); PV.sound.play('tap'); };
      $('#gEnd').onclick=()=>{ hideOv(); doFinish(); };
    }
    function showOver(){
      over=true;
      ovOpen=true;
      ovEl.innerHTML=`
        <b class="pv2048-ovt">${tt('overT')}</b>
        <p>${tt('noMove')}</p>
        <div class="pv2048-ovs">${tt('score')}: ${num(score)} • ${tt('best')}: ${num(best)}</div>`;
      ovEl.classList.remove('hidden');
      PV.sound.play('lose'); U.vibrate(90);
      after(950,doFinish);
    }
    function showPause(){
      ovOpen=true;
      ovEl.innerHTML=`
        <b class="pv2048-ovt">${tt('paused')}</b>
        <div class="pv2048-ovb"><button id="gRes">${tt('resume')}</button></div>`;
      ovEl.classList.remove('hidden');
      $('#gRes').onclick=()=>{ paused=false; hideOv(); PV.sound.play('go'); };
    }
    function hideOv(){ ovEl.classList.add('hidden'); ovEl.innerHTML=''; ovOpen=false; }
    function doFinish(){
      if(ended) return;
      ended=true;
      ctx.finish({
        res:'w',
        scores:{[selfPid]:score},
        stats:{maxTile: tiles.reduce((m,tl)=>Math.max(m,tl.val),0), moves},
        vsHuman:false,
        sub: tt('score')+': '+num(score),
      });
    }

    /* ---------- input: keyboard ---------- */
    function onKeyDown(e){
      if(e.target && (e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA')) return;
      const k=e.code;
      if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].indexOf(k)>=0) e.preventDefault();
      if(e.repeat) return;
      switch(k){
        case 'ArrowLeft': case 'KeyA': move(-1,0); break;
        case 'ArrowRight': case 'KeyD': move(1,0); break;
        case 'ArrowUp': case 'KeyW': move(0,-1); break;
        case 'ArrowDown': case 'KeyS': move(0,1); break;
        case 'KeyZ': undo(); break;
      }
    }

    /* ---------- input: swipe (threshold 24px, no scroll) ---------- */
    let tS=null;
    boardEl.addEventListener('touchstart',e=>{
      const t0=e.changedTouches[0];
      tS={x:t0.clientX,y:t0.clientY,done:false};
    },{passive:true});
    boardEl.addEventListener('touchmove',e=>{
      if(!tS||tS.done) return;
      e.preventDefault();
      const t0=e.changedTouches[0];
      const dx=t0.clientX-tS.x, dy=t0.clientY-tS.y;
      if(Math.max(Math.abs(dx),Math.abs(dy))<24) return;
      tS.done=true;
      if(Math.abs(dx)>Math.abs(dy)) move(dx>0?1:-1,0);
      else move(0,dy>0?1:-1);
    },{passive:false});
    boardEl.addEventListener('touchend',()=>{ tS=null; },{passive:true});
    boardEl.addEventListener('contextmenu',e=>e.preventDefault());

    /* ---------- buttons / listeners ---------- */
    undoBtn.addEventListener('click',undo);
    newBtn.addEventListener('click',()=>{ PV.sound.play('whoosh'); reset(); });
    finishBtn.addEventListener('click',()=>{ hideOv(); doFinish(); });

    function reset(){
      gen++; pendingDead=false;
      tiles.forEach(tl=>tl.el.remove()); tiles=[];
      score=0; moves=0; undoLeft=3; history=null;
      over=false; won=false; wonShown=false; ended=false; paused=false;
      hideOv();
      finishBtn.classList.add('hidden');
      for(let i=0;i<initTiles;i++) spawnTile();
      hud();
    }
    function onResize(){ measure(); }

    document.addEventListener('keydown',onKeyDown);
    window.addEventListener('resize',onResize);

    /* ---------- boot ---------- */
    measure();
    after(60,measure);
    for(let i=0;i<initTiles;i++) spawnTile();
    hud();

    return {
      init(){ measure(); },
      start(){ measure(); },
      pause(){ if(!ended&&!over){ paused=true; showPause(); } },
      resume(){ paused=false; if(ovOpen){ hideOv(); } },
      end(){ ended=true; },
      reset(){ reset(); },
      getState(){ return {score, moves, maxTile: tiles.reduce((m,tl)=>Math.max(m,tl.val),0)}; },
      getScores(){ return {[selfPid]: score}; },
      getStatus(){ return ended||over? '' : tt('moves')+': '+num(moves)+' • '+tt('best')+': '+num(best); },
      destroy(){
        timers.forEach(to=>clearTimeout(to)); timers.clear();
        document.removeEventListener('keydown',onKeyDown);
        window.removeEventListener('resize',onResize);
        root.remove();
      },
    };
  }
});
})();
