/* ============================================================
   GameVerse — SDK میزبانی بازی + ضدتقلب
   ------------------------------------------------------------
   قرارداد استاندارد هر بازی (Game Controller):
     const controller = createGame(host);
     controller.start(); controller.pause(); controller.resume(); controller.destroy();

   host که به بازی داده می‌شود:
     host.root        ظرف DOM بازی (خالی، dir=rtl)
     host.mode        'ai' | 'local' | 'solo'
     host.difficulty  'آسان' | 'متوسط' | 'سخت' | null
     host.sound(name) صدا: click|win|lose|tick|pop|flip|correct|wrong|place
     host.setHud(d)   به‌روزرسانی زندهٔ HUD: {score?, time?, note?}
     host.finish(r)   پایان مسابقه — فقط یک‌بار:
                      { outcome:'win'|'lose'|'draw',
                        score:Number,          // عدد صحیح ۰ تا ۵۰۰۰
                        durationSec:Number,    // زمان واقعی بازی (بدون مکث)
                        stats:[{label:'…', value:'…'}] }  // آماده برای نمایش

   ⚠️ امنیت: در نسخهٔ نهایی، finish() به سرور ارسال می‌شود و سرور با
   بازپخش/حدس آماری نتیجه را اعتبارسنجی می‌کند (docs/BACKEND.md).
   اینجا فقط اعتبارسنجی محدودهٔ منطقی انجام می‌شود.
   ============================================================ */

import { Bus } from '../core/bus.js';

/* محدوده‌های منطقی مجاز هر بازی — نتایج خارج از محدوده رد می‌شوند */
const BOUNDS = {
  'memory':       { maxScore: 1400, maxDurationSec: 1800 },
  'quiz':         { maxScore: 1500, maxDurationSec: 1800 },
  'tic-tac-toe':  { maxScore: 300,  maxDurationSec: 1800 },
  'rps':          { maxScore: 500,  maxDurationSec: 1800 },
  'reaction':     { maxScore: 1300, maxDurationSec: 1800 },
  'connect4':     { maxScore: 500,  maxDurationSec: 2400 },
  'word-fa':      { maxScore: 950,  maxDurationSec: 1800 },
};

export const AntiCheat = {
  _last: {},
  validate(gameId, result) {
    const b = BOUNDS[gameId];
    if (!b) return { ok: false, reason: 'بازی ناشناس است' };
    if (!result || typeof result.score !== 'number' || !Number.isFinite(result.score))
      return { ok: false, reason: 'امتیاز نامعتبر است' };
    if (result.score < 0 || result.score > b.maxScore)
      return { ok: false, reason: 'امتیاز خارج از محدودهٔ مجاز است' };
    if (!['win', 'lose', 'draw'].includes(result.outcome))
      return { ok: false, reason: 'نتیجهٔ نامعتبر است' };
    const dur = Math.round(Number(result.durationSec) || 0);
    if (dur < 1 || dur > b.maxDurationSec)
      return { ok: false, reason: 'زمان مسابقه نامعتبر است' };
    const now = Date.now();
    if (now - (AntiCheat._last[gameId] || 0) < 3000)
      return { ok: false, reason: 'ارسال نتایج پشت‌سرهم مجاز نیست' };
    AntiCheat._last[gameId] = now;
    return { ok: true, durationSec: dur };
  }
};

/** ساخت host برای یک بازی — فقط صفحهٔ Play از این استفاده می‌کند */
export function makeHost(game, rootEl, opts, hooks) {
  let finished = false;
  return {
    game,
    root: rootEl,
    mode: opts.mode || 'solo',
    difficulty: opts.difficulty || null,
    isTouch: window.matchMedia('(pointer: coarse)').matches,
    sound(name) { hooks.onSound?.(name); Bus.emit('game:sound', name); },
    setHud(data) { hooks.onHud?.(data); },
    finish(result) {
      if (finished) return;
      finished = true;
      const check = AntiCheat.validate(game.id, result);
      if (!check.ok) {
        hooks.onFinish({ ok: false, reason: check.reason, result });
        return;
      }
      hooks.onFinish({ ok: true, result: { ...result, durationSec: check.durationSec } });
    }
  };
}
