/* ============================================================
   GameVerse — صفحهٔ اجرای بازی (Game Host)
   انتخاب حالت/سطح → HUD → اجرای ماژول بازی (lazy import) →
   اعتبارسنجی نتیجه (AntiCheat) → ثبت → صفحهٔ نتیجه و جوایز
   ============================================================ */

import { el, fmtNum, pick, copyText, countUp } from '../core/utils.js';
import { getDb, update } from '../core/store.js';
import { getGame, getFactory, catById } from '../data/registry.js';
import { makeHost } from '../games/sdk.js';
import { API, gamesWithFlags } from '../api/mock-api.js';
import { emptyState, toast } from '../core/ui.js';
import { navigate } from '../core/router.js';
import { Sound } from '../core/sound.js';
import { levelFromXp } from '../api/core.js';

let hudRefs = null;

export async function render({ outlet, params, query }) {
  const gameId = params[0];
  const game = getGame(gameId);
  const db = getDb();
  const me = db.users[db.session.userId];

  outlet.innerHTML = '';
  const page = el('div', { class: 'gv-page gv-fade-in gv-play-page' });
  outlet.append(page);

  if (!game) { page.append(emptyState('🛸', 'بازی پیدا نشد.', el('a', { class: 'gv-btn gv-btn-primary', href: '#/games', text: 'همهٔ بازی‌ها' }))); return; }
  if (me?.banned) { page.append(emptyState('🚫', 'حساب مسدود است؛ امکان بازی وجود ندارد.')); return; }
  const flags = db.gameFlags[gameId];
  if (flags && flags.active === false) { page.append(emptyState('🛠️', 'این بازی موقتاً توسط مدیران غیرفعال شده است.')); return; }

  /* ---------------- پیش‌صفحه: انتخاب حالت و سطح ---------------- */
  let mode = query.mode && game.modes.some((m) => m.id === query.mode) ? query.mode : game.modes[0].id;
  let difficulty = game.difficulties ? game.difficulties[game.difficulties.length - 1] : null;

  const pre = el('section', { class: 'gv-pre-game gv-card' });
  page.append(pre);

  function renderPre() {
    pre.innerHTML = '';
    pre.append(
      el('div', { class: 'gv-pre-head' },
        el('div', { class: 'gv-pre-emoji', style: { background: `linear-gradient(135deg, ${game.gradient[0]}, ${game.gradient[1]})` }, text: game.emoji }),
        el('div', {},
          el('h1', { text: game.title }),
          el('p', { class: 'gv-muted-c', text: game.short }),
        ),
      ),
      el('div', { class: 'gv-pre-rows' },
        el('div', {}, el('div', { class: 'gv-label', text: 'حالت بازی' }),
          el('div', { class: 'gv-tabs' }, game.modes.map((m) => el('button', {
            class: `gv-tab ${mode === m.id ? 'active' : ''}`, text: m.label,
            onclick: () => { mode = m.id; Sound.play('click'); renderPre(); },
          })))),
        game.difficulties && mode === 'ai' ? el('div', {}, el('div', { class: 'gv-label', text: 'سطح دشواری' }),
          el('div', { class: 'gv-tabs' }, game.difficulties.map((d) => el('button', {
            class: `gv-tab ${difficulty === d ? 'active' : ''}`, text: d,
            onclick: () => { difficulty = d; Sound.play('click'); renderPre(); },
          })))) : null,
      ),
      query.room ? el('div', { class: 'gv-badge gv-badge-info', style: 'align-self:flex-start', text: `🏟️ در حال بازی در اتاق ${query.room}` }) : null,
      el('button', {
        class: 'gv-btn gv-btn-primary gv-btn-lg gv-btn-block', text: '🚀 شروع بازی',
        onclick: startGame,
      }),
      el('a', { class: 'gv-btn gv-btn-ghost gv-btn-block', href: `#/game/${gameId}`, text: 'بازگشت به جزئیات' }),
    );
  }
  renderPre();

  /* ---------------- اجرای بازی ---------------- */
  let controller = null;
  let gameWrap = null;

  async function startGame() {
    Sound.play('click');
    pre.classList.add('gv-hidden');

    gameWrap = el('section', { class: 'gv-game-shell gv-card' });
    page.append(gameWrap);

    const scoreEl = el('span', { class: 'gv-hud-score', text: '🏆 —' });
    const timeEl = el('span', { class: 'gv-hud-item', text: '⏱ —' });
    const noteEl = el('span', { class: 'gv-hud-item gv-hud-note', text: '' });
    hudRefs = { scoreEl, timeEl, noteEl };

    const root = el('div', { class: 'gv-game-root' });
    gameWrap.append(
      el('div', { class: 'gv-hud' },
        el('button', { class: 'gv-btn gv-btn-ghost gv-btn-icon', title: 'خروج', text: '✖', onclick: quitGame }),
        el('button', {
          class: 'gv-btn gv-btn-ghost gv-btn-icon', title: 'مکث / ادامه', text: '⏸',
          onclick: (e) => {
            if (!controller) return;
            paused = !paused;
            if (paused) { controller.pause(); e.currentTarget.textContent = '▶️'; Sound.play('click'); }
            else { controller.resume(); e.currentTarget.textContent = '⏸'; Sound.play('click'); }
          },
        }),
        scoreEl, timeEl, noteEl,
        el('span', { style: 'flex:1' }),
        el('button', { class: 'gv-btn gv-btn-ghost gv-btn-icon', title: 'تمام‌صفحه', text: '⛶', onclick: () => { if (document.fullscreenElement) document.exitFullscreen(); else gameWrap.requestFullscreen?.().catch(() => {}); } }),
        el('button', { class: 'gv-btn gv-btn-ghost gv-btn-icon', title: 'صدا', text: Sound.muted ? '🔇' : '🔊', onclick: (e) => { e.currentTarget.textContent = Sound.toggle() ? '🔇' : '🔊'; } }),
      ),
      root,
    );

    /* lazy import ماژول بازی (code splitting واقعی) */
    const mod = await import(`../games/${game.id}.js`);
    const factory = getFactory(game.id) || mod.default;

    controller = factory(makeHost(game, root, { mode, difficulty }, {
      onHud({ score, time, note }) {
        if (score != null) scoreEl.textContent = `🏆 ${score}`;
        if (time != null) timeEl.textContent = `⏱ ${time}`;
        if (note != null) noteEl.textContent = note;
      },
      onSound: (n) => Sound.play(n),
      onFinish: handleFinish,
    }));
    controller.start();
  }

  let paused = false;

  function quitGame() {
    if (controller) {
      controller.destroy();
      controller = null;
    }
    gameWrap?.remove();
    pre.classList.remove('gv-hidden');
  }

  /* ---------------- پایان و نتیجه ---------------- */
  async function handleFinish({ ok, result, reason }) {
    controller?.destroy();
    controller = null;
    gameWrap?.remove();

    if (!ok) {
      Sound.play('wrong');
      toast(`نتیجه تأیید نشد: ${reason}`, 'error', '🛡️');
      showResultScreen({ rejected: true, result });
      return;
    }

    const res = await API.matches.submit({ gameId, mode: result.mode || mode, outcome: result.outcome, score: result.score, durationSec: result.durationSec, stats: result.stats });
    if (!res.ok) { toast(res.reason || 'ثبت نتیجه ناموفق بود', 'error', '⚠️'); showResultScreen({ rejected: true, result }); return; }

    showResultScreen({ result, submit: res });
  }

  function showResultScreen({ result, submit, rejected }) {
    const outcome = result?.outcome || 'draw';
    const titles = { win: '🎉 بردی!', lose: '😤 باختی!', draw: '🤝 مساوی شد!' };
    const cls = { win: 'win', lose: 'lose', draw: 'draw' }[outcome];

    const scoreVal = el('span', { class: 'gv-res-score-num', text: '۰' });
    const lv = levelFromXp(getDb().users[getDb().session.userId].xp);

    const screen = el('section', { class: `gv-result gv-card ${cls} gv-fade-in` },
      el('div', { class: 'gv-res-title', text: rejected ? '🛡️ نتیجه ثبت نشد' : titles[outcome] }),
      rejected ? el('p', { class: 'gv-muted-c', text: 'نتیجه از نظر منطقی معتبر نبود (ضدتقلب). بدون جایزه — دوباره تلاش کن!' }) : null,
      el('div', { class: 'gv-res-score' }, scoreVal, el('span', { class: 'gv-res-score-label', text: 'امتیاز' })),
      el('div', { class: 'gv-res-stats' }, (result?.stats || []).map((s) => el('div', { class: 'gv-res-stat' }, el('b', { text: s.value }), el('span', { text: s.label })))),
      !rejected && submit ? el('div', { class: 'gv-res-rewards' },
        el('span', { class: 'gv-badge gv-badge-primary', text: `+${fmtNum(submit.xpEarned)} XP` }),
        el('span', { class: 'gv-badge gv-badge-warning', text: `+${fmtNum(submit.coinsEarned)} 🪙` }),
        submit.ratingDelta ? el('span', { class: `gv-badge ${submit.ratingDelta > 0 ? 'gv-badge-success' : 'gv-badge-danger'}`, text: `${submit.ratingDelta > 0 ? '+' : ''}${fmtNum(submit.ratingDelta)} رده` }) : null,
        submit.levelUp ? el('span', { class: 'gv-badge gv-badge-success', text: `🎊 ارتقا به سطح ${fmtNum(submit.levelUp)} (+${fmtNum(submit.levelBonus)} سکه)` }) : null,
      ) : null,
      !rejected && submit && submit.newAchievements?.length ? el('div', { class: 'gv-res-achs' },
        submit.newAchievements.map((a) => el('div', { class: 'gv-badge gv-badge-warning', text: `${a.emoji} دستاورد: ${a.title}` })),
      ) : null,
      !rejected && submit && submit.missionsReached?.length ? el('div', { class: 'gv-res-achs' },
        submit.missionsReached.map((m) => el('div', { class: 'gv-badge gv-badge-info', text: `✅ مأموریت کامل شد: ${m.title} — در بخش جوایز بگیرش` })),
      ) : null,
      !rejected ? el('div', { class: 'gv-hero-xp' },
        el('div', { class: 'gv-between', style: 'font-size:12px;color:var(--gv-muted)' },
          el('span', { text: `سطح ${fmtNum(lv.level)}` }),
          el('span', { text: `${fmtNum(lv.rem)} / ${fmtNum(lv.need)} XP` })),
        el('div', { class: 'gv-progress' }, el('div', { style: `width:${(lv.rem / lv.need) * 100}%` })),
      ) : null,
      el('div', { class: 'gv-res-actions' },
        el('button', { class: 'gv-btn gv-btn-primary', text: '🔄 بازی دوباره', onclick: () => { page.innerHTML = ''; render({ outlet, params, query }); } }),
        el('button', {
          class: 'gv-btn gv-btn-secondary', text: '🎲 بازی بعدی',
          onclick: () => {
            const others = gamesWithFlags().filter((g) => g.active !== false && g.id !== gameId);
            navigate(`/play/${pick(others).id}`);
          },
        }),
        el('a', { class: 'gv-btn gv-btn-ghost', href: '#/leaderboard', text: '🏆 رده‌بندی' }),
        el('a', { class: 'gv-btn gv-btn-ghost', href: '#/', text: '🏠 خانه' }),
        el('button', {
          class: 'gv-btn gv-btn-ghost gv-btn-icon', title: 'اشتراک‌گذاری نتیجه', text: '📣',
          onclick: async () => {
            const txt = rejected
              ? `تو گیماورس بازی ${game.title} را امتحان کردم!`
              : `در گیماورس بازی «${game.title}» ${outcome === 'win' ? 'برد' : outcome === 'draw' ? 'مساوی کردم' : 'باختم'} با امتیاز ${fmtNum(result.score)}! 🎮`;
            if (navigator.share) { try { await navigator.share({ text: txt, title: 'گیماورس' }); return; } catch {} }
            await copyText(txt);
            toast('نتیجه برای اشتراک‌گذاری کپی شد', 'success', '📣');
          },
        }),
      ),
    );

    if (!rejected) {
      Sound.play('coin');
      if (submit.levelUp) setTimeout(() => Sound.play('levelup'), 600);
      countUp(0, result.score, 900, (v) => { scoreVal.textContent = fmtNum(v); });
    }

    page.append(screen);
  }

  /* پاک‌سازی هنگام ترک صفحه */
  return () => { try { controller?.destroy(); } catch {} };
}
