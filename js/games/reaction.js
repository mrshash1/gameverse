/* ============================================================
   GameVerse — بازی «سرعت واکنش»
   قرارداد کامل: js/games/sdk.js
   ------------------------------------------------------------
   ۵ راند: قرمز یعنی صبر، سبز یعنی ضربه. زمان واکنش با اختلاف
   Date.now ثبت می‌شود. ضربهٔ زودهنگام = جریمهٔ ۸۰۰ میلی‌ثانیه.
   برد: میانگین ≤ ۳۵۰ میلی‌ثانیه.
   ============================================================ */

import { el, rndi, clamp, fmtNum, fmtTime } from '../core/utils.js';
import { registerFactory } from '../data/registry.js';

const ROUNDS = 5;
const WAIT_MIN_MS = 1200;    // حداقل انتظار قبل از سبز شدن
const WAIT_MAX_MS = 3500;    // حداکثر انتظار
const PENALTY_MS = 800;      // جریمهٔ ضربهٔ زودهنگام
const FLASH_MS = 900;        // مدت نمایش نتیجهٔ هر راند

const CSS = `
.gvrx-wrap { display:flex; flex-direction:column; align-items:center; gap:12px; width:min(92vw,520px); position:relative; }
.gvrx-zone {
  width:100%; min-height:46vh; border:none; border-radius:24px; cursor:pointer;
  display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px;
  padding:20px; text-align:center; color:#fff; font-family:inherit; font-weight:800;
  font-size:clamp(18px,4.5vw,24px); line-height:1.6;
  transition:background .15s ease, box-shadow .15s ease;
  user-select:none; -webkit-user-select:none; touch-action:manipulation;
  -webkit-tap-highlight-color:transparent;
}
.gvrx-zone:focus-visible { outline:3px solid rgba(255,255,255,.6); outline-offset:3px; }
.gvrx-idle { background:linear-gradient(155deg,#334155,#1d4ed8); box-shadow:0 12px 30px rgba(29,78,216,.28); }
.gvrx-wait { background:linear-gradient(155deg,#dc2626,#7f1d1d); box-shadow:0 12px 30px rgba(220,38,38,.3); }
.gvrx-go { background:linear-gradient(155deg,#059669,#34d399); box-shadow:0 12px 34px rgba(16,185,129,.45); }
.gvrx-res { background:var(--gv-surface-2,#1a2236); border:1px solid rgba(255,255,255,.12); }
.gvrx-emo { display:block; font-size:clamp(40px,12vw,58px); line-height:1.25; }
.gvrx-text { display:block; }
.gvrx-sub { display:block; font-size:14px; font-weight:600; opacity:.85; }
.gvrx-hint { font-size:13px; font-weight:600; opacity:.75; text-align:center; }
.gvrx-paused {
  position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
  background:rgba(11,15,26,.82); border-radius:24px; z-index:5; font-size:22px; font-weight:800;
}
`;

function createGame(host) {
  host.root.innerHTML = '';
  const style = el('style', { text: CSS });
  document.head.appendChild(style);

  /* ---------- وضعیت ---------- */
  let round = 0;             // راند جاری (۰ تا ۴)
  const results = [];        // میلی‌ثانیهٔ هر راند
  let state = 'idle';        // idle | wait | go | result
  let goStart = 0;           // لحظهٔ سبز شدن
  let goCarry = 0;           // زمان سپری‌شدهٔ فاز go هنگام مکث
  let elapsed = 0;           // ثانیه — بدون مکث‌ها
  let sTimer = null;         // تایمر ۱ ثانیه‌ای زمان کل
  let paused = false;
  let finished = false;
  let tmr = null;            // تایمر قابل توقف: { id, fn, due, remaining }
  const timeouts = new Set();

  /* ---------- HUD ---------- */
  const hud = () => host.setHud({
    score: null,
    time: fmtTime(elapsed),
    note: `راند ${fmtNum(Math.min(round + 1, ROUNDS))} از ${fmtNum(ROUNDS)}`
  });
  hud();

  /* ---------- DOM ---------- */
  const board = el('div', { class: 'gvrx-wrap' });
  const zone = el('button', { class: 'gvrx-zone gvrx-idle', type: 'button', 'aria-label': 'ناحیهٔ ضربه' });
  const emo = el('span', { class: 'gvrx-emo', text: '👆' });
  const text = el('span', { class: 'gvrx-text' });
  const sub = el('span', { class: 'gvrx-sub' });
  zone.append(emo, text, sub);
  zone.addEventListener('click', () => { zone.blur(); onTap(); });
  const hint = el('div', { class: 'gvrx-hint', text: `میانگین زیر ${fmtNum(350)} میلی‌ثانیه = برد 🏆` });
  board.append(zone, hint);
  host.root.append(board);

  function after(ms, fn) {
    const t = setTimeout(() => { timeouts.delete(t); fn(); }, ms);
    timeouts.add(t);
  }

  /* ---------- جریان بازی ---------- */
  function render() {
    zone.className = `gvrx-zone gvrx-${state}`;
    if (state === 'idle') {
      emo.textContent = '👆';
      text.textContent = `برای شروع راند ${fmtNum(round + 1)} ضربه بزن`;
      sub.textContent = 'صفحه سبز شد، سریع ضربه بزن!';
    } else if (state === 'wait') {
      emo.textContent = '⛔';
      text.textContent = 'صبر کن…';
      sub.textContent = '';
    } else if (state === 'go') {
      emo.textContent = '⚡';
      text.textContent = 'بزن!';
      sub.textContent = '';
    }
  }

  function showResult(emoChar, txt) {
    state = 'result';
    zone.className = 'gvrx-zone gvrx-res';
    emo.textContent = emoChar;
    text.textContent = txt;
    sub.textContent = '';
    arm(FLASH_MS, nextRound);
  }

  function onTap() {
    if (paused || finished) return;
    if (state === 'idle') {
      state = 'wait';
      render();
      arm(rndi(WAIT_MIN_MS, WAIT_MAX_MS), goPhase);
    } else if (state === 'wait') {
      disarm();
      results.push(PENALTY_MS);
      host.sound('wrong');
      showResult('⚠️', `زود زدی! ${fmtNum(PENALTY_MS)} میلی‌ثانیه`);
    } else if (state === 'go') {
      const ms = Math.max(1, Math.round(Date.now() - goStart));
      results.push(ms);
      host.sound('pop');
      showResult('🎯', `${fmtNum(ms)} میلی‌ثانیه!`);
    }
  }

  function goPhase() {
    state = 'go';
    goCarry = 0;
    goStart = Date.now();
    render();
    host.sound('tick');
  }

  function nextRound() {
    round++;
    if (round >= ROUNDS) return end();
    state = 'idle';
    render();
    hud();
  }

  function end() {
    finished = true;
    const avg = Math.round(results.reduce((a, b) => a + b, 0) / ROUNDS);
    const best = Math.min(...results);
    const worst = Math.max(...results);
    const outcome = avg <= 350 ? 'win' : 'lose';
    const score = clamp(Math.round((600 - avg) * 2.2), 30, 1300);
    host.sound(outcome);
    after(500, () => host.finish({
      outcome,
      score,
      durationSec: Math.max(1, Math.round(elapsed)),
      stats: [
        { label: 'میانگین', value: `${fmtNum(avg)} م.ث` },
        { label: 'بهترین', value: `${fmtNum(best)} م.ث` },
        { label: 'بدترین', value: `${fmtNum(worst)} م.ث` },
      ],
    }));
  }

  /* ---------- تایمر قابل توقف (مکث، شمارش معکوس را منجمد می‌کند) ---------- */
  function arm(ms, fn) {
    disarm();
    const id = setTimeout(() => { const t = tmr; tmr = null; t.fn(); }, ms);
    tmr = { id, fn, due: Date.now() + ms, remaining: ms };
  }
  function disarm() {
    if (!tmr || !tmr.id) return;
    clearTimeout(tmr.id);
    tmr.remaining = Math.max(0, tmr.due - Date.now());
    tmr.id = null;
  }
  function rearm() {
    if (!tmr || tmr.id || tmr.remaining <= 0) return;
    const rem = tmr.remaining;
    tmr.id = setTimeout(() => { const t = tmr; tmr = null; t.fn(); }, rem);
  }

  /* ---------- تایمر زمان کل (بدون مکث) ---------- */
  function startClock() {
    sTimer = setInterval(() => { if (!paused && !finished) { elapsed++; hud(); } }, 1000);
  }
  function stopClock() { if (sTimer) { clearInterval(sTimer); sTimer = null; } }

  /* ---------- مکث ---------- */
  const overlay = el('div', { class: 'gvrx-paused', text: '⏸ مکث' });
  overlay.style.display = 'none';
  board.append(overlay);

  return {
    start() { startClock(); render(); },
    pause() {
      paused = true;
      overlay.style.display = 'flex';
      disarm(); // ذخیرهٔ زمان باقی‌ماندهٔ تایمر جاری
      if (state === 'go') goCarry += Date.now() - goStart;
    },
    resume() {
      paused = false;
      overlay.style.display = 'none';
      if (state === 'go') goStart = Date.now() - goCarry; // زمان واکنش بدون مکث
      rearm();
    },
    destroy() {
      disarm();
      stopClock();
      timeouts.forEach((t) => clearTimeout(t));
      timeouts.clear();
      style.remove();
      host.root.innerHTML = '';
    }
  };
}

registerFactory('reaction', createGame);
export default createGame;
