/* ============================================================
   GameVerse — چندزبانی (i18n)
   زبان پیش‌فرض: فارسی (RTL کامل). ساختار آماده برای en / ar —
   کافی است دیکشنری جدید اضافه شود (docs/ROADMAP.md).
   ============================================================ */

const DICTS = {
  fa: {
    'app.name': 'گیماورس',
    'app.tagline': 'کهکشان بازی‌های اجتماعی',
    'nav.home': 'خانه',
    'nav.games': 'بازی‌ها',
    'nav.lobby': 'لابی',
    'nav.leaderboard': 'رده‌بندی',
    'nav.rewards': 'جوایز',
    'nav.friends': 'دوستان',
    'nav.profile': 'پروفایل',
    'nav.achievements': 'دستاوردها',
    'nav.notifications': 'اعلان‌ها',
    'nav.settings': 'تنظیمات',
    'nav.admin': 'مدیریت',
    'nav.logout': 'خروج از حساب',
    'common.play': 'بازی کن',
    'common.playNow': 'همین حالا بازی کن',
    'common.viewAll': 'مشاهدهٔ همه',
    'common.search': 'جست‌وجو…',
    'common.cancel': 'انصراف',
    'common.save': 'ذخیره',
    'common.close': 'بستن',
    'common.confirm': 'تأیید',
    'common.delete': 'حذف',
    'common.share': 'اشتراک‌گذاری',
    'common.copy': 'کپی لینک',
    'common.copied': 'کپی شد ✓',
    'common.loading': 'در حال بارگذاری…',
    'common.empty': 'چیزی اینجا نیست',
    'common.back': 'بازگشت',
    'common.you': 'شما',
    'common.online': 'آنلاین',
    'common.offline': 'آفلاین',
    'common.inGame': 'در حال بازی',
    'common.away': 'غایب',
    'common.level': 'سطح',
    'common.xp': 'امتیاز تجربه',
    'common.coins': 'سکه',
    'common.score': 'امتیاز',
    'common.wins': 'برد',
    'common.losses': 'باخت',
    'common.played': 'بازی‌ها',
    'common.winRate': 'نرخ برد',
    'common.guest': 'مهمان',
    'time.today': 'امروز',
    'time.week': 'این هفته',
    'time.all': 'همهٔ زمان‌ها',
  },
};

let lang = 'fa';

export function t(key) {
  return DICTS[lang]?.[key] ?? DICTS.fa[key] ?? key;
}

export const i18n = {
  get lang() { return lang; },
  get langs() { return Object.keys(DICTS); },
  set(code) {
    if (!DICTS[code]) return;
    lang = code;
    document.documentElement.lang = code;
    document.documentElement.dir = code === 'fa' || code === 'ar' ? 'rtl' : 'ltr';
  },
};
