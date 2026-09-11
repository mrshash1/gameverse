/* ============================================================
   GameVerse — راه‌انداز اپلیکیشن: نوبار، تب‌بار، آن‌بوردینگ، روتر
   ============================================================ */

import { el, debounce, todayKey, pick, fmtNum, uid } from './core/utils.js';
import { Bus } from './core/bus.js';
import { initDb, getDb, update } from './core/store.js';
import { addRoute, startRouter, navigate } from './core/router.js';
import { buildSeed } from './api/core.js';
import { API, gamesWithFlags } from './api/mock-api.js';
import { API as SocialAPI } from './api/mock-api-social.js';
import { Sound } from './core/sound.js';
import { toast, avatar, gameCard, emptyState } from './core/ui.js';
import { renderUserMenu, refreshBellBadge, setBellRef, soundToggleHandler } from './app-bridge.js';
import { registerAllRoutes } from './pages/routes.js';

const EMOJIS = '🦊🐼🐯🦁🐨🐺🦉🐬🦄🐢🚀🌟🎮⚡🎯🔥'.split('');

/* ---------------- bootstrap ---------------- */
initDb(buildSeed);
document.documentElement.dataset.theme = localStorage.getItem('gv_theme') || 'dark';
document.addEventListener('pointerdown', () => Sound.unlock(), { once: true });
window.addEventListener('error', () => toast('خطایی رخ داد؛ اگر تکرار شد صفحه را نوسازی کن.', 'error', '⚠️'));

renderChrome();
registerAllRoutes();

const me = getDb().session.userId ? getDb().users[getDb().session.userId] : null;
if (!me) renderOnboarding();
else if (me.banned) renderBanned();
else startApp();

/* ---------------- chrome: نوبار + تب‌بار ---------------- */
function renderChrome() {
  const nav = document.getElementById('gv-navbar');
  nav.innerHTML = '';
  nav.append(el('div', { class: 'gv-nav-inner' },
    el('a', { class: 'gv-logo', href: '#/' }, el('span', { text: '🎮' }), el('span', { class: 'gv-grad-text', text: 'گیماورس' })),
    el('nav', { class: 'gv-nav-links' },
      navLink('#/', '🏠 خانه'), navLink('#/games', '🎮 بازی‌ها'), navLink('#/lobby', '🏟️ لابی'),
      navLink('#/leaderboard', '🏆 رده‌بندی'), navLink('#/rewards', '🎁 جوایز'),
    ),
    el('div', { class: 'gv-nav-actions' },
      el('button', { class: 'gv-btn gv-btn-ghost gv-btn-icon', 'aria-label': 'جست‌وجو', onclick: openSearch, text: '🔍' }),
      el('div', { class: 'gv-bell-wrap' },
        el('button', { class: 'gv-btn gv-btn-ghost gv-btn-icon', 'aria-label': 'اعلان‌ها', onclick: () => navigate('/notifications'), text: '🔔' }),
        (() => { const b = el('span', { class: 'gv-bell-badge gv-hidden', text: '۰' }); setBellRef(b); return b; })(),
      ),
      el('button', {
        class: 'gv-btn gv-btn-ghost gv-btn-icon', 'aria-label': 'صدا', title: 'صدا',
        onclick: soundToggleHandler, text: Sound.muted ? '🔇' : '🔊',
      }),
      el('div', { id: 'gv-user-menu' }),
    ),
  ));
  renderUserMenu();
  renderTabbar();

  Bus.on('notif:changed', refreshBellBadge);
  Bus.on('route:changed', highlightActive);
  window.addEventListener('online', () => toast('اتصال برقرار شد', 'success', '🟢'));
  window.addEventListener('offline', () => toast('اتصال قطع شد — داده‌ها محلی ذخیره می‌شوند', 'error', '🔴'));
}

function navLink(href, label) { return el('a', { href, class: 'gv-nav-link', 'data-href': href, text: label }); }

function highlightActive({ path }) {
  document.querySelectorAll('.gv-nav-link, .gv-tab').forEach((a) => {
    const h = a.getAttribute('data-href');
    if (h) a.classList.toggle('active', h === '#' + path || (h !== '#/' && ('#' + path).startsWith(h)));
  });
}

function renderTabbar() {
  const tab = document.getElementById('gv-tabbar');
  tab.innerHTML = '';
  tab.append(
    tabItem('#/', '🏠', 'خانه'), tabItem('#/games', '🎮', 'بازی‌ها'), tabItem('#/lobby', '🏟️', 'لابی'),
    tabItem('#/rewards', '🎁', 'جوایز'), tabItem('#/profile', '👤', 'پروفایل'),
  );
}
function tabItem(href, emoji, label) {
  return el('a', { href, class: 'gv-tab', 'data-href': href }, el('span', { text: emoji }), el('span', { text: label }));
}

function startApp() {
  logVisit();
  document.getElementById('gv-tabbar').classList.remove('gv-hidden');
  refreshBellBadge();
  startRouter(document.getElementById('gv-outlet'), { notFound: notFoundPage });
  scheduleDemoLife();
}

function logVisit() {
  const db = getDb();
  const id = db.session.userId;
  if (!id) return;
  update((d) => {
    const day = d.analytics.days[todayKey()] ||= { logins: {}, matches: 0, newUsers: 0, coinsIssued: 0, playSec: 0 };
    day.logins[id] = (day.logins[id] || 0) + 1;
  });
}

/* ---------------- جست‌وجوی سراسری ---------------- */
function openSearch() {
  Sound.play('click');
  const overlay = el('div', { class: 'gv-search-overlay' });
  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  const input = el('input', { class: 'gv-input gv-search-input', placeholder: 'نام بازی، دسته یا بازیکن…', 'aria-label': 'جست‌وجو' });
  const results = el('div', { class: 'gv-search-results' });
  const run = debounce(async () => {
    const q = input.value.trim();
    results.innerHTML = '';
    if (q.length < 2) return;
    const games = gamesWithFlags().filter((g) => g.active !== false && (g.title.includes(q) || g.tags.some((t) => t.includes(q))));
    const users = await API.users.search(q);
    if (games.length) {
      results.append(el('div', { class: 'gv-search-cat', text: '🎮 بازی‌ها' }),
        el('div', { class: 'gv-search-games' }, games.slice(0, 6).map((g) => gameCard(g))));
    }
    if (users.length) {
      results.append(el('div', { class: 'gv-search-cat', text: '👥 بازیکنان' }),
        ...users.slice(0, 6).map((u) => el('a', { class: 'gv-search-user', href: `#/profile/${u.id}` },
          avatar(u, 'sm'), el('span', { text: u.displayName }),
          el('span', { class: 'gv-muted-c', style: 'font-size:12px', text: `سطح ${fmtNum(u.level)}` }))));
    }
    if (!games.length && !users.length) results.append(emptyState('🔍', 'چیزی پیدا نشد. عبارت دیگری امتحان کن.'));
  }, 250);
  input.addEventListener('input', run);
  overlay.append(el('div', { class: 'gv-search-box' },
    el('div', { class: 'gv-row' }, input, el('button', { class: 'gv-btn gv-btn-ghost', text: 'بستن', onclick: close })),
    results));
  document.body.append(overlay);
  setTimeout(() => input.focus(), 60);
}

/* ---------------- آن‌بوردینگ ---------------- */

function renderOnboarding() {
  const outlet = document.getElementById('gv-outlet');
  outlet.innerHTML = '';
  let chosenEmoji = pick(EMOJIS);
  const nameInput = el('input', { class: 'gv-input', placeholder: 'مثلاً: بازیکن_حرفه‌ای', maxlength: '20', 'aria-label': 'نام نمایشی' });
  const emojiRow = el('div', { class: 'gv-onb-emojis' });
  const renderEmojis = () => {
    emojiRow.innerHTML = '';
    EMOJIS.forEach((e) => emojiRow.append(el('button', {
      class: `gv-onb-emoji ${e === chosenEmoji ? 'active' : ''}`, type: 'button', text: e,
      onclick: () => { chosenEmoji = e; renderEmojis(); Sound.play('pop'); },
    })));
  };
  renderEmojis();

  outlet.append(el('div', { class: 'gv-onboarding gv-fade-in' },
    el('div', { class: 'gv-onb-card gv-card' },
      el('div', { class: 'gv-onb-logo', text: '🎮' }),
      el('h1', { class: 'gv-grad-text', text: 'به گیماورس خوش آمدی!' }),
      el('p', { class: 'gv-muted-c', text: '۷ بازی کامل، دوستان، دستاوردها، رده‌بندی و جوایز روزانه — همه در مرورگر تو.' }),
      el('label', { class: 'gv-label', text: 'اسم نمایشی‌ات چی باشه؟' }),
      nameInput,
      el('label', { class: 'gv-label', style: 'margin-top:16px', text: 'آواتارت را انتخاب کن' }),
      emojiRow,
      el('button', {
        class: 'gv-btn gv-btn-primary gv-btn-lg gv-btn-block', style: 'margin-top:22px', text: '🚀 شروع کن!',
        onclick: async () => {
          const name = nameInput.value.trim() || pick(['قهرمان_سایه', 'ستارهٔ_شب', 'پروانهٔ_بازی', 'آذرخش']);
          const user = await API.me.create({ displayName: name, avatarEmoji: chosenEmoji });
          renderUserMenu();
          toast(`خوش آمدی ${user.displayName}! ۱۰۰ سکهٔ هدیه گرفتی 🪙`, 'reward', '🎁');
          startApp();
          navigate('/');
        },
      }),
      el('p', { class: 'gv-onb-note', text: 'داده‌ها فقط در مرورگر خودت ذخیره می‌شوند؛ نسخهٔ سرور در نقشهٔ راه است.' }),
    )
  ));
  setTimeout(() => nameInput.focus(), 100);
}

function renderBanned() {
  const outlet = document.getElementById('gv-outlet');
  outlet.innerHTML = '';
  outlet.append(el('div', { class: 'gv-page' },
    emptyState('🚫', 'حساب شما مسدود شده است. از پنل مدیریت (نمایشی) می‌توانید رفع مسدودی کنید.')));
}

/* ---------------- زندگی نمایشی (شبیه‌سازی شفاف) ---------------- */
function scheduleDemoLife() {
  setTimeout(async () => {
    const db = getDb();
    const id = db.session.userId;
    if (!id || !db.social[id]) return;
    if (db.social[id].incoming.length) return;
    const candidate = pick(Object.values(db.users).filter((u) => u.isDemo && !db.social[id].friends.includes(u.id)));
    if (!candidate) return;
    update((d) => {
      d.social[id].incoming.push(candidate.id);
      d.notifications[id].unshift({ id: uid('n'), type: 'friend', cat: 'social', icon: '🙋', title: `${candidate.displayName} می‌خواهد دوستت شود!`, body: 'به بخش دوستان برو و درخواست را بپذیر.', at: Date.now(), read: false });
    });
    Bus.emit('notif:changed');
    toast(`${candidate.displayName} برایت درخواست دوستی فرستاد`, 'info', '👥');
  }, 45000);
}

/* ---------------- 404 ---------------- */
async function notFoundPage({ outlet }) {
  outlet.innerHTML = '';
  outlet.append(el('div', { class: 'gv-page' },
    emptyState('🛸', 'این صفحه در کهکشان گیماورس پیدا نشد!',
      el('a', { class: 'gv-btn gv-btn-primary', href: '#/', text: 'بازگشت به خانه' })),
  ));
}
