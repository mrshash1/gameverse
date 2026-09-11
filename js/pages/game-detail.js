/* ============================================================
   GameVerse — صفحهٔ جزئیات بازی
   ============================================================ */

import { el, fmtNum, copyText, timeAgo } from '../core/utils.js';
import { getDb, update } from '../core/store.js';
import { getGame, catById } from '../data/registry.js';
import { API, gamesWithFlags } from '../api/mock-api.js';
import { avatar, tierBadge, gameCard, sectionHead, emptyState, toast } from '../core/ui.js';
import { navigate } from '../core/router.js';
import { Sound } from '../core/sound.js';

export async function render({ outlet, params }) {
  const gameId = params[0];
  const game = getGame(gameId);
  const db = getDb();
  const me = db.users[db.session.userId];

  outlet.innerHTML = '';
  const page = el('div', { class: 'gv-page gv-fade-in' });
  outlet.append(page);

  if (!game) {
    page.append(emptyState('🛸', 'این بازی پیدا نشد.', el('a', { class: 'gv-btn gv-btn-primary', href: '#/games', text: 'همهٔ بازی‌ها' })));
    return;
  }

  /* ---------------- بنر ---------------- */
  const isFav = me.stats.favorites.includes(gameId);
  page.append(el('section', { class: 'gv-detail-hero', style: `background:linear-gradient(140deg, ${game.gradient[0]}33, ${game.gradient[1]}1c), var(--gv-surface)` },
    el('div', { class: 'gv-detail-cover', style: { background: `linear-gradient(135deg, ${game.gradient[0]}, ${game.gradient[1]})` } },
      el('span', { text: game.emoji })),
    el('div', { class: 'gv-detail-info' },
      el('h1', { text: game.title }),
      el('div', { class: 'gv-detail-meta' },
        el('span', { class: 'gv-badge gv-badge-warning', text: `★ ${fmtNum(game.rating)}` }),
        el('span', { class: 'gv-badge gv-badge-info', text: `👥 ${game.players}` }),
        el('span', { class: 'gv-badge gv-badge-muted', text: `⏱ ${game.playTime}` }),
        el('span', { class: 'gv-badge gv-badge-muted', text: `📈 ${fmtNum(game.seedPlays + (me.stats.perGame[gameId]?.played || 0))} بازی` }),
      ),
      el('div', { class: 'gv-detail-cats' }, game.categories.map((c) => el('span', { class: 'gv-chip', style: 'cursor:default;font-size:12px;padding:5px 11px', text: `${catById(c).emoji} ${catById(c).label}` }))),
      el('p', { class: 'gv-detail-desc', text: game.description }),
      el('div', { class: 'gv-detail-actions' },
        el('button', {
          class: 'gv-btn gv-btn-primary gv-btn-lg', text: '▶ بازی کن',
          onclick: () => { Sound.play('click'); navigate(`/play/${gameId}`); },
        }),
        el('button', {
          class: `gv-btn gv-btn-ghost ${isFav ? 'faved' : ''}`, text: isFav ? '❤️ علاقه‌مندی' : '🤍 علاقه‌مندی',
          onclick: () => {
            update((d) => {
              const f = d.users[d.session.userId].stats.favorites;
              const i = f.indexOf(gameId);
              if (i >= 0) f.splice(i, 1); else f.push(gameId);
            });
            Sound.play('pop');
            render({ outlet, params });
          },
        }),
        el('button', {
          class: 'gv-btn gv-btn-ghost', text: '🏟️ اتاق بازی',
          onclick: async () => {
            const room = await (await import('../api/mock-api-social.js')).API.rooms.create({ name: `اتاق ${game.title}`, gameId, mode: 'casual', maxPlayers: 4 });
            toast(`اتاق ساخته شد — کد: ${room.code}`, 'success', '🏟️');
            navigate(`/room/${room.code}`);
          },
        }),
        el('button', {
          class: 'gv-btn gv-btn-ghost gv-btn-icon', title: 'کپی لینک بازی', text: '🔗',
          onclick: async () => {
            await copyText(`${location.origin}${location.pathname}#/game/${gameId}`);
            toast('لینک بازی کپی شد', 'success', '🔗');
          },
        }),
      ),
    ),
  ));

  /* ---------------- رکورد تو ---------------- */
  const mine = me.stats.perGame[gameId];
  page.append(el('section', { class: 'gv-section' },
    sectionHead('📊', 'رکورد تو در این بازی'),
    el('div', { class: 'gv-stats-grid' },
      el('div', { class: 'gv-card gv-stat-card' }, el('div', { class: 'gv-stat-value', text: fmtNum(mine?.played || 0) }), el('div', { class: 'gv-stat-label', text: 'بازی‌ها' })),
      el('div', { class: 'gv-card gv-stat-card' }, el('div', { class: 'gv-stat-value', text: fmtNum(mine?.wins || 0) }), el('div', { class: 'gv-stat-label', text: 'بردها' })),
      el('div', { class: 'gv-card gv-stat-card' }, el('div', { class: 'gv-stat-value', text: fmtNum(mine?.best || 0) }), el('div', { class: 'gv-stat-label', text: 'بهترین امتیاز' })),
    ),
  ));

  /* ---------------- برترین‌های این بازی ---------------- */
  const top = await API.leaderboard.forGame(gameId);
  if (top.length) {
    page.append(el('section', { class: 'gv-section' },
      sectionHead('🏆', 'برترین‌های این بازی'),
      el('div', { class: 'gv-card', style: 'overflow:hidden' },
        el('table', { class: 'gv-table' },
          el('thead', {}, el('tr', {}, el('th', { text: '#' }), el('th', { text: 'بازیکن' }), el('th', { text: 'رده' }), el('th', { text: 'بهترین امتیاز' }))),
          el('tbody', {}, top.slice(0, 5).map((r, i) => el('tr', { class: r.user.id === me.id ? 'me' : '' },
            el('td', { text: ['🥇', '🥈', '🥉'][i] || fmtNum(i + 1) }),
            el('td', {}, el('a', { class: 'gv-row', href: `#/profile/${r.user.id}` }, avatar(r.user, 'sm'), el('span', { text: r.user.displayName }))),
            el('td', {}, tierBadge(r.user.rating)),
            el('td', { text: fmtNum(r.value) }),
          )))
        )
      )
    ));
  }

  /* ---------------- بازی‌های مشابه ---------------- */
  const similar = gamesWithFlags().filter((g) => g.active !== false && g.id !== gameId && g.categories.some((c) => game.categories.includes(c)));
  if (similar.length) {
    page.append(el('section', { class: 'gv-section' },
      sectionHead('🎯', 'بازی‌های مشابه', '#/games'),
      el('div', { class: 'gv-hscroll' }, similar.map(gameCard)),
    ));
  }
}
