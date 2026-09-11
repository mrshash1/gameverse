/* ============================================================
   GameVerse — ابزارهای مشترک (بدون وابستگی خارجی)
   ============================================================ */

/** ساخت عنصر DOM به شکل مختصر: el('div', {class:'x', onclick}, ...children) */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else node.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

export const rnd = (a, b) => a + Math.random() * (b - a);
export const rndi = (a, b) => Math.floor(rnd(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const FA = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
/** تبدیل اعداد به رقم فارسی */
export function fmtNum(n) {
  return String(n).replace(/\d/g, (d) => FA[+d]);
}

/** m:ss با ارقام فارسی */
export function fmtTime(sec) {
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  return fmtNum(`${m}:${String(s).padStart(2, '0')}`);
}

export const uid = (p = 'id') => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

/** کلید روز به شکل YYYY-MM-DD (با امکان جابه‌جایی روز) */
export function todayKey(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return d.toISOString().slice(0, 10);
}

/** شروع هفتهٔ جاری (دوشنبه‌ها بر اساس ISO) به میلی‌ثانیه */
export function weekStart() {
  const d = new Date();
  const day = (d.getDay() + 6) % 7; // دوشنبه = 0
  d.setHours(0, 0, 0, 0);
  return d.getTime() - day * 86400000;
}

export function timeAgo(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'لحظه‌ای پیش';
  if (diff < 3600000) return `${fmtNum(Math.floor(diff / 60000))} دقیقه پیش`;
  if (diff < 86400000) return `${fmtNum(Math.floor(diff / 3600000))} ساعت پیش`;
  return `${fmtNum(Math.floor(diff / 86400000))} روز پیش`;
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); return true; }
    finally { ta.remove(); }
  }
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** انیمیشن شمارش اعداد برای صفحهٔ نتیجه */
export function countUp(from, to, ms, cb) {
  const t0 = performance.now();
  function frame(t) {
    const p = clamp((t - t0) / ms, 0, 1);
    cb(Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))));
    if (p < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
