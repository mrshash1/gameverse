/* ============================================================
   GameVerse — موتور صدا (WebAudio؛ بدون هیچ فایل صوتی)
   افکت‌ها سنتز می‌شوند — سبک، آفلاین و بدون درخواست شبکه.
   ============================================================ */

let ctx = null;
let muted = localStorage.getItem('gv_muted') === '1';
let volume = parseFloat(localStorage.getItem('gv_vol') ?? '0.6');
if (Number.isNaN(volume)) volume = 0.6;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function tone({ f = 440, f2 = null, type = 'sine', dur = 0.15, gain = 0.15, delay = 0 }) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f, t0);
  if (f2) osc.frequency.exponentialRampToValueAtTime(Math.max(30, f2), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain * volume, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

const RECIPES = {
  click()   { tone({ f: 320, f2: 250, type: 'square', dur: 0.05, gain: 0.07 }); },
  flip()    { tone({ f: 520, f2: 720, dur: 0.08, gain: 0.09 }); },
  pop()     { tone({ f: 620, f2: 950, type: 'triangle', dur: 0.13, gain: 0.14 }); },
  tick()    { tone({ f: 1050, type: 'square', dur: 0.035, gain: 0.05 }); },
  place()   { tone({ f: 430, f2: 360, type: 'triangle', dur: 0.07, gain: 0.12 }); },
  correct() { tone({ f: 660, dur: 0.1, gain: 0.13 }); tone({ f: 880, dur: 0.16, delay: 0.09, gain: 0.13 }); },
  wrong()   { tone({ f: 220, f2: 150, type: 'sawtooth', dur: 0.22, gain: 0.1 }); },
  coin()    { tone({ f: 988, dur: 0.07, gain: 0.12 }); tone({ f: 1319, dur: 0.2, delay: 0.07, gain: 0.12 }); },
  win()     { [523, 659, 784, 1047].forEach((f, i) => tone({ f, dur: 0.2, delay: i * 0.12, gain: 0.15 })); },
  lose()    { tone({ f: 330, f2: 140, type: 'sawtooth', dur: 0.5, gain: 0.12 }); },
  levelup() { [440, 554, 659, 880, 1109].forEach((f, i) => tone({ f, dur: 0.16, delay: i * 0.09, type: 'triangle', gain: 0.14 })); },
};

export const Sound = {
  play(name) {
    if (muted) return;
    try { RECIPES[name]?.(); } catch { /* صدا حیاتی نیست */ }
  },
  toggle() {
    muted = !muted;
    localStorage.setItem('gv_muted', muted ? '1' : '0');
    if (!muted) Sound.play('pop');
    return muted;
  },
  get muted() { return muted; },
  setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
    localStorage.setItem('gv_vol', String(volume));
  },
  get volume() { return volume; },
  /** اولین تعامل کاربر برای فعال‌سازی AudioContext */
  unlock() { ac(); },
};
