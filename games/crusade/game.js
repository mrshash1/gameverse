/* ============ Game: لرد صلیبی (Stronghold-lite RTS) ============
   • Gold economy → build gold mines → train 4 unit types from the barracks
   • Enemy waves scale up; destroy the enemy keep, defend your own
   • Canvas real-time sim (fixed timestep), speed ×1/×2, pause
   • Solo vs AI (honest: no fake online), 3 difficulties
================================================================= */
(function(){
'use strict';
const PV = window.PV, U = PV.u, t = PV.t;
const { esc, fmt, icon, clamp } = U;

/* roundRect fallback for older browsers */
if(typeof CanvasRenderingContext2D!=='undefined' && !CanvasRenderingContext2D.prototype.roundRect){
  CanvasRenderingContext2D.prototype.roundRect = function(x,y,w,h,r){
    r = Math.min(r||4, w/2, h/2);
    this.moveTo(x+r,y); this.arcTo(x+w,y,x+w,y+h,r); this.arcTo(x+w,y+h,x,y+h,r);
    this.arcTo(x,y+h,x,y,r); this.arcTo(x,y,x+w,y,r); this.closePath();
    return this;
  };
}

const W = 960, H = 520, GROUND = 360;
const UNIT = {
  infantry:{ k:'infantry', cost:40,  hp:60,  dmg:7,  range:30,  speed:36, cd:.8,  r:11 },
  archer:  { k:'archer',   cost:70,  hp:38,  dmg:6,  range:150, speed:30, cd:1.1, r:10 },
  knight:  { k:'knight',   cost:150, hp:170, dmg:15, range:32,  speed:56, cd:.9,  r:13 },
  catapult:{ k:'catapult', cost:200, hp:80,  dmg:22, range:215, speed:15, cd:2.6, r:15 },
};
const MINE_COST = 120, MINE_RATE = 5, BASE_RATE = 8, CAP = 25;
const KEEP_W = 110, KEEP_H = 150;

PV.registry.register({
  id:'crusade', cats:['strategy','classic'], players:[1,1], modes:['solo'],
  weight:82,
  factory: function(ctx){
    const diff = ctx.diff || 'normal';
    const D = diff==='easy'? {budget:.7, keep:520, gap:56, inc:.75}
            : diff==='hard'? {budget:1.35, keep:820, gap:40, inc:1.3}
            : {budget:1, keep:650, gap:48, inc:1};

    let gold = 260, mines = 0, speed = 1, paused = false;
    let units = [], shots = [], fx = [];
    let time = 0, nextWave = D.gap, waveN = 0, kills = 0, dmgDealt = 0;
    let over = false, raf = 0, acc = 0, last = 0;
    let keepHP = {me: 650, en: D.keep};
    let enGold = 150;

    const root = document.createElement('div');
    root.innerHTML = `
      <div class="csb">
        <div class="cs-hud">
          <span class="cs-chip gold">${icon('coin',15)} <b class="num" id="csGold">0</b></span>
          <span class="cs-chip cyan">⛏ +<b class="num" id="csInc">0</b>/s</span>
          <span class="cs-chip">${icon('shield2',15)} <b class="num" id="csArmy">0</b>/${CAP}</span>
          <span class="cs-chip warn" id="csWave">${t('cs.nextWave',{n:0})}</span>
          <span class="spacer"></span>
          <button class="btn sm ghost" id="csSpd">×1</button>
          <button class="btn sm ghost" id="csPse">${t('cs.pause')}</button>
        </div>
        <div class="cs-canvas-wrap"><canvas id="csCv" width="${W}" height="${H}"></canvas></div>
        <div class="cs-keeps">
          <div class="cs-keep"><span>${t('cs.keepHP')} — ${t('c.you')}</span><div class="cs-hpb"><i id="hpMe" style="background:var(--grad-green)"></i></div></div>
          <div class="cs-keep"><span>${t('cs.keepHP')} — ${t('g.bot')}</span><div class="cs-hpb"><i id="hpEn" style="background:var(--grad-fire)"></i></div></div>
        </div>
        <div class="cs-dock">
          <div class="cs-grp">
            <span class="cs-grp-t">⛏ ${t('cs.mine')} <small class="muted">${t('cs.mineD')}</small></span>
            <button class="btn sm cyan" id="bMine">${MINE_COST} 🪙</button>
          </div>
          <div class="cs-grp"><span class="cs-grp-t">🏰 ${t('cs.barracks')}</span>
            <div class="cs-units">
              ${['infantry','archer','knight','catapult'].map(k=>{
                const u = UNIT[k];
                const names = {infantry:t('cs.infantry'), archer:t('cs.archer'), knight:t('cs.knight'), catapult:t('cs.catapult')};
                return `<button class="cs-unit" data-u="${k}" title="HP ${u.hp} · DMG ${u.dmg}">
                  <span class="cs-ui">${{infantry:'🗡',archer:'🏹',knight:'🐴',catapult:'🪨'}[k]}</span>
                  <b>${names[k]}</b><span class="cs-cost">${u.cost} 🪙</span>
                </button>`;
              }).join('')}
            </div>
          </div>
        </div>
        <div class="cs-banner" id="csBanner" style="display:none"></div>
      </div>`;
    ctx.root.appendChild(root);
    const cv = root.querySelector('#csCv'), g = cv.getContext('2d');
    const laneY = ()=> GROUND + 30 + Math.random()*(H-GROUND-55);

    function spawn(side, k){
      const def = UNIT[k];
      if(units.filter(u=>u.side===side).length >= CAP) return false;
      units.push({
        side, k, hp:def.hp, max:def.hp, x: side==='me'? 190+Math.random()*40 : W-190-Math.random()*40,
        y: laneY(), cd: .4+Math.random()*.4, face: side==='me'? 1 : -1, hitT:0, dead:0
      });
      return true;
    }
    function spawnShot(x, y, tx, ty, side, kind, dmg){
      shots.push({x, y, tx, ty, t:0, side, kind, dmg});
    }

    /* --------------------------- simulation step --------------------------- */
    function step(dt){
      time += dt;
      /* economy */
      gold += (BASE_RATE + mines*MINE_RATE) * dt;
      enGold += (BASE_RATE*D.inc) * dt;
      /* enemy planner */
      nextWave -= dt;
      if(nextWave <= 0){
        waveN++;
        nextWave = D.gap;
        banner(t('cs.wave')+' ('+t('cs.waveN',{n:waveN})+')');
        let budget = (70 + waveN*42) * D.budget;
        const types = ['infantry','archer','knight','catapult'];
        let guard = 30;
        while(budget >= 40 && guard-- > 0){
          const k = types[Math.floor(Math.random()*(waveN<2?2:types.length))];
          if(UNIT[k].cost <= budget && spawn('en', k)) budget -= UNIT[k].cost;
          else break;
        }
      }
      /* enemy trickle trainer */
      if(time % 3 < dt){
        const myUnits = units.filter(u=>u.side==='me').length;
        const enUnits = units.filter(u=>u.side==='en').length;
        if(enUnits < Math.min(CAP, 6 + waveN*2) && enGold >= 40){
          const pick = enGold>=200 && Math.random()<.3? 'catapult' : enGold>=150 && Math.random()<.35? 'knight' : Math.random()<.5? 'archer':'infantry';
          if(enGold >= UNIT[pick].cost){ enGold -= UNIT[pick].cost; spawn('en', pick); }
        }
      }
      /* player keep HP regen? none. Units act */
      const keeps = {
        me: {x: 90, w: KEEP_W},
        en: {x: W-90, w: KEEP_W},
      };
      for(const u of units){
        if(u.dead) continue;
        u.cd -= dt; if(u.hitT>0) u.hitT -= dt;
        const foes = units.filter(o=>!o.dead && o.side!==u.side);
        /* nearest foe */
        let tgt = null, best = 1e9;
        for(const o of foes){
          const d = Math.hypot(o.x-u.x, o.y-u.y);
          if(d < best){ best = d; tgt = o; }
        }
        const def = UNIT[u.k];
        const keepX = u.side==='me'? keeps.en.x : keeps.me.x;
        const keepDist = Math.abs(keepX - u.x);
        /* catapult prefers the keep */
        const wantKeep = u.k==='catapult'? true : (!tgt || keepDist < best);
        if(tgt && !wantKeep && best <= def.range){
          if(u.cd <= 0){
            u.cd = def.cd;
            if(u.k==='archer'){ spawnShot(u.x, u.y-14, tgt.x, tgt.y-10, u.side, 'arrow', def.dmg); }
            else { tgt.hp -= def.dmg; tgt.hitT = .18; puff(tgt.x, tgt.y-12, '#ff5c4d'); }
            if(tgt.hp <= 0){ tgt.dead = .9; if(u.side==='me'){ kills++; } }
          }
        } else if(wantKeep && keepDist <= def.range + KEEP_W/2){
          if(u.cd <= 0){
            u.cd = def.cd;
            const dmg = def.dmg * (u.k==='catapult'? 3 : 1);
            if(u.side==='me'){ keepHP.en -= dmg; dmgDealt += dmg; puff(keepX, u.y-20, '#ffb020'); }
            else keepHP.me -= dmg;
            if(u.k==='archer') spawnShot(u.x, u.y-14, keepX, GROUND-40, u.side, 'arrow', 0);
          }
        } else {
          /* march */
          const dir = u.side==='me'? 1 : -1;
          u.x += dir * def.speed * dt;
          /* soft lane separation */
          for(const o of units){
            if(o===u || o.dead || o.side!==u.side) continue;
            if(Math.abs(o.x-u.x)<18 && Math.abs(o.y-u.y)<14){
              u.y += (u.y<o.y? -1:1) * 14 * dt * 4;
            }
          }
          u.y = U.clamp(u.y, GROUND+18, H-24);
        }
      }
      /* projectiles */
      for(const s of shots){
        s.t += dt*3.2;
        if(s.t >= 1 && !s.done){
          s.done = true;
          if(s.kind==='arrow' && s.dmg>0){
            const hit = units.find(o=>!o.dead && o.side!==s.side && Math.hypot(o.x-s.tx, o.y-s.ty)<26);
            if(hit){ hit.hp -= s.dmg; hit.hitT = .18; if(hit.hp<=0){ hit.dead=.9; if(s.side==='me') kills++; } }
          }
        }
      }
      shots = shots.filter(s=>!s.done && s.t<1.2);
      /* deaths & fx */
      for(const u of units){ if(u.dead>0){ u.dead -= dt; } }
      units = units.filter(u=> u.hp>0 || (u.dead!==0 && u.dead>0));
      for(const f of fx){ f.t -= dt; }
      fx = fx.filter(f=>f.t>0);
      /* end conditions */
      if(keepHP.en <= 0 && !over){ over = true; endGame(true); }
      else if(keepHP.me <= 0 && !over){ over = true; endGame(false); }
    }

    function puff(x, y, col){ fx.push({x, y, col, t:.3, max:.3}); }
    let bannerTo = 0;
    function banner(txt){
      const b = root.querySelector('#csBanner');
      b.textContent = txt; b.style.display = 'block';
      clearTimeout(bannerTo);
      bannerTo = setTimeout(()=>{ b.style.display='none'; }, 2600);
    }

    /* ------------------------------ rendering ------------------------------ */
    function draw(){
      /* sky */
      const sky = g.createLinearGradient(0,0,0,GROUND);
      sky.addColorStop(0, '#87c5f2'); sky.addColorStop(1, '#e8d9b8');
      g.fillStyle = sky; g.fillRect(0,0,W,GROUND);
      /* sun + dunes */
      g.fillStyle = 'rgba(255,236,170,.9)'; g.beginPath(); g.arc(W*.78, 70, 34, 0, 7); g.fill();
      g.fillStyle = 'rgba(190,160,110,.35)';
      g.beginPath(); g.ellipse(W*.25, GROUND, 190, 42, 0, Math.PI, 0); g.fill();
      g.beginPath(); g.ellipse(W*.7, GROUND, 240, 54, 0, Math.PI, 0); g.fill();
      /* ground */
      const gr = g.createLinearGradient(0,GROUND,0,H);
      gr.addColorStop(0, '#c9a86a'); gr.addColorStop(1, '#a5884e');
      g.fillStyle = gr; g.fillRect(0,GROUND,W,H-GROUND);
      g.strokeStyle = 'rgba(120,90,50,.25)'; g.lineWidth = 1;
      for(let i=0;i<8;i++){ g.beginPath(); g.moveTo(0, GROUND+18+i*18); g.lineTo(W, GROUND+14+i*18); g.stroke(); }
      /* keeps */
      drawKeep(90, '#7c5cff', keepHP.me/650, 'me');
      drawKeep(W-90, '#b4433a', Math.max(0,keepHP.en)/D.keep, 'en');
      /* mines */
      for(let m=0;m<mines;m++) drawMine(150 + m*64);
      /* barracks marker */
      drawBarracks(180);
      /* shots */
      for(const s of shots){
        const x = s.x + (s.tx-s.x)*s.t, y = s.y + (s.ty-s.y)*s.t + (s.kind==='arrow'? Math.sin(s.t*Math.PI)*-36 : Math.sin(s.t*Math.PI)*-70);
        if(s.kind==='arrow'){
          g.strokeStyle = '#5b4630'; g.lineWidth = 2.2;
          g.beginPath(); g.moveTo(x, y); g.lineTo(x + (s.tx>s.x? 9:-9), y + 2); g.stroke();
        } else {
          g.fillStyle = '#8a8378'; g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill();
        }
      }
      /* units */
      for(const u of [...units].sort((a,b)=>a.y-b.y)){
        if(u.dead>0 && u.dead<.9) continue;
        drawUnit(u);
      }
      /* corpses fade */
      for(const u of units){ if(u.dead>0){ g.globalAlpha = Math.max(0,u.dead); g.fillStyle='#5c4a32'; g.beginPath(); g.ellipse(u.x, u.y+4, 12, 5, 0, 0, 7); g.fill(); g.globalAlpha = 1; } }
      /* fx */
      for(const f of fx){
        g.globalAlpha = Math.max(0, f.t/f.max);
        g.fillStyle = f.col;
        g.beginPath(); g.arc(f.x, f.y, 4 + (1-f.t/f.max)*7, 0, 7); g.fill();
        g.globalAlpha = 1;
      }
      /* wave progress thin bar on top */
      g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0,0,W,5);
      g.fillStyle = '#ffb020'; g.fillRect(0,0, W*(1-nextWave/D.gap), 5);
    }
    function drawKeep(x, col, hpFrac, side){
      const bx = x - KEEP_W/2, by = GROUND - KEEP_H + 40;
      /* main wall */
      g.fillStyle = '#e8e0d0'; g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 2;
      g.fillRect(bx, by, KEEP_W, KEEP_H-40); g.strokeRect(bx, by, KEEP_W, KEEP_H-40);
      /* towers */
      g.fillRect(bx-14, by-26, 26, KEEP_H-40+26); g.strokeRect(bx-14, by-26, 26, KEEP_H-40+26);
      g.fillRect(bx+KEEP_W-12, by-26, 26, KEEP_H-40+26); g.strokeRect(bx+KEEP_W-12, by-26, 26, KEEP_H-40+26);
      /* crenellations */
      g.fillStyle = col;
      for(let i=0;i<5;i++){ g.fillRect(bx+2+i*22, by-12, 13, 12); }
      g.fillRect(bx-14, by-36, 26, 12); g.fillRect(bx+KEEP_W-12, by-36, 26, 12);
      /* gate */
      g.fillStyle = '#6b4f2f';
      g.beginPath(); g.ellipse(x, by+KEEP_H-52, 17, 26, 0, Math.PI, 0); g.fill(); g.fillRect(x-17, by+KEEP_H-52, 34, 28);
      /* banner */
      g.strokeStyle = '#5b4630'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(x, by-36); g.lineTo(x, by-64); g.stroke();
      g.fillStyle = col;
      g.beginPath(); g.moveTo(x, by-64); g.lineTo(x + (side==='me'? 30:-30), by-56); g.lineTo(x, by-48); g.fill();
      /* hp bar */
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(bx-8, by-46, KEEP_W+16, 8);
      g.fillStyle = side==='me'? '#22c55e' : '#ff5c4d';
      g.fillRect(bx-8, by-46, (KEEP_W+16)*U.clamp(hpFrac,0,1), 8);
    }
    function drawMine(x){
      g.fillStyle = '#8a8378'; g.strokeStyle='rgba(0,0,0,.3)';
      g.beginPath(); g.moveTo(x-18, GROUND+8); g.lineTo(x-8, GROUND-22); g.lineTo(x+8, GROUND-22); g.lineTo(x+18, GROUND+8); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#ffd93d';
      g.beginPath(); g.arc(x-5, GROUND-2, 3.4, 0, 7); g.fill();
      g.beginPath(); g.arc(x+6, GROUND+2, 2.6, 0, 7); g.fill();
    }
    function drawBarracks(x){
      g.fillStyle = '#b0885c'; g.strokeStyle='rgba(0,0,0,.28)'; g.lineWidth=2;
      g.fillRect(x-24, GROUND-34, 48, 40); g.strokeRect(x-24, GROUND-34, 48, 40);
      g.fillStyle = '#8a3b2c';
      for(let i=0;i<4;i++) g.fillRect(x-22+i*12, GROUND-40, 8, 8);
      g.fillStyle='#5c4326'; g.fillRect(x-7, GROUND-16, 14, 22);
    }
    function drawUnit(u){
      const def = UNIT[u.k];
      const col = u.side==='me'? '#3b6fd4' : '#b4433a';
      const skin = u.hitT>0? '#fff' : col;
      g.save(); g.translate(u.x, u.y);
      /* shadow */
      g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.ellipse(0, 8, def.r+3, 4.5, 0, 0, 7); g.fill();
      /* body */
      g.fillStyle = skin; g.strokeStyle='rgba(0,0,0,.35)'; g.lineWidth=1.6;
      if(u.k==='knight'){
        g.beginPath(); g.roundRect(-def.r, -16, def.r*2, 22, 6); g.fill(); g.stroke();
        g.fillStyle='#e8e0d0'; g.fillRect(-def.r+3, -13, def.r*2-6, 7);
        g.fillStyle=skin; g.beginPath(); g.arc(0, -20, 6.5, 0, 7); g.fill(); g.stroke();
        g.fillStyle='#ffb020'; g.fillRect(-7, -24, 14, 3.4);
      } else if(u.k==='catapult'){
        g.fillStyle='#7a5c38'; g.beginPath(); g.roundRect(-15, -10, 30, 12, 4); g.fill(); g.stroke();
        g.strokeStyle='#4c3a20'; g.lineWidth=3.4;
        g.beginPath(); g.moveTo(-4,-10); g.lineTo(u.face*10, -26); g.stroke();
        g.fillStyle='#555'; g.beginPath(); g.arc(u.face*10, -26, 4, 0, 7); g.fill();
      } else {
        g.beginPath(); g.arc(0, -8, def.r-2, 0, 7); g.fill(); g.stroke();
        /* head */
        g.fillStyle = '#ffe0c2'; g.beginPath(); g.arc(0, -17, 5.4, 0, 7); g.fill();
        /* weapon */
        g.strokeStyle = '#4c3a20'; g.lineWidth = 2.4;
        if(u.k==='archer'){
          g.beginPath(); g.arc(u.face*8, -12, 8, -1.2, 1.2); g.stroke();
          g.strokeStyle='#d8c9a0'; g.lineWidth=1;
          g.beginPath(); g.moveTo(u.face*8+Math.cos(-1.2)*8, -12+Math.sin(-1.2)*8); g.lineTo(u.face*8+Math.cos(1.2)*8, -12+Math.sin(1.2)*8); g.stroke();
        } else {
          g.beginPath(); g.moveTo(u.face*6, -10); g.lineTo(u.face*15, -22); g.stroke();
          g.fillStyle='#c9ccd4'; g.beginPath(); g.moveTo(u.face*15, -26); g.lineTo(u.face*11, -20); g.lineTo(u.face*19, -20); g.fill();
        }
      }
      g.restore();
      /* hp bar */
      if(u.hp < u.max){
        g.fillStyle='rgba(0,0,0,.4)'; g.fillRect(u.x-11, u.y-30, 22, 3.6);
        g.fillStyle = u.side==='me'? '#22c55e':'#ff5c4d';
        g.fillRect(u.x-11, u.y-30, 22*U.clamp(u.hp/u.max,0,1), 3.6);
      }
    }

    /* --------------------------- HUD + loop ------------------------------- */
    function hud(){
      root.querySelector('#csGold').textContent = U.fmtEn(Math.floor(gold));
      root.querySelector('#csInc').textContent = Math.round(BASE_RATE + mines*MINE_RATE);
      root.querySelector('#csArmy').textContent = units.filter(u=>u.side==='me' && !u.dead).length;
      root.querySelector('#csWave').textContent = t('cs.nextWave',{n:Math.ceil(Math.max(0,nextWave))});
      root.querySelector('#hpMe').style.width = U.clamp(keepHP.me/650*100,0,100)+'%';
      root.querySelector('#hpEn').style.width = U.clamp(Math.max(0,keepHP.en)/D.keep*100,0,100)+'%';
    }
    function loop(ts){
      if(over) return;
      raf = requestAnimationFrame(loop);
      if(!last) last = ts;
      let frame = Math.min(100, ts-last); last = ts;
      if(!paused){
        acc += frame * speed;
        const STEP = 50;
        let guard = 8;
        while(acc >= STEP && guard-- > 0){ step(STEP/1000); acc -= STEP; }
      }
      draw(); hud();
    }

    function endGame(win){
      cancelAnimationFrame(raf);
      const score = Math.round(dmgDealt/4 + kills*25 + (win? 800:0));
      ctx.setTurn(win? t('pl.victory'):t('pl.defeat'), win?'win':'lose');
      PV.sound.play(win? 'win':'lose');
      setTimeout(()=>ctx.finish({
        res: win? 'w':'l', vsHuman:false,
        scores: {[ctx.selfPid]: score, me: score},
        sub: win? t('cs.destroyed') : t('cs.lost'),
        stats: {kills}
      }), 900);
    }

    /* ------------------------------ wiring -------------------------------- */
    root.querySelector('#bMine').onclick = ()=>{
      if(mines>=3){ PV.ui.toast(t('cs.full'),'info'); return; }
      if(gold < MINE_COST){ PV.ui.toast(t('cs.needGold'),'err'); return; }
      gold -= MINE_COST; mines++; PV.sound.play('place'); U.vibrate();
    };
    root.querySelectorAll('[data-u]').forEach(b=> b.onclick = ()=>{
      const k = b.dataset.u, def = UNIT[k];
      if(units.filter(u=>u.side==='me' && !u.dead).length >= CAP){ PV.ui.toast(t('cs.full'),'err'); return; }
      if(gold < def.cost){ PV.ui.toast(t('cs.needGold'),'err'); return; }
      gold -= def.cost; spawn('me', k); PV.sound.play('pop'); U.vibrate();
    });
    const spdBtn = root.querySelector('#csSpd');
    spdBtn.onclick = ()=>{ speed = speed===1? 2:1; spdBtn.textContent = '×'+speed; };
    const pseBtn = root.querySelector('#csPse');
    pseBtn.onclick = ()=>{ paused = !paused; pseBtn.textContent = paused? t('cs.resume'):t('cs.pause'); };

    raf = requestAnimationFrame(loop);

    return {
      init(){}, start(){},
      getState(){ return {gold:Math.floor(gold), mines, wave:waveN, kills}; },
      getScores(){ return {[ctx.selfPid]: Math.round(dmgDealt/4 + kills*25 + (keepHP.en<=0?800:0))}; },
      getStatus(){ return paused? t('cs.pause') : (over? '' : t('cs.nextWave',{n:Math.ceil(Math.max(0,nextWave))})); },
      pause(){ paused = true; }, resume(){ paused = false; },
      end(){ over = true; cancelAnimationFrame(raf); },
      destroy(){ over = true; cancelAnimationFrame(raf); clearTimeout(bannerTo); root.remove(); },
      reset(){ /* restart via sdk again */ },
    };
  }
});
})();
