/* ============================================================
   GameVerse — پروفایل: هویت، آمار، بازی‌ها، دستاوردها، فروشگاه
   ============================================================ */

import { el, fmtNum, timeAgo, pick } from '../core/utils.js';
import { getDb, update } from '../core/store.js';
import { API, gamesWithFlags } from '../api/mock-api.js';
import { API as SocialAPI } from '../api/mock-api-social.js';
import { avatar, statusOf, tierBadge, tierOf, emptyState, toast, progressBar, modal } from '../core/ui.js';
import { levelFromXp, FRAMES, TITLES } from '../api/core.js';
import { navigate } from '../core/router.js';
import { getGame } from '../data/registry.js';
import { Sound } from '../core/sound.js';

const TITLE_LABEL = Object.fromEntries(TITLES.map((t) => [t.id, t.label]));

export async function render({ outlet, params }) {
  const db = getDb();
  const meId = db.session.userId;
  const userId = params[0] === 'me' || !params[0] ? meId : params[0];
  const user = db.users[userId];
  const isMe = userId === meId;

  outlet.innerHTML = '';
  const page = el('div', { class: 'gv-page gv-fade-in' });
  outlet.append(page);

  if (!user) { page.append(emptyState('🛸', 'این بازیکن پیدا نشد.')); return; }

  const lv = levelFromXp(user.xp);
  const tier = tierOf(user.rating);

  /* ---------------- هدر ---------------- */
  const mySocial = db.social[meId] || { friends: [], incoming: [], outgoing: [], blocked: [] };
  page.append(el('section', { class: 'gv-card gv-profile-head' },
    el('div', { class: 'gv-profile-id' },
      avatar(user, 'xl'),
      el('div', { style: 'flex:1' },
        el('div', { class: 'gv-row', style: 'flex-wrap:wrap' },
          el('h1', { text: user.displayName }),
          tierBadge(user.rating),
          !isMe ? el('span', { class: 'gv-badge gv-badge-muted', text: { online: '🟢 آنلاین', ingame: '🎮 در حال بازی', away: '🟡 غایب', offline: '⚪ آفلاین' }[statusOf(userId, false)] }) : null,
        ),
        el('div', { class: 'gv-row', style: 'flex-wrap:wrap' },
          el('span', { class: 'gv-muted-c', text: `@${user.username}` }),
          el('span', { class: 'gv-badge gv-badge-primary', text: `🎖 ${TITLE_LABEL[user.title] || 'تازه‌کار'}` }),
          user.isDemo ? el('span', { class: 'gv-badge gv-badge-muted', text: '🤖 حساب نمایشی' }) : null,
        ),
        el('p', { class: 'gv-muted-c', style: 'font-size:13.5px;margin-top:6px', text: user.bio }),
      ),
    ),
    el('div', { class: 'gv-profile-level' },
      el('div', { class: 'gv-between', style: 'font-size:12.5px' },
        el('b', { text: `⭐ سطح ${fmtNum(lv.level)}` }),
        el('span', { class: 'gv-muted-c', text: `${fmtNum(lv.rem)} / ${fmtNum(lv.need)} XP` }),
      ),
      progressBar((lv.rem / lv.need) * 100),
      el('div', { class: 'gv-row', style: 'flex-wrap:wrap;margin-top:12px' },
        isMe ? el('span', { class: 'gv-badge gv-badge-warning', text: `🪙 ${fmtNum(user.coins)} سکه` }) : null,
        el('span', { class: 'gv-badge gv-badge-info', text: `🗓 عضویت: ${timeAgo(user.createdAt)}` }),
      ),
    ),
    el('div', { class: 'gv-row', style: 'flex-wrap:wrap' },
      isMe ? el('button', { class: 'gv-btn gv-btn-secondary', text: '✏️ ویرایش پروفایل', onclick: editProfile }) : null,
      !isMe && !mySocial.friends.includes(userId) ? el('button', {
        class: 'gv-btn gv-btn-primary', text: '➕ افزودن دوست',
        onclick: async () => { await SocialAPI.social.request(userId); toast('درخواست دوستی ارسال شد — به‌زودی پاسخ می‌گیرید (شبیه‌سازی)', 'success', '🙋'); render({ outlet, params }); },
      }) : null,
      !isMe && mySocial.friends.includes(userId) ? el('button', { class: 'gv-btn gv-btn-success', text: '✅ دوست شما', onclick: () => navigate('/friends') }) : null,
      !isMe ? el('button', {
        class: 'gv-btn gv-btn-danger', text: '🚫 مسدودسازی',
        onclick: async () => { await SocialAPI.social.block(userId); toast('کاربر مسدود شد', 'info', '🚫'); render({ outlet, params }); },
      }) : null,
    ),
  ));

  /* ---------------- آمار ---------------- */
  const st = user.stats;
  const winRate = st.played ? Math.round((st.wins / st.played) * 100) : 0;
  const favGame = Object.entries(st.perGame).sort((a, b) => b[1].played - a[1].played)[0];
  page.append(el('section', { class: 'gv-section' },
    el('h2', { class: 'gv-section-title', style: 'margin-bottom:12px', text: '📊 آمار کلی' }),
    el('div', { class: 'gv-stats-grid gv-stats-grid-4' },
      stat('🎮', fmtNum(st.played), 'بازی انجام‌شده'),
      stat('🏆', fmtNum(st.wins), 'برد'),
      stat('💔', fmtNum(st.losses), 'باخت'),
      stat('📈', `٪${fmtNum(winRate)}`, 'نرخ برد'),
      stat('🔥', fmtNum(st.bestStreak), 'بهترین زنجیره'),
      stat('⚡', fmtNum(user.xp), 'کل XP'),
      stat('🎖', `🥉 ${tier[1]}`, 'ردهٔ رقابتی'),
      stat('❤️', favGame ? getGame(favGame[0])?.title : '—', 'بازی محبوب'),
    ),
  ));

  /* ---------------- عملکرد در بازی‌ها ---------------- */
  const perGameRows = Object.entries(st.perGame).sort((a, b) => b[1].played - a[1].played);
  if (perGameRows.length) {
    page.append(el('section', { class: 'gv-section' },
      el('h2', { class: 'gv-section-title', style: 'margin-bottom:12px', text: '🎯 عملکرد در بازی‌ها' }),
      el('div', { class: 'gv-card', style: 'padding:16px;display:flex;flex-direction:column;gap:14px' },
        perGameRows.map(([gid, s]) => {
          const g = getGame(gid);
          const maxPlayed = perGameRows[0][1].played || 1;
          return el('div', {},
            el('div', { class: 'gv-between', style: 'font-size:13px;margin-bottom:6px' },
              el('span', { text: `${g?.emoji} ${g?.title}` }),
              el('span', { class: 'gv-muted-c', text: `${fmtNum(s.played)} بازی · ${fmtNum(s.wins)} برد · بهترین: ${fmtNum(s.best)}` }),
            ),
            progressBar((s.played / maxPlayed) * 100),
          );
        }),
      ),
    ));
  }

  /* ---------------- آخرین مسابقه‌ها ---------------- */
  const history = await API.matches.history({ userId, limit: 6 });
  if (history.length) {
    page.append(el('section', { class: 'gv-section' },
      el('h2', { class: 'gv-section-title', style: 'margin-bottom:12px', text: '🕘 آخرین مسابقه‌ها' }),
      el('div', { class: 'gv-card', style: 'overflow:hidden' },
        el('table', { class: 'gv-table' },
          el('tbody', {}, history.map((m) => {
            const g = getGame(m.gameId);
            const badge = m.outcome === 'win' ? el('span', { class: 'gv-badge gv-badge-success', text: 'برد' })
              : m.outcome === 'lose' ? el('span', { class: 'gv-badge gv-badge-danger', text: 'باخت' })
                : el('span', { class: 'gv-badge gv-badge-muted', text: 'مساوی' });
            return el('tr', {},
              el('td', { text: g?.emoji || '🎮' }),
              el('td', {}, el('a', { href: `#/game/${m.gameId}`, text: g?.title || m.gameId })),
              el('td', { text: fmtNum(m.score) }),
              el('td', {}, badge),
              el('td', { class: 'gv-muted-c', style: 'font-size:11.5px', text: timeAgo(m.at) }),
            );
          })),
        ),
      ),
    ));
  }

  /* ---------------- فروشگاه لوازم (فقط خودم) ---------------- */
  if (isMe) {
    const { frames, titles } = await API.cosmetics.catalog();
    page.append(el('section', { class: 'gv-section' },
      el('h2', { class: 'gv-section-title', style: 'margin-bottom:12px', text: '🛍️ فروشگاه قاب و عنوان' }),
      el('p', { class: 'gv-muted-c', style: 'font-size:12.5px;margin-bottom:12px', text: 'با سکه‌هایی که از بازی گرفتی قاب آواتار و عنوان خرج کن.' }),
      el('div', { class: 'gv-shop-grid' },
        ...frames.map((f) => shopItem('frame', f, user)),
        ...titles.map((t) => shopItem('title', t, user)),
      ),
    ));
  }
}

function stat(icon, value, label) {
  return el('div', { class: 'gv-card gv-stat-card' },
    el('div', { class: 'gv-stat-value' }, el('span', { text: `${icon} ` }), el('span', { text: value })),
    el('div', { class: 'gv-stat-label', text: label }));
}

function shopItem(kind, item, user) {
  const owned = (kind === 'frame' ? user.ownedFrames : user.ownedTitles).includes(item.id);
  const equipped = kind === 'frame' ? user.frame === item.id : user.title === item.id;
  return el('div', { class: 'gv-card gv-shop-item' },
    el('div', { class: 'gv-shop-preview' },
      kind === 'frame'
        ? el('span', { class: `gv-avatar md ${item.id !== 'default' ? 'f-' + item.id : ''}`, text: '🙂' })
        : el('span', { class: 'gv-badge gv-badge-primary', text: item.label })),
    el('div', { style: 'font-weight:800;font-size:13.5px', text: item.label }),
    el('div', { class: 'gv-muted-c', style: 'font-size:12px', text: item.cost ? `🪙 ${fmtNum(item.cost)}` : 'رایگان' }),
    equipped
      ? el('span', { class: 'gv-badge gv-badge-success', text: '✓ فعال' })
      : owned
        ? el('button', { class: 'gv-btn gv-btn-secondary gv-btn-sm', text: 'فعال‌سازی', onclick: async () => { await API.cosmetics.equip(kind, item.id); Sound.play('pop'); toast('فعال شد!', 'success'); render({ outlet: document.getElementById('gv-outlet'), params: ['me'] }); } })
        : el('button', {
          class: 'gv-btn gv-btn-primary gv-btn-sm', text: 'خرید',
          onclick: async () => {
            const res = await API.cosmetics.buy(kind, item.id);
            if (res.ok) { Sound.play('coin'); toast(`خریداری شد! ${fmtNum(res.cost)} سکه خرج شد`, 'reward', '🛍️'); render({ outlet: document.getElementById('gv-outlet'), params: ['me'] }); }
            else toast(res.reason || 'خرید ناموفق', 'error', '🪙');
          },
        }),
  );
}

/* ---------------- ویرایش پروفایل ---------------- */
const EMOJIS = '🦊🐼🐯🦁🐨🐺🦉🐬🦄🐢🚀🌟🎮⚡🎯🔥😊🤖👾'.split('');
const COLORS = ['#7c3aed', '#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#3b82f6'];

function editProfile() {
  const db = getDb();
  const me = db.users[db.session.userId];
  let emoji = me.avatar.emoji, color = me.avatar.color;
  const nameIn = el('input', { class: 'gv-input', value: me.displayName, maxlength: '24' });
  const bioIn = el('textarea', { class: 'gv-textarea', rows: '2', maxlength: '140', text: me.bio });
  const emojiRow = el('div', { class: 'gv-onb-emojis' });
  const colorRow = el('div', { class: 'gv-onb-emojis' });

  const drawPickers = () => {
    emojiRow.innerHTML = '';
    EMOJIS.forEach((e) => emojiRow.append(el('button', { class: `gv-onb-emoji ${e === emoji ? 'active' : ''}`, text: e, onclick: () => { emoji = e; drawPickers(); } })));
    colorRow.innerHTML = '';
    COLORS.forEach((c) => colorRow.append(el('button', { class: `gv-onb-color ${c === color ? 'active' : ''}`, style: { background: c }, onclick: () => { color = c; drawPickers(); } })));
  };
  drawPickers();

  modal({
    title: '✏️ ویرایش پروفایل',
    content: el('div', { style: 'display:flex;flex-direction:column;gap:13px' },
      el('div', {}, el('label', { class: 'gv-label', text: 'نام نمایشی' }), nameIn),
      el('div', {}, el('label', { class: 'gv-label', text: 'بیوگرافی' }), bioIn),
      el('div', {}, el('label', { class: 'gv-label', text: 'آواتار' }), emojiRow),
      el('div', {}, el('label', { class: 'gv-label', text: 'رنگ' }), colorRow),
    ),
    actions: [
      { label: 'انصراف' },
      {
        label: '💾 ذخیره', class: 'gv-btn-primary',
        onClick: async (close) => {
          await API.me.update({ displayName: nameIn.value, bio: bioIn.value, avatar: { emoji, color } });
          close();
          Sound.play('pop');
          toast('پروفایل به‌روزرسانی شد', 'success', '✅');
          render({ outlet: document.getElementById('gv-outlet'), params: ['me'] });
        },
      },
    ],
  });
}
