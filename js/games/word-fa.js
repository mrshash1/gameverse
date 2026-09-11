/* ============================================================
   GameVerse — بازی «حدس کلمه» (وردل فارسی)
   قرارداد کامل: js/games/sdk.js
   ------------------------------------------------------------
   کلمهٔ ۵ حرفی فارسی، ۶ تلاش. سبز = حرف در جای درست،
   کهربایی = حرف موجود ولی جای دیگر، خاکستری = حرف غایب.
   ⚠️ «آ» و «ا» دو حرف متفاوت‌اند.
   ============================================================ */

import { el, pick, fmtNum, fmtTime } from '../core/utils.js';
import { registerFactory } from '../data/registry.js';

const ROWS = 6;
const COLS = 5;

/* فهرست واژه‌های تأییدشده (از مشخصات بازی) */
const RAW_WORDS = [
  'مدرسه', 'پنجره', 'سلامت', 'گلدان', 'پرنده', 'گنجشک', 'پاییز', 'خواهر', 'برادر', 'سرباز',
  'بازار', 'نانوا', 'آشپزی', 'نقاشی', 'جهانی', 'ایرانی', 'انسانی', 'اعتماد', 'انرژی', 'همیشه',
  'همراه', 'همکار', 'گفتار', 'رفتار', 'پندار', 'دیدار', 'شنیدن', 'نوشتن', 'دویدن', 'خندید',
  'پریدن', 'ساختن', 'شکستن', 'بیشتر', 'نزدیک', 'دورتر', 'پایین', 'بیرون', 'میانه', 'سومین',
  'اولین', 'آخرین', 'امروز', 'دیروز', 'دقیقه', 'ثانیه', 'شبانه', 'ماهتاب', 'ستاره', 'پرواز',
  'گلبرگ', 'شکوفه', 'خوراک', 'فانوس', 'قناری', 'شاهین', 'کبوتر', 'زنبور', 'خرگوش', 'سنجاب',
  'دلفین', 'خرچنگ', 'مرجان', 'عروسک', 'تومان', 'الماس', 'جواهر', 'یاقوت', 'ناهار', 'بامداد',
  'هفتگی', 'دقایق', 'تقویم',
];
/* نگهبان: فقط واژه‌های دقیقاً ۵ حرفی قبول می‌شوند — ۵ واژهٔ فهرست بالا
   (ایرانی، انسانی، اعتماد، ماهتاب، بامداد) ۶ حرف دارند و کنار گذاشته می‌شوند
   تا شبکهٔ ۵ ستونی هرگز نشکند. */
const WORDS = RAW_WORDS.filter((w) => [...w].length === COLS);

const KEY_ROWS = [
  ['ض', 'ص', 'ث', 'ق', 'ف', 'غ', 'ع', 'ه', 'خ', 'ح', 'ج', 'چ'],
  ['ش', 'س', 'ی', 'ب', 'ل', 'ا', 'آ', 'ت', 'ن', 'م', 'ک', 'گ'],
  ['ظ', 'ط', 'ژ', 'پ', 'د', 'ذ', 'ر', 'ز', 'و'],
];
const KEYSET = new Set(KEY_ROWS.flat());
const RANK = { off: 1, near: 2, good: 3 }; // اولویت رنگ کلیدها

const CSS = `
.gvwd-wrap { display:flex; flex-direction:column; align-items:center; gap:12px; width:min(92vw,520px); position:relative; }
.gvwd-grid { display:flex; flex-direction:column; gap:6px; width:min(86vw,330px); }
.gvwd-row { display:flex; gap:6px; }
.gvwd-row.gvwd-shake { animation:gvwd-shake .35s ease; }
@keyframes gvwd-shake { 25%{transform:translateX(6px)} 50%{transform:translateX(-6px)} 75%{transform:translateX(4px)} }
.gvwd-tile {
  flex:1; aspect-ratio:1; display:flex; align-items:center; justify-content:center;
  font-size:clamp(20px,6vw,30px); font-weight:800; line-height:1;
  border:2px solid rgba(255,255,255,.14); border-radius:10px;
  background:var(--gv-surface-2,#1a2236); color:var(--gv-text,#e7eaf3);
  transition:transform .15s ease, background-color .15s ease, border-color .15s ease;
  user-select:none; -webkit-user-select:none;
}
.gvwd-filled { border-color:rgba(255,255,255,.5); }
.gvwd-cursor { animation:gvwd-blink 1s ease-in-out infinite; }
@keyframes gvwd-blink { 0%,100%{border-color:var(--gv-primary,#8b5cf6)} 50%{border-color:rgba(255,255,255,.14)} }
.gvwd-mid { transform:rotateX(90deg); }
.gvwd-good { background:#10b981; border-color:#10b981; color:#fff; }
.gvwd-near { background:#d97706; border-color:#d97706; color:#fff; }
.gvwd-off { background:#3b4460; border-color:#3b4460; color:#dbe2f0; }
.gvwd-msg { min-height:22px; font-size:14px; font-weight:700; color:var(--gv-accent,#f59e0b); text-align:center; }
.gvwd-kb { display:flex; flex-direction:column; gap:5px; width:100%; }
.gvwd-krow { display:flex; gap:3px; justify-content:center; }
.gvwd-key {
  flex:1; min-width:0; height:46px; padding:0 2px; border:none; border-radius:8px;
  background:var(--gv-surface-2,#1a2236); color:var(--gv-text,#e7eaf3);
  font-size:16px; font-weight:700; font-family:inherit; cursor:pointer;
  transition:background .2s ease, transform .08s ease;
}
.gvwd-key:active { transform:scale(.93); }
.gvwd-k-act { flex:1.8; font-size:13px; }
.gvwd-key.gvwd-k-good { background:#10b981; color:#fff; }
.gvwd-key.gvwd-k-near { background:#d97706; color:#fff; }
.gvwd-key.gvwd-k-off { background:#252d47; color:#7f89a3; }
.gvwd-paused {
  position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
  background:rgba(11,15,26,.82); border-radius:16px; z-index:5; font-size:22px; font-weight:800;
}
`;

function createGame(host) {
  host.root.innerHTML = '';
  const style = el('style', { text: CSS });
  document.head.appendChild(style);

  /* ---------- وضعیت ---------- */
  const targetWord = pick(WORDS);
  const target = [...targetWord];
  let r = 0;                 // سطر فعال (۰ تا ۵)
  let typed = [];            // حروف تایپ‌شدهٔ سطر فعال
  let revealing = false;     // قفل هنگام انیمیشن نمایش
  let triesUsed = 0;
  let greenTotal = 0;        // کل کاشی‌های سبز (برای امتیاز باخت)
  let elapsed = 0;           // ثانیه — بدون مکث‌ها
  let sTimer = null;         // تایمر ۱ ثانیه‌ای زمان کل
  let paused = false;
  let finished = false;
  const keyState = {};       // وضعیت رنگ هر حرف کیبورد
  const keyEls = {};         // عنصر دکمهٔ هر حرف
  const tiles = [];          // tiles[سطر][ستون]
  const rowEls = [];
  const timeouts = new Set();

  /* ---------- HUD ---------- */
  const hud = () => host.setHud({
    score: null,
    time: fmtTime(elapsed),
    note: `تلاش ${fmtNum(Math.min(r + 1, ROWS))} از ${fmtNum(ROWS)}`
  });
  hud();

  /* ---------- DOM: شبکهٔ ۶×۵ (راست‌به‌چپ — حرف اول سمت راست) ---------- */
  const board = el('div', { class: 'gvwd-wrap' });
  const grid = el('div', { class: 'gvwd-grid' });
  for (let i = 0; i < ROWS; i++) {
    const rowEl = el('div', { class: 'gvwd-row' });
    const rowTiles = [];
    for (let c = 0; c < COLS; c++) {
      const t = el('div', { class: 'gvwd-tile' });
      rowEl.append(t);
      rowTiles.push(t);
    }
    grid.append(rowEl);
    tiles.push(rowTiles);
    rowEls.push(rowEl);
  }
  const msg = el('div', { class: 'gvwd-msg', text: 'سبز: جای درست — کهربایی: حرف هست، جای دیگر' });
  const kb = el('div', { class: 'gvwd-kb' });
  buildKeyboard(kb);
  board.append(grid, msg, kb);
  host.root.append(board);

  function after(ms, fn) {
    const t = setTimeout(() => { timeouts.delete(t); fn(); }, ms);
    timeouts.add(t);
  }

  /* ---------- کیبورد مجازی ---------- */
  function buildKeyboard(kbRoot) {
    KEY_ROWS.forEach((keys, ri) => {
      const krow = el('div', { class: 'gvwd-krow' });
      if (ri === 2) krow.append(makeKey('⏎ ثبت', 'act', submitRow));
      keys.forEach((ch) => krow.append(makeKey(ch, '', () => addLetter(ch))));
      if (ri === 2) krow.append(makeKey('⌫ حذف', 'act', delLetter));
      kbRoot.append(krow);
    });
  }

  function makeKey(label, extra, fn) {
    const k = el('button', { class: 'gvwd-key' + (extra ? ` gvwd-k-${extra}` : ''), type: 'button', text: label });
    k.addEventListener('click', () => { if (!paused && !finished && !revealing) fn(); k.blur(); });
    if (KEYSET.has(label)) keyEls[label] = k;
    return k;
  }

  /* ---------- ورودی ---------- */
  function addLetter(ch) {
    if (paused || finished || revealing || typed.length >= COLS) return;
    typed.push(ch);
    renderActive();
  }

  function delLetter() {
    if (paused || finished || revealing || typed.length === 0) return;
    typed.pop();
    renderActive();
  }

  function renderActive() {
    const rowTiles = tiles[r];
    for (let c = 0; c < COLS; c++) {
      const t = rowTiles[c];
      t.classList.remove('gvwd-cursor');
      if (c < typed.length) { t.textContent = typed[c]; t.classList.add('gvwd-filled'); }
      else { t.textContent = ''; t.classList.remove('gvwd-filled'); }
    }
    if (typed.length < COLS) rowTiles[typed.length].classList.add('gvwd-cursor');
  }

  function submitRow() {
    if (paused || finished || revealing) return;
    if (typed.length < COLS) {
      msg.textContent = '۵ حرف وارد کن';
      const rowEl = rowEls[r];
      rowEl.classList.remove('gvwd-shake');
      void rowEl.offsetWidth; // راه‌اندازی مجدد انیمیشن
      rowEl.classList.add('gvwd-shake');
      host.sound('wrong');
      after(1600, () => { if (!finished && msg.textContent === '۵ حرف وارد کن') msg.textContent = ''; });
      return;
    }
    revealRow();
  }

  /* ---------- رنگ‌آمیزی دو مرحله‌ای (حروف تکراری درست مدیریت می‌شوند) ---------- */
  function grade(guess) {
    const res = Array(COLS).fill('off');
    const used = Array(COLS).fill(false);
    for (let i = 0; i < COLS; i++) {
      if (guess[i] === target[i]) { res[i] = 'good'; used[i] = true; }
    }
    for (let i = 0; i < COLS; i++) {
      if (res[i] === 'good') continue;
      for (let j = 0; j < COLS; j++) {
        if (!used[j] && guess[i] === target[j]) { res[i] = 'near'; used[j] = true; break; }
      }
    }
    return res;
  }

  function paintKey(ch, st) {
    const k = keyEls[ch];
    if (!k) return;
    if (keyState[ch] && RANK[keyState[ch]] >= RANK[st]) return;
    keyState[ch] = st;
    k.classList.remove('gvwd-k-good', 'gvwd-k-near', 'gvwd-k-off');
    k.classList.add(`gvwd-k-${st}`);
  }

  function revealRow() {
    revealing = true;
    const guess = [...typed];
    const res = grade(guess);
    host.sound('flip');
    guess.forEach((ch, i) => {
      after(i * 150, () => tiles[r][i].classList.add('gvwd-mid'));
      after(i * 150 + 150, () => {
        const t = tiles[r][i];
        t.classList.remove('gvwd-mid', 'gvwd-filled');
        t.classList.add(`gvwd-${res[i]}`);
        if (res[i] === 'good') host.sound('correct');
        paintKey(ch, res[i]);
      });
    });
    after(COLS * 150 + 220, () => resolveRow(guess, res));
  }

  function resolveRow(guess, res) {
    revealing = false;
    greenTotal += res.filter((s) => s === 'good').length;
    if (guess.every((ch, i) => ch === target[i])) {
      triesUsed = r + 1;
      msg.textContent = 'آفرین! درست حدس زدی 🎉';
      host.sound('win');
      finish('win');
    } else if (r + 1 >= ROWS) {
      triesUsed = ROWS;
      msg.textContent = `کلمه این بود: ${targetWord}`;
      host.sound('lose');
      finish('lose');
    } else {
      r++;
      typed = [];
      renderActive();
      hud();
    }
  }

  function finish(outcome) {
    finished = true;
    stopClock();
    after(750, () => host.finish({
      outcome,
      score: outcome === 'win' ? (7 - triesUsed) * 150 : Math.min(80, Math.round(greenTotal * 20)),
      durationSec: Math.max(1, Math.round(elapsed)),
      stats: [
        { label: 'تلاش‌ها', value: fmtNum(triesUsed) },
        { label: 'کلمه', value: targetWord },
      ],
    }));
  }

  /* ---------- تایمر زمان کل (بدون مکث) ---------- */
  function startClock() {
    sTimer = setInterval(() => { if (!paused && !finished) { elapsed++; hud(); } }, 1000);
  }
  function stopClock() { if (sTimer) { clearInterval(sTimer); sTimer = null; } }

  /* ---------- کیبورد فیزیکی ---------- */
  function onKey(e) {
    if (paused || finished || revealing) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.key === 'Enter') { e.preventDefault(); submitRow(); }
    else if (e.key === 'Backspace') { e.preventDefault(); delLetter(); }
    else if (e.key && e.key.length === 1 && KEYSET.has(e.key)) addLetter(e.key);
  }
  document.addEventListener('keydown', onKey);

  /* ---------- مکث ---------- */
  const overlay = el('div', { class: 'gvwd-paused', text: '⏸ مکث' });
  overlay.style.display = 'none';
  board.append(overlay);

  renderActive();

  return {
    start() { startClock(); },
    pause() { paused = true; overlay.style.display = 'flex'; },
    resume() { paused = false; overlay.style.display = 'none'; },
    destroy() {
      stopClock();
      document.removeEventListener('keydown', onKey);
      timeouts.forEach((t) => clearTimeout(t));
      timeouts.clear();
      style.remove();
      host.root.innerHTML = '';
    }
  };
}

registerFactory('word-fa', createGame);
export default createGame;
