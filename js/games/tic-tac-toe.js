/* ============================================================
   GameVerse — بازی «دوز» (Tic-Tac-Toe)
   قرارداد کامل: js/games/sdk.js
   ------------------------------------------------------------
   صفحهٔ ۳×۳ — انسان ✕ (بازیکن ۱) و ربات/بازیکن ۲ ○.
   سطوح ربات: آسان (۳۰٪ بهترین حرکت)، متوسط (هیوریستیک)،
   سخت (Minimax کامل — شکست‌ناپذیر).
   ============================================================ */

import { el, pick, fmtNum, fmtTime } from '../core/utils.js';
import { registerFactory } from '../data/registry.js';

const CSS = `
.gv-ttt { display:flex; flex-direction:column; align-items:center; gap:12px; position:relative; }
.gvttt-grid {
  display:grid; grid-template-columns:repeat(3,1fr); gap:10px;
  width:min(92vw, 480px);
}
.gvttt-cell {
  aspect-ratio:1; min-width:90px; min-height:90px;
  border:none; border-radius:16px; cursor:pointer; padding:0;
  background:var(--gv-surface-2, #1a2236);
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.08);
  font-size:clamp(34px, 9vw, 54px); font-weight:800; line-height:1;
  color:var(--gv-text, #e5e7eb);
  transition:transform .12s ease, background .25s ease;
}
.gvttt-cell:hover:not(:disabled) { transform:scale(1.05); }
.gvttt-cell:disabled { cursor:default; }
.gvttt-x { color:#22d3ee; }
.gvttt-o { color:#fbbf24; }
.gvttt-win { animation:gvttt-pulse 1.1s ease-in-out infinite; }
@keyframes gvttt-pulse {
  0%,100% { background:rgba(34,197,94,.14); box-shadow:0 0 0 rgba(34,197,94,0); }
  50%     { background:rgba(34,197,94,.4);  box-shadow:0 0 20px rgba(34,197,94,.55); }
}
.gvttt-result { min-height:30px; font-size:20px; font-weight:800; }
.gvttt-paused {
  position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
  background:rgba(11,15,26,.82); border-radius:16px; z-index:5; font-size:22px; font-weight:800;
}
`;

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // افقی
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // عمودی
  [0, 4, 8], [2, 4, 6],            // مورب
];

function createGame(host) {
  host.root.innerHTML = '';
  const style = el('style', { text: CSS });
  document.head.appendChild(style);

  /* ---------- وضعیت ---------- */
  const vsAI = host.mode === 'ai';
  const HUMAN = 'X';                     // شما / بازیکن ۱
  const AI = 'O';                        // ربات / بازیکن ۲
  const MARK = { [HUMAN]: '✕', [AI]: '○' };

  const board = Array(9).fill(null);
  let turn = HUMAN;                      // در همهٔ حالت‌ها ✕ شروع می‌کند
  let moves = 0;
  let elapsed = 0;                       // ثانیه — بدون مکث‌ها
  let timer = null;
  let paused = false;
  let finished = false;
  let aiPending = false;                 // آیا زمان‌سنج حرکت ربات فعال است؟

  /* ---------- زمان‌سنج‌های قابل توقف (مکث، همهٔ timeoutها را منجمد می‌کند) ---------- */
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
    if (!vsAI) return turn === HUMAN ? 'نوبت بازیکن ۱ (✕)' : 'نوبت بازیکن ۲ (○)';
    return turn === HUMAN ? 'نوبت شما (✕)' : 'نوبت ربات (○)';
  };
  const hud = () => host.setHud({ score: null, time: fmtTime(elapsed), note: noteFor() });
  hud();

  /* ---------- DOM ---------- */
  const wrap = el('div', { class: 'gv-ttt' });
  const grid = el('div', { class: 'gvttt-grid' });
  const resultLine = el('div', { class: 'gvttt-result' });
  const overlay = el('div', { class: 'gvttt-paused', text: '⏸ مکث' });
  overlay.style.display = 'none';
  wrap.append(grid, resultLine, overlay);
  host.root.append(wrap);

  const cells = board.map((_, i) => {
    const btn = el('button', { class: 'gvttt-cell', type: 'button', 'aria-label': `خانه ${fmtNum(i + 1)}` });
    btn.addEventListener('click', () => play(i));
    grid.append(btn);
    return btn;
  });

  /* ---------- حرکت‌ها ---------- */
  function play(i) {
    if (paused || finished || board[i]) return;
    if (vsAI && turn !== HUMAN) return;
    host.sound('click');
    applyMove(i, turn);
    if (!finished && vsAI && turn === AI) scheduleAI();
  }

  function applyMove(i, mark) {
    board[i] = mark;
    moves++;
    const cell = cells[i];
    cell.textContent = MARK[mark];
    cell.classList.add(mark === HUMAN ? 'gvttt-x' : 'gvttt-o');
    cell.disabled = true;
    const line = winLine(board, mark);
    if (line) { endGame(mark, line); return; }
    if (moves === 9) { endGame(null, null); return; }
    turn = mark === HUMAN ? AI : HUMAN;
    hud();
  }

  /* ---------- هوش مصنوعی ---------- */
  function scheduleAI() {
    if (aiPending) return;
    aiPending = true;
    after(450, () => {
      aiPending = false;
      if (paused || finished) return;   // ⬅ هرگز هنگام مکث/پایان حرکت نکن
      const i = aiPick();
      if (i != null) applyMove(i, AI);
    });
  }

  const empties = (b) => b.map((v, i) => (v ? null : i)).filter((v) => v !== null);

  function winLine(b, mark) {
    for (const L of LINES) if (L.every((i) => b[i] === mark)) return L;
    return null;
  }

  /** Minimax کامل — بهترین حرکت مطلق برای mark */
  function minimax(b, current, depth) {
    if (winLine(b, AI)) return { i: null, score: 10 - depth };
    if (winLine(b, HUMAN)) return { i: null, score: depth - 10 };
    const free = empties(b);
    if (!free.length) return { i: null, score: 0 };
    let best = null;
    for (const i of free) {
      b[i] = current;
      const { score } = minimax(b, current === AI ? HUMAN : AI, depth + 1);
      b[i] = null;
      if (!best || (current === AI ? score > best.score : score < best.score)) best = { i, score };
    }
    return best;
  }
  function bestMove(mark) {
    const res = minimax([...board], mark, 0);
    return res ? res.i : null;
  }

  /** هیوریستیک سطح متوسط: برد ← دفاع ← مرکز ← گوشه/ضلع تصادفی */
  function heuristicMove() {
    const completing = (m) => {
      for (const L of LINES) {
        const vals = L.map((i) => board[i]);
        if (vals.filter((v) => v === m).length === 2 && vals.includes(null)) return L[vals.indexOf(null)];
      }
      return null;
    };
    const winI = completing(AI); if (winI != null) return winI;
    const blockI = completing(HUMAN); if (blockI != null) return blockI;
    if (!board[4]) return 4;
    const corners = [0, 2, 6, 8].filter((i) => !board[i]);
    if (corners.length) return pick(corners);
    const free = empties(board);
    return free.length ? pick(free) : null;
  }

  function aiPick() {
    const free = empties(board);
    if (!free.length) return null;
    if (host.difficulty === 'آسان') return Math.random() < 0.3 ? bestMove(AI) : pick(free);
    if (host.difficulty === 'متوسط') return heuristicMove();
    return bestMove(AI); // سخت — Minimax کامل (شکست‌ناپذیر)
  }

  /* ---------- پایان مسابقه ---------- */
  function scoreFor(outcome) {
    if (outcome === 'win') {
      let s = 100;
      if (!vsAI || host.difficulty === 'متوسط') s += 50; // دونفره ← پاداش «متوسط»
      else if (host.difficulty === 'سخت') s += 100;
      return s;
    }
    return outcome === 'draw' ? 40 : 0;
  }

  function endGame(winner, line) {
    finished = true;
    stopTimer();
    hud();
    cells.forEach((c) => { c.disabled = true; });
    if (line) line.forEach((i) => cells[i].classList.add('gvttt-win'));

    let outcome, text;
    if (!winner) { outcome = 'draw'; text = '🤝 مساوی'; }
    else if (vsAI) {
      outcome = winner === HUMAN ? 'win' : 'lose';
      text = winner === HUMAN ? '🎉 بردی!' : '🤖 ربات برد';
    } else {
      outcome = 'win';
      text = winner === HUMAN ? '🎉 برد بازیکن ۱!' : '🎉 برد بازیکن ۲!';
    }

    host.sound(outcome === 'win' ? 'win' : outcome === 'lose' ? 'lose' : 'pop');
    resultLine.textContent = text;

    after(300, () => {
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
    start() { startTimer(); if (vsAI && turn === AI) scheduleAI(); },
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

registerFactory('tic-tac-toe', createGame);
export default createGame;
