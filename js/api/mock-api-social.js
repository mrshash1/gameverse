/* ============================================================
   GameVerse — Mock API بخش ۲: اجتماعی، اعلان‌ها، اتاق‌ها، مدیریت
   ------------------------------------------------------------
   شفافیت: حضور/رفتار کاربران نمایشی شبیه‌سازی می‌شود (پذیرش خودکار
   درخواست دوستی با تأخیر، ارسال درخواست پس از ورود). این رفتارها
   در docs/LIMITATIONS.md مستند شده‌اند.
   ============================================================ */

import { getDb, update, wipeDb } from '../core/store.js';
import { uid, todayKey, pick, rndi } from '../core/utils.js';
import { Bus } from '../core/bus.js';
import { buildSeed } from './core.js';
import { wait } from './core.js';

const DEMO_ACCEPT_DELAY = () => 4000 + Math.random() * 6000;

export const API = {

  /* ---------------- اجتماعی (دوستان) ---------------- */
  social: {
    async graph() {
      await wait(50);
      const db = getDb();
      const id = db.session.userId;
      const g = db.social[id] ||= { friends: [], incoming: [], outgoing: [], blocked: [] };
      const u = (uid2) => db.users[uid2];
      return {
        friends: g.friends.map(u).filter(Boolean),
        incoming: g.incoming.map(u).filter(Boolean),
        outgoing: g.outgoing.map(u).filter(Boolean),
        blocked: g.blocked.map(u).filter(Boolean),
      };
    },
    async request(targetId) {
      await wait(60);
      const db = getDb();
      const id = db.session.userId;
      const g = db.social[id] ||= { friends: [], incoming: [], outgoing: [], blocked: [] };
      if (g.blocked.includes(targetId) || g.friends.includes(targetId) || g.outgoing.includes(targetId)) return { ok: false };
      g.outgoing.push(targetId);
      // شبیه‌سازی: کاربر نمایشی بعد از چند ثانیه می‌پذیرد
      const target = db.users[targetId];
      if (target?.isDemo) {
        setTimeout(() => {
          update((db2) => {
            const g2 = db2.social[id];
            if (!g2) return;
            g2.outgoing = g2.outgoing.filter((x) => x !== targetId);
            if (!g2.friends.includes(targetId)) {
              g2.friends.push(targetId);
              db2.social[targetId] ||= { friends: [], incoming: [], outgoing: [], blocked: [] };
              db2.social[targetId].friends.push(id);
              db2.notifications[id].unshift({ id: uid('n'), type: 'friend', cat: 'social', icon: '🤝', title: `${target.displayName} درخواست دوستی‌ات را پذیرفت`, body: 'حالا می‌توانید رده‌بندی دوستان را ببینید.', at: Date.now(), read: false });
              Bus.emit('notif:changed');
              evaluateSocialAch(id);
            }
          });
        }, DEMO_ACCEPT_DELAY());
      }
      return { ok: true };
    },
    async accept(targetId) {
      await wait(50);
      return update((db) => {
        const id = db.session.userId;
        const g = db.social[id];
        if (!g || !g.incoming.includes(targetId)) return { ok: false };
        g.incoming = g.incoming.filter((x) => x !== targetId);
        if (!g.friends.includes(targetId)) g.friends.push(targetId);
        db.social[targetId] ||= { friends: [], incoming: [], outgoing: [], blocked: [] };
        if (!db.social[targetId].friends.includes(id)) db.social[targetId].friends.push(id);
        db.notifications[id].unshift({ id: uid('n'), type: 'friend', cat: 'social', icon: '🎉', title: 'دوست جدید اضافه شد!', body: `حالا با ${db.users[targetId]?.displayName} دوست هستید.`, at: Date.now(), read: false });
        Bus.emit('notif:changed');
        evaluateSocialAch(id);
        return { ok: true };
      });
    },
    async reject(targetId) {
      await wait(40);
      return update((db) => {
        const g = db.social[db.session.userId];
        if (g) g.incoming = g.incoming.filter((x) => x !== targetId);
        return { ok: true };
      });
    },
    async remove(targetId) {
      await wait(40);
      return update((db) => {
        const id = db.session.userId;
        const g = db.social[id];
        if (g) g.friends = g.friends.filter((x) => x !== targetId);
        if (db.social[targetId]) db.social[targetId].friends = db.social[targetId].friends.filter((x) => x !== id);
        return { ok: true };
      });
    },
    async block(targetId) {
      await wait(40);
      return update((db) => {
        const id = db.session.userId;
        const g = db.social[id];
        g.friends = g.friends.filter((x) => x !== targetId);
        g.incoming = g.incoming.filter((x) => x !== targetId);
        g.outgoing = g.outgoing.filter((x) => x !== targetId);
        if (!g.blocked.includes(targetId)) g.blocked.push(targetId);
        return { ok: true };
      });
    },
    async suggestions() {
      await wait(40);
      const db = getDb();
      const id = db.session.userId;
      const g = db.social[id] || { friends: [], incoming: [], outgoing: [], blocked: [] };
      return Object.values(db.users).filter((u) =>
        u.id !== id && !g.friends.includes(u.id) && !g.incoming.includes(u.id) && !g.outgoing.includes(u.id) && !g.blocked.includes(u.id)
      ).slice(0, 8);
    },
  },

  /* ---------------- اعلان‌ها ---------------- */
  notifications: {
    async list() {
      await wait(40);
      const db = getDb();
      return (db.notifications[db.session.userId] || []);
    },
    async unreadCount() {
      const db = getDb();
      return (db.notifications[db.session.userId] || []).filter((n) => !n.read).length;
    },
    async markAll() {
      update((db) => {
        const list = db.notifications[db.session.userId] || [];
        list.forEach((n) => (n.read = true));
      });
      Bus.emit('notif:changed');
    },
    async markOne(notifId) {
      update((db) => {
        const n = (db.notifications[db.session.userId] || []).find((x) => x.id === notifId);
        if (n) n.read = true;
      });
      Bus.emit('notif:changed');
    },
    push(userId, notif) {
      update((db) => {
        db.notifications[userId] ||= [];
        db.notifications[userId].unshift({ id: uid('n'), at: Date.now(), read: false, ...notif });
        if (db.notifications[userId].length > 50) db.notifications[userId].pop();
      });
      Bus.emit('notif:changed');
    },
  },

  /* ---------------- اتاق‌های بازی (چندنفرهٔ محلی/شبیه‌سازی‌شده) ---------------- */
  rooms: {
    async list() { await wait(50); return getDb().rooms; },
    async get(code) { await wait(30); return getDb().rooms.find((r) => r.code === code.toUpperCase()) || null; },
    async create({ name, gameId, mode = 'casual', maxPlayers = 4, isPrivate = false }) {
      await wait(80);
      return update((db) => {
        const code = Array.from({ length: 6 }, () => pick('ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.split(''))).join('');
        const room = { code, name: name?.trim() || `اتاق ${db.session.userId?.slice(-4) || 'بازی'}`, gameId, mode, maxPlayers, isPrivate, hostId: db.session.userId, createdAt: Date.now(), settings: {}, players: [{ userId: db.session.userId, isBot: false, ready: true }] };
        db.rooms.unshift(room);
        db.flags.hostedOnce = true;
        // دستاورد «میزبان» بلافاصله ارزیابی شود
        import('./core.js').then(({ evaluateAchievements }) => {
          const newly = evaluateAchievements(db.session.userId);
          newly.forEach((a) => API.notifications.push(db.session.userId, { type: 'achievement', cat: 'game', icon: a.emoji, title: `دستاورد جدید: ${a.title}`, body: a.desc }));
        });
        return room;
      });
    },
    async join(code) {
      await wait(60);
      return update((db) => {
        const room = db.rooms.find((r) => r.code === code.toUpperCase());
        if (!room) return { ok: false, reason: 'اتاق با این کد پیدا نشد' };
        const meId = db.session.userId;
        if (room.players.some((p) => p.userId === meId)) return { ok: true, room };
        if (room.players.length >= room.maxPlayers) return { ok: false, reason: 'ظرفیت اتاق پر است' };
        room.players.push({ userId: meId, isBot: false, ready: false });
        return { ok: true, room };
      });
    },
    async leave(code) {
      await wait(40);
      return update((db) => {
        const room = db.rooms.find((r) => r.code === code.toUpperCase());
        if (!room) return { ok: false };
        const meId = db.session.userId;
        room.players = room.players.filter((p) => p.userId !== meId);
        if (room.hostId === meId) {
          const nextHuman = room.players.find((p) => !p.isBot);
          if (nextHuman) room.hostId = nextHuman.userId;
          else db.rooms = db.rooms.filter((r) => r.code !== room.code);
        }
        return { ok: true };
      });
    },
    async kick(code, userId) {
      await wait(40);
      return update((db) => {
        const room = db.rooms.find((r) => r.code === code.toUpperCase());
        if (!room || room.hostId !== db.session.userId) return { ok: false, reason: 'فقط میزبان می‌تواند حذف کند' };
        room.players = room.players.filter((p) => p.userId !== userId);
        return { ok: true };
      });
    },
    async addDemoPlayer(code) {
      await wait(50);
      return update((db) => {
        const room = db.rooms.find((r) => r.code === code.toUpperCase());
        if (!room) return { ok: false };
        if (room.players.length >= room.maxPlayers) return { ok: false, reason: 'ظرفیت پر است' };
        const demos = Object.values(db.users).filter((u) => u.isDemo && !room.players.some((p) => p.userId === u.id));
        if (!demos.length) return { ok: false, reason: 'بازیکن نمایشی موجود نیست' };
        const u = pick(demos);
        room.players.push({ userId: u.id, isBot: true, ready: true });
        return { ok: true };
      });
    },
    async close(code) {
      await wait(40);
      return update((db) => {
        const room = db.rooms.find((r) => r.code === code.toUpperCase());
        if (!room || room.hostId !== db.session.userId) return { ok: false };
        db.rooms = db.rooms.filter((r) => r.code !== room.code);
        return { ok: true };
      });
    },
  },

  /* ---------------- گزارش‌ها ---------------- */
  reports: {
    async create({ targetUserId, reason }) {
      await wait(50);
      update((db) => {
        db.reports.unshift({ id: uid('r'), byUserId: db.session.userId, targetUserId, reason: reason.slice(0, 200), at: Date.now(), status: 'open' });
      });
      return { ok: true };
    },
    async list() { await wait(40); return getDb().reports; },
    async resolve(id, status = 'resolved') {
      await wait(40);
      update((db) => {
        const r = db.reports.find((x) => x.id === id);
        if (r) r.status = status;
      });
    },
  },

  /* ---------------- پنل مدیریت ---------------- */
  admin: {
    async stats() {
      await wait(80);
      const db = getDb();
      const today = todayKey();
      const week = [];
      for (let i = 6; i >= 0; i--) {
        const k = todayKey(-i);
        const d = db.analytics.days[k] || { logins: {}, matches: 0, newUsers: 0, playSec: 0 };
        week.push({ day: k, logins: Object.keys(d.logins).length, matches: d.matches, newUsers: d.newUsers, playSec: d.playSec });
      }
      const popular = {};
      db.matches.forEach((m) => { popular[m.gameId] = (popular[m.gameId] || 0) + 1; });
      return {
        totalUsers: Object.keys(db.users).length,
        demoUsers: Object.values(db.users).filter((u) => u.isDemo).length,
        totalMatches: db.matches.length,
        matchesToday: (db.analytics.days[today]?.matches) || 0,
        dau: week[6].logins,
        avgSessionMin: Math.round((week.reduce((s, w) => s + w.playSec, 0) / 7 / Math.max(1, week.reduce((s, w) => s + w.matches, 0) / 7)) / 60 * 10) / 10,
        openRooms: db.rooms.length,
        openReports: db.reports.filter((r) => r.status === 'open').length,
        coinsIssued: Object.values(db.analytics.days).reduce((s, d) => s + (d.coinsIssued || 0), 0),
        week, popular: Object.entries(popular).map(([id, n]) => ({ game: id, count: n })).sort((a, b) => b.count - a.count),
      };
    },
    async setAdminMode(on) { update((db) => { db.session.adminMode = !!on; }); },
    async toggleBan(userId) {
      await wait(40);
      return update((db) => {
        const u = db.users[userId];
        if (!u || u.id === db.session.userId) return { ok: false };
        u.banned = !u.banned;
        return { ok: true, banned: u.banned };
      });
    },
    async toggleGameFlag(gameId, field) {
      await wait(40);
      return update((db) => {
        db.gameFlags[gameId] ||= { active: true, featured: false };
        db.gameFlags[gameId][field] = !db.gameFlags[gameId][field];
        return db.gameFlags[gameId];
      });
    },
    async resetDemoData() {
      await wait(120);
      update((db) => {
        const fresh = buildSeed();
        Object.assign(db, fresh);
      });
    },
    async wipeEverything() { wipeDb(); },
  },
};

function evaluateSocialAch(userId) {
  import('./core.js').then(({ evaluateAchievements }) => {
    const newly = evaluateAchievements(userId);
    newly.forEach((a) => API.notifications.push(userId, { type: 'achievement', cat: 'game', icon: a.emoji, title: `دستاورد جدید: ${a.title}`, body: a.desc }));
  });
}
