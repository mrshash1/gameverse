/* ============================================================
   GameVerse — Mock API بخش ۱: کاربران، مسابقه‌ها، جوایز، رده‌بندی
   همهٔ توابع async هستند تا در نسخهٔ سرور بدون تغییر UI، به
   فراخوانی HTTP تبدیل شوند. داده‌های دمو با برچسب isDemo:true
   نشانه‌گذاری شده‌اند و از پنل مدیریت قابل پاک‌سازی‌اند.
   ============================================================ */

import { getDb, update } from '../core/store.js';
import { uid, todayKey, clamp, rndi, pick } from '../core/utils.js';
import { Bus } from '../core/bus.js';
import { GAMES, getGame } from '../data/registry.js';
import {
  wait, levelFromXp, ensureMissions, bumpMission, evaluateAchievements,
  buildSeed, DAILY_MISSIONS, WEEKLY_MISSIONS, FRAMES, TITLES,
} from './core.js';

const AVATAR_COLORS = ['#7c3aed', '#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#3b82f6'];

export const API = {

  /* ---------------- من / کاربران ---------------- */
  me: {
    async get() {
      await wait(20);
      const db = getDb();
      return db.session.userId ? db.users[db.session.userId] : null;
    },
    async create({ username, displayName, avatarEmoji = '🙂' }) {
      await wait();
      return update((db) => {
        const user = {
          id: uid('u'),
          username: (username || 'player').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 18) || uid('p'),
          displayName: displayName?.trim() || 'بازیکن مهمان',
          avatar: { emoji: avatarEmoji || pick('🦊🐼🐯🦁🐨🐺🦉🐬🦄🐢'.split('')), color: pick(AVATAR_COLORS) },
          bio: 'به گیماورس خوش آمدید!',
          title: 'rookie',
          frame: 'default',
          ownedTitles: ['rookie'],
          ownedFrames: ['default'],
          coins: 100,
          xp: 0,
          level: 1,
          rating: 1000,
          banned: false,
          isDemo: false,
          createdAt: Date.now(),
          stats: { played: 0, wins: 0, losses: 0, draws: 0, bestStreak: 0, streak: 0, favorites: [], perGame: {} },
        };
        db.users[user.id] = user;
        db.session.userId = user.id;
        db.social[user.id] = { friends: [], incoming: [], outgoing: [], blocked: [] };
        db.notifications[user.id] = [
          { id: uid('n'), type: 'system', cat: 'system', icon: '👋', title: 'به گیماورس خوش آمدی!', body: 'اولین بازی‌ات را انجام بده و اولین دستاوردت را قفل کن.', at: Date.now(), read: false },
          { id: uid('n'), type: 'reward', cat: 'reward', icon: '🎁', title: 'پاداش روزانه منتظر توست', body: 'به بخش جوایز برو و پاداش ورود امروزت را بگیر.', at: Date.now(), read: false },
        ];
        db.achievements[user.id] = {};
        ensureMissions(user.id);
        // یک درخواست دوستی نمایشی برای شروع مسیر اجتماعی
        db.social[user.id].incoming.push('demo_2');
        db.analytics.days[todayKey()] ||= { logins: {}, matches: 0, newUsers: 0, coinsIssued: 0, playSec: 0 };
        db.analytics.days[todayKey()].newUsers++;
        return user;
      });
    },
    async update(patch) {
      await wait(40);
      return update((db) => {
        const me = db.users[db.session.userId];
        if (!me) return null;
        if (patch.displayName != null) me.displayName = String(patch.displayName).slice(0, 24) || me.displayName;
        if (patch.bio != null) me.bio = String(patch.bio).slice(0, 140);
        if (patch.avatar) me.avatar = { ...me.avatar, ...patch.avatar };
        return me;
      });
    },
    async logout() { update((db) => { db.session.userId = null; }); },
  },

  users: {
    async list() { await wait(40); return Object.values(getDb().users); },
    async get(id) { await wait(30); return getDb().users[id] || null; },
    async search(q) {
      await wait(60);
      const s = (q || '').trim();
      if (!s) return [];
      return Object.values(getDb().users).filter((u) => u.displayName.includes(s) || u.username.includes(s.toLowerCase())).slice(0, 12);
    },
  },

  /* ---------------- مسابقه‌ها (نقطهٔ اعتبارسنجی نتیجه) ---------------- */
  matches: {
    /**
     * ثبت نتیجهٔ مسابقه — نقطهٔ مرکزی اقتصاد بازی.
     * در نسخهٔ سرور این تابع جای AntiCheat واقعی، بازپخش مسابقه و
     * امضای نتایج را انجام می‌دهد (docs/BACKEND.md §Anti-Cheat).
     */
    async submit({ gameId, mode, outcome, score, durationSec, stats }) {
      await wait(90);
      const game = getGame(gameId);
      if (!game) return { ok: false, reason: 'بازی ناشناس است' };
      const rec = { id: uid('m'), gameId, mode, outcome, score: Math.round(score), durationSec: Math.round(durationSec), stats, at: Date.now(), xpEarned: 0, coinsEarned: 0, ratingDelta: 0 };

      return update((db) => {
        const meId = db.session.userId;
        const me = db.users[meId];
        if (!me) return { ok: false, reason: 'ابتدا وارد حساب شو' };
        if (me.banned) return { ok: false, reason: 'حساب شما مسدود است' };
        rec.userId = meId;

        /* اقتصاد — فرمول ثابت و شفاف */
        const baseXp = 20 + Math.round(clamp(rec.score, 0, 1200) / 25);
        const outcomeXp = rec.outcome === 'win' ? 30 : rec.outcome === 'draw' ? 12 : 5;
        rec.xpEarned = baseXp + outcomeXp;
        rec.coinsEarned = (rec.outcome === 'win' ? 12 : rec.outcome === 'draw' ? 5 : 3) + Math.round(clamp(rec.score, 0, 900) / 90);

        /* ELO سبک فقط برای بازی‌های مقابل حریف ربات با رتبهٔ مشخص */
        let ratingDelta = 0;
        const oppRating = game.modes.some((m) => m.id === 'ai') && game.difficulties ? (me.rating > 1400 ? 1300 : 1100) : null;
        if (oppRating) {
          const expected = 1 / (1 + Math.pow(10, (oppRating - me.rating) / 400));
          const s = rec.outcome === 'win' ? 1 : rec.outcome === 'draw' ? 0.5 : 0;
          ratingDelta = Math.round(32 * (s - expected));
          me.rating = Math.max(400, me.rating + ratingDelta);
        }
        rec.ratingDelta = ratingDelta;

        /* آمار */
        const st = me.stats;
        st.played++;
        if (rec.outcome === 'win') { st.wins++; st.streak++; st.bestStreak = Math.max(st.bestStreak, st.streak); }
        else if (rec.outcome === 'lose') { st.losses++; st.streak = 0; }
        else st.draws++;
        const pg = st.perGame[gameId] ||= { played: 0, wins: 0, best: 0 };
        pg.played++;
        if (rec.outcome === 'win') pg.wins++;
        pg.best = Math.max(pg.best, rec.score);

        /* سطح */
        const before = levelFromXp(me.xp);
        me.xp += rec.xpEarned;
        me.coins += rec.coinsEarned;
        const after = levelFromXp(me.xp);
        let levelBonus = 0;
        if (after.level > before.level) levelBonus = after.level * 10, me.coins += levelBonus;

        /* مأموریت‌ها */
        ensureMissions(meId);
        let missionsReached = [
          ...bumpMission(meId, 'play3'),
          ...bumpMission(meId, 'w_play10'),
          ...bumpMission(meId, 'w_xp500', rec.xpEarned),
        ];
        if (rec.outcome === 'win') missionsReached.push(...bumpMission(meId, 'win1'), ...bumpMission(meId, 'w_win5'));
        const ms = db.missions[meId];
        if (!ms.todayGames.includes(gameId)) {
          ms.todayGames.push(gameId);
          missionsReached.push(...bumpMission(meId, 'new_game'));
        }

        /* دستاوردها */
        const newAchs = evaluateAchievements(meId);
        for (const a of newAchs) {
          db.notifications[meId].unshift({ id: uid('n'), type: 'achievement', cat: 'game', icon: a.emoji, title: `دستاورد جدید: ${a.title}`, body: a.desc, at: Date.now(), read: false });
        }

        /* آنالیتیکس */
        const day = db.analytics.days[todayKey()] ||= { logins: {}, matches: 0, newUsers: 0, coinsIssued: 0, playSec: 0 };
        day.matches++;
        day.coinsIssued += rec.coinsEarned;
        day.playSec += rec.durationSec;

        db.matches.push(rec);
        if (db.matches.length > 500) db.matches.shift();

        return {
          ok: true, match: rec, xpEarned: rec.xpEarned, coinsEarned: rec.coinsEarned, ratingDelta,
          levelUp: after.level > before.level ? after.level : null, levelBonus, missionsReached, newAchievements: newAchs,
        };
      });
    },

    async history({ userId = 'me', limit = 20 } = {}) {
      await wait(50);
      const db = getDb();
      const id = userId === 'me' ? db.session.userId : userId;
      return db.matches.filter((m) => m.userId === id).sort((a, b) => b.at - a.at).slice(0, limit);
    },
  },

  /* ---------------- جوایز روزانه و مأموریت‌ها ---------------- */
  rewards: {
    async dailyStatus() {
      await wait(40);
      const db = getDb();
      const id = db.session.userId;
      if (!id) return { canClaim: false, streak: 0 };
      const d = db.daily[id] ||= { lastClaim: null, streak: 0 };
      const yesterday = todayKey(-1);
      return { canClaim: d.lastClaim !== todayKey(), streak: d.streak, claimedToday: d.lastClaim === todayKey(), wasYesterday: d.lastClaim === yesterday };
    },
    async claimDaily() {
      await wait(70);
      return update((db) => {
        const id = db.session.userId;
        const me = db.users[id];
        if (!me) return { ok: false };
        const d = db.daily[id] ||= { lastClaim: null, streak: 0 };
        if (d.lastClaim === todayKey()) return { ok: false, reason: 'امروز قبلاً گرفته‌ای' };
        d.streak = d.lastClaim === todayKey(-1) ? d.streak + 1 : 1;
        d.lastClaim = todayKey();
        const coins = 20 + Math.min(d.streak, 7) * 10;
        me.coins += coins;
        return { ok: true, coins, streak: d.streak };
      });
    },
    async missions() {
      await wait(40);
      const db = getDb();
      const id = db.session.userId;
      if (!id) return null;
      const m = ensureMissions(id);
      return {
        daily: DAILY_MISSIONS.map((d) => ({ ...d, ...m.daily[d.id] })),
        weekly: WEEKLY_MISSIONS.map((w) => ({ ...w, ...m.weekly[w.id] })),
      };
    },
    async claimMission(missionId) {
      await wait(60);
      return update((db) => {
        const id = db.session.userId;
        const me = db.users[id];
        if (!me) return { ok: false };
        const m = ensureMissions(id);
        const def = [...DAILY_MISSIONS, ...WEEKLY_MISSIONS].find((x) => x.id === missionId);
        const st = missionId.startsWith('w_') ? m.weekly[missionId] : m.daily[missionId];
        if (!def || !st || st.claimed || st.p < def.target) return { ok: false };
        st.claimed = true;
        me.coins += def.reward.coins;
        me.xp += def.reward.xp;
        return { ok: true, reward: def.reward };
      });
    },
  },

  /* ---------------- رده‌بندی ---------------- */
  leaderboard: {
    async global({ scope = 'weekly', metric = 'xp' } = {}) {
      await wait(70);
      const db = getDb();
      const weekStart = Date.now() - 7 * 86400000;
      const rows = Object.values(db.users)
        .filter((u) => !u.banned)
        .map((u) => {
          let value;
          if (scope === 'weekly') {
            const ms = db.matches.filter((m) => m.userId === u.id && m.at >= weekStart);
            value = metric === 'xp' ? ms.reduce((s, m) => s + m.xpEarned, 0) : metric === 'wins' ? ms.filter((m) => m.outcome === 'win').length : ms.length;
          } else {
            value = metric === 'xp' ? u.xp : metric === 'wins' ? u.stats.wins : u.stats.played;
          }
          return { user: u, value };
        })
        .filter((r) => r.value > 0)
        .sort((a, b) => b.value - a.value);
      return rows;
    },
    async forGame(gameId) {
      await wait(70);
      const db = getDb();
      return Object.values(db.users)
        .map((u) => ({ user: u, value: u.stats.perGame[gameId]?.best || 0 }))
        .filter((r) => r.value > 0)
        .sort((a, b) => b.value - a.value);
    },
    async friends() {
      await wait(60);
      const db = getDb();
      const id = db.session.userId;
      const g = db.social[id];
      if (!g) return [];
      return g.friends.map((fid) => db.users[fid]).filter(Boolean)
        .map((u) => ({ user: u, value: u.xp }))
        .sort((a, b) => b.value - a.value);
    },
  },

  /* ---------------- دستاوردها ---------------- */
  achievements: {
    async mine() {
      await wait(50);
      const db = getDb();
      return { all: (await import('./core.js')).ACHIEVEMENTS, unlocked: db.achievements[db.session.userId] || {} };
    },
  },

  /* ---------------- لوازم آواتار (سکه‌صرف) ---------------- */
  cosmetics: {
    async catalog() { await wait(30); return { frames: FRAMES, titles: TITLES }; },
    async buy(kind, itemId) {
      await wait(70);
      return update((db) => {
        const me = db.users[db.session.userId];
        if (!me) return { ok: false };
        const cat = kind === 'frame' ? FRAMES : TITLES;
        const item = cat.find((x) => x.id === itemId);
        if (!item) return { ok: false, reason: 'موجود نیست' };
        const owned = kind === 'frame' ? me.ownedFrames : me.ownedTitles;
        if (owned.includes(itemId)) return { ok: true, alreadyOwned: true };
        if (me.coins < item.cost) return { ok: false, reason: 'سکه کافی نداری' };
        me.coins -= item.cost;
        owned.push(itemId);
        return { ok: true, cost: item.cost };
      });
    },
    async equip(kind, itemId) {
      await wait(40);
      return update((db) => {
        const me = db.users[db.session.userId];
        if (!me) return { ok: false };
        const owned = kind === 'frame' ? me.ownedFrames : me.ownedTitles;
        if (!owned.includes(itemId)) return { ok: false };
        if (kind === 'frame') me.frame = itemId; else me.title = itemId;
        return { ok: true };
      });
    },
  },
};

/* پرچم‌های بازی (فعال/ویژه) از پنل مدیریت — ترکیب رجیستری با دیتابیس */
export function gamesWithFlags() {
  const db = getDb();
  return GAMES.map((g) => ({ ...g, ...(db.gameFlags[g.id] || {}), active: (db.gameFlags[g.id]?.active ?? true) }));
}
