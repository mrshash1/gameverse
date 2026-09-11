/* ============================================================
   GameVerse — رده‌بندی: هفتگی/کلی/دوستان + رده‌بندی هر بازی
   ============================================================ */

import { el, fmtNum } from '../core/utils.js';
import { getDb } from '../core/store.js';
import { API, gamesWithFlags } from '../api/mock-api.js';
import { avatar, tierBadge, emptyState } from '../core/ui.js';
import { GAMES } from '../data/registry.js';

const SCOPES = [
  { id: 'weekly', label: '📅 هفتگی' },
  { id: 'allTime', label: '♾️ همهٔ زمان‌ها' },
  { id: 'friends', label: '🤝 دوستان' },
];
const METRICS = [
  { id: 'xp', label: 'XP' },
  { id: 'wins', label: '🏆 برد' },
  { id: 'played', label: '🎮 بازی' },
];

export async function render({ outlet }) {
  let scope = 'weekly';
  let metric = 'xp';
  let gameId = '';

  const db = getDb();
  outlet.innerHTML = '';
  const page = el('div', { class: 'gv-page gv-fade-in' });
  outlet.append(page);

  page.append(el('div', { class: 'gv-page-head' },
    el('h1', { text: '🏆 رده‌بندی' }),
    el('p', { class: 'gv-muted-c', text: 'با بازیکنان سراسر گیماورس رقابت کن؛ هر مسابقه رتبه‌ات را بالا می‌برد.' }),
  ));

  const scopeTabs = el('div', { class: 'gv-tabs' }, SCOPES.map((s) => el('button', {
    class: `gv-tab ${s.id === scope ? 'active' : ''}`, text: s.label,
    onclick: () => { scope = s.id; [...scopeTabs.children].forEach((c) => c.classList.remove('active')); scopeTabs.children[SCOPES.indexOf(s)].classList.add('active'); draw(); },
  })));
  const gameSel = el('select', { class: 'gv-select', style: 'max-width:220px' },
    el('option', { value: '', text: '🏅 رده‌بندی کلی' }),
    GAMES.map((g) => el('option', { value: g.id, text: `${g.emoji} ${g.title}` })));
  gameSel.addEventListener('change', () => { gameId = gameSel.value; draw(); });

  const metricTabs = el('div', { class: 'gv-tabs' }, METRICS.map((m) => el('button', {
    class: `gv-tab ${m.id === metric ? 'active' : ''}`, text: m.label,
    onclick: () => { metric = m.id; [...metricTabs.children].forEach((c) => c.classList.remove('active')); metricTabs.children[METRICS.indexOf(m)].classList.add('active'); draw(); },
  })));

  page.append(scopeTabs, el('div', { class: 'gv-filter-bar', style: 'margin-top:14px' }, gameSel, metricTabs));

  const tableWrap = el('div', { class: 'gv-section' });
  page.append(tableWrap);

  async function draw() {
    tableWrap.innerHTML = '';
    tableWrap.append(el('div', { class: 'gv-skeleton', style: 'height:120px' }));
    const meId = db.session.userId;

    if (gameId) {
      const rows = await API.leaderboard.forGame(gameId);
      renderTable(rows, 'بهترین امتیاز', true);
      return;
    }
    if (scope === 'friends') {
      const rows = await API.leaderboard.friends();
      renderTable(rows, 'کل XP', true);
      return;
    }
    const rows = await API.leaderboard.global({ scope, metric });
    renderTable(rows, METRICS.find((m) => m.id === metric).label, true);
  }

  function renderTable(rows, valueLabel, showTier = true) {
    tableWrap.innerHTML = '';
    const meId = db.session.userId;
    if (!rows.length) {
      tableWrap.append(emptyState('🏆', 'هنوز داده‌ای برای این رده‌بندی نیست — اولین نفری باش که بازی می‌کند!',
        el('a', { class: 'gv-btn gv-btn-primary', href: '#/games', text: '🎮 شروع بازی' })));
      return;
    }

    /* سکو */
    const podium = el('div', { class: 'gv-podium' });
    rows.slice(0, 3).forEach((r, i) => {
      podium.append(el('div', { class: `gv-podium-item p${i + 1} ${r.user.id === meId ? 'me' : ''}` },
        el('span', { class: 'gv-podium-medal', text: ['🥇', '🥈', '🥉'][i] }),
        avatar(r.user, i === 0 ? 'lg' : 'md'),
        el('a', { class: 'gv-podium-name', href: `#/profile/${r.user.id}`, text: r.user.displayName }),
        el('span', { class: 'gv-podium-value', text: fmtNum(r.value) }),
      ));
    });
    tableWrap.append(podium);

    const table = el('div', { class: 'gv-card', style: 'overflow:hidden;margin-top:16px' },
      el('table', { class: 'gv-table' },
        el('thead', {}, el('tr', {},
          el('th', { text: '#' }), el('th', { text: 'بازیکن' }),
          showTier ? el('th', { text: 'رده' }) : null, el('th', { text: valueLabel }))),
        el('tbody', {}, rows.slice(0, 20).map((r, i) => el('tr', { class: r.user.id === meId ? 'me' : '' },
          el('td', { text: ['🥇', '🥈', '🥉'][i] || fmtNum(i + 1) }),
          el('td', {}, el('a', { class: 'gv-row', href: `#/profile/${r.user.id}` }, avatar(r.user, 'sm'), el('b', { text: r.user.displayName }), r.user.isDemo ? el('span', { class: 'gv-badge gv-badge-muted', style: 'font-size:10px', text: 'نمایشی' }) : null)),
          showTier ? el('td', {}, tierBadge(r.user.rating)) : null,
          el('td', {}, el('b', { text: fmtNum(r.value) })),
        ))),
      ));
    tableWrap.append(table);
  }

  await draw();
}
