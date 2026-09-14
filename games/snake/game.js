/* ============ Game: مار (Snake) — premium canvas arcade ============
   • 21×21 grid, buttery interpolated motion (lerp between grid steps)
   • Gradient rounded body, cute head (eyes track direction + tongue flick)
   • Apple with leaf & bounce; every 5th apple spawns a golden bonus (4s, blinks)
   • Swipe / arrows / WASD / on-screen D-pad, direction queue (no 180° suicide)
   • Death: head shake + red flash + smooth panel (امتیاز، رکورد، دوباره)
=================================================================== */
(function(){
'use strict';
const PV = window.PV, U = PV.u, t = PV.t;
const { clamp, fmt } = U;

const LANG = ()=> (PV.i18n && PV.i18n.lang) || 'fa';
const L = {
  fa:{
    ready:'برای شروع بزن', readySub:'سیب بخور، بزرگ شو — به دم خودت گاز نگیر!',
    paused:'مکث', pausedSub:'برای ادامه بزن', resume:'ادامه',
    over:'بازی تمام شد!', score:'امتیاز', best:'رکورد', again:'دوباره',
    newBest:'🎉 رکورد جدید!', bonus:'+۵۰ طلایی!', level:'سطح',
  },
  en:{
    ready:'Tap to start', readySub:'Eat apples, grow long — don’t bite your tail!',
    paused:'Paused', pausedSub:'Tap to resume', resume:'Resume',
    over:'Game over!', score:'Score', best:'Best', again:'Again',
    newBest:'🎉 New record!', bonus:'+50 golden!', level:'Level',
  },
};
const tt = k => (L[LANG()] && L[LANG()][k]) || L.fa[k] || k;

PV.registry.register({
  id:'snake', cats:['speed','classic'], players:[1,1], modes:['solo'], weight:79,
  factory: function(ctx){
    /* ------------------------------ setup ------------------------------ */
    const N = 21, CELL = 22, SIZE = N*CELL;         /* 462×462 logical px */
    const diff = ctx.diff || 'normal';
    const BASE = diff==='easy'? 170 : diff==='hard'? 110 : 150;
    const MIN_STEP = 70;
    const meP = (PV.store && PV.store.me && PV.store.me()) || null;
    const uk = (meP && meP.u) || 'guest';
    const BEST_KEY = 'best:snake:'+uk;
    let best = U.LS.get(BEST_KEY, 0) || 0;
    const rng = ctx.rng || Math.random;

    /* ------------------------------ state ------------------------------ */
    let snake, prevSnake, dir, dirQ, food, bonus, apples, level, score, stepMs;
    let lastStep, phase, dieAt, floats, tongueAt, flashA, foodSeed;
    let raf = 0, finished = false, finishTO = null, newBestFlag = false;

    function reset(){
      const cx = N>>1;
      snake = [{x:cx+1,y:cx},{x:cx,y:cx},{x:cx-1,y:cx}];
      prevSnake = snake.map(s=>({...s}));
      dir = {x:1,y:0}; dirQ = [];
      food = {x:cx+5,y:cx}; bonus = null;
      apples = 0; level = 0; score = 0; stepMs = BASE;
      lastStep = 0; phase = 'ready'; dieAt = 0;
      floats = []; tongueAt = 1400; flashA = 0; foodSeed = 0;
      finished = false; newBestFlag = false;
      if(finishTO){ clearTimeout(finishTO); finishTO = null; }
      hud(); showOv('ready');
    }

    /* ------------------------------- DOM ------------------------------- */
    const root = document.createElement('div');
    root.innerHTML = `
<style>
.pvsnk-wrap{display:flex;flex-direction:column;align-items:center;gap:10px;width:100%;padding:2px 0 8px;font-family:inherit}
.pvsnk-hud{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center;width:min(92vw,480px)}
.pvsnk-chip{display:inline-flex;align-items:center;gap:6px;background:var(--surface2);border:1.5px solid var(--border);
  border-radius:999px;padding:5px 13px;font-size:.86rem;font-weight:800;box-shadow:var(--sh-1)}
.pvsnk-chip b{font-variant-numeric:tabular-nums}
.pvsnk-chip.gold{background:linear-gradient(135deg,#fff6df,#ffedc2);border-color:#f3d489;color:#8a5a00}
.pvsnk-chip.grn{background:linear-gradient(135deg,#e8f9ee,#dcf3e4);border-color:#b9e4c9;color:#196c3d}
.pvsnk-stage{position:relative;line-height:0;border-radius:22px;box-shadow:var(--sh-3),0 0 0 1.5px var(--border);overflow:hidden}
.pvsnk-cv{display:block;border-radius:22px;touch-action:none;cursor:pointer}
.pvsnk-ov{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  background:rgba(20,40,28,.42);backdrop-filter:blur(3px);opacity:0;pointer-events:none;transition:opacity .25s;z-index:5}
.pvsnk-ov.on{opacity:1;pointer-events:auto}
.pvsnk-card{background:var(--surface);border-radius:20px;padding:20px 26px;text-align:center;min-width:210px;
  box-shadow:var(--sh-3);transform:translateY(14px) scale(.94);transition:transform .28s cubic-bezier(.34,1.56,.64,1)}
.pvsnk-ov.on .pvsnk-card{transform:translateY(0) scale(1)}
.pvsnk-ot{font-weight:900;font-size:1.18rem;margin-bottom:2px}
.pvsnk-os{font-size:.82rem;color:var(--tx2);margin-bottom:10px}
.pvsnk-oscore{font-size:2rem;font-weight:900;background:var(--grad-green);-webkit-background-clip:text;background-clip:text;color:transparent;line-height:1.2}
.pvsnk-obest{font-size:.85rem;color:var(--tx2);margin:4px 0 12px}
.pvsnk-newbest{display:inline-block;background:var(--grad-gold);color:#fff;border-radius:999px;padding:3px 12px;font-size:.8rem;font-weight:900;margin-bottom:10px;animation:pvsnk-pulse 1.1s ease-in-out infinite}
.pvsnk-gobtn{background:var(--grad-green);color:#fff;border:none;border-radius:14px;padding:10px 26px;font-weight:900;font-size:1rem;box-shadow:0 8px 20px -6px rgba(34,197,94,.55);cursor:pointer;transition:transform .15s}
.pvsnk-gobtn:active{transform:scale(.94)}
@keyframes pvsnk-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}
.pvsnk-dpad{display:none;grid-template-columns:repeat(3,64px);grid-template-rows:repeat(2,54px);gap:7px;margin-top:4px;opacity:.85}
.pvsnk-dbtn{background:var(--surface2);border:1.5px solid var(--border);border-radius:14px;font-size:1.25rem;
  display:flex;align-items:center;justify-content:center;box-shadow:var(--sh-1);color:var(--tx2);touch-action:manipulation;user-select:none;-webkit-user-select:none}
.pvsnk-dbtn:active{background:var(--grad-p);color:#fff;border-color:transparent;transform:scale(.93)}
.pvsnk-dup{grid-column:2;grid-row:1}.pvsnk-dleft{grid-column:1;grid-row:2}.pvsnk-ddown{grid-column:2;grid-row:2}.pvsnk-dright{grid-column:3;grid-row:2}
@media (pointer:coarse){.pvsnk-dpad{display:grid}}
</style>
<div class="pvsnk-wrap">
  <div class="pvsnk-hud">
    <span class="pvsnk-chip gold">🍎 <b class="num" id="pvsnkScore">۰</b></span>
    <span class="pvsnk-chip grn">⚡ <span>${tt('level')}</span> <b class="num" id="pvsnkLevel">۱</b></span>
    <span class="pvsnk-chip">🏆 <b class="num" id="pvsnkBest">۰</b></span>
    <button class="pvsnk-chip" id="pvsnkPause" style="cursor:pointer" title="P">⏸</button>
  </div>
  <div class="pvsnk-stage">
    <canvas class="pvsnk-cv" id="pvsnkCv" width="${SIZE}" height="${SIZE}"></canvas>
    <div class="pvsnk-ov" id="pvsnkOv">
      <div class="pvsnk-card">
        <div class="pvsnk-ot" id="pvsnkOt"></div>
        <div class="pvsnk-os" id="pvsnkOs"></div>
        <div class="pvsnk-oscore num" id="pvsnkOscore" style="display:none"></div>
        <div class="pvsnk-newbest" id="pvsnkNewbest" style="display:none">${tt('newBest')}</div>
        <div class="pvsnk-obest num" id="pvsnkObest" style="display:none"></div>
        <button class="pvsnk-gobtn" id="pvsnkGo"></button>
      </div>
    </div>
  </div>
  <div class="pvsnk-dpad" id="pvsnkDpad">
    <button class="pvsnk-dbtn pvsnk-dup" data-d="up">▲</button>
    <button class="pvsnk-dbtn pvsnk-dleft" data-d="left">◀</button>
    <button class="pvsnk-dbtn pvsnk-ddown" data-d="down">▼</button>
    <button class="pvsnk-dbtn pvsnk-dright" data-d="right">▶</button>
  </div>
</div>`;
    ctx.root.appendChild(root);
    const $ = s => root.querySelector(s);
    const cv = $('#pvsnkCv'), g = cv.getContext('2d');
    const ov = $('#pvsnkOv');
    let dpr = 1;

    function fit(){
      const cssW = Math.min(window.innerWidth*0.92, window.innerHeight*0.58, 480);
      cv.style.width = cssW+'px'; cv.style.height = cssW+'px';
      dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(SIZE*dpr); cv.height = Math.round(SIZE*dpr);
    }
    fit();

    /* ----------------------------- helpers ----------------------------- */
    const px = v => v*CELL + CELL/2;
    function pidScores(v){
      const out = {}; out[ctx.selfPid] = v;
      const p0 = (ctx.players||[])[0];
      if(p0 && p0.pid && p0.pid!==ctx.selfPid) out[p0.pid] = v;
      return out;
    }
    function hud(){
      $('#pvsnkScore').textContent = fmt(score);
      $('#pvsnkLevel').textContent = fmt(level+1);
      $('#pvsnkBest').textContent = fmt(best);
    }
    function showOv(kind){
      const ot=$('#pvsnkOt'), os=$('#pvsnkOs'), osc=$('#pvsnkOscore'), nb=$('#pvsnkNewbest'), ob=$('#pvsnkObest'), go=$('#pvsnkGo');
      if(kind==='none'){ ov.classList.remove('on'); return; }
      osc.style.display='none'; nb.style.display='none'; ob.style.display='none';
      if(kind==='ready'){ ot.textContent='🐍 '+t('g.snake'); os.textContent=tt('readySub'); go.textContent=tt('ready'); }
      else if(kind==='pause'){ ot.textContent='⏸ '+tt('paused'); os.textContent=tt('pausedSub'); go.textContent=tt('resume'); }
      else {
        ot.textContent='💀 '+tt('over'); os.textContent='';
        osc.style.display='block'; osc.textContent = fmt(score);
        if(newBestFlag) nb.style.display='inline-block';
        ob.style.display='block'; ob.textContent = tt('best')+': '+fmt(best);
        go.textContent = '🔄 '+tt('again');
      }
      ov.classList.add('on');
    }
    function setDir(name){
      const D = {up:{x:0,y:-1}, down:{x:0,y:1}, left:{x:-1,y:0}, right:{x:1,y:0}}[name];
      if(!D) return;
      if(phase==='ready'||phase==='over'){ startOrRestart(); if(phase!=='run') return; }
      if(phase!=='run') return;
      const lastRef = dirQ.length? dirQ[dirQ.length-1] : dir;
      if(D.x===-lastRef.x && D.y===-lastRef.y) return;   /* no 180° suicide */
      if(D.x===lastRef.x && D.y===lastRef.y) return;
      if(dirQ.length>=2) return;
      dirQ.push(D);
    }
    function startOrRestart(){
      if(phase==='ready'){ phase='run'; lastStep=performance.now(); showOv('none'); PV.sound.play('go'); }
      else if(phase==='over'){ reset(); phase='run'; lastStep=performance.now(); showOv('none'); PV.sound.play('go'); }
      else if(phase==='pause'){ phase='run'; lastStep=performance.now(); ov.classList.remove('on'); PV.sound.play('tap'); }
    }
    function togglePause(){
      if(phase==='run'){ phase='pause'; showOv('pause'); PV.sound.play('tap'); }
      else if(phase==='pause'){ startOrRestart(); }
    }

    /* ---------------------------- game step ---------------------------- */
    function spawnFood(){
      const free = [];
      for(let x=0;x<N;x++) for(let y=0;y<N;y++){
        if(snake.some(s=>s.x===x&&s.y===y)) continue;
        if(food && food.x===x && food.y===y) continue;
        if(bonus && bonus.x===x && bonus.y===y) continue;
        free.push({x,y});
      }
      const f = free[Math.floor(rng()*free.length)];
      food = f? {x:f.x, y:f.y} : null;
      foodSeed = rng()*7;
    }
    function step(){
      if(dirQ.length) dir = dirQ.shift();
      prevSnake = snake.map(s=>({...s}));
      const head = {x:snake[0].x+dir.x, y:snake[0].y+dir.y};
      const eating = food && head.x===food.x && head.y===food.y;
      const body = eating? snake : snake.slice(0,-1);
      if(head.x<0||head.y<0||head.x>=N||head.y>=N || body.some(s=>s.x===head.x&&s.y===head.y)){ die(); return; }
      snake.unshift(head);
      if(eating){
        apples++;
        const gained = Math.round(10*(1+level*0.1));
        score += gained;
        floats.push({x:px(head.x), y:px(head.y), txt:'+'+fmt(gained), t0:performance.now(), gold:false});
        PV.sound.play('pop'); U.vibrate(12);
        if(apples%5===0 && !bonus){
          const free = [];
          for(let x=0;x<N;x++) for(let y=0;y<N;y++){
            if(snake.some(s=>s.x===x&&s.y===y)) continue;
            if(food.x===x&&food.y===y) continue;
            free.push({x,y});
          }
          if(free.length){
            const bf = free[Math.floor(rng()*free.length)];
            bonus = {x:bf.x, y:bf.y, exp:performance.now()+4000};
            PV.sound.play('ach');
          }
        }
        const nl = Math.floor(apples/3);
        if(nl>level){ level=nl; stepMs = Math.max(MIN_STEP, BASE - level*8); PV.sound.play('flip'); }
        spawnFood();
      } else {
        snake.pop();
      }
      if(bonus && head.x===bonus.x && head.y===bonus.y){
        score += 50;
        floats.push({x:px(head.x), y:px(head.y), txt:tt('bonus'), t0:performance.now(), gold:true});
        bonus = null;
        PV.sound.play('coin'); U.vibrate(28);
      }
      if(bonus && performance.now()>bonus.exp) bonus = null;
      hud();
    }
    function die(){
      phase='dying'; dieAt=performance.now(); flashA=.55;
      PV.sound.play('falseStart'); U.vibrate([60,40,80]);
      newBestFlag = score>best && score>0;
      if(newBestFlag){ best=score; U.LS.set(BEST_KEY, best); }
      setTimeout(()=>{
        if(phase!=='dying') return;
        phase='over';
        showOv('over');
        if(!finished){
          finished = true;
          finishTO = setTimeout(()=>ctx.finish({
            res:'w', scores:pidScores(score), stats:{best:score}, vsHuman:false,
            sub: tt('score')+': '+fmt(score),
          }), 1500);
        }
      }, 780);
    }

    /* ------------------------------ render ----------------------------- */
    function lerpPt(a,b,tv){ return {x:a.x+(b.x-a.x)*tv, y:a.y+(b.y-a.y)*tv}; }
    function drawApple(cx2, cy2, now){
      const bounce = 1 + Math.sin(now/240 + foodSeed)*0.055;
      const r = CELL*0.34*bounce;
      g.save();
      g.fillStyle='rgba(30,90,50,.16)';
      g.beginPath(); g.ellipse(cx2, cy2+r*0.86, r*0.9, r*0.32, 0, 0, 7); g.fill();
      const gr = g.createRadialGradient(cx2-r*.35, cy2-r*.4, r*.15, cx2, cy2, r*1.15);
      gr.addColorStop(0,'#ff7d6e'); gr.addColorStop(.55,'#ef4444'); gr.addColorStop(1,'#c22736');
      g.fillStyle=gr; g.beginPath(); g.arc(cx2,cy2,r,0,7); g.fill();
      g.strokeStyle='#7a4a21'; g.lineWidth=CELL*0.075; g.lineCap='round';
      g.beginPath(); g.moveTo(cx2,cy2-r*.9); g.quadraticCurveTo(cx2+r*.12, cy2-r*1.25, cx2+r*.28, cy2-r*1.38); g.stroke();
      g.fillStyle='#2fb344';
      g.save(); g.translate(cx2+r*.34, cy2-r*1.22); g.rotate(-.7);
      g.beginPath(); g.ellipse(0,0,r*.42,r*.2,0,0,7); g.fill(); g.restore();
      g.fillStyle='rgba(255,255,255,.65)';
      g.beginPath(); g.ellipse(cx2-r*.34, cy2-r*.3, r*.16, r*.26, -.6, 0, 7); g.fill();
      g.restore();
    }
    function drawBonus(cx2, cy2, now){
      const left = bonus.exp-now;
      const blink = left<1400 ? (Math.sin(now/85)>0 ? 1 : .3) : 1;
      const pulse = 1+Math.sin(now/160)*.08;
      const r = CELL*0.38*pulse;
      g.save(); g.globalAlpha = blink;
      g.shadowColor='rgba(255,193,7,.85)'; g.shadowBlur=14;
      const gr = g.createRadialGradient(cx2-r*.3, cy2-r*.35, r*.15, cx2, cy2, r*1.1);
      gr.addColorStop(0,'#fff3b0'); gr.addColorStop(.55,'#ffc107'); gr.addColorStop(1,'#e8960c');
      g.fillStyle=gr; g.beginPath(); g.arc(cx2,cy2,r,0,7); g.fill();
      g.shadowBlur=0;
      g.strokeStyle='rgba(255,255,255,.85)'; g.lineWidth=1.4;
      g.beginPath(); g.arc(cx2,cy2,r*.62,-Math.PI/2, -Math.PI/2 + Math.PI*2*clamp(left/4000,0,1)); g.stroke();
      g.fillStyle='#8a5a00'; g.font='900 '+(CELL*0.5)+'px Vazirmatn, sans-serif';
      g.textAlign='center'; g.textBaseline='middle';
      g.fillText('★', cx2, cy2+1);
      g.restore();
    }
    function drawSnake(now, tv){
      const alive = phase!=='dying' && phase!=='over';
      const pad = prevSnake[prevSnake.length-1];
      const pts = snake.map((s,i)=>{
        const p = prevSnake[i] || pad || s;
        return lerpPt({x:px(p.x), y:px(p.y)}, {x:px(s.x), y:px(s.y)}, alive? tv : 1);
      });
      let ox=0, oy=0;
      if(phase==='dying'){
        const k = clamp(1-(now-dieAt)/620, 0, 1);
        ox = Math.sin(now*0.09)*6*k; oy = Math.cos(now*0.11)*4*k;
      }
      g.save(); g.translate(ox,oy);
      const head = pts[0], tail = pts[pts.length-1];
      g.lineCap='round'; g.lineJoin='round';
      /* dark outline pass */
      g.strokeStyle='rgba(15,80,40,.9)'; g.lineWidth=CELL*0.94;
      g.beginPath(); g.moveTo(pts[0].x, pts[0].y);
      for(let i=1;i<pts.length;i++) g.lineTo(pts[i].x, pts[i].y);
      g.stroke();
      /* gradient body pass */
      let gr;
      const dist = Math.hypot(head.x-tail.x, head.y-tail.y);
      if(dist>2){ gr = g.createLinearGradient(head.x, head.y, tail.x, tail.y); }
      else { gr = g.createLinearGradient(0,0,SIZE,SIZE); }
      gr.addColorStop(0,'#5ee07f'); gr.addColorStop(.5,'#2fb344'); gr.addColorStop(1,'#177a38');
      g.strokeStyle=gr; g.lineWidth=CELL*0.78;
      g.beginPath(); g.moveTo(pts[0].x, pts[0].y);
      for(let i=1;i<pts.length;i++) g.lineTo(pts[i].x, pts[i].y);
      g.stroke();
      /* subtle scale dots on alternating segments */
      g.fillStyle='rgba(255,255,255,.14)';
      for(let i=2;i<pts.length;i+=2){ g.beginPath(); g.arc(pts[i].x, pts[i].y, CELL*0.11, 0, 7); g.fill(); }
      /* ------- cute head ------- */
      const hr = CELL*0.52;
      const hx = head.x + (alive? dir.x*CELL*0.08*tv : 0);
      const hy = head.y + (alive? dir.y*CELL*0.08*tv : 0);
      const grh = g.createRadialGradient(hx-hr*.3, hy-hr*.35, hr*.2, hx, hy, hr*1.1);
      grh.addColorStop(0,'#7ff09a'); grh.addColorStop(1,'#2fb344');
      g.fillStyle=grh; g.beginPath(); g.arc(hx,hy,hr,0,7); g.fill();
      g.strokeStyle='rgba(15,80,40,.85)'; g.lineWidth=CELL*0.1; g.stroke();
      /* tongue flick */
      const tnow = now % 3600;
      if(alive && tnow>tongueAt && tnow<tongueAt+300){
        const tp = clamp((tnow-tongueAt)/300, 0, 1);
        const ext = Math.sin(tp*Math.PI)*CELL*0.55;
        const tx = hx+dir.x*(hr+ext), ty = hy+dir.y*(hr+ext);
        const pxp = -dir.y, pyp = dir.x;
        g.strokeStyle='#ff4d6d'; g.lineWidth=CELL*0.09; g.lineCap='round';
        g.beginPath();
        g.moveTo(hx+dir.x*hr*.8, hy+dir.y*hr*.8); g.lineTo(tx,ty);
        g.moveTo(tx,ty); g.lineTo(tx+pxp*CELL*.13+dir.x*CELL*.12, ty+pyp*CELL*.13+dir.y*CELL*.12);
        g.moveTo(tx,ty); g.lineTo(tx-pxp*CELL*.13+dir.x*CELL*.12, ty-pyp*CELL*.13+dir.y*CELL*.12);
        g.stroke();
      }
      /* eyes look toward movement direction */
      const ex = -dir.y, ey = dir.x;
      const eo = hr*0.48, fo = hr*0.34;
      for(const sgn of [-1,1]){
        const cxE = hx + ex*eo*sgn + dir.x*fo;
        const cyE = hy + ey*eo*sgn + dir.y*fo;
        g.fillStyle='#fff'; g.beginPath(); g.arc(cxE,cyE,hr*0.34,0,7); g.fill();
        g.fillStyle='#14261a'; g.beginPath(); g.arc(cxE+dir.x*hr*0.13, cyE+dir.y*hr*0.13, hr*0.17, 0, 7); g.fill();
        g.fillStyle='rgba(255,255,255,.9)';
        g.beginPath(); g.arc(cxE-dir.x*hr*0.05+ex*hr*0.06, cyE-dir.y*hr*0.05+ey*hr*0.06, hr*0.06, 0, 7); g.fill();
      }
      g.restore();
    }
    function draw(now, tv){
      g.setTransform(dpr,0,0,dpr,0,0);
      /* checkerboard */
      for(let x=0;x<N;x++) for(let y=0;y<N;y++){
        g.fillStyle = (x+y)%2? '#dcf0e3' : '#e7f6ec';
        g.fillRect(x*CELL, y*CELL, CELL, CELL);
      }
      /* soft vignette */
      const vg = g.createRadialGradient(SIZE/2,SIZE/2,SIZE*.35, SIZE/2,SIZE/2,SIZE*.75);
      vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(20,60,35,.1)');
      g.fillStyle=vg; g.fillRect(0,0,SIZE,SIZE);
      if(food) drawApple(px(food.x), px(food.y), now);
      if(bonus) drawBonus(px(bonus.x), px(bonus.y), now);
      drawSnake(now, tv);
      /* floating score texts */
      floats = floats.filter(f=> now-f.t0 < 950);
      for(const f of floats){
        const k = (now-f.t0)/950;
        g.save(); g.globalAlpha = 1-k;
        g.fillStyle = f.gold? '#e8960c' : '#1c7c3d';
        g.font='900 '+(f.gold? CELL*0.72 : CELL*0.62)+'px Vazirmatn, sans-serif';
        g.textAlign='center'; g.textBaseline='middle';
        g.fillText(f.txt, f.x, f.y - CELL*1.1 - k*CELL*1.4);
        g.restore();
      }
      if(flashA>0){
        g.fillStyle='rgba(239,68,68,'+flashA.toFixed(3)+')';
        g.fillRect(0,0,SIZE,SIZE);
      }
    }

    /* ------------------------------- loop ------------------------------ */
    let running = false;
    function loop(now){
      raf = requestAnimationFrame(loop);
      if(flashA>0) flashA = Math.max(0, flashA-0.03);
      if(phase==='run'){
        if(!lastStep) lastStep = now;
        if(now-lastStep >= stepMs){
          lastStep += stepMs;
          if(now-lastStep > stepMs*2) lastStep = now;
          step();
        }
        draw(now, clamp((now-lastStep)/stepMs, 0, 1));
      } else {
        draw(now, 1);
      }
    }
    function startLoop(){ if(!running){ running=true; raf=requestAnimationFrame(loop); } }
    function stopLoop(){ running=false; if(raf){ cancelAnimationFrame(raf); raf=0; } }

    /* ------------------------------ input ------------------------------ */
    const KEYMAP = {ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',s:'down',a:'left',d:'right',W:'up',S:'down',A:'left',D:'right'};
    function onKey(e){
      if(e.key==='p'||e.key==='P'){ togglePause(); e.preventDefault(); return; }
      if((e.key===' '||e.key==='Enter') && phase!=='run'){ startOrRestart(); e.preventDefault(); return; }
      const d = KEYMAP[e.key];
      if(d){ setDir(d); e.preventDefault(); }
    }
    window.addEventListener('keydown', onKey);

    let swipe = null;
    function pDown(e){ swipe = {x:e.clientX, y:e.clientY, used:false}; }
    function pMove(e){
      if(!swipe || swipe.used) return;
      const dx = e.clientX-swipe.x, dy = e.clientY-swipe.y;
      if(Math.hypot(dx,dy) >= 20){
        swipe.used = true;
        setDir(Math.abs(dx)>Math.abs(dy) ? (dx>0?'right':'left') : (dy>0?'down':'up'));
      }
    }
    function pUp(){ swipe = null; }
    cv.addEventListener('pointerdown', e=>{ pDown(e); if(phase!=='run') startOrRestart(); });
    cv.addEventListener('pointermove', pMove);
    window.addEventListener('pointerup', pUp);

    root.querySelectorAll('.pvsnk-dbtn').forEach(b=>{
      b.addEventListener('pointerdown', e=>{ e.preventDefault(); setDir(b.dataset.d); U.vibrate(8); });
    });
    $('#pvsnkGo').addEventListener('click', e=>{ e.stopPropagation(); startOrRestart(); });
    $('#pvsnkPause').addEventListener('click', togglePause);

    const onVis = ()=>{ if(document.hidden && phase==='run') togglePause(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('resize', fit);

    /* ------------------------------- boot ------------------------------ */
    reset();
    hud();
    startLoop();
    ctx.setStatus((diff==='easy'? '⭐' : diff==='hard'? '⭐⭐⭐' : '⭐⭐'));
    ctx.setTurn('🐍 '+t('g.snake'), '');

    return {
      init(){}, start(){},
      pause(){ if(phase==='run') togglePause(); },
      resume(){ if(phase==='pause') startOrRestart(); },
      reset(){ reset(); },
      end(){ stopLoop(); },
      destroy(){ stopLoop(); window.removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('resize', fit); window.removeEventListener('pointerup', pUp); if(finishTO) clearTimeout(finishTO); root.remove(); },
      getState(){ return {phase, score, apples}; },
      getScores(){ return pidScores(score); },
      getStatus(){ return phase==='run'? (tt('score')+': '+fmt(score)) : phase==='pause'? tt('paused') : ''; },
    };
  }
});
})();
