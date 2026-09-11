/* ============================================================
   GameVerse — بازی «چهار در یک ردیف» (Connect Four)
   قرارداد کامل: js/games/sdk.js
   ------------------------------------------------------------
   تختهٔ ۷×۶ — قرمز 🔴 (شما/بازیکن ۱) و زرد 🟡 (ربات/بازیکن ۲).
   ربات: آسان (تصادفی با گرایش به مرکز)، متوسط (Minimax عمق ۲)،
   سخت (Minimax عمق ۴ با هرس آلفا-بتا) + ارزیابی پنجره‌های ۴تایی.
   ============================================================ */

import { el, fmtNum, fmtTime } from '../core/utils.js';
import { registerFactory } from '../data/registry.js';

const CSS = `
.gv-c4 { display:flex; flex-direction:column; align-items:center; gap:12px; position:relative; }
.gvc4-board {
  position:relative; width:min(92vw, 460px); padding:10px; border-radius:14px;
  background:linear-gradient(160deg, #1d4ed8, #1e3a8a);
  box-shadow:0 8px 20px rgba(0,0,0,.35); overflow:hidden;
}
.gvc4-grid { display:grid; grid-template-columns:repeat(7, 1fr); gap:5px; }
.gvc4-cell { aspect-ratio:1; position:relative; }
.gvc4-hole { position:absolute; inset:0; border-radius:50%; background:rgba(7,11,25,.85); box-shadow:inset 0 2px 5px rgba(0,0,0,.6); }
.gvc4-disc { position:absolute; inset:0; border-radius:50%; }
.gvc4-red { background:radial-gradient(circle at 35% 30%, #fb7185, #dc2626 60%, #991b1b); }
.gvc4-yellow { background:radial-gradient(circle at 35% 30%, #fde047, #f59e0b 60%, #b45309); }
.gvc4-drop { animation:gvc4-fall var(--gvc4-dur, .5s) ease-in both; }
@keyframes gvc4-fall {
  0%   { transform:translateY(var(--gvc4-from)); }
  72%  { transform:translateY(0); }
  85%  { transform:translateY(-5%); }
  100% { transform:translateY(0); }
}
.gvc4-cols { position:absolute; inset:0; display:grid; grid-template-columns:repeat(7, 1fr); z-index:2; }
.gvc4-col { background:transparent; border:none; padding:0; cursor:pointer; min-height:44px; }
.gvc4-col:hover { background:rgba(255,255,255,.09); }
.gvc4-win { animation:gvc4-winpulse 1s ease-in-out infinite; }
@keyframes gvc4-winpulse {
  0%,100% { filter:brightness(1);   box-shadow:0 0 0 rgba(255,255,255,0); }
  50%     { filter:brightness(1.4); box-shadow:0 0 16px rgba(255,255,255,.85); }
}
.gvc4-result { min-height:30px; font-size:19px; font-weight:800; }
.gvc4-paused {
  position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
  background:rgba(11,15,26,.82); border-radius:16px; z-index:5; font-size:22px; font-weight:800;
}
`;

const ROWS = 6;
const COLS = 7;
const GAP = 5; // باید با gap در CSS یکی باشد
const ORDER = [3, 2, 4, 1, 5, 0, 6]; // ترتیب ستون‌ها از مرکز — هرس بهتر
const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];

/** همهٔ پنجره‌های ۴سلولی (افقی، عمودی، دو مورب) برای ارزیابی */
const WINDOWS = (() => {
  const w = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c <= COLS - 4; c++)
      w.push([[r, c], [r, c + 1], [r, c + 2], [r, c + 3]]);             // افقی
  for (let c = 0; c < COLS; c++)
    for (let r = 0; r <= ROWS - 4; r++)
      w.push([[r, c], [r + 1, c], [r + 2, c], [r + 3, c]]);             // عمودی
  for (let r = 0; r <= ROWS - 4; r++)
    for (let c = 0; c <= COLS - 4; c++)
      w.push([[r, c], [r + 1, c + 1], [r + 2, c + 2], [r + 3, c + 3]]); // مورب ↘
  for (let r = 0; r <= ROWS - 4; r++)
    for (let c = 3; c < COLS; c++)
      w.push([[r, c], [r + 1, c - 1], [r + 2, c - 2], [r + 3, c - 3]]); // مورب ↙
  return w;
})();

function createGame(host) {
  host.root.innerHTML = '';
  const style = el('style', { text: CSS });
  document.head.appendChild(style);

  /* ---------- وضعیت ---------- */
  const vsAI = host.mode === 'ai';
  const HU = 'R';   // قرمز — شما / بازیکن ۱ (شروع‌کننده)
  const AIC = 'Y';  // زرد — ربات / بازیکن ۲
  const DISC = { [HU]: 'gvc4-red', [AIC]: 'gvc4-yellow' };
  const MARK = { [HU]: '🔴', [AIC]: '🟡' };

  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  let turn = HU;
  let moves = 0;
  let elapsed = 0;                  // ثانیه — بدون مکث‌ها
  let timer = null;
  let paused = false;
  let finished = false;
  let aiPending = false;            // آیا زمان‌سنج فکر ربات فعال است؟

  /* ---------- زمان‌سنج‌های قابل توقف ---------- */
  const pendings = new Set();
  function after(ms, fn) {
    const t = { id: null, fn, remaining: ms, startedAt: Date.now() };
    t.id = setTimeout(() => { pendings.delete(t); fn(); }, ms);
    pendings.add(t);
    return t;
  }
  function freezeTimers() {
    const now = Date.now();
    for (const t of pendings) { clearTimeout(t.id); t.remaining -= now - t.startedAt; }
  }
  function unfreezeTimers() {
    for (const t of pendings) {
      t.startedAt = Date.now();
      t.id = setTimeout(() => { pendings.delete(t); t.fn(); }, Math.max(0, t.remaining));
    }
  }
  function clearTimers() {
    for (const t of pendings) clearTimeout(t.id);
    pendings.clear();
  }

  /* ---------- HUD ---------- */
  const noteFor = () => {
    if (finished) return '';
    if (!vsAI) return turn === HU ? 'نوبت بازیکن ۱ 🔴' : 'نوبت بازیکن ۲ 🟡';
    return turn === HU ? 'نوبت شما 🔴' : 'نوبت ربات 🟡 · 🤖 فکر می‌کند…';
  };
  const hud = () => host.setHud({ score: null, time: fmtTime(elapsed), note: noteFor() });
  hud();

  /* ---------- DOM ---------- */
  const wrap = el('div', { class: 'gv-c4' });
  const boardEl = el('div', { class: 'gvc4-board' });
  const gridEl = el('div', { class: 'gvc4-grid' });
  const colsEl = el('div', { class: 'gvc4-cols' });
  const resultLine = el('div', { class: 'gvc4-result' });
  boardEl.append(gridEl, colsEl);
  const overlay = el('div', { class: 'gvc4-paused', text: '⏸ مکث' });
  overlay.style.display = 'none';
  wrap.append(boardEl, resultLine, overlay);
  host.root.append(wrap);

  const cells = [];
  for (let r = 0; r < ROWS; r++) {
    const rowCells = [];
    for (let c = 0; c < COLS; c++) {
      const cell = el('div', { class: 'gvc4-cell' }, el('div', { class: 'gvc4-hole' }));
      gridEl.append(cell);
      rowCells.push(cell);
    }
    cells.push(rowCells);
  }
  for (let c = 0; c < COLS; c++) {
    const btn = el('button', { class: 'gvc4-col', type: 'button', 'aria-label': `ستون ${fmtNum(c + 1)}` });
    btn.addEventListener('click', () => onCol(c));
    colsEl.append(btn);
  }

  /* ---------- منطق تخته ---------- */
  function landingRow(b, c) {
    for (let r = ROWS - 1; r >= 0; r--) if (!b[r][c]) return r;
    return null;
  }
  const validCols = (b) => ORDER.filter((c) => b[0][c] === null);

  function isWinAt(b, r, c, mark) {
    for (const [dr, dc] of DIRS) {
      let count = 1;
      for (const s of [1, -1]) {
        let rr = r + dr * s, cc = c + dc * s;
        while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && b[rr][cc] === mark) {
          count++; rr += dr * s; cc += dc * s;
        }
      }
      if (count >= 4) return true;
    }
    return false;
  }

  function winRun(r, c, mark) {
    for (const [dr, dc] of DIRS) {
      const run = [[r, c]];
      for (const s of [1, -1]) {
        let rr = r + dr * s, cc = c + dc * s;
        while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && grid[rr][cc] === mark) {
          run.push([rr, cc]); rr += dr * s; cc += dc * s;
        }
      }
      if (run.length >= 4) return run;
    }
    return null;
  }

  function renderDisc(r, c, mark) {
    const disc = el('div', { class: `gvc4-disc ${DISC[mark]}` });
    // سقوط از بالای تخته: -(ردیف+۱) × (ارتفاع خانه + فاصله)
    disc.style.setProperty('--gvc4-from', `calc(${-(r + 1)} * (100% + ${GAP}px))`);
    disc.style.setProperty('--gvc4-dur', `${(0.18 + 0.07 * (r + 1)).toFixed(2)}s`);
    disc.classList.add('gvc4-drop');
    cells[r][c].append(disc);
  }

  /* ---------- حرکت‌ها ---------- */
  function onCol(c) {
    if (paused || finished) return;
    if (vsAI && turn !== HU) return;
    if (landingRow(grid, c) == null) return;
    doDrop(c, turn);
  }

  function doDrop(c, mark) {
    const r = landingRow(grid, c);
    if (r == null) return;
    grid[r][c] = mark;
    moves++;
    renderDisc(r, c, mark);
    host.sound('place');
    const run = winRun(r, c, mark);
    if (run) { endGame(mark, run); return; }
    if (moves === ROWS * COLS) { endGame(null, null); return; }
    turn = mark === HU ? AIC : HU;
    hud();
    if (vsAI && turn === AIC) scheduleAI();
  }

  /* ---------- هوش مصنوعی ---------- */
  function scheduleAI() {
    if (aiPending) return;
    aiPending = true;
    after(500, () => {
      aiPending = false;
      if (paused || finished) return;   // ⬅ هرگز هنگام مکث/پایان حرکت نکن
      const col = aiPick();
      if (col != null) doDrop(col, AIC);
    });
  }

  /** ارزیابی پنجره‌های ۴تایی + ترجیح ستون مرکزی */
  function evaluate(b) {
    let s = 0;
    for (let r = 0; r < ROWS; r++) if (b[r][3] === AIC) s += 3;
    for (const w of WINDOWS) {
      let mine = 0, theirs = 0;
      for (const [r, c] of w) {
        const v = b[r][c];
        if (v === AIC) mine++;
        else if (v === HU) theirs++;
      }
      if (mine && theirs) continue; // پنجرهٔ بسته
      if (mine === 3) s += 50; else if (mine === 2) s += 5;
      if (theirs === 3) s -= 60; else if (theirs === 2) s -= 6; // جریمهٔ تهدید حریف
    }
    return s;
  }

  function minimax(b, depth, alpha, beta, current) {
    const valid = validCols(b);
    if (depth === 0 || !valid.length) return { col: null, score: evaluate(b) };
    let bestCol = valid[0];
    if (current === AIC) {
      let best = -Infinity;
      for (const c of valid) {
        const r = landingRow(b, c);
        b[r][c] = AIC;
        let score;
        if (isWinAt(b, r, c, AIC)) score = 1000000 - depth; // برد سریع‌تر بهتر است
        else score = minimax(b, depth - 1, alpha, beta, HU).score;
        b[r][c] = null;
        if (score > best) { best = score; bestCol = c; }
        alpha = Math.max(alpha, best);
        if (alpha >= beta) break; // هرس آلفا-بتا
      }
      return { col: bestCol, score: best };
    }
    let best = Infinity;
    for (const c of valid) {
      const r = landingRow(b, c);
      b[r][c] = HU;
      let score;
      if (isWinAt(b, r, c, HU)) score = -1000000 + depth; // باخت دیرتر بهتر است
      else score = minimax(b, depth - 1, alpha, beta, AIC).score;
      b[r][c] = null;
      if (score < best) { best = score; bestCol = c; }
      beta = Math.min(beta, best);
      if (alpha >= beta) break;
    }
    return { col: bestCol, score: best };
  }

  function aiPick() {
    const valid = validCols(grid);
    if (!valid.length) return null;
    if (host.difficulty === 'آسان') {
      // تصادفی با گرایش ملایم به مرکز (وزن ۱ تا ۴)
      const weights = valid.map((c) => COLS - Math.abs(c - 3) * 2);
      const total = weights.reduce((a, w) => a + w, 0);
      let roll = Math.random() * total;
      for (let i = 0; i < valid.length; i++) { roll -= weights[i]; if (roll <= 0) return valid[i]; }
      return valid[valid.length - 1];
    }
    const depth = host.difficulty === 'سخت' ? 4 : 2; // متوسط = عمق ۲
    const { col } = minimax(grid, depth, -Infinity, Infinity, AIC);
    return col != null ? col : valid[0];
  }

  /* ---------- پایان مسابقه ---------- */
  function scoreFor(outcome) {
    if (outcome === 'win') {
      let s = 200;
      if (!vsAI || host.difficulty === 'متوسط') s += 50; // دونفره ← پاداش «متوسط»
      else if (host.difficulty === 'سخت') s += 100;
      return s;
    }
    return outcome === 'draw' ? 60 : 0;
  }

  function endGame(winner, run) {
    finished = true;
    stopTimer();
    if (run) {
      for (const [r, c] of run) {
        const disc = cells[r][c].querySelector('.gvc4-disc');
        if (disc) disc.classList.add('gvc4-win');
      }
    }
    let outcome, text;
    if (!winner) { outcome = 'draw'; text = '🤝 مساوی'; }
    else if (vsAI) {
      outcome = winner === HU ? 'win' : 'lose';
      text = winner === HU ? '🎉 بردی!' : '🤖 ربات برد';
    } else {
      outcome = 'win';
      text = winner === HU ? '🎉 برد بازیکن ۱!' : '🎉 برد بازیکن ۲!';
    }
    host.sound(outcome === 'win' ? 'win' : outcome === 'lose' ? 'lose' : 'pop');
    resultLine.textContent = text;
    hud();

    after(450, () => {
      host.finish({
        outcome,
        score: scoreFor(outcome),
        durationSec: Math.max(1, Math.round(elapsed)),
        stats: [
          { label: 'حرکت‌ها', value: fmtNum(moves) },
          { label: 'حریف', value: vsAI ? `ربات (${host.difficulty || 'عادی'})` : 'بازیکن ۲' },
        ],
      });
    });
  }

  /* ---------- تایمر (با پشتیبانی مکث) ---------- */
  function startTimer() {
    stopTimer();
    timer = setInterval(() => {
      if (!paused && !finished) { elapsed++; hud(); }
    }, 1000);
  }
  function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }

  return {
    start() { startTimer(); if (vsAI && turn === AIC) scheduleAI(); },
    pause() { paused = true; freezeTimers(); overlay.style.display = 'flex'; },
    resume() { paused = false; unfreezeTimers(); overlay.style.display = 'none'; },
    destroy() {
      stopTimer();
      clearTimers();
      aiPending = false;
      style.remove();
      host.root.innerHTML = '';
    },
  };
}

registerFactory('connect4', createGame);
export default createGame;
