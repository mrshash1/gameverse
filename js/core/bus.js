/* ============================================================
   GameVerse — Bus رویدادها (Pub/Sub)
   معماری آماده برای WebSocket/SSE: در نسخهٔ سرور، همین قرارداد
   به پیام‌های ریل‌تایم وصل می‌شود (docs/BACKEND.md).
   ============================================================ */

const listeners = {};

export const Bus = {
  on(ev, fn) {
    (listeners[ev] ||= new Set()).add(fn);
    return () => listeners[ev]?.delete(fn);
  },
  once(ev, fn) {
    const off = Bus.on(ev, (d) => { off(); fn(d); });
    return off;
  },
  emit(ev, data) {
    (listeners[ev] || []).forEach((fn) => {
      try { fn(data); } catch (e) { console.error(`[bus:${ev}]`, e); }
    });
  }
};
