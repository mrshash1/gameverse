/* ============================================================
   GameVerse — بازی «حافظه» (نمونهٔ مرجع برای سایر بازی‌ها)
   قرارداد کامل: js/games/sdk.js
   ============================================================ */

import { el, shuffle, clamp, fmtNum, fmtTime } from '../core/utils.js';
import { registerFactory } from '../data/registry.js';

const EMOJIS = ['🍕', '🚀', '🐼', '🌈', '⚽', '🌻', '🎧', '🐙'];

const CSS = `
.gv-memory { display:flex; flex-direction:column; align-items:center; gap:14px; }
.gv-memory .gvm-grid {
  display:grid; grid-template-columns:repeat(4,1fr); gap:10px;
  width:min(92vw, 420px);
}
.gvm-card { aspect-ratio:1; perspective:600px; border:none; background:none; padding:0; cursor:pointer; }
.gvm-inner {
  position:relative; width:100%; height:100%;
  transform-style:preserve-3d; transition:transform .35s ease;
}
.gvm-card.flipped .gvm-inner, .gvm-card.done .gvm-inner { transform:rotateY(180deg); }
.gvm-face {
  position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
  border-radius:14px; backface-visibility:hidden; -webkit-backface-visibility:hidden;
  font-size:clamp(24px, 7vw, 40px);
}
.gvm-back { background:linear-gradient(135deg, var(--gv-primary, #7c3aed), var(--gv-secondary, #06b6d4)); box-shadow:0 6px 16px rgba(0,0,0,.35); }
.gvm-back::after { content:'❓'; font-size:.55em; opacity:.8; }
.gvm-front { background:var(--gv-surface-2, #1a2236); transform:rotateY(180deg); border:1px solid rgba(255,255,255,.08); }
.gvm-card.done .gvm-front { background:rgba(16,185,129,.15); border-color:rgba(16,185,129,.5); }
.gvm-card.shake { animation:gvm-shake .3s; }
@keyframes gvm-shake { 25%{transform:translateX(4px)} 50%{transform:translateX(-4px)} 75%{transform:translateX(3px)} }
.gvm-paused {
  position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
  background:rgba(11,15,26,.82); border-radius:16px; z-index:5; font-size:22px; font-weight:800;
}
`;

function createGame(host) {
  host.root.innerHTML = '';
  const style = el('style', { text: CSS });
  document.head.appendChild(style);

  /* ---------- وضعیت ---------- */
  const deck = shuffle([...EMOJIS, ...EMOJIS]); // ۸ جفت
  let first = null;          // اولین کارت باز
  let lock = false;          // قفل موقت هنگام بررسی
  let matched = 0;           // تعداد جفت‌های پیدا شده
  let moves = 0;
  let elapsed = 0;           // ثانیه — بدون مکث‌ها
  let timer = null;
  let paused = false;
  let finished = false;

  /* ---------- HUD ---------- */
  const hud = () => host.setHud({ score: null, time: fmtTime(elapsed), note: `حرکت‌ها: ${fmtNum(moves)}` });
  hud();

  const board = el('div', { class: 'gv-memory' });
  const grid = el('div', { class: 'gvm-grid' });
  board.append(grid);
  host.root.append(board);

  /* ---------- ساخت کارت‌ها ---------- */
  deck.forEach((emoji, i) => {
    const card = el('button', { class: 'gvm-card', 'aria-label': 'کارت بسته', type: 'button' },
      el('div', { class: 'gvm-inner' },
        el('div', { class: 'gvm-face gvm-back' }),
        el('div', { class: 'gvm-face gvm-front', text: emoji })
      )
    );
    card.addEventListener('click', () => flip(card, emoji));
    grid.append(card);
  });

  function flip(card, emoji) {
    if (lock || paused || finished) return;
    if (card.classList.contains('flipped') || card.classList.contains('done')) return;
    host.sound('flip');
    card.classList.add('flipped');

    if (!first) { first = { card, emoji }; return; }

    moves++;
    hud();
    const a = first;
    first = null;

    if (a.emoji === emoji) {
      a.card.classList.add('done');
      card.classList.add('done');
      matched++;
      host.sound('pop');
      if (matched === deck.length / 2) win();
    } else {
      lock = true;
      host.sound('wrong');
      setTimeout(() => {
        a.card.classList.remove('flipped');
        card.classList.remove('flipped');
        lock = false;
      }, 650);
    }
  }

  function win() {
    finished = true;
    stopTimer();
    const score = clamp(Math.round(1400 - moves * 22 - elapsed * 5), 60, 1400);
    host.sound('win');
    setTimeout(() => host.finish({
      outcome: 'win',
      score,
      durationSec: Math.round(elapsed),
      stats: [
        { label: 'حرکت‌ها', value: fmtNum(moves) },
        { label: 'زمان', value: fmtTime(elapsed) },
      ]
    }), 500);
  }

  /* ---------- تایمر (با پشتیبانی مکث) ---------- */
  function startTimer() {
    stopTimer();
    timer = setInterval(() => {
      if (!paused && !finished) { elapsed++; hud(); }
    }, 1000);
  }
  function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }

  /* ---------- مکث ---------- */
  const overlay = el('div', { class: 'gvm-paused', text: '⏸ مکث' });
  overlay.style.display = 'none';
  board.style.position = 'relative';
  board.append(overlay);

  return {
    start() { startTimer(); },
    pause() { paused = true; overlay.style.display = 'flex'; },
    resume() { paused = false; overlay.style.display = 'none'; },
    destroy() { stopTimer(); style.remove(); host.root.innerHTML = ''; }
  };
}

registerFactory('memory', createGame);
export default createGame;
