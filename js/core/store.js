/* ============================================================
   GameVerse — Store مرکزی با ذخیره‌سازی localStorage
   در نسخهٔ سرور، همین اینترفیس به دیتابیس واقعی وصل می‌شود.
   ============================================================ */

import { Bus } from './bus.js';

const DB_KEY = 'gv_db_v1';
let db = null;

export function loadRaw() {
  try { return JSON.parse(localStorage.getItem(DB_KEY)); } catch { return null; }
}

/** مقداردهی اولیه — اگر دیتابیسی نبود seed می‌سازد */
export function initDb(seedFn) {
  db = loadRaw();
  if (!db || db.v !== 1) {
    db = seedFn();
    persistNow();
  }
}

export const getDb = () => db;

/** تغییر اتمی + ذخیرهٔ فوری + انتشار رویداد — مقدار callback برمی‌گردد */
export function update(fn) {
  const result = fn(db);
  persistNow();
  Bus.emit('db:changed');
  return result;
}

function persistNow() {
  try { localStorage.setItem(DB_KEY, JSON.stringify(db)); }
  catch (e) { console.warn('[store] persist failed', e); }
}

/** پاک‌سازی کامل همهٔ داده‌ها (از تنظیمات/پنل مدیریت) */
export function wipeDb() {
  localStorage.removeItem(DB_KEY);
  location.hash = '#/';
  location.reload();
}
