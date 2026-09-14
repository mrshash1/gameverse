/* ============ Game: Sudoku (سودوکو) — premium solo ============
   • Real generator: randomized backtracking fill + cell-digging with a
     fast bitmask uniqueness solver (count solutions, cap 2) — all local <400ms
   • Bitmask candidates, MRV solver, undo stack, notes (pencil marks),
     hints ×3, auto-check toggle, pause overlay, best-time per difficulty
   • Persian UI, Latin board digits, mobile-first, zero libraries
================================================================= */
(function(){
'use strict';
const PV = window.PV, U = PV.u, t = PV.t;
const { el, fmt, fmtEn, LS, vibrate } = U;

/* ---------------- local dict ---------------- */
const L = {
  fa: {
    gen:'پازل جدید…',
    undo:'بازگردانی', notes:'یادداشت', hint:'راهنما', erase:'پاک کردن',
    autocheck:'بررسی خودکار',
    paused:'مکث', resume:'ادامه',
    noHints:'راهنمایی باقی نمانده',
    noSelect:'اول یک خانه را انتخاب کن',
    fullWrong:'همه خانه‌ها پر شد اما جایی خطا هست…',
    newRecord:'رکورد جدید زمان! 🏅',
    best:'بهترین زمان: ', noBest:'هنوز رکوردی ثبت نشده',
    statusPlaying:'در حال حل…', statusPaused:'مکث', statusDone:'پازل حل شد! 🎉',
    kbdTip:'کیبورد: ۱-۹ عدد · فلش‌ها حرکت · Backspace پاک · N یادداشت · H راهنما · P مکث',
    time:'زمان', mistakes:'اشتباه', hintsLeft:'راهنما',
    winSub:(ts, m, h, rec)=> 'زمان: '+ts+' — اشتباه: '+fmt(m)
      + (h>0 ? ' — راهنما: '+fmt(h) : '') + (rec ? ' — 🏅 رکورد جدید!' : ''),
  },
  en: {
    gen:'New puzzle…',
    undo:'Undo', notes:'Notes', hint:'Hint', erase:'Erase',
    autocheck:'Auto-check',
    paused:'Paused', resume:'Resume',
    noHints:'No hints left',
    noSelect:'Select a cell first',
    fullWrong:'Board is full but something is wrong…',
    newRecord:'New time record! 🏅',
    best:'Best: ', noBest:'No record yet',
    statusPlaying:'Solving…', statusPaused:'Paused', statusDone:'Solved! 🎉',
    kbdTip:'Keys: 1-9 · arrows · Backspace erase · N notes · H hint · P pause',
    time:'Time', mistakes:'Mistakes', hintsLeft:'Hints',
    winSub:(ts, m, h, rec)=> 'Time: '+ts+' — Mistakes: '+fmtEn(m)
      + (h>0 ? ' — Hints: '+fmtEn(h) : '') + (rec ? ' — 🏅 New record!' : ''),
  }
};
const lang = (PV.i18n && PV.i18n.lang === 'en') ? 'en' : 'fa';
const tt = k => (L[lang] && L[lang][k] != null) ? L[lang][k] : (L.fa[k] != null ? L.fa[k] : k);
const num = n => isFa ? fmt(n) : fmtEn(n);
const isFa = lang !== 'en';
const zero = isFa ? '۰' : '0';
const pad2 = n => ((n%100)<10 ? zero : '') + num(Math.min(99, n|0));
function timeStr(sec){
  const h=(sec/3600)|0, m=((sec%3600)/60)|0, s=sec%60;
  return h ? pad2(h)+':'+pad2(m)+':'+pad2(s) : pad2(m)+':'+pad2(s);
}

/* ---------------- sudoku math (bitmask) ---------------- */
const ALL = 0b1111111110;                 /* bits 1..9 */
const boxOf = i => (((i/9)|0)/3|0)*3 + ((i%9)/3|0);
function popcount(x){ let n=0; while(x){ x&=x-1; n++; } return n; }

/* fill a complete grid via backtracking with randomized candidate order */
function fullGrid(){
  const vals = new Array(81).fill(0);
  const rows = new Array(9).fill(0), cols = new Array(9).fill(0), boxes = new Array(9).fill(0);
  function rec(i){
    if(i===81) return true;
    const r=(i/9)|0, c=i%9, b=boxOf(i);
    let m = ALL & ~(rows[r]|cols[c]|boxes[b]);
    const bits = []; while(m){ const bit=m&-m; m^=bit; bits.push(bit); }
    U.shuffle(bits, Math.random);
    for(const bit of bits){
      const d = 31 - Math.clz32(bit);
      vals[i]=d; rows[r]|=bit; cols[c]|=bit; boxes[b]|=bit;
      if(rec(i+1)) return true;
      vals[i]=0; rows[r]^=bit; cols[c]^=bit; boxes[b]^=bit;
    }
    return false;
  }
  rec(0);
  return vals;
}

/* count solutions up to `cap` — MRV + bitmask (fast) */
function solveCount(grid, cap){
  const rows = new Array(9).fill(0), cols = new Array(9).fill(0), boxes = new Array(9).fill(0);
  const vals = grid.slice();
  for(let i=0;i<81;i++) if(vals[i]){
    const bit = 1<<vals[i];
    rows[(i/9)|0] |= bit; cols[i%9] |= bit; boxes[boxOf(i)] |= bit;
  }
  let count = 0;
  function rec(){
    if(count >= cap) return;
    let bi=-1, bm=0, bn=10;
    for(let i=0;i<81;i++){
      if(vals[i]) continue;
      const m = ALL & ~(rows[(i/9)|0] | cols[i%9] | boxes[boxOf(i)]);
      const n = popcount(m);
      if(n===0) return;                       /* dead end */
      if(n<bn){ bn=n; bi=i; bm=m; if(n===1) break; }
    }
    if(bi===-1){ count++; return; }           /* solved */
    const r=(bi/9)|0, c=bi%9, b=boxOf(bi);
    let m = bm;
    while(m){
      const bit = m & -m; m ^= bit;
      vals[bi] = 31 - Math.clz32(bit);
      rows[r]|=bit; cols[c]|=bit; boxes[b]|=bit;
      rec();
      vals[bi]=0; rows[r]^=bit; cols[c]^=bit; boxes[b]^=bit;
      if(count >= cap) return;
    }
  }
  rec();
  return count;
}

/* dig cells down to the clue target; every removal keeps the puzzle unique */
function dig(solution, target, deadline){
  const grid = solution.slice();
  let clues = 81, timedOut = false;
  const order = U.shuffle([...Array(81).keys()], Math.random);
  for(const i of order){
    if(clues <= target) break;
    if(performance.now() > deadline){ timedOut = true; break; }
    const saved = grid[i];
    grid[i] = 0;
    if(solveCount(grid, 2) !== 1) grid[i] = saved;   /* would break uniqueness → restore */
    else clues--;
  }
  return { grid, clues, timedOut };
}

/* difficulty → clue targets: easy 38-40 · normal 30-32 · hard 26-28 */
function generate(diff){
  let target = diff==='easy' ? 39 : diff==='hard' ? 27 : 31;
  const t0 = performance.now();
  let out = null;
  for(let attempt=0; attempt<3; attempt++){
    const solution = fullGrid();
    const res = dig(solution, target, t0 + 300);
    out = { puzzle: res.grid, solution };
    if(!res.timedOut || res.clues <= target + 2) break;
    target += 3;                               /* fewer removals → quicker next attempt */
  }
  return out;
}

/* peers (same row/col/box) + units */
const PEERS = [], UNITS = [];
for(let i=0;i<81;i++){
  const r=(i/9)|0, c=i%9, br=r-r%3, bc=c-c%3, set = new Set();
  for(let k=0;k<9;k++){ set.add(r*9+k); set.add(k*9+c); }
  for(let rr=br; rr<br+3; rr++) for(let cc=bc; cc<bc+3; cc++) set.add(rr*9+cc);
  set.delete(i);
  PEERS.push([...set]);
}
for(let u=0;u<27;u++){
  const arr=[];
  if(u<9){ for(let c=0;c<9;c++) arr.push(u*9+c); }
  else if(u<18){ for(let r=0;r<9;r++) arr.push(r*9+(u-9)); }
  else { const b=u-18, br=(b/3|0)*3, bc=(b%3)*3;
    for(let rr=br; rr<br+3; rr++) for(let cc=bc; cc<bc+3; cc++) arr.push(rr*9+cc); }
  UNITS.push(arr);
}

/* ---------------- style ---------------- */
const CSS = `
.pvsud{--sud-line:rgba(120,120,180,.16);--sud-box:rgba(110,100,220,.5);--sud-acc:rgba(124,92,255,.15);--sud-err:rgba(239,68,103,.16);
  max-width:520px;margin:0 auto;display:flex;flex-direction:column;gap:11px;
  animation:pvsudUp .45s cubic-bezier(.22,1,.36,1) both;touch-action:manipulation}
[data-theme="dark"] .pvsud{--sud-line:rgba(170,170,255,.13);--sud-box:rgba(150,140,255,.5);--sud-acc:rgba(139,108,255,.18);--sud-err:rgba(255,111,171,.15)}
@keyframes pvsudUp{from{opacity:0;transform:translateY(14px) scale(.985)}to{opacity:1;transform:none}}
.pvsud button{-webkit-tap-highlight-color:transparent;font-family:inherit;user-select:none}
.pvsud-sp{flex:1}

/* ---- top chips ---- */
.pvsud-top{display:flex;align-items:center;gap:8px}
.pvsud-chip{display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:999px;
  background:var(--surface);border:1px solid var(--border);box-shadow:var(--sh-1);
  font-size:.82rem;font-weight:700;color:var(--tx2);white-space:nowrap}
.pvsud-chip b{color:var(--tx);font-weight:800;letter-spacing:.5px}
.pvsud-ibtn{width:40px;height:40px;border-radius:13px;background:var(--surface);border:1px solid var(--border);
  box-shadow:var(--sh-1);font-size:1.02rem;display:flex;align-items:center;justify-content:center;
  color:var(--tx2);transition:transform .15s,box-shadow .2s}
.pvsud-ibtn:active{transform:scale(.88)}

/* ---- tools row ---- */
.pvsud-tools{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap}
.pvsud-tbtn{display:inline-flex;align-items:center;gap:6px;padding:8px 13px;border-radius:12px;
  background:var(--surface);border:1px solid var(--border);box-shadow:var(--sh-1);
  font-size:.84rem;font-weight:800;color:var(--tx2);
  transition:transform .15s,box-shadow .2s,color .2s,background .2s}
.pvsud-tbtn:active{transform:scale(.93)}
.pvsud-tbtn[disabled]{opacity:.38;pointer-events:none}
.pvsud-tbtn.pvsud-on{background:var(--grad-p);color:#fff;border-color:transparent;box-shadow:var(--sh-p)}
.pvsud-badge{font-style:normal;min-width:19px;height:19px;padding:0 5px;border-radius:999px;
  background:var(--grad-gold);color:#fff;font-size:.68rem;font-weight:800;
  display:inline-flex;align-items:center;justify-content:center}
.pvsud-tbtn.pvsud-on .pvsud-badge{background:rgba(255,255,255,.25)}
.pvsud-sw{display:inline-flex;align-items:center;gap:7px;font-size:.8rem;font-weight:800;color:var(--tx2);cursor:pointer;user-select:none}
.pvsud-sw input{display:none}
.pvsud-sw i{width:36px;height:21px;border-radius:999px;background:var(--border2);position:relative;transition:background .25s;direction:ltr;flex:none}
.pvsud-sw i::after{content:'';position:absolute;top:2.5px;left:2.5px;width:16px;height:16px;border-radius:50%;
  background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.3);transition:left .22s cubic-bezier(.34,1.4,.64,1)}
.pvsud-sw input:checked + i{background:var(--grad-green)}
.pvsud-sw input:checked + i::after{left:17.5px}

/* ---- board ---- */
.pvsud-bwrap{position:relative;width:min(100%,470px);margin-inline:auto;border-radius:20px;padding:7px;
  background:linear-gradient(150deg,var(--p1) 0%,var(--p2) 45%,var(--p3) 120%);box-shadow:var(--sh-2)}
.pvsud-board{position:relative;display:grid;grid-template-columns:repeat(9,1fr);grid-template-rows:repeat(9,1fr);
  width:100%;aspect-ratio:1;background:var(--surface);border-radius:13px;overflow:hidden;direction:ltr;
  transition:filter .3s,transform .3s}
.pvsud-paused .pvsud-board{filter:blur(15px) saturate(.75);transform:scale(.985)}
.pvsud-cell{position:relative;display:flex;align-items:center;justify-content:center;padding:0;
  background:var(--surface);border-right:1px solid var(--sud-line);border-bottom:1px solid var(--sud-line);
  font-size:min(6.2vw,30px);font-weight:700;color:var(--p1);cursor:pointer;
  transition:background .16s,color .16s;animation:none}
.pvsud-cell.pvsud-br{border-right:2px solid var(--sud-box)}
.pvsud-cell.pvsud-bb{border-bottom:2px solid var(--sud-box)}
.pvsud-cell:nth-child(9n){border-right:none}
.pvsud-cell:nth-child(n+73){border-bottom:none}
.pvsud-cell.pvsud-given{color:var(--tx);font-weight:800;background:var(--surface2)}
.pvsud-cell.pvsud-hinted{color:var(--gold);font-weight:800;background:rgba(255,176,32,.13)}
.pvsud-cell.pvsud-peer{background:var(--surface3)}
.pvsud-cell.pvsud-same{background:var(--sud-acc)}
.pvsud-cell.pvsud-err{color:var(--err)!important;background:var(--sud-err)!important}
.pvsud-cell.pvsud-sel{background:var(--sud-acc);z-index:2;
  box-shadow:inset 0 0 0 2.5px var(--p1),inset 0 0 18px rgba(124,92,255,.25)}
.pvsud-val{display:inline-block;line-height:1}
@keyframes pvsudPop{0%{transform:scale(.3);opacity:.1}55%{transform:scale(1.22)}100%{transform:scale(1);opacity:1}}
.pvsud-cell.pvsud-pop .pvsud-val{animation:pvsudPop .3s cubic-bezier(.34,1.6,.64,1)}
@keyframes pvsudShake{0%,100%{transform:translateX(0)}20%{transform:translateX(-4px)}40%{transform:translateX(4px)}60%{transform:translateX(-3px)}80%{transform:translateX(3px)}}
.pvsud-cell.pvsud-shake{animation:pvsudShake .32s ease}
@keyframes pvsudFlash{0%{background:rgba(239,68,103,.5)}100%{background:transparent}}
.pvsud-cell.pvsud-flash{animation:pvsudFlash .6s ease}
@keyframes pvsudIn{from{opacity:0;transform:scale(.55)}to{opacity:1;transform:scale(1)}}
.pvsud-cell.pvsud-in{animation:pvsudIn .4s cubic-bezier(.34,1.4,.64,1) both}
@keyframes pvsudWave{0%{transform:scale(1)}35%{transform:scale(.72);background:var(--sud-acc)}70%{transform:scale(1.12)}100%{transform:scale(1)}}
.pvsud-cell.pvsud-wave{animation:pvsudWave .62s cubic-bezier(.34,1.3,.64,1) both;z-index:3}
.pvsud-spark{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  font-size:min(7vw,34px);pointer-events:none;z-index:4;animation:pvsudSpark .75s ease-out forwards}
@keyframes pvsudSpark{0%{transform:scale(.2);opacity:1}60%{transform:scale(1.5);opacity:.95}100%{transform:scale(2.1);opacity:0}}
.pvsud-marks{position:absolute;inset:1px;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);direction:ltr;pointer-events:none}
.pvsud-marks i{font-style:normal;font-size:min(2.5vw,11.5px);line-height:1;font-weight:700;color:var(--tx2);
  display:flex;align-items:center;justify-content:center}
.pvsud-marks i.pvsud-hlnote{color:var(--p1);font-weight:900;transform:scale(1.25)}

/* ---- skeleton shimmer ---- */
.pvsud-skel{position:absolute;inset:0;z-index:6;border-radius:inherit;display:flex;align-items:center;justify-content:center;background:var(--surface);overflow:hidden}
.pvsud-skelgrid{position:absolute;inset:0;display:grid;grid-template-columns:repeat(9,1fr);grid-template-rows:repeat(9,1fr);direction:ltr}
.pvsud-skt{margin:1.5px;border-radius:6px;background:linear-gradient(100deg,var(--surface3) 35%,var(--surface2) 50%,var(--surface3) 65%);
  background-size:220% 100%;animation:pvsudShimmer 1.15s linear infinite}
@keyframes pvsudShimmer{from{background-position:120% 0}to{background-position:-120% 0}}
.pvsud-skltxt{position:relative;z-index:2;font-weight:900;font-size:.95rem;color:var(--tx2);
  background:var(--glass);border:1px solid var(--glass-brd);padding:9px 18px;border-radius:999px;
  box-shadow:var(--sh-2);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);
  animation:pvsudPulse 1.4s ease-in-out infinite}
@keyframes pvsudPulse{0%,100%{transform:scale(1);opacity:.9}50%{transform:scale(1.06);opacity:1}}

/* ---- pause overlay ---- */
.pvsud-pauseov{position:absolute;inset:0;z-index:7;border-radius:inherit;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:9px;background:var(--glass);
  backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);animation:pvsudFade .28s ease}
@keyframes pvsudFade{from{opacity:0}to{opacity:1}}
.pvsud-pico{font-size:2.5rem;animation:pvsudFloat 2.2s ease-in-out infinite}
@keyframes pvsudFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
.pvsud-ptxt{font-weight:900;font-size:1.15rem;color:var(--tx)}
.pvsud-pbest{font-size:.8rem;font-weight:700;color:var(--tx2)}
.pvsud-resume{display:inline-flex;align-items:center;gap:7px;margin-top:6px;padding:11px 26px;border-radius:999px;
  background:var(--grad-p);color:#fff;font-weight:900;font-size:.95rem;border:none;box-shadow:var(--sh-p);transition:transform .15s}
.pvsud-resume:active{transform:scale(.94)}
.pvsud.hidden{display:none!important}

/* ---- number pad ---- */
.pvsud-pad{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;direction:ltr;width:min(100%,470px);margin-inline:auto}
.pvsud-key{position:relative;aspect-ratio:1/.8;border-radius:15px;
  background:linear-gradient(165deg,var(--surface2),var(--surface));border:1px solid var(--border);
  box-shadow:0 3px 10px -3px rgba(60,60,140,.14),inset 0 1px 0 rgba(255,255,255,.5);
  font-size:min(6vw,27px);font-weight:800;color:var(--tx);
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;
  transition:transform .13s,box-shadow .2s,opacity .2s,background .25s,color .25s}
[data-theme="dark"] .pvsud-key{box-shadow:0 3px 10px -3px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.07)}
.pvsud-key:active{transform:scale(.9)}
.pvsud-key .pvsud-kcount{position:absolute;top:4px;right:6px;font-size:.6rem;font-weight:700;color:var(--tx3);font-style:normal}
.pvsud-key.pvsud-done{opacity:.28}
.pvsud-key.pvsud-done .pvsud-kcount{display:none}
.pvsud-key.pvsud-erase{background:linear-gradient(165deg,#ffe3ec,var(--surface));color:var(--err)}
[data-theme="dark"] .pvsud-key.pvsud-erase{background:linear-gradient(165deg,#3a2030,var(--surface2))}
.pvsud-etxt{font-size:.56rem;font-weight:800;letter-spacing:.2px}
.pvsud-pad.pvsud-nmode .pvsud-key:not(.pvsud-erase){color:var(--p3);font-size:min(4.6vw,20px);
  background:linear-gradient(165deg,var(--surface3),var(--surface2));border-color:var(--p3)}

.pvsud-kbdtip{display:none;text-align:center;font-size:.72rem;color:var(--tx3);font-weight:600}
@media (hover:hover) and (pointer:fine){.pvsud-kbdtip{display:block}}
`;

PV.registry.register({
  id:'sudoku', cats:['brain','classic'], players:[1,1], modes:['solo'], weight:83,
  factory: function(ctx){
    const diff = ctx.diff || 'normal';

    /* ---------- state ---------- */
    let vals   = new Array(81).fill(0);     /* current values, 0=empty */
    let given  = new Array(81).fill(false); /* locked puzzle clues */
    let hinted = new Array(81).fill(false); /* hint-filled (locked, gold) */
    let notes  = new Array(81).fill(0);     /* bitmask pencil marks (bit d) */
    let solution = new Array(81).fill(0);
    let sel = -1, noteMode = false;
    let autocheck = LS.get('sudoku:autocheck', true);
    let mistakes = 0, hintsLeft = 3, elapsed = 0;
    let paused = false, over = false, finished = false;
    let timer = 0, genTo = 0, winTo = 0;
    const undoStack = [];

    /* ---------- DOM ---------- */
    const root = el(`<div class="pvsud">
      <div class="pvsud-top">
        <span class="pvsud-chip" title="${tt('time')}">⏱ <b class="num" id="pvsud-timer">۰۰:۰۰</b></span>
        <span class="pvsud-chip" title="${tt('mistakes')}">✖️ <b class="num" id="pvsud-mis">۰</b></span>
        <span class="pvsud-chip" title="${tt('hintsLeft')}">💡 <b class="num" id="pvsud-hl">۳</b></span>
        <span class="pvsud-sp"></span>
        <button type="button" class="pvsud-ibtn" id="pvsud-pause" title="${tt('paused')}">⏸</button>
      </div>
      <div class="pvsud-tools">
        <button type="button" class="pvsud-tbtn" id="pvsud-undo">↩️ <span>${tt('undo')}</span></button>
        <button type="button" class="pvsud-tbtn" id="pvsud-notes">✏️ <span>${tt('notes')}</span></button>
        <button type="button" class="pvsud-tbtn" id="pvsud-hint">💡 <span>${tt('hint')}</span> <i class="pvsud-badge" id="pvsud-hbadge">۳</i></button>
        <label class="pvsud-sw" title="${tt('autocheck')}"><input type="checkbox" id="pvsud-auto"><i></i><span>${tt('autocheck')}</span></label>
      </div>
      <div class="pvsud-bwrap" id="pvsud-bwrap">
        <div class="pvsud-board" id="pvsud-board"></div>
        <div class="pvsud-skel" id="pvsud-skel">
          <div class="pvsud-skelgrid" id="pvsud-skelgrid"></div>
          <div class="pvsud-skltxt">${tt('gen')}</div>
        </div>
        <div class="pvsud-pauseov hidden" id="pvsud-pov">
          <div class="pvsud-pico">⏸</div>
          <div class="pvsud-ptxt">${tt('paused')}</div>
          <div class="pvsud-pbest" id="pvsud-pbest"></div>
          <button type="button" class="pvsud-resume" id="pvsud-resume">▶ ${tt('resume')}</button>
        </div>
      </div>
      <div class="pvsud-pad" id="pvsud-pad"></div>
      <div class="pvsud-kbdtip">${tt('kbdTip')}</div>
    </div>`);
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    ctx.root.appendChild(root);

    const board   = root.querySelector('#pvsud-board');
    const skel    = root.querySelector('#pvsud-skel');
    const bwrap   = root.querySelector('#pvsud-bwrap');
    const pov     = root.querySelector('#pvsud-pov');
    const pbestEl = root.querySelector('#pvsud-pbest');
    const timerEl = root.querySelector('#pvsud-timer');
    const misEl   = root.querySelector('#pvsud-mis');
    const hlEl    = root.querySelector('#pvsud-hl');
    const hbadge  = root.querySelector('#pvsud-hbadge');
    const undoBtn = root.querySelector('#pvsud-undo');
    const notesBtn= root.querySelector('#pvsud-notes');
    const hintBtn = root.querySelector('#pvsud-hint');
    const pauseBtn= root.querySelector('#pvsud-pause');
    const pad     = root.querySelector('#pvsud-pad');

    /* build 81 cells */
    const cells = [];
    for(let i=0;i<81;i++){
      const b = document.createElement('button');
      b.type='button'; b.className='pvsud-cell'; b.dataset.i=String(i);
      board.appendChild(b); cells.push(b);
    }
    /* skeleton shimmer cells (staggered) */
    const skelgrid = root.querySelector('#pvsud-skelgrid');
    for(let i=0;i<81;i++){
      const s = document.createElement('i');
      s.className='pvsud-skt';
      s.style.animationDelay = (((i/9|0)+(i%9))*35)+'ms';
      skelgrid.appendChild(s);
    }
    /* number pad: 1-9 + erase */
    const keys = {};
    for(let d=1;d<=9;d++){
      const k = el(`<button type="button" class="pvsud-key" data-d="${d}">${d}<i class="pvsud-kcount"></i></button>`);
      pad.appendChild(k); keys[d]=k;
    }
    pad.appendChild(el(`<button type="button" class="pvsud-key pvsud-erase">⌫<span class="pvsud-etxt">${tt('erase')}</span></button>`));

    /* ---------- rendering ---------- */
    function conflictSet(){
      const s = new Set();
      for(const unit of UNITS){
        const by = {};
        for(const i of unit){ const v=vals[i]; if(!v) continue; (by[v] ||= []).push(i); }
        for(const v in by){
          const arr = by[v];
          if(arr.length<2) continue;
          for(const i of arr) if(!given[i] && !hinted[i]) s.add(i);
        }
      }
      return s;
    }
    function renderAll(){
      const conflicts = autocheck ? conflictSet() : null;
      const selVal = sel>=0 ? vals[sel] : 0;
      for(let i=0;i<81;i++){
        const cell = cells[i], r=(i/9)|0, c=i%9, v = vals[i];
        let cls = 'pvsud-cell';
        if(c%3===2 && c!==8) cls += ' pvsud-br';
        if(r%3===2 && r!==8) cls += ' pvsud-bb';
        if(given[i]) cls += ' pvsud-given';
        else if(hinted[i]) cls += ' pvsud-hinted';
        if(!v) cls += ' pvsud-empty';
        if(sel===i) cls += ' pvsud-sel';
        else if(sel>=0){
          if(PEERS[sel].indexOf(i)>=0) cls += ' pvsud-peer';
          if(selVal && v===selVal) cls += ' pvsud-same';
        }
        if(conflicts && conflicts.has(i)) cls += ' pvsud-err';
        cell.className = cls;
        if(v){ cell.innerHTML = `<span class="pvsud-val">${v}</span>`; }
        else if(notes[i]){
          let m='';
          for(let d=1;d<=9;d++){
            const on = (notes[i] & (1<<d)) !== 0;
            m += `<i class="${on&&selVal===d?'pvsud-hlnote':''}">${on?d:''}</i>`;
          }
          cell.innerHTML = `<span class="pvsud-marks">${m}</span>`;
        }
        else if(cell.firstChild) cell.innerHTML = '';
      }
      updatePad(); updateChips();
    }
    function updatePad(){
      const cnt = new Array(10).fill(0);
      for(let i=0;i<81;i++) cnt[vals[i]]++;
      for(let d=1;d<=9;d++){
        const rem = 9 - cnt[d];
        keys[d].querySelector('.pvsud-kcount').textContent = num(rem);
        keys[d].classList.toggle('pvsud-done', rem<=0 && !noteMode);
      }
      pad.classList.toggle('pvsud-nmode', noteMode);
    }
    function updateChips(){
      misEl.textContent = num(mistakes);
      hlEl.textContent = num(hintsLeft);
      hbadge.textContent = num(hintsLeft);
      hintBtn.disabled = hintsLeft<=0 || over;
      undoBtn.disabled = !undoStack.length || over;
      notesBtn.classList.toggle('pvsud-on', noteMode);
    }
    function updateTime(){ timerEl.textContent = timeStr(elapsed); }
    function pulse(i, cls, dur){
      const c = cells[i]; c.classList.add(cls);
      setTimeout(()=>c.classList.remove(cls), dur);
    }

    /* ---------- state helpers ---------- */
    function pushUndo(){
      undoStack.push({ vals:vals.slice(), notes:notes.slice(), hinted:hinted.slice(), hintsLeft });
      if(undoStack.length>300) undoStack.shift();
    }
    function undo(){
      if(over || paused) return;
      const s = undoStack.pop();
      if(!s){ PV.sound.play('tick'); return; }
      vals=s.vals; notes=s.notes; hinted=s.hinted; hintsLeft=s.hintsLeft;
      PV.sound.play('flip'); vibrate(8);
      renderAll();
    }
    function rejectLock(){
      if(sel>=0) pulse(sel,'pvsud-shake',360);
      PV.sound.play('falseStart'); vibrate(50);
    }
    function select(i){
      if(over || paused) return;
      sel = (sel===i) ? -1 : i;
      PV.sound.play('tap'); vibrate(6);
      renderAll();
    }
    function digitCount(d){ let n=0; for(let i=0;i<81;i++) if(vals[i]===d) n++; return n; }

    function inputDigit(d){
      if(over || paused) return;
      if(sel<0){ PV.sound.play('tick'); if(PV.ui?.toast) PV.ui.toast(tt('noSelect'),'warn'); return; }
      if(given[sel] || hinted[sel]){ rejectLock(); return; }
      if(noteMode){
        if(vals[sel]){ rejectLock(); return; }
        pushUndo();
        notes[sel] ^= (1<<d);
        PV.sound.play('flip'); vibrate(8);
        renderAll();
        return;
      }
      if(vals[sel]!==d && digitCount(d)>=9){ PV.sound.play('tick'); return; }
      pushUndo();
      if(vals[sel]===d){                 /* same digit again → toggle off */
        vals[sel]=0; PV.sound.play('pop'); vibrate(8);
        renderAll(); return;
      }
      vals[sel]=d; notes[sel]=0;
      for(const p of PEERS[sel]) notes[p] &= ~(1<<d);   /* auto-clean peer notes */
      let dup=false;
      for(const p of PEERS[sel]) if(vals[p]===d){ dup=true; break; }
      if(dup){
        mistakes++; updateChips();
        PV.sound.play('falseStart'); vibrate(60);
        pulse(sel,'pvsud-flash',640);
      }else{
        PV.sound.play('place'); vibrate(12);
      }
      renderAll();
      pulse(sel,'pvsud-pop',330);
      if(!dup && checkWin()) return win();
      if(!dup && boardFull()) fullButWrong();
    }
    function eraseCell(){
      if(over || paused || sel<0) return;
      if(given[sel] || hinted[sel]){ rejectLock(); return; }
      if(!vals[sel] && !notes[sel]){ PV.sound.play('tick'); return; }
      pushUndo();
      vals[sel]=0; notes[sel]=0;
      PV.sound.play('pop'); vibrate(8);
      renderAll();
    }
    function toggleNotes(){
      if(over || paused) return;
      noteMode = !noteMode;
      PV.sound.play('flip'); vibrate(10);
      renderAll();
    }
    function useHint(){
      if(over || paused) return;
      if(hintsLeft<=0){ PV.sound.play('tick'); if(PV.ui?.toast) PV.ui.toast(tt('noHints'),'warn'); return; }
      let target = -1;
      if(sel>=0 && !vals[sel] && !given[sel] && !hinted[sel]) target = sel;
      else{
        const empt=[]; for(let i=0;i<81;i++) if(!vals[i] && !given[i]) empt.push(i);
        if(!empt.length) return;
        target = empt[(Math.random()*empt.length)|0];
      }
      pushUndo();
      hintsLeft--;
      sel = target;
      vals[target] = solution[target];
      hinted[target] = true; notes[target]=0;
      for(const p of PEERS[target]) notes[p] &= ~(1<<solution[target]);
      PV.sound.play('coin'); vibrate(20);
      renderAll();
      pulse(target,'pvsud-pop',330);
      const sp = document.createElement('span');
      sp.className='pvsud-spark'; sp.textContent='✨';
      cells[target].appendChild(sp);
      setTimeout(()=>sp.remove(), 800);
      updateChips();
      if(checkWin()) win();
    }
    function checkWin(){ for(let i=0;i<81;i++) if(vals[i]!==solution[i]) return false; return true; }
    function boardFull(){ for(let i=0;i<81;i++) if(!vals[i]) return false; return true; }
    function fullButWrong(){
      PV.sound.play('tick');
      if(PV.ui?.toast) PV.ui.toast(tt('fullWrong'),'warn');
      if(autocheck) for(let i=0;i<81;i++) if(vals[i]!==solution[i]) pulse(i,'pvsud-flash',680);
    }

    /* ---------- win ---------- */
    function curScore(){
      return Math.max(50, 800 - elapsed*2 - mistakes*40 - (3-hintsLeft)*60);
    }
    function userKey(){
      let u=null; try{ u = PV.store?.me?.(); }catch(e){}
      return (u && u.u) ? u.u : 'guest';
    }
    function bestLabel(){
      const b = LS.get('best:sudoku:'+userKey()+':'+diff, null);
      return b==null ? tt('noBest') : tt('best') + timeStr(b);
    }
    function win(){
      if(finished) return;
      finished = true; over = true;
      stopTimer();
      ctx.setStatus(tt('statusDone'));
      PV.sound.play('fanfare');
      /* diagonal wave celebration */
      for(let i=0;i<81;i++){
        const r=(i/9)|0, c=i%9;
        cells[i].style.animationDelay = ((r+c)*45)+'ms';
        cells[i].classList.add('pvsud-wave');
      }
      setTimeout(()=>{ for(let i=0;i<81;i++){ cells[i].classList.remove('pvsud-wave'); cells[i].style.animationDelay=''; } }, 1800);
      updateChips();
      /* best time per difficulty */
      const bk = 'best:sudoku:'+userKey()+':'+diff;
      const best = LS.get(bk, null);
      const rec = (best==null || elapsed < best);
      if(rec) LS.set(bk, elapsed);
      if(rec && PV.ui?.toast) PV.ui.toast(tt('newRecord'),'gold');
      const used = 3 - hintsLeft;
      const score = Math.max(50, 800 - elapsed*2 - mistakes*40 - used*60);
      const sub = tt('winSub')(timeStr(elapsed), mistakes, used, rec);
      winTo = setTimeout(()=>{
        winTo = 0;
        ctx.finish({
          res:'w',
          scores:{ [ctx.selfPid]: score },
          stats:{ mistakes, hints: used },
          vsHuman:false,
          sub,
        });
      }, 1500);
    }

    /* ---------- timer / pause ---------- */
    function startTimer(){
      stopTimer();
      timer = setInterval(()=>{ if(paused || over) return; elapsed++; updateTime(); }, 1000);
    }
    function stopTimer(){ if(timer){ clearInterval(timer); timer=0; } }
    function setPaused(p){
      if(over || paused===p) return;
      paused = p;
      pov.classList.toggle('hidden', !p);
      bwrap.classList.toggle('pvsud-paused', p);
      pauseBtn.textContent = p ? '▶' : '⏸';
      if(p){ pbestEl.textContent = bestLabel(); PV.sound.play('tick'); }
      else PV.sound.play('go');
      vibrate(10);
      ctx.setStatus(getStatus());
    }

    /* ---------- game lifecycle ---------- */
    function newGame(){
      over=false; finished=false; paused=false;
      mistakes=0; hintsLeft=3; elapsed=0; sel=-1; noteMode=false;
      undoStack.length=0;
      vals.fill(0); given.fill(false); hinted.fill(false); notes.fill(0); solution.fill(0);
      pov.classList.add('hidden'); bwrap.classList.remove('pvsud-paused');
      pauseBtn.textContent='⏸';
      skel.classList.remove('hidden');
      updateTime(); updateChips(); renderAll();
      ctx.setStatus(tt('gen'));
      clearTimeout(genTo);
      genTo = setTimeout(()=>{
        const g = generate(diff);
        solution = g.solution;
        for(let i=0;i<81;i++) if(g.puzzle[i]){ vals[i]=g.puzzle[i]; given[i]=true; }
        renderAll();
        /* staggered board entrance */
        for(let i=0;i<81;i++){
          cells[i].style.animationDelay = (((i/9|0)+(i%9))*16)+'ms';
          cells[i].classList.add('pvsud-in');
        }
        setTimeout(()=>{ for(let i=0;i<81;i++){ cells[i].classList.remove('pvsud-in'); cells[i].style.animationDelay=''; } }, 1300);
        skel.classList.add('hidden');
        startTimer();
        ctx.setStatus(tt('statusPlaying'));
      }, 300);
    }

    /* ---------- events ---------- */
    board.addEventListener('click', e=>{
      const c = e.target.closest('.pvsud-cell');
      if(c) select(+c.dataset.i);
    });
    pad.addEventListener('click', e=>{
      const k = e.target.closest('.pvsud-key');
      if(!k) return;
      if(k.dataset.d) inputDigit(+k.dataset.d);
      else eraseCell();
    });
    undoBtn.addEventListener('click', undo);
    notesBtn.addEventListener('click', toggleNotes);
    hintBtn.addEventListener('click', useHint);
    pauseBtn.addEventListener('click', ()=>setPaused(!paused));
    root.querySelector('#pvsud-resume').addEventListener('click', ()=>setPaused(false));
    const autoEl = root.querySelector('#pvsud-auto');
    autoEl.checked = !!autocheck;
    autoEl.addEventListener('change', ()=>{ autocheck = autoEl.checked; LS.set('sudoku:autocheck', autocheck); PV.sound.play('tap'); renderAll(); });

    function onKey(e){
      if(over) return;
      const k = e.key;
      if(paused){ if(k==='p'||k==='P'){ setPaused(false); } return; }
      if(k>='1' && k<='9'){ inputDigit(+k); e.preventDefault(); return; }
      if(k==='Backspace' || k==='Delete'){ eraseCell(); e.preventDefault(); return; }
      if(k==='n'||k==='N'){ toggleNotes(); return; }
      if(k==='h'||k==='H'){ useHint(); return; }
      if(k==='p'||k==='P'){ setPaused(true); return; }
      if(k && k.indexOf('Arrow')===0){
        e.preventDefault();
        if(sel<0){ sel=40; PV.sound.play('tap'); renderAll(); return; }
        let r=(sel/9)|0, c=sel%9;
        if(k==='ArrowUp') r=(r+8)%9;
        else if(k==='ArrowDown') r=(r+1)%9;
        else if(k==='ArrowLeft') c=(c+8)%9;
        else if(k==='ArrowRight') c=(c+1)%9;
        sel = r*9+c;
        PV.sound.play('tap');
        renderAll();
      }
    }
    function onVis(){ if(document.hidden && !over && !paused) setPaused(true); }
    document.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVis);

    /* ---------- controller ---------- */
    return {
      init(){ ctx.setStatus(tt('gen')); },
      start(){ newGame(); },
      pause(){ setPaused(true); },
      resume(){ setPaused(false); },
      end(){ over=true; stopTimer(); },
      reset(){ newGame(); },
      getState(){
        return { v:1, diff, vals:vals.slice(), notes:notes.slice(), given:given.slice(),
                 hinted:hinted.slice(), solution:solution.slice(),
                 elapsed, mistakes, hintsLeft, sel, over, paused };
      },
      getScores(){ return { [ctx.selfPid]: curScore() }; },
      getStatus(){ return over ? tt('statusDone') : (paused ? tt('statusPaused') : tt('statusPlaying')); },
      destroy(){
        stopTimer(); clearTimeout(genTo); clearTimeout(winTo);
        document.removeEventListener('keydown', onKey);
        document.removeEventListener('visibilitychange', onVis);
        style.remove();
        root.remove();
      },
    };
  }
});
})();
