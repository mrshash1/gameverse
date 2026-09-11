/* ============================================================
   GameVerse — هستهٔ لایهٔ داده (Mock Backend)
   ------------------------------------------------------------
   ⚠️ شفافیت: این لایه نقش سرور را در مرورگر بازی می‌کند
   (localStorage). در نسخهٔ نهایی، هر تابع به REST/WebSocket یک
   بک‌اند واقعی وصل می‌شود و اعتبارسنجی سمت سرور انجام می‌گیرد.
   → معماری هدف: docs/BACKEND.md | محدودیت‌ها: docs/LIMITATIONS.md
   ============================================================ */

import { uid, rndi, pick, todayKey, weekStart } from '../core/utils.js';
import { getDb } from '../core/store.js';
import { GAMES } from '../data/registry.js';

/* تأخیر شبیه‌سازی‌شدهٔ شبکه */
export const wait = (ms = 60) => new Promise((r) => setTimeout(r, ms + Math.random() * 70));

/* ---------------- ریاضی XP / سطح ---------------- */
export function xpForLevel(level) {
  return Math.round(100 * Math.pow(level, 1.35));
}
export function levelFromXp(xp) {
  let level = 1, rem = xp;
  while (rem >= xpForLevel(level) && level < 200) { rem -= xpForLevel(level); level++; }
  return { level, rem, need: xpForLevel(level) };
}

/* ---------------- دستاوردها ---------------- */
export const ACHIEVEMENTS = [
  { id: 'first_win', emoji: '🥇', title: 'اولین پیروزی', desc: 'اولین بازی خودت را ببر', points: 10, check: (u) => u.stats.wins >= 1 },
  { id: 'wins_10', emoji: '🎯', title: 'ده‌تایی', desc: '۱۰ بازی ببر', points: 20, check: (u) => u.stats.wins >= 10 },
  { id: 'wins_50', emoji: '🏹', title: 'شکارچی', desc: '۵۰ بازی ببر', points: 40, check: (u) => u.stats.wins >= 50 },
  { id: 'streak_3', emoji: '🔥', title: 'زنجیرهٔ آتش', desc: '۳ برد پیاپی بگیر', points: 20, check: (u) => u.stats.bestStreak >= 3 },
  { id: 'streak_5', emoji: '🌋', title: 'توقف‌ناپذیر', desc: '۵ برد پیاپی بگیر', points: 35, check: (u) => u.stats.bestStreak >= 5 },
  { id: 'games_10', emoji: '🎮', title: 'تازه‌کار', desc: '۱۰ بازی انجام بده', points: 10, check: (u) => u.stats.played >= 10 },
  { id: 'games_50', emoji: '🕹️', title: 'حرفه‌ای', desc: '۵۰ بازی انجام بده', points: 30, check: (u) => u.stats.played >= 50 },
  { id: 'games_100', emoji: '👑', title: 'افسانهٔ گیماورس', desc: '۱۰۰ بازی انجام بده', points: 60, check: (u) => u.stats.played >= 100 },
  { id: 'xp_1000', emoji: '⚡', title: 'هزارتایی', desc: '۱٬۰۰۰ XP جمع کن', points: 20, check: (u) => u.xp >= 1000 },
  { id: 'level_5', emoji: '⭐', title: 'سطح ۵', desc: 'به سطح ۵ برس', points: 25, check: (u) => u.level >= 5 },
  { id: 'level_10', emoji: '🌟', title: 'ستارهٔ درخشان', desc: 'به سطح ۱۰ برس', points: 50, check: (u) => u.level >= 10 },
  { id: 'explorer', emoji: '🧭', title: 'کاوشگر', desc: 'هر ۷ بازی را امتحان کن', points: 40, check: (u) => Object.keys(u.stats.perGame).length >= 7 },
  { id: 'smart', emoji: '🧠', title: 'تیزبین', desc: 'در آزمون دانش امتیاز ۸۵۰+ بگیر', points: 30, check: (u) => (u.stats.perGame.quiz?.best || 0) >= 850 },
  { id: 'flash', emoji: '💨', title: 'برق‌آسا', desc: 'در سرعت واکنش امتیاز ۵۵۰+ بگیر', points: 30, check: (u) => (u.stats.perGame.reaction?.best || 0) >= 550 },
  { id: 'social', emoji: '🤝', title: 'رفيق‌باز', desc: '۳ دوست اضافه کن', points: 15, check: (u, db) => (db.social[u.id]?.friends.length || 0) >= 3 },
  { id: 'host', emoji: '🎪', title: 'میزبان', desc: 'اولین اتاقت را بساز', points: 10, check: (u, db) => !!db.flags?.hostedOnce },
];
export const achById = (id) => ACHIEVEMENTS.find((a) => a.id === id);

export function evaluateAchievements(userId) {
  const db = getDb();
  const u = db.users[userId];
  if (!u) return [];
  db.achievements[userId] ||= {};
  const mine = db.achievements[userId];
  const newly = [];
  for (const a of ACHIEVEMENTS) {
    if (!mine[a.id] && a.check(u, db)) { mine[a.id] = Date.now(); newly.push(a); }
  }
  return newly;
}

/* ---------------- مأموریت‌ها ---------------- */
export const DAILY_MISSIONS = [
  { id: 'play3', emoji: '🎮', title: '۳ بازی انجام بده', target: 3, reward: { coins: 20, xp: 40 } },
  { id: 'win1', emoji: '🏅', title: '۱ بازی ببر', target: 1, reward: { coins: 25, xp: 50 } },
  { id: 'new_game', emoji: '🧪', title: 'یک بازی جدید امتحان کن', target: 1, reward: { coins: 15, xp: 30 } },
];
export const WEEKLY_MISSIONS = [
  { id: 'w_play10', emoji: '🕹️', title: '۱۰ بازی در این هفته', target: 10, reward: { coins: 60, xp: 120 } },
  { id: 'w_win5', emoji: '🏆', title: '۵ برد در این هفته', target: 5, reward: { coins: 80, xp: 150 } },
  { id: 'w_xp500', emoji: '⚡', title: '۵۰۰ XP در این هفته', target: 500, reward: { coins: 100, xp: 0 } },
];

export function ensureMissions(userId) {
  const db = getDb();
  const m = db.missions[userId] ||= { date: todayKey(), weekStart: 0, daily: {}, weekly: {}, todayGames: [] };
  if (m.date !== todayKey()) {
    m.date = todayKey();
    m.daily = {};
    m.todayGames = [];
  }
  const ws = weekStart();
  if (m.weekStart !== ws) { m.weekStart = ws; m.weekly = {}; }
  for (const d of DAILY_MISSIONS) m.daily[d.id] ||= { p: 0, claimed: false };
  for (const w of WEEKLY_MISSIONS) m.weekly[w.id] ||= { p: 0, claimed: false };
  return m;
}

/** افزایش پیشرفت مأموریت — خروجی: مأموریت‌هایی که همین حالا کامل شدند */
export function bumpMission(userId, id, amount = 1) {
  const db = getDb();
  const m = ensureMissions(userId);
  const all = [...DAILY_MISSIONS, ...WEEKLY_MISSIONS];
  const def = all.find((x) => x.id === id);
  if (!def) return [];
  const bucket = id.startsWith('w_') ? m.weekly : m.daily;
  const st = bucket[id];
  if (!st || st.claimed || st.p >= def.target) return [];
  st.p = Math.min(def.target, st.p + amount);
  if (st.p >= def.target) return [{ ...def, bucket: id.startsWith('w_') ? 'weekly' : 'daily' }];
  return [];
}

/* ---------------- فروشگاه لوازم آرایشی آواتار ---------------- */
export const FRAMES = [
  { id: 'default', label: 'پیش‌فرض', cost: 0, emoji: '⚪' },
  { id: 'gold', label: 'طلایی', cost: 150, emoji: '🟡' },
  { id: 'flame', label: 'شعله‌ور', cost: 300, emoji: '🔥' },
  { id: 'neon', label: 'نئون', cost: 220, emoji: '💠' },
  { id: 'royal', label: 'سلطنتی', cost: 350, emoji: '👑' },
];
export const TITLES = [
  { id: 'rookie', label: 'تازه‌کار', cost: 0 },
  { id: 'fighter', label: 'جنگاور', cost: 120 },
  { id: 'strategist', label: 'استراتژیست', cost: 180 },
  { id: 'speedster', label: 'برق‌آسا', cost: 180 },
  { id: 'legend', label: 'افسانه', cost: 500 },
];

/* ---------------- کاربران نمایشی (دادهٔ دمو — قابل پاک‌سازی از پنل مدیریت) ---------------- */
const DEMO_USERS = [
  ['آرمان', '🦊', '#f43f5e', 'شب‌بیدارِ دنیای بازی‌ها 🌙'],
  ['سارا', '🐼', '#8b5cf6', 'حیفم می‌آید ببازم ولی بازی می‌کنم!'],
  ['نیما', '🐯', '#f59e0b', 'استراتژی یا شانس؟ هر دو 😎'],
  ['مریم', '🦋', '#ec4899', 'قهرمان آزمون دانش این هفته'],
  ['پارسا', '🦁', '#ef4444', 'فقط بازی‌های رقابتی!'],
  ['الهام', '🐬', '#06b6d4', 'دنبال حریف برای چهار در یک ردیفم'],
  ['کیان', '🐺', '#64748b', 'آرام و پیوسته پیش می‌روم'],
  ['رها', '🦄', '#d946ef', 'عاشق بازی‌های کلماتی‌ام 💜'],
  ['سام', '🐨', '#10b981', 'برای سلامتی، روزی سه بازی!'],
  ['درسا', '🦅', '#3b82f6', 'سرعت واکنش؟ تخصص من'],
  ['بهرام', '🐢', '#84cc16', 'آهسته برو، پیوسته برو'],
  ['یاسمن', '🐙', '#f97316', 'حافظه‌ام مثل فیل است 🐘'],
];

function seededUser([name, emoji, color, bio], i) {
  const played = rndi(15, 95);
  const wins = Math.round(played * (0.38 + Math.random() * 0.24));
  const xp = played * rndi(28, 55);
  const lv = levelFromXp(xp).level;
  const perGame = {};
  let remaining = played;
  const gids = GAMES.map((g) => g.id);
  gids.forEach((gid, idx) => {
    const isLast = idx === gids.length - 1;
    const share = isLast ? remaining : rndi(0, Math.max(0, Math.floor(remaining / (gids.length - idx))) * 2);
    if (share > 0) {
      perGame[gid] = { played: share, wins: Math.round(share * (0.35 + Math.random() * 0.3)), best: rndi(150, 1250) };
      remaining -= share;
    }
  });
  return {
    id: `demo_${i + 1}`,
    username: `demo${i + 1}`,
    displayName: name,
    avatar: { emoji, color },
    bio,
    title: 'rookie',
    frame: i < 3 ? 'gold' : 'default',
    ownedTitles: ['rookie'],
    ownedFrames: ['default', ...(i < 3 ? ['gold'] : [])],
    coins: rndi(80, 600),
    xp,
    level: lv,
    rating: rndi(920, 1520),
    banned: false,
    isDemo: true,
    createdAt: Date.now() - rndi(30, 300) * 86400000,
    stats: {
      played, wins, losses: played - wins - rndi(0, Math.floor(played * 0.1)), draws: rndi(0, 8),
      bestStreak: rndi(1, 6), streak: 0, favorites: [pick(gids)], perGame,
    },
  };
}

/* ---------------- Seed کامل دیتابیس ---------------- */
export function buildSeed() {
  const now = Date.now();
  const users = {};
  DEMO_USERS.forEach((d, i) => { const u = seededUser(d, i); users[u.id] = u; });

  // مسابقات نمایشی ۷ روز اخیر (برای رده‌بندی هفتگی، آمار محبوبیت و آنالیتیکس)
  const matches = [];
  const days = {};
  for (let d = 6; d >= 0; d--) {
    const key = todayKey(-d);
    days[key] = { logins: {}, matches: 0, newUsers: d === 3 ? 1 : 0, coinsIssued: 0, playSec: 0 };
    for (const u of Object.values(users)) {
      const n = rndi(0, 3);
      days[key].logins[u.id] = n;
      for (let k = 0; k < n; k++) {
        const g = pick(GAMES);
        const outcome = Math.random() < 0.5 ? 'win' : Math.random() < 0.75 ? 'lose' : 'draw';
        matches.push({
          id: uid('m'), gameId: g.id, userId: u.id, mode: g.modes[0].id,
          outcome, score: rndi(40, Math.min(1300, g.rating * 220)),
          durationSec: rndi(40, 300), at: now - d * 86400000 - rndi(0, 82800) * 1000,
          xpEarned: rndi(25, 70), coinsEarned: rndi(3, 15), ratingDelta: 0,
        });
        days[key].matches++;
        days[key].playSec += 120;
      }
    }
  }

  // دو اتاق فعال نمایشی
  const rooms = [
    { code: 'GVX42A', name: 'اتاق دوستان آرمان', gameId: 'tic-tac-toe', mode: 'casual', maxPlayers: 4, isPrivate: false, hostId: 'demo_1', createdAt: now - 600000, settings: {}, players: [{ userId: 'demo_1', isBot: false, ready: true }, { userId: 'demo_3', isBot: true, ready: true }] },
    { code: 'QZ88LM', name: 'مسابقهٔ اطلاعات عمومی', gameId: 'quiz', mode: 'ranked', maxPlayers: 8, isPrivate: false, hostId: 'demo_4', createdAt: now - 300000, settings: {}, players: [{ userId: 'demo_4', isBot: false, ready: true }, { userId: 'demo_2', isBot: true, ready: true }, { userId: 'demo_9', isBot: true, ready: false }] },
  ];

  return {
    v: 1,
    seededAt: now,
    users,
    session: { userId: null, adminMode: false },
    social: {},
    notifications: {},
    matches,
    missions: {},
    daily: {},
    achievements: {},
    analytics: { days },
    reports: [
      { id: uid('r'), byUserId: 'demo_2', targetUserId: 'demo_7', reason: 'رفتار نامناسب در اتاق بازی (نمایشی)', at: now - 3600000, status: 'open' },
      { id: uid('r'), byUserId: 'demo_5', targetUserId: 'demo_11', reason: 'اسپم در چت لابی (نمایشی)', at: now - 86400000, status: 'open' },
    ],
    rooms,
    gameFlags: Object.fromEntries(GAMES.map((g) => [g.id, { active: true, featured: !!g.featured }])),
    flags: { hostedOnce: false },
  };
}
