/* ============================================================
   GameVerse — پنل مدیریت (نمایشی)
   آنالیتیکس واقعی از داده‌های محلی + مدیریت کاربر/بازی/اتاق/گزارش
   ============================================================ */

import { el, fmtNum, timeAgo } from '../core/utils.js';
import { getDb } from '../core/store.js';
import { API, gamesWithFlags } from '../api/mock-api.js';
import { API as SocialAPI } from '../api/mock-api-social.js';
import { avatar, emptyState, toast, confirmDlg } from '../core/ui.js';
import { getGame } from '../data/registry.js';
import { navigate } from '../core/router.js';

const TABS = [
  { id: 'overview', label: '📊 نمای کلی' },
  { id: 'users', label: '👥 کاربران' },
  { id: 'games', label: '🎮 بازی‌ها' },
  { id: 'rooms', label: '🏟️ اتاق‌ها' },
  { id: 'reports', label: '🚩 گزارش‌ها' },
  { id: 'data', label: '💾 داده‌ها' },
];

export async function render({ outlet }) {
  const db = getDb();
  outlet.innerHTML = '';
  const page = el('div', { class: 'gv-page gv-fade-in' });
  outlet.append(page);

  if (!db.session.adminMode) {
    page.append(emptyState('🔒', 'برای ورود به پنل مدیریت، از «تنظیمات ← حالت مدیریت» فعال کن. (در نسخهٔ واقعی این بخش با نقش سرور محافظت می‌شود)',
      el('a', { class: 'gv-btn gv-btn-primary', href: '#/settings', text: 'رفتن به تنظیمات' })));
    return;
  }

  page.append(el('div', { class: 'gv-page-head' },
    el('h1', { text: '🛠️ پنل مدیریت' }),
    el('span', { class: 'gv-badge gv-badge-warning', text: '⚠️ نسخهٔ نمایشی — داده‌های محلی' }),
  ));

  let tab = 'overview';
  const tabsBar = el('div', { class: 'gv-tabs' }, TABS.map((t) => el('button', {
    class: `gv-tab ${t.id === tab ? 'active' : ''}`, text: t.label,
    onclick: () => { tab = t.id; [...tabsBar.children].forEach((c) => c.classList.remove('active')); tabsBar.children[TABS.indexOf(t)].classList.add('active'); draw(); },
  })));
  page.append(tabsBar);
  const body = el('div', { class: 'gv-section' });
  page.append(body);

  async function draw() {
    body.innerHTML = '';
    if (tab === 'overview') await drawOverview();
    else if (tab === 'users') await drawUsers();
    else if (tab === 'games') drawGames();
    else if (tab === 'rooms') await drawRooms();
    else if (tab === 'reports') drawReports();
    else drawData();
  }

  /* ---------------- نمای کلی ---------------- */
  async function drawOverview() {
    const s = await SocialAPI.admin.stats();
    body.append(el('div', { class: 'gv-stats-grid gv-stats-grid-4' },
      miniStat('👥', fmtNum(s.totalUsers), 'کل کاربران'),
      miniStat('🎮', fmtNum(s.totalMatches), 'کل مسابقه‌ها'),
      miniStat('📅', fmtNum(s.matchesToday), 'مسابقهٔ امروز'),
      miniStat('🟢', fmtNum(s.dau), 'کاربران فعال امروز (DAU)'),
      miniStat('🏟️', fmtNum(s.openRooms), 'اتاق‌های باز'),
      miniStat('🚩', fmtNum(s.openReports), 'گزارش‌های باز'),
      miniStat('🪙', fmtNum(s.coinsIssued), 'سکهٔ صادرشده'),
      miniStat('⏱', `${fmtNum(s.avgSessionMin)} دقیقه`, 'میانگین زمان بازی'),
    ));

    /* نمودار فعالیت هفتگی (CSS خالص) */
    const maxM = Math.max(1, ...s.week.map((w) => w.matches));
    body.append(el('section', { class: 'gv-card', style: 'padding:18px;margin-top:16px' },
      el('h3', { style: 'margin-bottom:14px', text: '📈 مسابقه‌های ۷ روز اخیر' }),
      el('div', { class: 'gv-admin-bars' },
        s.week.map((w) => el('div', { class: 'gv-admin-bar-col' },
          el('div', { class: 'gv-admin-bar', style: `height:${Math.max(6, (w.matches / maxM) * 130)}px`, title: `${w.matches} مسابقه` }),
          el('span', { style: 'font-size:10.5px;color:var(--gv-muted)', text: w.day.slice(5) }),
        )),
      ),
    ));

    /* محبوب‌ترین بازی‌ها */
    const maxP = Math.max(1, ...s.popular.map((p) => p.count));
    body.append(el('section', { class: 'gv-card', style: 'padding:18px;margin-top:16px' },
      el('h3', { style: 'margin-bottom:14px', text: '🔥 محبوب‌ترین بازی‌ها (بر اساس مسابقه‌های واقعی ثبت‌شده)' }),
      el('div', { style: 'display:flex;flex-direction:column;gap:10px' },
        s.popular.map((p) => {
          const g = getGame(p.game);
          return el('div', { class: 'gv-between', style: 'font-size:13px' },
            el('span', { text: `${g?.emoji || '🎮'} ${g?.title || p.game}` }),
            el('div', { class: 'gv-row', style: 'width:55%' },
              el('div', { class: 'gv-progress', style: 'flex:1' }, el('div', { style: `width:${(p.count / maxP) * 100}%` })),
              el('b', { text: fmtNum(p.count) }),
            ),
          );
        }),
      ),
    ));
  }

  function miniStat(icon, value, label) {
    return el('div', { class: 'gv-card gv-stat-card' },
      el('div', { class: 'gv-stat-value' }, el('span', { text: `${icon} ` }), el('span', { text: value })),
      el('div', { class: 'gv-stat-label', text: label }));
  }

  /* ---------------- کاربران ---------------- */
  async function drawUsers() {
    const users = await API.users.list();
    body.append(el('div', { class: 'gv-card', style: 'overflow:auto' },
      el('table', { class: 'gv-table' },
        el('thead', {}, el('tr', {}, el('th', { text: 'کاربر' }), el('th', { text: 'سطح' }), el('th', { text: 'XP' }), el('th', { text: 'مسابقه' }), el('th', { text: 'وضعیت' }), el('th', { text: 'اقدام' }))),
        el('tbody', {}, users.map((u) => el('tr', {},
          el('td', {}, el('a', { class: 'gv-row', href: `#/profile/${u.id}` }, avatar(u, 'sm'), el('span', {}, el('b', { text: u.displayName }), u.isDemo ? el('span', { class: 'gv-badge gv-badge-muted', style: 'font-size:10px', text: ' نمایشی' }) : null))),
          el('td', { text: fmtNum(u.level) }),
          el('td', { text: fmtNum(u.xp) }),
          el('td', { text: fmtNum(u.stats.played) }),
          el('td', {}, u.banned ? el('span', { class: 'gv-badge gv-badge-danger', text: 'مسدود' }) : el('span', { class: 'gv-badge gv-badge-success', text: 'فعال' })),
          el('td', {}, u.id === db.session.userId ? el('span', { class: 'gv-muted-c', style: 'font-size:11px', text: 'شما' }) : el('button', {
            class: `gv-btn gv-btn-sm ${u.banned ? 'gv-btn-success' : 'gv-btn-danger'}`, text: u.banned ? 'رفع مسدودی' : 'مسدودسازی',
            onclick: async () => { await SocialAPI.admin.toggleBan(u.id); toast('وضعیت کاربر تغییر کرد', 'info', '🛠️'); draw(); },
          })),
        ))),
      ),
    ));
  }

  /* ---------------- بازی‌ها ---------------- */
  function drawGames() {
    const games = gamesWithFlags();
    body.append(el('div', { class: 'gv-card', style: 'overflow:auto' },
      el('table', { class: 'gv-table' },
        el('thead', {}, el('tr', {}, el('th', { text: 'بازی' }), el('th', { text: 'دسته' }), el('th', { text: 'فعال' }), el('th', { text: 'ویژه' }))),
        el('tbody', {}, games.map((g) => el('tr', {},
          el('td', { text: `${g.emoji} ${g.title}` }),
          el('td', { class: 'gv-muted-c', style: 'font-size:12px', text: g.categories.join('، ') }),
          el('td', {}, el('button', { class: `gv-btn gv-btn-sm ${g.active ? 'gv-btn-success' : 'gv-btn-danger'}`, text: g.active ? '✓ فعال' : 'غیرفعال', onclick: async () => { await SocialAPI.admin.toggleGameFlag(g.id, 'active'); draw(); } })),
          el('td', {}, el('button', { class: `gv-btn gv-btn-sm ${g.featured ? 'gv-btn-warning' : 'gv-btn-ghost'}`, text: g.featured ? '⭐ ویژه' : 'عادی', onclick: async () => { await SocialAPI.admin.toggleGameFlag(g.id, 'featured'); draw(); } })),
        ))),
      ),
    ));
  }

  /* ---------------- اتاق‌ها ---------------- */
  async function drawRooms() {
    const rooms = await SocialAPI.rooms.list();
    if (!rooms.length) { body.append(emptyState('💨', 'اتاق بازی فعالی وجود ندارد.')); return; }
    body.append(...rooms.map((r) => {
      const g = getGame(r.gameId);
      return el('div', { class: 'gv-card', style: 'padding:14px;margin-bottom:10px' },
        el('div', { class: 'gv-between' },
          el('div', {},
            el('b', { text: `${g?.emoji || '🎮'} ${r.name}` }),
            el('div', { class: 'gv-muted-c', style: 'font-size:12px', text: `کد: ${r.code} · ${fmtNum(r.players.length)} بازیکن · ${timeAgo(r.createdAt)}` }),
          ),
          el('button', { class: 'gv-btn gv-btn-danger gv-btn-sm', text: 'بستن اتاق', onclick: async () => { await SocialAPI.rooms.close(r.code); toast('اتاق بسته شد', 'info', '🛠️'); draw(); } }),
        ),
      );
    }));
  }

  /* ---------------- گزارش‌ها ---------------- */
  function drawReports() {
    const reports = getDb().reports;
    if (!reports.length) { body.append(emptyState('✨', 'هیچ گزارشی وجود ندارد.')); return; }
    body.append(...reports.map((r) => {
      const by = getDb().users[r.byUserId], target = getDb().users[r.targetUserId];
      return el('div', { class: 'gv-card', style: 'padding:14px;margin-bottom:10px' },
        el('div', { class: 'gv-between' },
          el('div', {},
            el('b', { text: r.reason }),
            el('div', { class: 'gv-muted-c', style: 'font-size:12px', text: `${by?.displayName} علیه ${target?.displayName} · ${timeAgo(r.at)}` }),
          ),
          r.status === 'open'
            ? el('div', { class: 'gv-row' },
              el('button', { class: 'gv-btn gv-btn-success gv-btn-sm', text: 'رسیدگی شد', onclick: async () => { await SocialAPI.reports.resolve(r.id, 'resolved'); draw(); } }),
              el('button', { class: 'gv-btn gv-btn-ghost gv-btn-sm', text: 'رد', onclick: async () => { await SocialAPI.reports.resolve(r.id, 'dismissed'); draw(); } }),
            )
            : el('span', { class: 'gv-badge gv-badge-muted', text: r.status === 'resolved' ? '✓ رسیدگی شد' : 'رد شد' }),
        ),
      );
    }));
  }

  /* ---------------- داده‌ها ---------------- */
  function drawData() {
    body.append(el('div', { class: 'gv-card', style: 'padding:18px' },
      el('h3', { text: 'مدیریت داده‌های نمایشی' }),
      el('p', { class: 'gv-muted-c', style: 'font-size:13px;line-height:2;margin:10px 0' },
        { text: 'داده‌های این نسخه محلی‌اند. می‌توانی کاربران و مسابقه‌های نمایشی را بازتولید کنی یا همه‌چیز را پاک کنی. (در نسخهٔ سرور، این بخش به پاک‌سازی دیتابیس با مجوز مدیر وصل می‌شود)' }),
      el('div', { class: 'gv-row', style: 'flex-wrap:wrap' },
        el('button', {
          class: 'gv-btn gv-btn-secondary', text: '🔄 بازتولید داده‌های نمایشی',
          onclick: async () => {
            if (await confirmDlg({ title: 'بازتولید دادهٔ دمو', message: 'همهٔ داده‌ها به حالت اولیهٔ seed بازمی‌گردند (حساب تو هم ساخته می‌شود از نو).', danger: true, okLabel: 'بازتولید' })) {
              await SocialAPI.admin.resetDemoData();
              location.hash = '#/';
              location.reload();
            }
          },
        }),
        el('button', {
          class: 'gv-btn gv-btn-danger', text: '🗑️ پاک‌سازی کامل',
          onclick: async () => {
            if (await confirmDlg({ title: 'پاک‌سازی کامل', message: 'کل دیتابیس محلی پاک می‌شود و اپ ری‌استارت می‌شود.', danger: true, okLabel: 'پاک کن' })) {
              await SocialAPI.admin.wipeEverything();
            }
          },
        }),
      ),
    ));
  }

  await draw();
}
