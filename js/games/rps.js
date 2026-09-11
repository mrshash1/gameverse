/* ============================================================
   GameVerse — بازی «سنگ کاغذ قیچی»
   قرارداد کامل: js/games/sdk.js
   ------------------------------------------------------------
   بهترین از ۵ راند (اولین به ۳ برد). ربات فراوانی حرکت‌های
   حریف را ثبت می‌کند و با احتمال ۶۵٪ ضدِ حرکت پرتکرار را می‌زند.
   حالت دونفره: پردهٔ حریم برای هر بازیکن («بازیکن ۲ نگاه نکند!»).
   ============================================================ */

import { el, pick, fmtNum, fmtTime } from '../core/utils.js';
import { registerFactory } from '../data/registry.js';

const CSS = `
.gv-rps {
  display:flex; flex-direction:column; align-items:center; gap:14px;
  position:relative; width:min(92vw, 480px);
}
.gvrps-score { display:flex; justify-content:space-between; align-items:center; gap:10px; width:100%; font-size:14px; font-weight:700; }
.gvrps-side { display:flex; align-items:center; gap:7px; }
.gvrps-vslabel { font-size:16px; opacity:.75; }
.gvrps-pips { display:flex; gap:5px; }
.gvrps-pip { width:14px; height:14px; border-radius:50%; border:2px solid rgba(255,255,255,.35); }
.gvrps-pip.gvrps-on { background:#22c55e; border-color:#22c55e; box-shadow:0 0 8px rgba(34,197,94,.7); }
.gvrps-arena {
  width:100%; min-height:112px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px;
  background:var(--gv-surface-2, #1a2236); border-radius:16px; padding:14px;
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.08);
}
.gvrps-big { font-size:clamp(38px, 12vw, 60px); line-height:1.25; min-height:1.25em; }
.gvrps-vs { font-size:.45em; opacity:.75; margin:0 12px; vertical-align:middle; }
.gvrps-msg { font-size:17px; font-weight:700; min-height:24px; text-align:center; }
.gvrps-shake { animation:gvrps-shake .23s linear 3; }
@keyframes gvrps-shake { 0%,100% { transform:translateX(0); } 25% { transform:translateX(-5px); } 75% { transform:translateX(5px); } }
.gvrps-choices { display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; width:100%; }
.gvrps-choice {
  min-height:88px; border:none; border-radius:16px; cursor:pointer; padding:8px;
  display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px;
  background:var(--gv-surface-2, #1a2236); color:var(--gv-text, #e5e7eb); font:inherit;
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.08);
  transition:transform .12s ease, background .2s ease;
}
.gvrps-choice:hover { transform:scale(1.05); }
.gvrps-emoji { font-size:34px; line-height:1; }
.gvrps-label { font-size:14px; font-weight:800; }
.gvrps-cover {
  position:absolute; inset:0; z-index:6; display:flex; flex-direction:column; align-items:center; justify-content:center;
  gap:16px; background:rgba(11,15,26,.94); border-radius:16px; padding:18px; text-align:center;
}
.gvrps-cover-msg { font-size:17px; font-weight:800; line-height:1.9; }
.gvrps-ready {
  border:none; border-radius:12px; padding:12px 28px; min-height:44px; cursor:pointer;
  font-weight:800; font-size:16px; color:#fff;
  background:linear-gradient(135deg, var(--gv-primary, #7c3aed), var(--gv-secondary, #06b6d4));
}
.gvrps-paused {
  position:absolute; inset:0; z-index:7; display:flex; align-items:center; justify-content:center;
  background:rgba(11,15,26,.82); border-radius:16px; font-size:22px; font-weight:800;
}
`;

const MOVES = [
  { id: 'rock', emoji: '🪨', label: 'سنگ' },
  { id: 'paper', emoji: '📄', label: 'کاغذ' },
  { id: 'scissors', emoji: '✂️', label: 'قیچی' },
];
const EMOJI = { rock: '🪨', paper: '📄', scissors: '✂️' };
const BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' };   // کلید، مقدار را می‌زند
const COUNTER = { rock: 'paper', paper: 'scissors', scissors: 'rock' }; // حرکتی که کلید را می‌زند
const TARGET = 3; // اولین به ۳ برد

function createGame(host) {
  host.root.innerHTML = '';
  const style = el('style', { text: CSS });
  document.head.appendChild(style);

  /* ---------- وضعیت ---------- */
  const vsAI = host.mode === 'ai';
  let winsA = 0;                          // شما / بازیکن ۱
  let winsB = 0;                          // ربات / بازیکن ۲
  let rounds = 0;
  let lock = false;                       // قفل در جریان انیمیشن راند
  let elapsed = 0;                        // ثانیه — بدون مکث‌ها
  let timer = null;
  let paused = false;
  let finished = false;

  const freq = { rock: 0, paper: 0, scissors: 0 }; // پیش‌بینی ربات: فراوانی حرکت‌های حریف
  const picks = { a: null, b: null };              // حالت دونفره
  let picker = 'a';

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
    const n = rounds + 1;
    return n <= 5 ? `راند ${fmtNum(n)} از ${fmtNum(5)}` : `راند ${fmtNum(n)}`;
  };
  const hud = () => host.setHud({ score: null, time: fmtTime(elapsed), note: noteFor() });
  hud();

  /* ---------- DOM ---------- */
  const labelA = vsAI ? 'شما' : 'بازیکن ۱';
  const labelB = vsAI ? 'ربات' : 'بازیکن ۲';

  const wrap = el('div', { class: 'gv-rps' });
  const pipsA = el('div', { class: 'gvrps-pips' });
  const pipsB = el('div', { class: 'gvrps-pips' });
  const scorebar = el('div', { class: 'gvrps-score' },
    el('div', { class: 'gvrps-side' }, el('span', { text: labelA }), pipsA),
    el('div', { class: 'gvrps-vslabel', text: '🆚' }),
    el('div', { class: 'gvrps-side' }, pipsB, el('span', { text: labelB })),
  );
  const bigBox = el('div', { class: 'gvrps-big' });
  const msgBox = el('div', { class: 'gvrps-msg' });
  const arena = el('div', { class: 'gvrps-arena' }, bigBox, msgBox);
  const choices = el('div', { class: 'gvrps-choices' });
  for (const m of MOVES) {
    const btn = el('button', { class: 'gvrps-choice', type: 'button', 'aria-label': m.label },
      el('span', { class: 'gvrps-emoji', text: m.emoji }),
      el('span', { class: 'gvrps-label', text: m.label }),
    );
    btn.addEventListener('click', () => onChoice(m.id));
    choices.append(btn);
  }
  const coverMsg = el('div', { class: 'gvrps-cover-msg' });
  const cover = el('div', { class: 'gvrps-cover' }, coverMsg,
    el('button', { class: 'gvrps-ready', type: 'button', text: 'آماده‌ام', onclick: () => onReady() }));
  const overlay = el('div', { class: 'gvrps-paused', text: '⏸ مکث' });
  overlay.style.display = 'none';
  wrap.append(scorebar, arena, choices, cover, overlay);
  host.root.append(wrap);

  function setBig(a, b) {
    bigBox.innerHTML = '';
    if (a && b) {
      bigBox.append(
        el('span', { text: EMOJI[a] }),
        el('span', { class: 'gvrps-vs', text: '🆚' }),
        el('span', { text: EMOJI[b] }),
      );
    }
  }
  const setMsg = (t) => { msgBox.textContent = t; };

  function renderPips() {
    const mk = (n) => {
      const list = [];
      for (let i = 0; i < TARGET; i++) list.push(el('span', { class: 'gvrps-pip' + (i < n ? ' gvrps-on' : '') }));
      return list;
    };
    pipsA.innerHTML = '';
    pipsB.innerHTML = '';
    pipsA.append(...mk(winsA));
    pipsB.append(...mk(winsB));
  }

  /* ---------- پردهٔ حریم (دونفره) ---------- */
  function showCover(who) {
    coverMsg.textContent = `🙈 بازیکن ${who === 'a' ? '۱' : '۲'} انتخاب کند (بازیکن ${who === 'a' ? '۲' : '۱'} نگاه نکند!)`;
    cover.style.display = 'flex';
  }
  function onReady() {
    if (paused || finished) return;
    host.sound('click');
    cover.style.display = 'none';
    setMsg(`بازیکن ${picker === 'a' ? '۱' : '۲'} انتخاب کند`);
  }

  /* ---------- انتخاب حرکت ---------- */
  function onChoice(id) {
    if (lock || paused || finished) return;
    if (!vsAI && cover.style.display !== 'none') return;
    host.sound('click');
    if (vsAI) { lock = true; playRoundAI(id); return; }
    if (picker === 'a') {
      picks.a = id;
      picker = 'b';
      showCover('b');
    } else {
      picks.b = id;
      lock = true;
      resolve(picks.a, picks.b);
    }
  }

  /* ---------- هوش مصنوعی: پیش‌بینی الگوی حریف ---------- */
  function predictAI() {
    if (Math.random() < 0.65) {
      const max = Math.max(freq.rock, freq.paper, freq.scissors);
      if (max > 0) {
        const tops = MOVES.map((m) => m.id).filter((id) => freq[id] === max);
        return COUNTER[pick(tops)]; // ضدِ حرکت پرتکرار حریف
      }
    }
    return pick(MOVES).id;
  }

  function playRoundAI(userPick) {
    const robotPick = predictAI();
    setBig('', '');
    arena.classList.add('gvrps-shake');
    ['سنگ…', 'کاغذ…', 'قیچی!'].forEach((s, i) => after(i * 233, () => { setMsg(s); host.sound('tick'); }));
    after(700, () => {
      arena.classList.remove('gvrps-shake');
      freq[userPick]++; // ثبت پس از پیش‌بینی (تاریخچه)
      resolve(userPick, robotPick);
    });
  }

  /* ---------- نتیجهٔ راند ---------- */
  function resolve(a, b) {
    rounds++;
    setBig(a, b);
    let txt, aWon;
    if (a === b) { txt = 'مساوی 🤝'; aWon = null; host.sound('pop'); }
    else if (BEATS[a] === b) { aWon = true; txt = vsAI ? 'بردی! ✅' : 'بازیکن ۱ برد ✅'; host.sound('correct'); }
    else { aWon = false; txt = vsAI ? 'باختی ❌' : 'بازیکن ۲ برد ✅'; host.sound('wrong'); }
    if (aWon === true) winsA++;
    if (aWon === false) winsB++;
    setMsg(txt);
    renderPips();
    hud();

    if (winsA === TARGET || winsB === TARGET) endMatch();
    else after(900, nextRound);
  }

  function nextRound() {
    lock = false;
    setBig('', '');
    if (vsAI) setMsg('انتخاب کن!');
    else { picker = 'a'; picks.a = null; picks.b = null; showCover('a'); }
    hud();
  }

  /* ---------- پایان مسابقه ---------- */
  function endMatch() {
    finished = true;
    stopTimer();
    hud();
    const aWon = winsA === TARGET;
    let text;
    if (vsAI) {
      text = aWon ? '🏆 بردی! برندهٔ مسابقه شدی' : '🤖 ربات برنده شد';
      host.sound(aWon ? 'win' : 'lose');
    } else {
      text = aWon ? '🏆 بازیکن ۱ برنده شد!' : '🏆 بازیکن ۲ برنده شد!';
      host.sound('win');
    }
    setMsg(text);

    after(650, () => {
      // امتیاز: هر برد راند ۱۰۰ + پاداش ۵۰ برای برد ۳-۰ (سوئیپ)
      const sweep = (winsA === TARGET && winsB === 0) || (winsB === TARGET && winsA === 0);
      let score;
      if (vsAI) {
        score = winsA * 100 + (aWon && sweep ? 50 : 0);
      } else {
        const winnerWins = aWon ? winsA : winsB;
        score = winnerWins * 100 + (sweep ? 50 : 0);
      }
      const stats = [
        { label: vsAI ? 'برد شما' : 'برد بازیکن ۱', value: fmtNum(winsA) },
        { label: vsAI ? 'برد حریف' : 'برد بازیکن ۲', value: fmtNum(winsB) },
        { label: 'راند‌ها', value: fmtNum(rounds) },
      ];
      if (!vsAI) stats.push({ label: 'برنده', value: aWon ? 'بازیکن ۱' : 'بازیکن ۲' });
      host.finish({
        outcome: vsAI ? (aWon ? 'win' : 'lose') : 'win',
        score,
        durationSec: Math.max(1, Math.round(elapsed)),
        stats,
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

  /* ---------- شروع ---------- */
  renderPips();
  if (vsAI) { cover.style.display = 'none'; setMsg('انتخاب کن!'); }
  else showCover('a');

  return {
    start() { startTimer(); },
    pause() { paused = true; freezeTimers(); overlay.style.display = 'flex'; },
    resume() { paused = false; unfreezeTimers(); overlay.style.display = 'none'; },
    destroy() { stopTimer(); clearTimers(); style.remove(); host.root.innerHTML = ''; },
  };
}

registerFactory('rps', createGame);
export default createGame;
