/* ============================================================
   GameVerse — بازی «آزمون دانش»
   قرارداد کامل: js/games/sdk.js
   ------------------------------------------------------------
   ۱۰ سؤال چهارگزینه‌ای از بانک ۴۴ سؤالی؛ ۱۵ ثانیه برای هر سؤال.
   پاسخ درست: ۱۰۰ امتیاز پایه + جایزهٔ سرعت (تا ~۵۰).
   برد: حداقل ۶ پاسخ درست از ۱۰.
   ============================================================ */

import { el, shuffle, fmtNum, fmtTime } from '../core/utils.js';
import { registerFactory } from '../data/registry.js';

const ROUND_SIZE = 10;
const QUESTION_MS = 15000;   // زمان هر سؤال (میلی‌ثانیه)
const BASE_POINTS = 100;     // امتیاز پایه هر پاسخ درست
const PASS_RATE = 6;         // حداقل پاسخ درست برای برد

const QUIZ_BANK = [
  { q: 'پایتخت ایران کدام شهر است؟', options: ['تهران', 'اصفهان', 'شیراز', 'تبریز'], answer: 0, cat: 'جغرافیا' },
  { q: 'بزرگ‌ترین سیارهٔ منظومهٔ شمسی کدام است؟', options: ['زمین', 'مشتری', 'زحل', 'مریخ'], answer: 1, cat: 'علوم' },
  { q: 'حاصل ضرب ۷ در ۸ چند است؟', options: ['۵۴', '۴۸', '۵۶', '۶۴'], answer: 2, cat: 'ریاضی' },
  { q: 'سریع‌ترین حیوان خشکی کدام است؟', options: ['شیر', 'اسب', 'آهو', 'یوزپلنگ'], answer: 3, cat: 'علوم' },
  { q: 'آب خالص در سطح دریا در چند درجهٔ سانتی‌گراد می‌جوشد؟', options: ['۱۰۰', '۹۰', '۱۲۰', '۸۰'], answer: 0, cat: 'علوم' },
  { q: 'نماد شیمیایی O مربوط به کدام عنصر است؟', options: ['طلا', 'اکسیژن', 'نقره', 'آهن'], answer: 1, cat: 'علوم' },
  { q: 'محبوب‌ترین و پرطرفدارترین ورزش جهان کدام است؟', options: ['فوتبال', 'کریکت', 'بسکتبال', 'والیبال'], answer: 0, cat: 'ورزش' },
  { q: 'جهان چند قاره دارد؟', options: ['۵', '۷', '۶', '۸'], answer: 1, cat: 'جغرافیا' },
  { q: 'کتاب «بوف کور» اثر کیست؟', options: ['محمدعلی جمال‌زاده', 'سهراب سپهری', 'صادق هدایت', 'نیما یوشیج'], answer: 2, cat: 'فرهنگ و ادبیات' },
  { q: 'نظریهٔ نسبیت را کدام دانشمند معرفی کرد؟', options: ['آلبرت اینشتین', 'ایزاک نیوتن', 'ماکس پلانک', 'نیلز بور'], answer: 0, cat: 'علوم' },
  { q: 'طولانی‌ترین رود جهان کدام است؟', options: ['آمازون', 'نیل', 'یانگ‌تسه', 'می‌سی‌سی‌پی'], answer: 1, cat: 'جغرافیا' },
  { q: 'کدام عضو بدن خون را پمپ می‌کند؟', options: ['کبد', 'ریه', 'کلیه', 'قلب'], answer: 3, cat: 'علوم' },
  { q: 'پایتخت فرانسه کدام شهر است؟', options: ['پاریس', 'لندن', 'برلین', 'مادرید'], answer: 0, cat: 'جغرافیا' },
  { q: 'بزرگ‌ترین اقیانوس جهان کدام است؟', options: ['اقیانوس اطلس', 'اقیانوس آرام', 'اقیانوس هند', 'اقیانوس منجمد شمالی'], answer: 1, cat: 'جغرافیا' },
  { q: 'حاصل جمع ۱۲۵ و ۲۷۵ چند است؟', options: ['۳۹۰', '۴۱۰', '۴۰۰', '۳۸۵'], answer: 2, cat: 'ریاضی' },
  { q: 'عدد پی تقریباً برابر کدام عدد است؟', options: ['۲٫۱۴', '۳٫۴۱', '۲٫۷۱', '۳٫۱۴'], answer: 3, cat: 'ریاضی' },
  { q: 'شاهنامه اثر کدام شاعر است؟', options: ['فردوسی', 'حافظ', 'سعدی', 'مولانا'], answer: 0, cat: 'فرهنگ و ادبیات' },
  { q: 'نماد شیمیایی Au مربوط به کدام عنصر است؟', options: ['نقره', 'طلا', 'مس', 'آهن'], answer: 1, cat: 'علوم' },
  { q: 'بزرگ‌ترین کشور جهان از نظر مساحت کدام است؟', options: ['کانادا', 'چین', 'روسیه', 'آمریکا'], answer: 2, cat: 'جغرافیا' },
  { q: 'در فوتبال هر تیم در زمین چند بازیکن دارد؟', options: ['۹', '۱۰', '۱۲', '۱۱'], answer: 3, cat: 'ورزش' },
  { q: 'یک سال میلادی معمولاً چند روز است؟', options: ['۳۶۵', '۳۶۰', '۳۷۰', '۳۵۵'], answer: 0, cat: 'دانش عمومی' },
  { q: 'رنگین‌کمان چند رنگ دارد؟', options: ['۵', '۶', '۷', '۸'], answer: 2, cat: 'دانش عمومی' },
  { q: 'بزرگ‌ترین حیوان جهان کدام است؟', options: ['فیل آفریقایی', 'نهنگ آبی', 'کوسهٔ سفید', 'زرافه'], answer: 1, cat: 'علوم' },
  { q: 'قانون جهانی جاذبه را کدام دانشمند کشف کرد؟', options: ['گالیله', 'اینشتین', 'ایزاک نیوتن', 'ادیسون'], answer: 2, cat: 'علوم' },
  { q: 'در والیبال هر تیم در زمین چند بازیکن دارد؟', options: ['۶', '۵', '۷', '۱۱'], answer: 0, cat: 'ورزش' },
  { q: 'کوه دماوند در کدام رشته‌کوه قرار دارد؟', options: ['زاگرس', 'البرز', 'هیمالیا', 'آلپ'], answer: 1, cat: 'جغرافیا' },
  { q: 'مثنوی معنوی اثر کیست؟', options: ['مولانا', 'سعدی', 'حافظ', 'فردوسی'], answer: 0, cat: 'فرهنگ و ادبیات' },
  { q: 'حاصل تقسیم ۱۴۴ بر ۱۲ چند است؟', options: ['۱۴', '۱۱', '۱۶', '۱۲'], answer: 3, cat: 'ریاضی' },
  { q: 'نمکی‌ترین پهنهٔ آبی جهان کدام است؟', options: ['دریای خزر', 'دریای مرده', 'دریای عمان', 'دریای سیاه'], answer: 1, cat: 'جغرافیا' },
  { q: 'نخستین بازی‌های المپیک در کدام کشور برگزار شد؟', options: ['ایتالیا', 'فرانسه', 'یونان', 'مصر'], answer: 2, cat: 'ورزش' },
  { q: 'پرچم ایران چند رنگ دارد؟', options: ['۲', '۳', '۴', '۵'], answer: 1, cat: 'دانش عمومی' },
  { q: 'الفبای فارسی چند حرف دارد؟', options: ['۲۸', '۳۰', '۳۲', '۳۴'], answer: 2, cat: 'دانش عمومی' },
  { q: 'بدن انسان بزرگسال چند استخوان دارد؟', options: ['۲۰۶', '۱۹۸', '۲۱۰', '۱۸۶'], answer: 0, cat: 'علوم' },
  { q: 'بزرگ‌ترین جزیرهٔ جهان کدام است؟', options: ['ماداگاسکار', 'گرینلند', 'بورنئو', 'بریتانیا'], answer: 1, cat: 'جغرافیا' },
  { q: 'کدام سیاره به خورشید نزدیک‌تر است؟', options: ['زهره', 'زمین', 'عطارد', 'مریخ'], answer: 2, cat: 'علوم' },
  { q: '۱۵٪ از عدد ۲۰۰ چند می‌شود؟', options: ['۲۵', '۳۵', '۴۰', '۳۰'], answer: 3, cat: 'ریاضی' },
  { q: 'دیوان اشعار حافظ متعلق به کدام شاعر است؟', options: ['حافظ شیرازی', 'سعدی', 'فردوسی', 'خیام'], answer: 0, cat: 'فرهنگ و ادبیات' },
  { q: 'در بسکتبال هر تیم چند بازیکن در زمین دارد؟', options: ['۶', '۵', '۷', '۴'], answer: 1, cat: 'ورزش' },
  { q: 'پرجمعیت‌ترین کشور جهان در حال حاضر کدام است؟', options: ['چین', 'هند', 'آمریکا', 'اندونزی'], answer: 1, cat: 'جغرافیا' },
  { q: 'واحد اندازه‌گیری نیرو در فیزیک چیست؟', options: ['ژول', 'وات', 'آمپر', 'نیوتن'], answer: 3, cat: 'علوم' },
  { q: 'داستان «رستم و سهراب» از کدام کتاب است؟', options: ['مثنوی معنوی', 'گلستان', 'شاهنامه', 'بوستان'], answer: 2, cat: 'فرهنگ و ادبیات' },
  { q: 'مجموع زوایای داخلی مثلث چند درجه است؟', options: ['۹۰', '۱۸۰', '۲۷۰', '۳۶۰'], answer: 1, cat: 'ریاضی' },
  { q: 'اختراع لامپ رشته‌ای به کدام مخترع نسبت داده می‌شود؟', options: ['توماس ادیسون', 'گراهام بل', 'مارکونی', 'جیمز وات'], answer: 0, cat: 'دانش عمومی' },
  { q: 'پرجمعیت‌ترین شهر ایران کدام است؟', options: ['مشهد', 'اصفهان', 'تهران', 'شیراز'], answer: 2, cat: 'جغرافیا' },
];

const CSS = `
.gvqz-wrap { display:flex; flex-direction:column; align-items:center; gap:14px; width:min(92vw,520px); position:relative; }
.gvqz-chip {
  background:var(--gv-surface-2,#1a2236); border:1px solid rgba(255,255,255,.12);
  color:var(--gv-accent,#f59e0b); border-radius:999px; padding:5px 16px;
  font-size:13px; font-weight:800;
}
.gvqz-q { font-size:clamp(18px,4.6vw,24px); font-weight:800; text-align:center; line-height:1.8; margin:0; }
.gvqz-barbox { width:100%; height:10px; border-radius:999px; background:var(--gv-surface-2,#1a2236); overflow:hidden; }
.gvqz-bar { height:100%; width:100%; border-radius:999px; background:linear-gradient(90deg,#f59e0b,#f97316); transition:width .1s linear; }
.gvqz-opts { display:grid; grid-template-columns:1fr; gap:10px; width:100%; }
.gvqz-opt {
  min-height:52px; border-radius:14px; border:1px solid rgba(255,255,255,.12);
  background:var(--gv-surface-2,#1a2236); color:var(--gv-text,#e7eaf3);
  font-size:17px; font-weight:600; font-family:inherit; padding:10px 18px;
  cursor:pointer; text-align:right; line-height:1.6;
  transition:transform .12s ease, background .2s ease, border-color .2s ease;
}
.gvqz-opt:hover { border-color:rgba(255,255,255,.32); }
.gvqz-opt:active { transform:scale(.97); }
.gvqz-opt.gvqz-good { background:rgba(16,185,129,.28); border-color:#10b981; }
.gvqz-opt.gvqz-bad { background:rgba(239,68,68,.25); border-color:#ef4444; }
.gvqz-paused {
  position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
  background:rgba(11,15,26,.82); border-radius:16px; z-index:5; font-size:22px; font-weight:800;
}
`;

function createGame(host) {
  host.root.innerHTML = '';
  const style = el('style', { text: CSS });
  document.head.appendChild(style);

  /* ---------- وضعیت ---------- */
  const questions = shuffle(QUIZ_BANK).slice(0, ROUND_SIZE);
  let idx = 0;               // سؤال جاری (۰ تا ۹)
  let score = 0;
  let correct = 0;
  let streak = 0;
  let bestStreak = 0;
  let remaining = QUESTION_MS; // زمان باقی‌ماندهٔ سؤال جاری
  let locked = false;        // قفل هنگام نمایش بازخورد
  let elapsed = 0;           // ثانیه — بدون مکث‌ها
  let qTimer = null;         // تایمر ۱۰۰ms نوار زمان
  let sTimer = null;         // تایمر ۱ ثانیه‌ای زمان کل
  let paused = false;
  let finished = false;
  const timeouts = new Set();

  /* ---------- HUD ---------- */
  const hud = () => host.setHud({
    score: fmtNum(score),
    time: fmtTime(elapsed),
    note: `سؤال ${fmtNum(Math.min(idx + 1, ROUND_SIZE))} از ${fmtNum(ROUND_SIZE)}`
  });
  hud();

  /* ---------- DOM ---------- */
  const board = el('div', { class: 'gvqz-wrap' });
  const chip = el('span', { class: 'gvqz-chip' });
  const qText = el('div', { class: 'gvqz-q' });
  const barBox = el('div', { class: 'gvqz-barbox' });
  const bar = el('div', { class: 'gvqz-bar' });
  barBox.append(bar);
  const opts = el('div', { class: 'gvqz-opts' });
  board.append(chip, qText, barBox, opts);
  host.root.append(board);

  function after(ms, fn) {
    const t = setTimeout(() => { timeouts.delete(t); fn(); }, ms);
    timeouts.add(t);
  }

  /* ---------- جریان بازی ---------- */
  function showQuestion() {
    locked = false;
    const q = questions[idx];
    chip.textContent = q.cat;
    qText.textContent = q.q;
    opts.innerHTML = '';
    q.options.forEach((opt, i) => {
      const btn = el('button', { class: 'gvqz-opt', type: 'button', text: opt });
      btn.addEventListener('click', () => answer(i, btn));
      opts.append(btn);
    });
    remaining = QUESTION_MS;
    bar.style.width = '100%';
    startQTimer();
    hud();
  }

  function answer(i, btn) {
    if (locked || paused || finished) return;
    locked = true;
    stopQTimer();
    const q = questions[idx];
    const buttons = [...opts.children];
    if (i === q.answer) {
      correct++;
      streak++;
      bestStreak = Math.max(bestStreak, streak);
      score += BASE_POINTS + Math.round((remaining / 1000) * 3.3);
      btn.classList.add('gvqz-good');
      host.sound('correct');
    } else {
      streak = 0;
      if (btn) btn.classList.add('gvqz-bad');
      buttons[q.answer].classList.add('gvqz-good');
      host.sound('wrong');
    }
    hud();
    after(i === q.answer ? 700 : 1200, () => {
      idx++;
      if (idx >= ROUND_SIZE) endGame();
      else showQuestion();
    });
  }

  function endGame() {
    finished = true;
    stopQTimer();
    stopClock();
    const win = correct >= PASS_RATE;
    host.sound(win ? 'win' : 'lose');
    after(450, () => host.finish({
      outcome: win ? 'win' : 'lose',
      score,
      durationSec: Math.max(1, Math.round(elapsed)),
      stats: [
        { label: 'پاسخ درست', value: `${fmtNum(correct)} از ${fmtNum(ROUND_SIZE)}` },
        { label: 'دقت', value: `٪${fmtNum(correct * 10)}` },
        { label: 'بهترین زنجیره', value: fmtNum(bestStreak) },
      ],
    }));
  }

  /* ---------- تایمرها (با پشتیبانی مکث) ---------- */
  function startQTimer() {
    stopQTimer();
    qTimer = setInterval(() => {
      if (paused || finished || locked) return;
      remaining -= 100;
      bar.style.width = `${Math.max(0, (remaining / QUESTION_MS) * 100)}%`;
      if (remaining <= 0) answer(-1, null); // پایان زمان
    }, 100);
  }
  function stopQTimer() { if (qTimer) { clearInterval(qTimer); qTimer = null; } }

  function startClock() {
    sTimer = setInterval(() => { if (!paused && !finished) { elapsed++; hud(); } }, 1000);
  }
  function stopClock() { if (sTimer) { clearInterval(sTimer); sTimer = null; } }

  /* ---------- مکث ---------- */
  const overlay = el('div', { class: 'gvqz-paused', text: '⏸ مکث' });
  overlay.style.display = 'none';
  board.append(overlay);

  return {
    start() { startClock(); showQuestion(); },
    pause() { paused = true; overlay.style.display = 'flex'; },
    resume() { paused = false; overlay.style.display = 'none'; },
    destroy() {
      stopQTimer();
      stopClock();
      timeouts.forEach((t) => clearTimeout(t));
      timeouts.clear();
      style.remove();
      host.root.innerHTML = '';
    }
  };
}

registerFactory('quiz', createGame);
export default createGame;
