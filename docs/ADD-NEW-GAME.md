# ➕ راهنمای افزودن بازی جدید — Game SDK

افزودن بازی به گیماورس **فقط ۲ قدم** دارد و هیچ صفحهٔ دیگری را تغییر نمی‌دهند: خانه، کشف، جزئیات، رده‌بندی، مأموریت‌ها، دستاوردها و پنل مدیریت به‌صورت خودکار بازی جدید را از رجیستری می‌خوانند.

## قدم ۱ — مدخل رجیستری

فایل `js/data/registry.js` را باز کنید و یک آبجکت به آرایهٔ `GAMES` اضافه کنید:

```js
{
  id: 'snake',                       // یکتا، انگلیسی، بدون فاصله — نام فایل هم هست
  title: 'مار',                      // نام نمایشی فارسی
  emoji: '🐍',                       // آیکون (بدون نیاز به فایل تصویر)
  categories: ['casual', 'action'],  // از CATEGORIES — دستهٔ جدید؟ به CATEGORIES اضافه کنید
  players: '۱ نفر',
  difficulty: 'آسان',                // نمایشی
  playTime: '۳–۵ دقیقه',
  short: 'یک جملهٔ جذاب برای کارت بازی',
  description: 'دو تا چهار جملهٔ کامل برای صفحهٔ جزئیات…',
  rating: 4.6,                       // امتیاز نمایشی
  tags: ['کلاسیک', 'سریع'],          // برچسب «سریع» ⇒ ردیف «بازی‌های سریع» خانه
  gradient: ['#10b981', '#14b8a6'],  // دو رنگ کارت و بنر
  modes: [                           // حالت‌های قابل‌انتخاب قبل از شروع
    { id: 'solo', label: 'تک‌نفره' },
    // { id: 'ai', label: 'مقابل ربات' },      ← difficulties لازم دارد
    // { id: 'local', label: 'دو نفره' },
  ],
  difficulties: ['آسان', 'متوسط'],   // فقط اگر حالت 'ai' دارید
  seedPlays: 0,                      // برای رتبهٔ «محبوب‌ترین»
  addedAt: '2026-09-11',             // برای ردیف «تازه‌رسیده‌ها»
  featured: false,                   // true ⇒ «بازی ویژهٔ امروز»
}
```

## قدم ۲ — ماژول بازی

فایل `js/games/snake.js` بسازید (این فایل فقط هنگام اجرای بازی با `import()` داینامیک بارگذاری می‌شود — code splitting خودکار):

```js
import { el, shuffle, clamp, fmtNum, fmtTime } from '../core/utils.js';
import { registerFactory } from '../data/registry.js';

const CSS = `
.gv-snake { /* استایل مخصوص بازی — با پیشوند .gv-<id> تا با بقیه تداخل نکند */ }
`;

function createGame(host) {
  host.root.innerHTML = '';
  const style = el('style', { text: CSS });
  document.head.appendChild(style);

  /* ---------- وضعیت بازی ---------- */
  let elapsed = 0, paused = false, finished = false;
  let timer = setInterval(() => { if (!paused && !finished) { elapsed++; host.setHud({ time: fmtTime(elapsed) }); } }, 1000);

  const board = el('div', { class: 'gv-snake' }, '/* رندر بازی */');
  host.root.append(board);

  function end(outcome, score, stats) {
    finished = true;
    host.sound(outcome === 'win' ? 'win' : 'lose');
    host.finish({ outcome, score, durationSec: Math.round(elapsed), stats }); // فقط یک‌بار!
  }

  return {
    start()  { /* شمارش معکوس، شروع حلقهٔ بازی */ },
    pause()  { paused = true;  /* تایمرها منجمد شوند + اورلی «⏸ مکث» */ },
    resume() { paused = false; },
    destroy(){ clearInterval(timer); style.remove(); host.root.innerHTML = ''; /* همهٔ listenerها */ },
  };
}

registerFactory('snake', createGame);
export default createGame;
```

## قرارداد host (داده‌هایی که پلتفرم به بازی می‌دهد)

| عضو | نوع | توضیح |
|---|---|---|
| `host.root` | HTMLElement | ظرف خالی بازی (`dir=rtl`) — آزادانه رندر کنید |
| `host.mode` | string | `'ai'` \| `'local'` \| `'solo'` (از انتخاب کاربر) |
| `host.difficulty` | string \| null | `'آسان'` \| `'متوسط'` \| `'سخت'` |
| `host.sound(name)` | fn | `click\|win\|lose\|tick\|pop\|flip\|correct\|wrong\|place` |
| `host.setHud(d)` | fn | `{score?, time?, note?}` — نمایش زنده در نوار بالا |
| `host.finish(r)` | fn | **فقط یک‌بار** در پایان مسابقه |

## قرارداد result (خروجی `host.finish`)

```js
{
  outcome: 'win' | 'lose' | 'draw',
  score: 120,          // عدد صحیح؛ سقف مجاز در js/games/sdk.js → BOUNDS ثبت شود!
  durationSec: 45,     // بدون احتساب زمان مکث
  stats: [             // آمادهٔ نمایش با ارقام فارسی (fmtNum)
    { label: 'حرکت‌ها', value: '۲۴' },
  ]
}
```

## چک‌لیست کیفیت (مثل بازی‌های موجود)

- [ ] `node --check js/games/<id>.js` پاس شود
- [ ] `finish()` دقیقاً یک‌بار؛ `durationSec` زمان مکث را حساب نکند
- [ ] `destroy()` همهٔ interval/timeout/listener و `<style>` تزریق‌شده را پاک کند
- [ ] تارگت لمسی ≥ ۴۴px؛ عرض صفحه `min(92vw, 480–520px)`؛ متنی‌ها فارسی با `fmtNum`
- [ ] بدون فایل خارجی (تصویر/صدا/فونت) — فقط ایموجی و CSS و WebAudio از `host.sound`
- [ ] سقف امتیاز جدید را در `BOUNDS` داخل `js/games/sdk.js` ثبت کن (ضدتقلب منطقی)
- [ ] `pause()` بازی را واقعاً منجمد کند (تست: دکمهٔ مکث در HUD)

## نکتهٔ ضدتقلب

`host.finish` قبل از ثبت، نتیجه را از نظر محدودهٔ منطقی بررسی می‌کند (`BOUNDS` + نرخ ارسال). نتایج نامعتبر **بدون جایزه** رد می‌شوند. در نسخهٔ سرور، همین قرارداد به اعتبارسنجی سمت سرور (بازپخش و امضای نتیجه) تبدیل می‌شود — `docs/BACKEND.md`.
