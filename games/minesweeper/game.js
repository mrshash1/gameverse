/* ============ Game: Minesweeper — مین‌یاب کلاسیک پرمیوم ============
   • آسان 9x9/10 · متوسط 16x16/40 · سخت 30x16/99 (اسکرول افقی در موبایل)
   • اولین کلیک همیشه امن · موج آبشاری ۱۵ms · شورد (chord) · پرچم با لمس طولانی ۴۵۰ms
   • پالت کلاسیک اعداد · LED HUD · فیسبوک ایموجی · رکورد بهترین زمان per diff
================================================================== */
(function(){
'use strict';
const PV = window.PV, U = PV.u;
const { fmt } = U;

/* --------------------------- local dict --------------------------- */
const lang = (PV.i18n && PV.i18n.lang) || 'fa';
const L = {
  fa:{ easy:'آسان', normal:'متوسط', hard:'سخت',
    restart:'شروع دوباره', best:'رکورد', sec:'ثانیه', minesLeft:'ماین',
    paused:'مکث — برای ادامه برگرد ⏸',
    stFirst:'برای شروع یک خانه را لمس کن 👆', stPlay:'میدان مین فعال است — هوشیار باش!',
    newRec:'رکورد جدید! 🏅', winTurn:'😎 همه‌ی خانه‌های امن باز شد!',
    winSub:'زمان: {n} ثانیه', loseSub:'بووم! به مین خوردی 💥', loseTurn:'💥 انفجار!',
    hintFlag:'لمس طولانی یا راست‌کلیک = پرچم · دوضربه روی عدد = بازکردن اطراف' },
  en:{ easy:'Easy', normal:'Medium', hard:'Hard',
    restart:'Restart', best:'Best', sec:'s', minesLeft:'mines',
    paused:'Paused — come back to resume ⏸',
    stFirst:'Tap any cell to start 👆', stPlay:'Minefield active — stay sharp!',
    newRec:'New record! 🏅', winTurn:'😎 All safe cells cleared!',
    winSub:'Time: {n}s', loseSub:'Boom! You hit a mine 💥', loseTurn:'💥 Boom!',
    hintFlag:'Long-press or right-click = flag · double-tap a number = chord' },
};
function tt(k, vars){
  const src = (L[lang] && L[lang][k]!=null) ? L[lang] : L.fa;
  let s = src[k]!=null ? src[k] : (L.fa[k]!=null ? L.fa[k] : k);
  if(vars) for(const key in vars) s = s.split('{'+key+'}').join(vars[key]);
  return s;
}

/* ----------------------------- config ----------------------------- */
const DIFFS = {
  easy:   { cols:9,  rows:9,  mines:10 },
  normal: { cols:16, rows:16, mines:40 },
  hard:   { cols:30, rows:16, mines:99 },
};
const CELL_CSS = {
  easy:   'min(calc((min(92vw,430px) - 30px)/9), 44px)',
  normal: 'max(min(calc((min(92vw,640px) - 44px)/16), 36px), 30px)',
  hard:   'max(min(calc((min(92vw,1000px) - 74px)/30), 34px), 30px)',
};

const MINE_CSS = `
.pvmine{--mc:34px;display:flex;flex-direction:column;align-items:center;gap:12px;padding:4px 0 14px;width:100%}
.pvmine-hud{display:flex;align-items:center;gap:12px;background:var(--surface);border:1.5px solid var(--border);padding:9px 14px;border-radius:18px;box-shadow:var(--sh-2)}
.pvmine-led{display:flex;align-items:center;gap:7px;font-weight:800;font-size:1rem;color:#ff5964;background:#191d33;padding:5px 12px;border-radius:12px;box-shadow:inset 0 2px 8px rgba(0,0,0,.55);font-variant-numeric:tabular-nums;letter-spacing:.5px;min-width:96px;justify-content:center;text-shadow:0 0 8px rgba(255,80,80,.55)}
.pvmine-face{width:50px;height:50px;font-size:1.6rem;border-radius:16px;background:var(--grad-gold);display:grid;place-items:center;box-shadow:0 6px 14px -4px rgba(255,150,30,.55),inset 0 2px 0 rgba(255,255,255,.4);transition:transform .12s ease;animation:pvmine-breathe 3.2s ease-in-out infinite}
.pvmine-face:active{transform:scale(.86)}
.pvmine-face.dead,.pvmine-face.win{animation:pvmine-pop .35s ease}
@keyframes pvmine-breathe{0%,100%{box-shadow:0 6px 14px -4px rgba(255,150,30,.45),inset 0 2px 0 rgba(255,255,255,.4)}50%{box-shadow:0 8px 22px -4px rgba(255,150,30,.75),inset 0 2px 0 rgba(255,255,255,.4)}}
.pvmine-seg{display:flex;background:var(--surface2);border:1.5px solid var(--border);border-radius:999px;padding:4px;gap:4px}
.pvmine-seg button{border-radius:999px;padding:6px 16px;font-weight:800;font-size:.85rem;color:var(--tx2);transition:.2s}
.pvmine-seg button.on{background:var(--grad-p);color:#fff;box-shadow:var(--sh-p)}
.pvmine-fieldwrap{position:relative;max-width:100%}
.pvmine-fieldwrap.paused::after{content:'⏸';position:absolute;inset:0;display:grid;place-items:center;font-size:3rem;background:rgba(20,22,45,.45);border-radius:16px;z-index:8;backdrop-filter:blur(2px)}
.pvmine-scroll{width:100%;display:flex;justify-content:center;overflow:auto;padding:4px 2px 10px;-webkit-overflow-scrolling:touch;scrollbar-width:thin}
.pvmine-field{display:grid;grid-template-columns:repeat(var(--cols),var(--mc));grid-auto-rows:var(--mc);gap:2px;background:#b8bfe4;padding:7px;border-radius:14px;box-shadow:0 12px 26px -10px rgba(60,60,140,.45),inset 0 0 0 1px rgba(255,255,255,.4);touch-action:pan-x pan-y;user-select:none;-webkit-user-select:none;width:max-content;margin:auto}
.pvmine-cell{width:var(--mc);height:var(--mc);border-radius:6px;background:linear-gradient(150deg,#e9ecfd,#c3c9ec);box-shadow:inset 0 2px 0 rgba(255,255,255,.85),inset 0 -3px 0 rgba(90,95,160,.28),0 1px 2px rgba(40,40,90,.18);display:grid;place-items:center;font-weight:900;font-size:calc(var(--mc)*.5);line-height:1;cursor:pointer;position:relative;transition:transform .08s}
.pvmine-cell:not(.rev):active{transform:scale(.88)}
.pvmine-cell.rev{background:var(--surface2);box-shadow:inset 0 0 0 1.5px #b9bfe0;cursor:default;animation:pvmine-pop .18s ease both}
.pvmine-cell.flag::after{content:'🚩';font-size:calc(var(--mc)*.52);animation:pvmine-flagpop .3s cubic-bezier(.34,1.56,.64,1) both;filter:drop-shadow(0 2px 3px rgba(0,0,0,.3))}
.pvmine-cell.mine::after{content:'💣';font-size:calc(var(--mc)*.52);animation:pvmine-pop .25s ease both}
.pvmine-cell.boom{background:radial-gradient(circle at 50% 45%,#fff7d6 0%,#ffd54f 22%,#ff7043 52%,#c62828 88%);box-shadow:0 0 18px 4px rgba(255,112,67,.65)}
.pvmine-cell.boom::after{content:'💥';font-size:calc(var(--mc)*.6);animation:pvmine-pop .3s ease both}
.pvmine-cell.flagok{box-shadow:inset 0 0 0 3px rgba(24,181,102,.75)}
.pvmine-cell.wrong{box-shadow:inset 0 0 0 3px rgba(229,57,53,.85)}
.pvmine-cell .mk{position:absolute;inset:0;display:grid;place-items:center;font-weight:900;font-size:calc(var(--mc)*.62);animation:pvmine-pop .25s ease both;pointer-events:none}
.pvmine-cell .mk.ok{color:#18b566}.pvmine-cell .mk.no{color:#e53935}
@keyframes pvmine-pop{0%{transform:scale(.45);opacity:.35}70%{transform:scale(1.12)}100%{transform:scale(1);opacity:1}}
@keyframes pvmine-flagpop{0%{transform:scale(0) rotate(-40deg)}62%{transform:scale(1.35) rotate(8deg)}100%{transform:scale(1) rotate(0)}}
@keyframes pvmine-shake{0%,100%{transform:translate(0,0)}15%{transform:translate(-8px,4px) rotate(-.8deg)}30%{transform:translate(7px,-5px) rotate(.7deg)}45%{transform:translate(-6px,3px)}60%{transform:translate(5px,-3px)}75%{transform:translate(-3px,1px)}}
.pvmine-field.shake{animation:pvmine-shake .55s ease}
.pvmine-blast{position:absolute;width:14px;height:14px;margin:-7px;border-radius:50%;border:3px solid rgba(255,171,64,.95);box-shadow:0 0 26px 10px rgba(255,112,67,.55);animation:pvmine-ring .68s ease-out forwards;pointer-events:none;z-index:6}
@keyframes pvmine-ring{from{transform:scale(.4);opacity:1}to{transform:scale(10);opacity:0}}
.pvmine-foot{display:flex;align-items:center;gap:14px;flex-wrap:wrap;justify-content:center}
.pvmine-btn{padding:8px 18px;border-radius:13px;font-weight:800;font-size:.88rem;background:var(--grad-cyan);color:#fff;border:none;box-shadow:0 6px 16px -6px rgba(0,180,190,.6);transition:.18s}
.pvmine-btn:hover{transform:translateY(-2px);filter:brightness(1.06)}
.pvmine-btn:active{transform:scale(.94)}
.pvmine-best{font-size:.82rem;font-weight:800;color:var(--tx2)}
.pvmine-tip{max-width:92vw;text-align:center}
`;

/* ------------------------------ register ------------------------------ */
PV.registry.register({
  id:'minesweeper', cats:['brain','classic'], players:[1,1], modes:['solo'], weight:85,
  factory: function(ctx){

    /* ------------------------------ dom ------------------------------ */
    const root = document.createElement('div');
    root.className = 'pvmine';
    root.innerHTML = `<style>${MINE_CSS}</style>
      <div class="pvmine-hud">
        <div class="pvmine-led" id="pvmine-mines" title="${tt('minesLeft')}">🚩 ۰۰۰</div>
        <button class="pvmine-face" id="pvmine-face" title="${tt('restart')}">😊</button>
        <div class="pvmine-led" id="pvmine-time">⏱ ۰۰۰</div>
      </div>
      <div class="pvmine-seg" id="pvmine-seg">
        <button data-d="easy"></button><button data-d="normal"></button><button data-d="hard"></button>
      </div>
      <div class="pvmine-scroll"><div class="pvmine-fieldwrap" id="pvmine-fwrap">
        <div class="pvmine-field" id="pvmine-field"></div>
      </div></div>
      <div class="pvmine-foot">
        <button class="pvmine-btn" id="pvmine-restart">🔄 ${tt('restart')}</button>
        <span class="pvmine-best" id="pvmine-best"></span>
      </div>
      <div class="pvmine-tip tiny muted">${tt('hintFlag')}</div>`;
    ctx.root.appendChild(root);
    const $ = s => root.querySelector(s);
    const field = $('#pvmine-field'), fwrap = $('#pvmine-fwrap'), face = $('#pvmine-face');
    const minesEl = $('#pvmine-mines'), timeEl = $('#pvmine-time'), bestEl = $('#pvmine-best');
    const seg = $('#pvmine-seg');
    seg.querySelectorAll('button').forEach(b=> b.textContent = tt(b.dataset.d));

    /* ----------------------------- state ----------------------------- */
    let diffKey = DIFFS[ctx.diff] ? ctx.diff : 'normal';
    let cols=9, rows=9, mines=10, cells=[], NB=[];
    let flags=0, revealed=0, placed=false, over=false, paused=false, finished=false;
    let startedAt=0, accMs=0, running=false;
    let pressTimer=0, pressPos=null, suppressClick=false;
    const selfKey = (ctx.players && ctx.players[0] && ctx.players[0].pid) || ctx.selfPid || 'me';

    const pad3 = n => { const neg=n<0, a=Math.abs(n); let s=fmt(a); if(a<10)s='۰'+s; if(a<100)s='۰'+s; return (neg?'−':'')+s; };
    const disp = s => s>999 ? fmt(s) : pad3(s);
    const secs = () => Math.floor((accMs + (running ? performance.now()-startedAt : 0))/1000);

    /* ---------------------------- new game --------------------------- */
    function newGame(dk){
      diffKey = DIFFS[dk] ? dk : 'normal';
      U.LS.set('diff:minesweeper', diffKey);
      const D = DIFFS[diffKey];
      cols=D.cols; rows=D.rows; mines=D.mines;
      cells = Array.from({length:cols*rows}, ()=>({mine:false,rev:false,flag:false,n:0}));
      NB = cells.map((_,i)=>{
        const x=i%cols, y=(i/cols)|0, out=[];
        for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){
          if(!dx && !dy) continue;
          const nx=x+dx, ny=y+dy;
          if(nx>=0 && nx<cols && ny>=0 && ny<rows) out.push(ny*cols+nx);
        }
        return out;
      });
      flags=0; revealed=0; placed=false; over=false; paused=false; finished=false;
      accMs=0; running=false;
      clearTimeout(pressTimer); pressTimer=0; suppressClick=false;
      field.style.setProperty('--cols', cols);
      field.style.setProperty('--mc', CELL_CSS[diffKey]);
      field.classList.remove('shake');
      fwrap.classList.remove('paused');
      field.innerHTML = cells.map((_,i)=>`<div class="pvmine-cell" data-i="${i}"></div>`).join('');
      setFace('smile');
      seg.querySelectorAll('button').forEach(b=> b.classList.toggle('on', b.dataset.d===diffKey));
      updateHud(); updateBest();
      ctx.setTurn('💣 ' + tt('stFirst'));
    }

    /* ----------------------------- hud ------------------------------- */
    function updateHud(){
      minesEl.textContent = '🚩 ' + pad3(mines-flags);
      timeEl.textContent  = '⏱ ' + disp(secs());
    }
    function bestKey(){ const u=(PV.store && PV.store.me && PV.store.me() && PV.store.me().u) || 'guest'; return 'best:minesweeper:'+u+':'+diffKey; }
    function updateBest(){
      const b = U.LS.get(bestKey(), null);
      bestEl.textContent = '🏅 ' + tt('best') + ': ' + (b==null ? '—' : fmt(b)+' '+tt('sec'));
    }
    function setFace(s){
      face.textContent = {smile:'😊',press:'😮',dead:'💥',win:'😎'}[s] || '😊';
      face.classList.toggle('dead', s==='dead');
      face.classList.toggle('win', s==='win');
    }

    /* --------------------------- mine logic -------------------------- */
    function placeMines(safe){
      const banned = new Set([safe, ...NB[safe]]);
      let pool = cells.map((_,i)=>i).filter(i=>!banned.has(i));
      if(pool.length < mines) pool = cells.map((_,i)=>i).filter(i=>i!==safe);
      pool = U.shuffle(pool, ctx.rng);
      for(let k=0;k<mines;k++) cells[pool[k]].mine = true;
      cells.forEach((c,i)=>{ if(!c.mine) c.n = NB[i].filter(j=>cells[j].mine).length; });
      placed = true;
    }
    function flood(start){
      const out=[], seen=new Set([start]), q=[[start,0]];
      while(q.length){
        const [i,d] = q.shift();
        const c = cells[i];
        if(c.flag) continue;
        out.push([i,d]);
        if(c.n===0){
          for(const nb of NB[i]) if(!seen.has(nb) && !cells[nb].rev && !cells[nb].flag && !cells[nb].mine){ seen.add(nb); q.push([nb,d+1]); }
        }
      }
      return out;
    }
    function paintRev(j){
      const cel = field.children[j]; if(!cel) return;
      const c = cells[j];
      cel.classList.add('rev');
      if(c.n>0){ cel.classList.add('n'+c.n); cel.textContent = fmt(c.n); }
    }
    function reveal(i){
      const c = cells[i];
      if(over || paused || c.rev || c.flag) return;
      if(!placed) placeMines(i);
      if(c.mine){ explode(i); return; }
      if(!running && !over){ startedAt = performance.now(); running = true; }
      PV.sound.play('flip');
      const list = flood(i);
      list.forEach(([j,d])=>{
        cells[j].rev = true; revealed++;
        setTimeout(()=>{ paintRev(j); if(d>0 && d%4===0) PV.sound.play('tick'); }, d*15);
      });
      updateHud();
      if(revealed === cols*rows - mines) winGame();
    }
    function chord(i){
      const c = cells[i];
      if(over || paused || !c.rev || c.n===0) return;
      const flagged = NB[i].filter(j=>cells[j].flag).length;
      if(flagged !== c.n){ PV.sound.play('tap'); return; }
      PV.sound.play('go');
      for(const j of NB[i]){
        const cc = cells[j];
        if(cc.flag || cc.rev) continue;
        if(cc.mine){ explode(j); return; }
        const list = flood(j);
        list.forEach(([k,d])=>{ cells[k].rev=true; revealed++; setTimeout(()=>paintRev(k), d*15); });
      }
      updateHud();
      if(revealed === cols*rows - mines) winGame();
    }
    function toggleFlag(i){
      const c = cells[i];
      if(over || paused || c.rev) return;
      c.flag = !c.flag;
      flags += c.flag ? 1 : -1;
      const cel = field.children[i];
      cel.classList.remove('flag');
      if(c.flag){ void cel.offsetWidth; cel.classList.add('flag'); PV.sound.play('place'); U.vibrate(16); }
      else PV.sound.play('tap');
      updateHud();
    }

    /* -------------------------- win / lose --------------------------- */
    function winGame(){
      if(over) return;
      over = true;
      if(running){ accMs += performance.now()-startedAt; running = false; }
      setFace('win');
      PV.sound.play('coin'); U.vibrate(45);
      cells.forEach((c,j)=>{ if(c.mine && !c.flag){ c.flag=true; flags++; field.children[j].classList.add('flag'); } });
      updateHud();
      const s = Math.floor(accMs/1000);
      const prev = U.LS.get(bestKey(), null);
      const isRec = prev==null || s<prev;
      if(isRec) U.LS.set(bestKey(), s);
      updateBest();
      if(isRec){ try{ PV.ui.toast(tt('newRec'),'gold','crown'); }catch(e){} PV.sound.play('ach'); }
      ctx.setTurn('😎 ' + tt('winTurn'), 'win');
      setTimeout(()=>{
        if(finished) return; finished = true;
        ctx.finish({
          res:'w',
          scores:{ [selfKey]: Math.max(1, 999-s) },
          stats:{ best: s },
          sub: tt('winSub',{n:fmt(s)}) + (isRec ? ' 🏅' : ''),
        });
      }, 900);
    }
    function explode(i){
      if(over) return;
      over = true;
      if(running){ accMs += performance.now()-startedAt; running = false; }
      cells[i].rev = true;
      setFace('dead');
      PV.sound.play('falseStart'); U.vibrate(90);
      ctx.setTurn('💥 ' + tt('loseTurn'), 'lose');
      field.classList.add('shake');
      const cel = field.children[i];
      cel.classList.add('boom');
      try{
        const br = fwrap.getBoundingClientRect(), cr = cel.getBoundingClientRect();
        const b = document.createElement('div');
        b.className = 'pvmine-blast';
        b.style.left = (cr.left-br.left+cr.width/2)+'px';
        b.style.top  = (cr.top-br.top+cr.height/2)+'px';
        fwrap.appendChild(b);
        setTimeout(()=>b.remove(), 750);
      }catch(e){}
      let k = 0;
      cells.forEach((c,j)=>{
        if(j===i) return;
        if(c.mine && !c.flag){
          const d = 140 + (k++)*18;
          setTimeout(()=>{ const ce=field.children[j]; if(ce) ce.classList.add('mine'); }, d);
        } else if(c.flag){
          const okM = c.mine;
          const d = 140 + (k++)*18;
          setTimeout(()=>{
            const ce = field.children[j]; if(!ce) return;
            ce.classList.add(okM ? 'flagok' : 'wrong');
            ce.insertAdjacentHTML('beforeend', okM ? '<span class="mk ok">✓</span>' : '<span class="mk no">✕</span>');
          }, d);
        }
      });
      setTimeout(()=>{
        if(finished) return; finished = true;
        ctx.finish({ res:'l', scores:{ [selfKey]:0 }, sub: tt('loseSub') });
      }, 1600);
    }

    /* ---------------------------- input ------------------------------ */
    field.addEventListener('contextmenu', e=>{
      const cel = e.target.closest('.pvmine-cell'); if(!cel) return;
      e.preventDefault();
      toggleFlag(+cel.dataset.i);
    });
    field.addEventListener('pointerdown', e=>{
      if(e.button===2) return;
      const cel = e.target.closest('.pvmine-cell'); if(!cel) return;
      const i = +cel.dataset.i, c = cells[i];
      if(over || paused || c.rev) return;
      setFace('press');
      pressPos = {x:e.clientX, y:e.clientY};
      clearTimeout(pressTimer);
      pressTimer = setTimeout(()=>{
        pressTimer = 0;
        if(over || paused) return;
        suppressClick = true;
        toggleFlag(i);
      }, 450);
    });
    function cancelPress(){
      if(pressTimer){ clearTimeout(pressTimer); pressTimer=0; }
      if(!over) setFace('smile');
    }
    field.addEventListener('pointermove', e=>{
      if(pressTimer && pressPos && Math.hypot(e.clientX-pressPos.x, e.clientY-pressPos.y)>9) cancelPress();
    });
    field.addEventListener('pointerup',    ()=>{ pressTimer ? cancelPress() : (!over && setFace('smile')); });
    field.addEventListener('pointerleave', ()=>{ if(pressTimer) cancelPress(); });
    field.addEventListener('pointercancel',cancelPress);
    field.addEventListener('click', e=>{
      if(suppressClick){ suppressClick=false; return; }
      const cel = e.target.closest('.pvmine-cell'); if(!cel) return;
      const i = +cel.dataset.i, c = cells[i];
      if(over || paused) return;
      if(!c.rev){ if(!c.flag) reveal(i); }
      else chord(i);
    });
    face.addEventListener('click', ()=>{ PV.sound.play('pop'); newGame(diffKey); });
    $('#pvmine-restart').addEventListener('click', ()=>{ PV.sound.play('pop'); newGame(diffKey); });
    seg.addEventListener('click', e=>{
      const b = e.target.closest('button[data-d]'); if(!b) return;
      if(b.dataset.d !== diffKey){ PV.sound.play('tap'); newGame(b.dataset.d); }
    });

    /* ------------------------ pause / timer -------------------------- */
    function doPause(){ if(over) return; if(running){ accMs += performance.now()-startedAt; running=false; } paused=true; fwrap.classList.add('paused'); }
    function doResume(){ paused=false; fwrap.classList.remove('paused'); if(placed && !over && !running){ startedAt=performance.now(); running=true; } }
    function onVis(){ try{ document.hidden ? doPause() : (!over && doResume()); }catch(e){} }
    document.addEventListener('visibilitychange', onVis);
    const hudIv = setInterval(()=>{ if(running) timeEl.textContent = '⏱ ' + disp(secs()); }, 250);

    /* ----------------------------- boot ------------------------------ */
    newGame(diffKey);

    /* ---------------------------- contract --------------------------- */
    return {
      init(){}, start(){},
      pause(){ doPause(); },
      resume(){ doResume(); },
      reset(){ newGame(diffKey); },
      end(){ over=true; clearTimeout(pressTimer); },
      destroy(){ over=true; document.removeEventListener('visibilitychange', onVis); clearTimeout(pressTimer); clearInterval(hudIv); root.remove(); },
      getState(){ return {diff:diffKey, revealed, flags, over, secs:secs()}; },
      getScores(){ return { [selfKey]: placed ? Math.max(1, 999-secs()) : 999 }; },
      getStatus(){ return over ? '' : paused ? tt('paused') : placed ? tt('stPlay') : tt('stFirst'); },
    };
  }
});
})();
