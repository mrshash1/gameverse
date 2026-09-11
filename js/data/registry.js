/* ============================================================
   GameVerse — رجیستری مرکزی بازی‌ها
   ------------------------------------------------------------
   افزودن بازی جدید فقط ۲ قدم دارد:
     ۱) یک مدخل در آرایهٔ GAMES زیر اضافه کنید
     ۲) فایل ماژول بازی را در js/games/<id>.js بسازید
        (با قرارداد createGame(host) — مستندات: docs/ADD-NEW-GAME.md)
   هیچ بخش دیگری از سایت نیازی به تغییر ندارد؛ همهٔ صفحه‌ها از
   همین رجیستری تغذیه می‌شوند (دسته‌ها هم هاردکد نیستند).
   ============================================================ */

/* دسته‌بندی‌ها — داینامیک؛ UI هرگز دسته را هاردکد نمی‌کند */
export const CATEGORIES = [
  { id: 'board',       label: 'صفحه‌ای',       emoji: '♟️' },
  { id: 'strategy',    label: 'استراتژی',      emoji: '🧠' },
  { id: 'puzzle',      label: 'پازل',          emoji: '🧩' },
  { id: 'trivia',      label: 'اطلاعات عمومی', emoji: '🎓' },
  { id: 'party',       label: 'مهمانی',        emoji: '🎉' },
  { id: 'casual',      label: 'سبک',           emoji: '🎈' },
  { id: 'action',      label: 'اکشن',          emoji: '⚡' },
  { id: 'word',        label: 'کلمات',         emoji: '🔤' },
  { id: 'multiplayer', label: 'چندنفره',       emoji: '👥' },
  { id: 'competitive', label: 'رقابتی',        emoji: '🏆' },
];

export const catById = (id) => CATEGORIES.find((c) => c.id === id) || { id, label: id, emoji: '🎮' };

/* کارخانه‌های بازی (lazy load — فقط هنگام اجرای بازی import می‌شوند) */
const factories = {};
export function registerFactory(id, fn) { factories[id] = fn; }
export function getFactory(id) { return factories[id] || null; }

/* ----------------------- مدخل بازی‌ها ----------------------- */

export const GAMES = [
  {
    id: 'memory',
    title: 'حافظه',
    emoji: '🧩',
    categories: ['puzzle', 'casual'],
    players: '۱ نفر',
    difficulty: 'آسان',
    playTime: '۲–۴ دقیقه',
    short: 'جفت کارت‌های همسان را پیدا کن؛ حافظهٔ خود را به چالش بکش!',
    description: 'شانزده کارت بسته روی میز است و هر کارت فقط یک جفت دارد. کارت‌ها را برگردان و همهٔ جفت‌ها را با کمترین حرکت و سریع‌ترین زمان پیدا کن. هرچه سریع‌تر و دقیق‌تر بازی کنی امتیاز بیشتری می‌گیری.',
    rating: 4.7,
    tags: ['حافظه', 'سریع', 'خانوادگی'],
    gradient: ['#7c3aed', '#6366f1'],
    modes: [{ id: 'solo', label: 'تک‌نفره' }],
    seedPlays: 8100,
    addedAt: '2026-08-01',
    featured: true,
  },
  {
    id: 'quiz',
    title: 'آزمون دانش',
    emoji: '🎓',
    categories: ['trivia', 'casual', 'competitive'],
    players: '۱ نفر',
    difficulty: 'متوسط',
    playTime: '۳–۵ دقیقه',
    short: '۱۰ سؤال، ۱۵ ثانیه برای هر سؤال — چقدر اطلاعات داری؟',
    description: 'ده سؤال از دانش عمومی، علوم، ریاضی، فرهنگ و جغرافیا با تایمر ۱۵ ثانیه‌ای. هر پاسخ درست ۱۰۰ امتیاز دارد و پاسخ سریع‌تر، جایزهٔ سرعت بیشتری می‌گیرد. با دقت بالا لقب «نابغه» را از آنِ خود کن.',
    rating: 4.8,
    tags: ['اطلاعات عمومی', 'سریع', 'رقابتی'],
    gradient: ['#f59e0b', '#f97316'],
    modes: [{ id: 'solo', label: 'تک‌نفره' }],
    seedPlays: 11200,
    addedAt: '2026-08-01',
  },
  {
    id: 'tic-tac-toe',
    title: 'دوز',
    emoji: '⭕',
    categories: ['board', 'strategy', 'multiplayer', 'competitive'],
    players: '۱–۲ نفر',
    difficulty: 'آسان تا سخت',
    playTime: '۱–۳ دقیقه',
    short: 'کلاسیک‌ترین بازی استراتژی؛ سه‌تایی در یک خط بچین!',
    description: 'دوز کلاسیک روی صفحهٔ ۳×۳، هم مقابل ربات هوشمند در سه سطح و هم دو‌نفره روی یک دستگاه. در سطح سخت ربات با الگوریتم Minimax شکست‌ناپذیر است — آیا می‌توانی او را به تساوی بکشانی؟',
    rating: 4.6,
    tags: ['استراتژی', 'کلاسیک', 'سریع'],
    gradient: ['#06b6d4', '#3b82f6'],
    modes: [
      { id: 'ai', label: 'مقابل ربات' },
      { id: 'local', label: 'دو نفره روی یک دستگاه' },
    ],
    difficulties: ['آسان', 'متوسط', 'سخت'],
    seedPlays: 9600,
    addedAt: '2026-08-01',
  },
  {
    id: 'rps',
    title: 'سنگ کاغذ قیچی',
    emoji: '✂️',
    categories: ['party', 'casual', 'social'],
    players: '۱–۲ نفر',
    difficulty: 'آسان',
    playTime: '۱–۲ دقیقه',
    short: 'سریع‌ترین بازی دنیا؛ ربات حرکت‌هایت را پیش‌بینی می‌کند!',
    description: 'بازی جذاب سنگ‌کاغذقیچی در قالب بهترین از ۵ راند. ربات این نسخه حرکت‌های قبلی تو را تحلیل می‌کند و الگویت را پیش‌بینی می‌کند — پس تصادفی بازی کن تا ببری!',
    rating: 4.4,
    tags: ['سریع', 'سرگرمی', 'پارتی'],
    gradient: ['#ec4899', '#f43f5e'],
    modes: [
      { id: 'ai', label: 'مقابل ربات' },
      { id: 'local', label: 'دو نفره روی یک دستگاه' },
    ],
    difficulties: ['عادی'],
    seedPlays: 7400,
    addedAt: '2026-08-01',
  },
  {
    id: 'reaction',
    title: 'سرعت واکنش',
    emoji: '⚡',
    categories: ['action', 'casual', 'competitive'],
    players: '۱ نفر',
    difficulty: 'آسان',
    playTime: '۱ دقیقه',
    short: 'صبر کن سبز شود... بزن! واکنش تو چند میلی‌ثانیه است؟',
    description: 'پنج راند آزمون سرعت واکنش. صفحهٔ قرمز یعنی صبر، سبز یعنی ضربه! میانگین میلی‌ثانیه‌های تو ثبت می‌شود؛ زیر ۲۵۰ میلی‌ثانیه یعنی از ۹۰٪ بازیکنان جهان سریع‌تری.',
    rating: 4.5,
    tags: ['سرعت', 'سریع', 'رقابتی'],
    gradient: ['#10b981', '#14b8a6'],
    modes: [{ id: 'solo', label: 'تک‌نفره' }],
    seedPlays: 6300,
    addedAt: '2026-08-01',
  },
  {
    id: 'connect4',
    title: 'چهار در یک ردیف',
    emoji: '🔴',
    categories: ['board', 'strategy', 'multiplayer', 'competitive'],
    players: '۱–۲ نفر',
    difficulty: 'متوسط تا سخت',
    playTime: '۳–۶ دقیقه',
    short: 'سکه‌ها را بینداز و چهار مهرهٔ خود را در یک ردیف بچین.',
    description: 'نسخهٔ دیجیتال بازی محبوب Connect Four روی تختهٔ ۷×۶. سکه‌هایت را هوشمندانه بینداز و قبل از ربات چهار مهرهٔ پیوستهٔ افقی، عمودی یا مورب بساز. ربات در سطح سخت از الگوریتم Minimax با عمق ۴ استفاده می‌کند.',
    rating: 4.7,
    tags: ['استراتژی', 'خانوادگی'],
    gradient: ['#ef4444', '#f97316'],
    modes: [
      { id: 'ai', label: 'مقابل ربات' },
      { id: 'local', label: 'دو نفره روی یک دستگاه' },
    ],
    difficulties: ['آسان', 'متوسط', 'سخت'],
    seedPlays: 8700,
    addedAt: '2026-08-28',
  },
  {
    id: 'word-fa',
    title: 'حدس کلمه',
    emoji: '🔤',
    categories: ['word', 'puzzle'],
    players: '۱ نفر',
    difficulty: 'متوسط',
    playTime: '۳–۵ دقیقه',
    short: 'کلمهٔ ۵ حرفی فارسی را در ۶ تلاش حدس بزن!',
    description: 'نسخهٔ فارسی بازی محبوب Wordle. یک کلمهٔ ۵ حرفی فارسی انتخاب شده و تو ۶ تلاش داری. رنگ سبز یعنی حرف درست در جای درست، کهربایی یعنی حرف درست در جای اشتباه. واژه‌نامهٔ پرمحتوا و کیبورد فارسی کامل.',
    rating: 4.9,
    tags: ['کلمات', 'فکری', 'روزانه'],
    gradient: ['#8b5cf6', '#d946ef'],
    modes: [{ id: 'solo', label: 'تک‌نفره' }],
    seedPlays: 9900,
    addedAt: '2026-09-05',
  },
];

/* ----------------------- پرس‌وجوها ----------------------- */

export function getGame(id) {
  return GAMES.find((g) => g.id === id) || null;
}

export function listGames({ q = '', category = '', sort = 'popular' } = {}) {
  let out = GAMES.filter((g) => g.active !== false);
  if (q) {
    const s = q.trim().toLowerCase();
    out = out.filter((g) =>
      g.title.toLowerCase().includes(s) ||
      g.short.includes(q.trim()) ||
      g.tags.some((t) => t.includes(q.trim()))
    );
  }
  if (category) out = out.filter((g) => g.categories.includes(category));
  const sorters = {
    popular: (a, b) => b.seedPlays - a.seedPlays,
    newest: (a, b) => b.addedAt.localeCompare(a.addedAt),
    rating: (a, b) => b.rating - a.rating,
    title: (a, b) => a.title.localeCompare(b.title, 'fa'),
  };
  return [...out].sort(sorters[sort] || sorters.popular);
}

export const popularGames = () => [...GAMES].sort((a, b) => b.seedPlays - a.seedPlays);
export const newGames = () => [...GAMES].sort((a, b) => b.addedAt.localeCompare(a.addedAt)).slice(0, 4);

/** تعداد بازی هر دسته — از خود رجیستری محاسبه می‌شود (نه هاردکد) */
export function categoryCounts() {
  const counts = {};
  for (const g of GAMES) for (const c of g.categories) counts[c] = (counts[c] || 0) + 1;
  return counts;
}
