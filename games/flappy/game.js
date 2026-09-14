/* ============ Game: پرنده جهنده (Flappy) — premium canvas arcade ============
   • Gravity/flap physics with terminal clamp, tuned per difficulty
   • Bird: round yellow body, 3-frame wing, rotation follows velocity
   • Pipes with cap rims; gap/speed per diff; parallax clouds + city + ground
   • Sky morphs day → sunset → night (every 10 pts) with stars & twinkle
   • Score pop + sounds; medals 🥉10 🥈20 🥇30 💎40 on the game-over card
============================================================================ */
(function(){
'use strict';
const PV = window.PV, U = PV.u, t = PV.t;
const { clamp, fmt } = U;

const LANG = ()=> (PV.i18n && PV.i18n.lang) || 'fa';
const L = {
  fa:{
    ready:'آماده؟', readySub:'هر جا لمس کن تا بال بزند', tap:'بزن!',
    over:'آخ! خوردی!', score:'امتیاز', best:'رکورد', again:'دوباره',
    newBest:'رکورد جدید!', medal:'مدال', fly:'پرواز کن',
  },
  en:{
    ready:'Ready?', readySub:'Tap anywhere to flap', tap:'TAP!',
    over:'Crashed!', score:'Score', best:'Best', again:'Again',
    newBest:'New record!', medal:'Medal', fly:'Fly',
  },
};
const tt = k => (L[LANG()] && L[LANG()][k]) || L.fa[k] || k;

PV.registry.register({
  id:'flappy', cats:['speed','party'], players:[1,1], modes:['solo'], weight:77,
  factory: function(ctx){
    /* ------------------------------ setup ------------------------------ */
    const W = 340, H = 520, GROUND = 64, PIPE_W = 62, BIRD_X = 92, R = 13;
    const diff = ctx.diff || 'normal';
    const D = diff==='easy'? {gap:170, grav:1620, jump:-505, spd:128}
            : diff==='hard'? {gap:130, grav:1950, jump:-535, spd:152}
            : {gap:150, grav:1800, jump:-520, spd:140};
    const TERM = 760;
    const meP = (PV.store && PV.store.me && PV.store.me()) || null;
    const uk = (meP && meP.u) || 'guest';
    const BEST_KEY = 'best:flappy:'+uk;
    let best = U.LS.get(BEST_KEY, 0) || 0;
    const rng = ctx.rng || Math.random;

    /* ------------------------------ state ------------------------------ */
    let y, vy, rot, wingT, pipes, nextSpawn, speed, score, phase, flash;
    let groundOff, cloudOff, cityOff, dieT, overTO, finished, lastTs, newBestFlag;
    let clouds, city, stars;

    function buildScenery(){
      clouds = []; city = [];
      for(let i=0;i<6;i++) clouds.push({x:rng()*W, y:30+rng()*180, s:.6+rng()*.8, spd:9+rng()*10});
      let bx = -30;
      while(bx < W+80){
        const bw = 18+rng()*30, bh = 40+rng()*95;
        city.push({x:bx, w:bw, h:bh, win:Math.floor(rng()*3)});
        bx += bw + 4+rng()*14;
      }
      stars = [];
      for(let i=0;i<42;i++) stars.push({x:rng()*W, y:rng()*(H-GROUND-60), r:.6+rng()*1.1, tw:rng()*6});
    }
    function reset(){
      y = H*0.42; vy = 0; rot = 0; wingT = 0;
      pipes = []; nextSpawn = 90; speed = D.spd; score = 0;
      phase = 'ready'; flash = 0; groundOff = 0; cloudOff = 0; cityOff = 0;
      dieT = 0; finished = false; lastTs = 0; newBestFlag = false;
      flashEl.style.opacity = '0';
      if(overTO){ clearTimeout(overTO); overTO = null; }
      buildScenery();
      scoreChip(false); showOv('ready');
    }

    /* ------------------------------- DOM ------------------------------- */
    const root = document.createElement('div');
    root.innerHTML = `
<style>
.pvflp-wrap{display:flex;flex-direction:column;align-items:center;gap:10px;width:100%;padding:2px 0 8px;font-family:inherit}
.pvflp-stage{position:relative;line-height:0;border-radius:22px;overflow:hidden;box-shadow:var(--sh-3),0 0 0 1.5px var(--border);cursor:pointer;touch-action:manipulation;user-select:none;-webkit-user-select:none}
.pvflp-cv{display:block;border-radius:22px}
.pvflp-score{position:absolute;top:14px;left:50%;transform:translateX(-50%);z-index:4;pointer-events:none;
  font-size:2rem;font-weight:900;color:#fff;-webkit-text-stroke:1.5px rgba(30,40,80,.55);text-shadow:0 4px 14px rgba(0,0,0,.3);
  font-variant-numeric:tabular-nums;line-height:1.1;opacity:.95}
.pvflp-score.pop{animation:pvflp-pop .38s cubic-bezier(.34,1.8,.64,1)}
@keyframes pvflp-pop{0%{transform:translateX(-50%) scale(1)}40%{transform:translateX(-50%) scale(1.45)}100%{transform:translateX(-50%) scale(1)}}
.pvflp-flash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:3}
.pvflp-ov{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:5;
  opacity:0;pointer-events:none;transition:opacity .25s;background:rgba(15,25,50,.34);backdrop-filter:blur(2px)}
.pvflp-ov.on{opacity:1;pointer-events:auto}
.pvflp-card{background:var(--surface);border-radius:22px;padding:20px 28px;text-align:center;min-width:216px;
  box-shadow:var(--sh-3);transform:translateY(16px) scale(.93);transition:transform .3s cubic-bezier(.34,1.56,.64,1)}
.pvflp-ov.on .pvflp-card{transform:translateY(0) scale(1)}
.pvflp-rt{font-size:1.5rem;font-weight:900;animation:pvflp-bob 1.15s ease-in-out infinite}
@keyframes pvflp-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
.pvflp-rs{font-size:.84rem;color:var(--tx2);margin-top:4px}
.pvflp-taphint{margin-top:16px;display:flex;flex-direction:column;align-items:center;gap:8px;color:var(--p1);font-weight:900}
.pvflp-ring{width:46px;height:46px;border-radius:50%;border:3px solid var(--p1);display:flex;align-items:center;justify-content:center;font-size:1.15rem;position:relative}
.pvflp-ring::after{content:'';position:absolute;inset:-9px;border-radius:50%;border:2.5px solid var(--p1);opacity:.55;animation:pvflp-ring 1.25s ease-out infinite}
@keyframes pvflp-ring{0%{transform:scale(.55);opacity:.75}100%{transform:scale(1.25);opacity:0}}
.pvflp-medal{font-size:2.6rem;line-height:1.25;animation:pvflp-bob 1.5s ease-in-out infinite}
.pvflp-ot{font-weight:900;font-size:1.12rem;margin-top:4px}
.pvflp-ocore{display:flex;justify-content:center;gap:18px;margin:10px 0 14px}
.pvflp-ocore>div{display:flex;flex-direction:column;align-items:center}
.pvflp-ocore b{font-size:1.45rem;font-variant-numeric:tabular-nums;background:var(--grad-p);-webkit-background-clip:text;background-clip:text;color:transparent}
.pvflp-ocore span{font-size:.72rem;color:var(--tx3);font-weight:700}
.pvflp-newbest{display:inline-block;background:var(--grad-gold);color:#fff;border-radius:999px;padding:3px 13px;font-size:.78rem;font-weight:900;margin-bottom:8px;animation:pvflp-shine 1.1s ease-in-out infinite}
@keyframes pvflp-shine{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
.pvflp-gobtn{background:var(--grad-p);color:#fff;border:none;border-radius:14px;padding:10px 30px;font-weight:900;font-size:1rem;box-shadow:var(--sh-p);cursor:pointer;transition:transform .15s}
.pvflp-gobtn:active{transform:scale(.93)}
.pvflp-hudrow{display:flex;align-items:center;gap:8px;justify-content:center;width:min(92vw,360px)}
.pvflp-chip{display:inline-flex;align-items:center;gap:6px;background:var(--surface2);border:1.5px solid var(--border);border-radius:999px;padding:4px 13px;font-size:.84rem;font-weight:800;box-shadow:var(--sh-1)}
.pvflp-chip b{font-variant-numeric:tabular-nums}
</style>
<div class="pvflp-wrap">
  <div class="pvflp-hudrow">
    <span class="pvflp-chip">🏆 <b id="pvflpBest">۰</b></span>
    <span class="pvflp-chip" id="pvflpDiff">⭐⭐</span>
    <span class="pvflp-chip" id="pvflpPhase">☀️</span>
  </div>
  <div class="pvflp-stage" id="pvflpStage">
    <canvas class="pvflp-cv" id="pvflpCv" width="${W}" height="${H}"></canvas>
    <div class="pvflp-flash" id="pvflpFlash"></div>
    <div class="pvflp-score num" id="pvflpScore">۰</div>
    <div class="pvflp-ov" id="pvflpOv">
      <div class="pvflp-card">
        <div id="pvflpReadyBox">
          <div class="pvflp-rt">${tt('ready')}</div>
          <div class="pvflp-rs">${tt('readySub')}</div>
          <div class="pvflp-taphint"><div class="pvflp-ring">👆</div>${tt('tap')}</div>
        </div>
        <div id="pvflpOverBox" style="display:none">
          <div class="pvflp-medal" id="pvflpMedal">🥉</div>
          <div class="pvflp-ot">${tt('over')}</div>
          <div class="pvflp-newbest" id="pvflpNewbest" style="display:none">${tt('newBest')}</div>
          <div class="pvflp-ocore">
            <div><b class="num" id="pvflpOscore">۰</b><span>${tt('score')}</span></div>
            <div><b class="num" id="pvflpObest">۰</b><span>${tt('best')}</span></div>
          </div>
          <button class="pvflp-gobtn" id="pvflpGo">🔄 ${tt('again')}</button>
        </div>
      </div>
    </div>
  </div>
</div>`;
    ctx.root.appendChild(root);
    const $ = s => root.querySelector(s);
    const cv = $('#pvflpCv'), g = cv.getContext('2d');
    const stage = $('#pvflpStage'), ov = $('#pvflpOv'), scoreEl = $('#pvflpScore'), flashEl = $('#pvflpFlash');
    let dpr = 1;

    function fit(){
      const cssW = Math.min(window.innerWidth*0.92, 340, (window.innerHeight*0.66)*(W/H));
      const cssH = cssW*(H/W);
      cv.style.width = cssW+'px'; cv.style.height = cssH+'px';
      dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(W*dpr); cv.height = Math.round(H*dpr);
    }
    fit();

    /* ----------------------------- helpers ----------------------------- */
    function pidScores(v){
      const out = {}; out[ctx.selfPid] = v;
      const p0 = (ctx.players||[])[0];
      if(p0 && p0.pid && p0.pid!==ctx.selfPid) out[p0.pid] = v;
      return out;
    }
    function medalOf(s){ return s>=40? '💎' : s>=30? '🥇' : s>=20? '🥈' : s>=10? '🥉' : '🍂'; }
    function scoreChip(pop){
      scoreEl.textContent = fmt(score);
      if(pop){ scoreEl.classList.remove('pop'); void scoreEl.offsetWidth; scoreEl.classList.add('pop'); }
    }
    function showOv(kind){
      if(kind==='none'){ ov.classList.remove('on'); return; }
      $('#pvflpReadyBox').style.display = kind==='ready'? '' : 'none';
      $('#pvflpOverBox').style.display = kind==='over'? '' : 'none';
      if(kind==='over'){
        $('#pvflpMedal').textContent = medalOf(score);
        $('#pvflpOscore').textContent = fmt(score);
        $('#pvflpObest').textContent = fmt(best);
        $('#pvflpNewbest').style.display = newBestFlag? 'inline-block' : 'none';
      }
      ov.classList.add('on');
    }
    function flap(){
      if(phase==='ready'){ phase='run'; showOv('none'); PV.sound.play('go'); }
      if(phase!=='run') return;
      vy = D.jump; wingT = 0.28;
      PV.sound.play('flip'); U.vibrate(8);
    }
    function die(){
      if(phase!=='run') return;
      phase='dying'; dieT=0; flash=1;
      PV.sound.play('falseStart'); U.vibrate([50,40,90]);
      newBestFlag = score>best && score>0;
      if(newBestFlag){ best=score; U.LS.set(BEST_KEY, best); }
      $('#pvflpBest').textContent = fmt(best);
    }
    function landDeath(){
      phase='over';
      showOv('over');
      if(!finished){
        finished = true;
        overTO = setTimeout(()=>ctx.finish({
          res:'w', scores:pidScores(score), stats:{best:score}, vsHuman:false,
          sub: tt('score')+': '+fmt(score),
        }), 1500);
      }
    }

    /* ------------------------------ physics ---------------------------- */
    function spawnPipe(){
      const m = 54;
      const gapY = m + D.gap/2 + rng()*(H-GROUND-2*m-D.gap);
      pipes.push({x:W+30, gapY, passed:false});
    }
    function step(dt){
      wingT = Math.max(0, wingT-dt);
      speed = Math.min(232, D.spd + score*2.2);
      groundOff = (groundOff + speed*dt) % 26;
      cloudOff += dt;
      if(phase==='ready'){
        y = H*0.42 + Math.sin(performance.now()/300)*7;
        rot = Math.sin(performance.now()/300+1)*0.08;
        return;
      }
      vy = Math.min(TERM, vy + D.grav*dt);
      y += vy*dt;
      const targetRot = vy<0? clamp(vy*0.00052, -0.44, 0) : clamp(vy*0.0016, 0, 1.5);
      rot += (targetRot-rot)*Math.min(1, dt*(vy<0? 14 : 7));
      if(y < R+2){ y = R+2; vy = Math.max(vy, 0); }
      /* pipes */
      nextSpawn -= speed*dt;
      if(nextSpawn<=0){ spawnPipe(); nextSpawn += 220; }
      for(const p of pipes) p.x -= speed*dt;
      pipes = pipes.filter(p=> p.x > -PIPE_W-10);
      if(phase==='run'){
        for(const p of pipes){
          if(!p.passed && p.x+PIPE_W < BIRD_X-R){
            p.passed = true; score++;
            scoreChip(true);
            PV.sound.play('coin'); U.vibrate(10);
            if(score%10===0){ PV.sound.play('ach'); U.vibrate(30); }
            $('#pvflpPhase').textContent = score<10? '☀️' : score<20? '🌇' : '🌙';
          }
          if(circleRect(BIRD_X, y, R*0.86, p.x, -20, PIPE_W, p.gapY-D.gap/2+20) ||
             circleRect(BIRD_X, y, R*0.86, p.x, p.gapY+D.gap/2, PIPE_W, H)){ die(); }
        }
        if(y >= H-GROUND-R){ die(); }
      }
      if(phase==='dying'){
        dieT += dt;
        rot = Math.min(1.62, rot + dt*7);
        if(y >= H-GROUND-R*0.6){ y = H-GROUND-R*0.6; vy = 0; landDeath(); }
      }
    }
    function circleRect(cx2, cy2, r2, rx, ry, rw, rh){
      const nx = clamp(cx2, rx, rx+rw), ny = clamp(cy2, ry, ry+rh);
      return (cx2-nx)*(cx2-nx)+(cy2-ny)*(cy2-ny) < r2*r2;
    }

    /* ------------------------------ render ----------------------------- */
    function lerpC(a,b,tv){ return [0,1,2].map(i=> Math.round(a[i]+(b[i]-a[i])*tv)); }
    const SKY = [
      {top:[126,205,255], bot:[233,249,255], city:[92,130,190], sun:'#ffe066'},   /* day */
      {top:[244,150,92],  bot:[255,214,160], city:[120,80,130],  sun:'#ff9040'},  /* sunset */
      {top:[24,32,86],    bot:[64,48,112],   city:[28,30,66],    sun:'#f4f1de'},  /* night */
    ];
    function skyAt(){
      const ttv = Math.min(2, score/10);
      const a = SKY[Math.min(1, Math.floor(ttv))], b = SKY[Math.min(2, Math.ceil(ttv))];
      const tv = ttv - Math.floor(ttv);
      return {
        top: lerpC(a.top,b.top,tv), bot: lerpC(a.bot,b.bot,tv),
        city: lerpC(a.city,b.city,tv),
        night: clamp(ttv-1.15, 0, 1),
      };
    }
    function rgb(c){ return 'rgb('+c[0]+','+c[1]+','+c[2]+')'; }
    function draw(now){
      g.setTransform(dpr,0,0,dpr,0,0);
      const sky = skyAt();
      const grad = g.createLinearGradient(0,0,0,H-GROUND);
      grad.addColorStop(0, rgb(sky.top)); grad.addColorStop(1, rgb(sky.bot));
      g.fillStyle = grad; g.fillRect(0,0,W,H);
      /* stars at night */
      if(sky.night>0){
        for(const s of stars){
          g.globalAlpha = sky.night * (0.45+0.55*Math.abs(Math.sin(now/700+s.tw)));
          g.fillStyle = '#fff';
          g.beginPath(); g.arc(s.x, s.y, s.r, 0, 7); g.fill();
        }
        g.globalAlpha = 1;
        /* moon */
        g.fillStyle='rgba(244,241,222,.92)';
        g.beginPath(); g.arc(W-52, 64, 17, 0, 7); g.fill();
        g.fillStyle = rgb(sky.top);
        g.beginPath(); g.arc(W-45, 58, 14, 0, 7); g.fill();
      } else {
        /* sun */
        g.fillStyle='rgba(255,224,102,.95)';
        g.beginPath(); g.arc(W-52, 60, 18, 0, 7); g.fill();
        g.fillStyle='rgba(255,236,150,.4)';
        g.beginPath(); g.arc(W-52, 60, 27, 0, 7); g.fill();
      }
      /* clouds (parallax slow) */
      g.fillStyle = 'rgba(255,255,255,'+(0.82 - sky.night*0.45)+')';
      for(const c of clouds){
        const cx2 = ((c.x - cloudOff*c.spd) % (W+140) + (W+140)) % (W+140) - 70;
        const cy2 = c.y, s2 = c.s;
        g.beginPath();
        g.arc(cx2, cy2, 13*s2, 0, 7);
        g.arc(cx2+13*s2, cy2+3*s2, 10*s2, 0, 7);
        g.arc(cx2-13*s2, cy2+4*s2, 9*s2, 0, 7);
        g.arc(cx2+3*s2, cy2-8*s2, 10*s2, 0, 7);
        g.fill();
      }
      /* city silhouette (mid parallax) */
      const cOff = (performance.now()*0.018) % 9999;
      g.fillStyle = 'rgba('+sky.city[0]+','+sky.city[1]+','+sky.city[2]+','+(0.5+sky.night*0.4)+')';
      for(let rep=-1; rep<=1; rep++){
        for(const b of city){
          const bx = b.x + rep*W - (cOff % W);
          g.fillRect(bx, H-GROUND-b.h, b.w, b.h);
          if(sky.night>0.15){
            g.fillStyle = 'rgba(255,214,120,'+(sky.night*0.75)+')';
            const wx = bx+4, wy = H-GROUND-b.h+7;
            for(let wy2=wy; wy2<H-GROUND-8; wy2+=12){
              for(let wx2=wx; wx2<bx+b.w-5; wx2+=10){
                if(((wx2*7+wy2*13+b.win)%5)<2) g.fillRect(wx2, wy2, 3.5, 5);
              }
            }
            g.fillStyle = 'rgba('+sky.city[0]+','+sky.city[1]+','+sky.city[2]+','+(0.5+sky.night*0.4)+')';
          }
        }
      }
      /* pipes */
      for(const p of pipes){
        const topH = p.gapY-D.gap/2, botY = p.gapY+D.gap/2;
        drawPipe(p.x, 0, topH, true);
        drawPipe(p.x, botY, H-GROUND-botY, false);
      }
      drawBird(now);
      /* ground strip */
      const gg = g.createLinearGradient(0,H-GROUND,0,H);
      gg.addColorStop(0,'#e8c98a'); gg.addColorStop(.16,'#d9b36c'); gg.addColorStop(1,'#b98d4b');
      g.fillStyle = gg; g.fillRect(0, H-GROUND, W, GROUND);
      g.fillStyle = '#7ec850'; g.fillRect(0, H-GROUND, W, 9);
      g.fillStyle = '#5da83a';
      for(let x=-26; x<W+26; x+=26){
        const gx = x - groundOff;
        g.beginPath(); g.moveTo(gx, H-GROUND+9); g.lineTo(gx+13, H-GROUND+9); g.lineTo(gx+6.5, H-GROUND+1); g.closePath(); g.fill();
      }
      g.fillStyle = 'rgba(120,80,30,.25)';
      for(let x=-52; x<W+52; x+=52) g.fillRect(x - groundOff, H-GROUND+22, 26, 4);
      /* white death flash */
      if(flash>0){ g.fillStyle='rgba(255,255,255,'+flash.toFixed(3)+')'; g.fillRect(0,0,W,H); }
    }
    function drawPipe(x, py, ph, isTop){
      if(ph<=0) return;
      const grad = g.createLinearGradient(x, 0, x+PIPE_W, 0);
      grad.addColorStop(0,'#3f9e42'); grad.addColorStop(.28,'#6fd06f'); grad.addColorStop(.62,'#4cb04e'); grad.addColorStop(1,'#2c7a30');
      g.fillStyle = grad; g.fillRect(x, py, PIPE_W, ph);
      g.strokeStyle = 'rgba(20,70,25,.65)'; g.lineWidth = 2;
      g.strokeRect(x+1, py-2, PIPE_W-2, ph+4);
      /* cap rim */
      const capH = 24, capW = PIPE_W+12;
      const capY = isTop? py+ph-capH : py;
      const cg = g.createLinearGradient(x-6, 0, x+capW-6, 0);
      cg.addColorStop(0,'#3f9e42'); cg.addColorStop(.3,'#77d877'); cg.addColorStop(.65,'#4cb04e'); cg.addColorStop(1,'#256b29');
      g.fillStyle = cg; g.fillRect(x-6, capY, capW, capH);
      g.strokeStyle = 'rgba(20,70,25,.7)'; g.strokeRect(x-5, capY+1, capW-2, capH-2);
      g.fillStyle = 'rgba(255,255,255,.22)';
      g.fillRect(x+8, py+6, 7, Math.max(0, ph-12));
    }
    function drawBird(now){
      const bx = BIRD_X, by = y;
      g.save();
      g.translate(bx, by); g.rotate(rot);
      const flapK = wingT>0 ? (0.28-wingT)/0.28 : 0;
      const frame = wingT>0 ? (Math.floor(flapK*3)%3) : 1;
      const wingAng = [-0.85, 0, 0.85][wingT>0? frame : 1] * (wingT>0? 1 : Math.sin(now/240)*0.25);
      /* body */
      const bg = g.createRadialGradient(-3,-4,3, 0,0,R+5);
      bg.addColorStop(0,'#ffe680'); bg.addColorStop(.65,'#ffd23b'); bg.addColorStop(1,'#f0b429');
      g.fillStyle = bg;
      g.beginPath(); g.ellipse(0, 0, R+4, R+1, 0, 0, 7); g.fill();
      g.strokeStyle = 'rgba(140,90,10,.75)'; g.lineWidth = 2; g.stroke();
      /* belly */
      g.fillStyle = '#fff3c4';
      g.beginPath(); g.ellipse(1, 6, R*0.62, R*0.42, 0, 0, 7); g.fill();
      /* tail */
      g.fillStyle = '#f0b429';
      g.beginPath(); g.moveTo(-R-1, -2); g.lineTo(-R-9, -6); g.lineTo(-R-8, 3); g.closePath(); g.fill();
      /* wing (3-frame) */
      g.save(); g.translate(-2, 1); g.rotate(wingAng);
      g.fillStyle = '#fff8dc';
      g.beginPath(); g.ellipse(-2, 0, 9.5, 5.5, -0.25, 0, 7); g.fill();
      g.strokeStyle = 'rgba(140,90,10,.5)'; g.lineWidth = 1.4; g.stroke();
      g.restore();
      /* beak */
      g.fillStyle = '#ff8c42';
      g.beginPath(); g.moveTo(R-2, -2); g.lineTo(R+9, 1); g.lineTo(R-2, 5); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(160,70,10,.6)'; g.lineWidth = 1.2; g.stroke();
      /* eye */
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(R*0.42, -R*0.42, 4.6, 0, 7); g.fill();
      g.strokeStyle = 'rgba(140,90,10,.4)'; g.lineWidth = 1; g.stroke();
      const dead = phase==='dying'||phase==='over';
      g.fillStyle = dead? '#31343f' : '#22262e';
      g.beginPath(); g.arc(R*0.55, -R*0.42, dead? 2 : 2.3, 0, 7); g.fill();
      if(!dead){ g.fillStyle='#fff'; g.beginPath(); g.arc(R*0.62, -R*0.52, 0.9, 0, 7); g.fill(); }
      g.restore();
    }

    /* ------------------------------- loop ------------------------------ */
    let raf = 0, running = false;
    function loop(ts){
      raf = requestAnimationFrame(loop);
      if(!lastTs) lastTs = ts;
      let dt = (ts-lastTs)/1000; lastTs = ts;
      dt = Math.min(dt, 0.033);
      if(phase==='run' || phase==='ready' || phase==='dying') step(dt);
      if(flash>0){ flash = Math.max(0, flash-0.06); flashEl.style.opacity = flash.toFixed(2); }
      draw(ts);
    }
    function startLoop(){ if(!running){ running=true; lastTs=0; raf=requestAnimationFrame(loop); } }
    function stopLoop(){ running=false; if(raf){ cancelAnimationFrame(raf); raf=0; } }

    /* ------------------------------ input ------------------------------ */
    function onKey(e){
      if(e.code==='Space' || e.key===' ' || e.key==='ArrowUp'){
        e.preventDefault();
        if(phase==='ready' || phase==='run') flap();
        else if(phase==='over') restart();
      }
    }
    function restart(){
      if(overTO){ clearTimeout(overTO); overTO=null; }
      reset();
      phase='run'; showOv('none'); PV.sound.play('go');
    }
    stage.addEventListener('pointerdown', e=>{
      if(phase==='ready' || phase==='run') flap();
    });
    $('#pvflpGo').addEventListener('click', e=>{ e.stopPropagation(); restart(); });
    window.addEventListener('keydown', onKey);
    const onVis = ()=>{ if(document.hidden && phase==='run'){ die(); } };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('resize', fit);

    /* ------------------------------- boot ------------------------------ */
    reset();
    $('#pvflpBest').textContent = fmt(best);
    $('#pvflpDiff').textContent = diff==='easy'? '⭐' : diff==='hard'? '⭐⭐⭐' : '⭐⭐';
    startLoop();
    ctx.setStatus('🐦 '+tt('fly'));
    ctx.setTurn('🐦 '+t('g.flappy'), '');

    return {
      init(){}, start(){},
      pause(){}, resume(){},
      reset(){ restart(); },
      end(){ stopLoop(); },
      destroy(){ stopLoop(); window.removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('resize', fit); if(overTO) clearTimeout(overTO); root.remove(); },
      getState(){ return {phase, score, y:Math.round(y)}; },
      getScores(){ return pidScores(score); },
      getStatus(){ return phase==='run'? (tt('score')+': '+fmt(score)) : ''; },
    };
  }
});
})();
