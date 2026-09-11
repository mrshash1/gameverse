/* ============================================================
   GameVerse — صفحهٔ خانه: هیرو، بازی ویژه، ردیف‌های داینامیک
   همهٔ ردیف‌ها از رجیستری بازی‌ها و دادهٔ کاربر ساخته می‌شوند.
   ============================================================ */

import { el, fmtNum, shuffle, pick } from '../core/utils.js';
import { getDb } from '../core/store.js';
import { gamesWithFlags } from '../api/mock-api.js';
import { gameCard, sectionHead, avatar, statusOf, emptyState } from '../core/ui.js';
import { levelFromXp } from '../api/core.js';
import { CATEGORIES, catById, categoryCounts } from '../data/registry.js';
import { progressBar } from '../core/ui.js';

export async function render({ outlet }) {
  const db = getDb();
  const me = db.users[db.session.userId];
  const games = gamesWithFlags().filter((g) => g.active !== false);

  outlet.innerHTML = '';
  const page = el('div', { class: 'gv-page gv-fade-in' });
  outlet.append(page);

  /* ---------------- هیرو ---------------- */
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'صبح بخیر ☀️' : hour < 18 ? 'وقت خوش ⛅' : 'شب بازی‌ها بخیر 🌙';
  const lv = levelFromXp(me.xp);
  const daily = db.daily[me.id];
  const hero = el('section', { class: 'gv-hero gv-glass' },
    el('div', { class: 'gv-hero-text' },
      el('div', { class: 'gv-hero-hi' }, el('span', { text: greet }), el('b', { text: me.displayName }), el('span', { text: '!' })),
      el('h1', { class: 'gv-hero-title' }, 'امروز چه بازی‌ای می‌زنیم؟', el('span', { class: 'gv-hero-cursor', text: '❓' })),
      el('div', { class: 'gv-hero-chips' },
        el('span', { class: 'gv-badge gv-badge-primary', text: `⭐ سطح ${fmtNum(lv.level)}` }),
        el('span', { class: 'gv-badge gv-badge-warning', text: `🪙 ${fmtNum(me.coins)} سکه` }),
        el('span', { class: 'gv-badge gv-badge-info', text: `🔥 زنجیرهٔ ورود: ${fmtNum(daily?.streak || 0)} روز` }),
        el('span', { class: 'gv-badge gv-badge-success', text: `🎮 ${fmtNum(me.stats.played)} بازی` }),
      ),
      el('div', { class: 'gv-hero-cta' },
        el('button', {
          class: 'gv-btn gv-btn-primary gv-btn-lg', text: '🎲 سورپرایزم کن',
          onclick: () => { location.hash = `#/play/${pick(games).id}`; },
        }),
        el('a', { class: 'gv-btn gv-btn-ghost gv-btn-lg', href: '#/games', text: '🧭 کاوش بازی‌ها' }),
      ),
    ),
    el('div', { class: 'gv-hero-xp' },
      el('div', { class: 'gv-between', style: 'font-size:12px;color:var(--gv-muted)' },
        el('span', { text: `XP تا سطح ${fmtNum(lv.level + 1)}` }),
        el('span', { text: `${fmtNum(lv.rem)} / ${fmtNum(lv.need)}` })),
      progressBar((lv.rem / lv.need) * 100)
    )
  );
  page.append(hero);

  /* ---------------- بازی ویژه ---------------- */
  const featured = games.find((g) => g.featured) || games.slice().sort((a, b) => b.seedPlays - a.seedPlays)[0];
  page.append(el('section', { class: 'gv-featured gv-card', style: `background:linear-gradient(135deg, ${featured.gradient[0]}26, ${featured.gradient[1]}18), var(--gv-surface)` },
    el('div', { class: 'gv-featured-cover', style: { background: `linear-gradient(135deg, ${featured.gradient[0]}, ${featured.gradient[1]})` } },
      el('span', { class: 'gv-featured-emoji', text: featured.emoji })),
    el('div', { class: 'gv-featured-info' },
      el('span', { class: 'gv-badge gv-badge-warning', text: '⭐ بازی ویژه امروز' }),
      el('h2', { text: featured.title }),
      el('p', { class: 'gv-muted-c', text: featured.short }),
      el('div', { class: 'gv-row', style: 'flex-wrap:wrap' },
        el('a', { class: 'gv-btn gv-btn-primary', href: `#/play/${featured.id}`, text: '▶ همین حالا بازی کن' }),
        el('a', { class: 'gv-btn gv-btn-ghost', href: `#/game/${featured.id}`, text: 'جزئیات و رده‌بندی' }),
      ),
    )
  ));

  /* ---------------- دسته‌بندی‌ها (داینامیک از رجیستری) ---------------- */
  const counts = categoryCounts();
  page.append(el('section', { class: 'gv-section' },
    sectionHead('🗂️', 'دسته‌بندی‌ها', '#/games'),
    el('div', { class: 'gv-hscroll' },
      CATEGORIES.filter((c) => counts[c.id]).map((c) => el('a', {
        class: 'gv-chip', href: `#/games?cat=${c.id}`, text: `${c.emoji} ${c.label} (${fmtNum(counts[c.id])})`,
      }))
    )
  ));

  /* ---------------- ردیف‌ها ---------------- */
  const row = (emoji, title, list, moreHref) => {
    if (!list.length) return null;
    return el('section', { class: 'gv-section' },
      sectionHead(emoji, title, moreHref || null),
      el('div', { class: 'gv-hscroll' }, list.map(gameCard)),
    );
  };

  const popular = [...games].sort((a, b) => b.seedPlays - a.seedPlays);
  page.append(row('🔥', 'محبوب‌ترین‌ها', popular.slice(0, 6), '#/games?sort=popular'));
  page.append(row('🆕', 'تازه‌رسیده‌ها', [...games].sort((a, b) => b.addedAt.localeCompare(a.addedAt)).slice(0, 6), '#/games?sort=newest'));

  /* پیشنهاد هوشمند (قاعده‌محور — آمادهٔ مدل ML در نقشهٔ راه) */
  const favCat = Object.entries(me.stats.perGame)
    .sort((a, b) => b[1].played - a[1].played)
    .map(([gid]) => games.find((g) => g.id === gid)?.categories[0])
    .find(Boolean);
  let recommended = games.filter((g) => favCat && g.categories.includes(favCat) && !me.stats.perGame[g.id]);
  if (recommended.length < 3) recommended = shuffle(games.filter((g) => !me.stats.perGame[g.id]));
  if (!recommended.length) recommended = shuffle(games).slice(0, 4);
  page.append(row('⭐', 'پیشنهاد برای تو', recommended.slice(0, 6)));

  /* دوستان در حال بازی */
  const friendIds = (db.social[me.id]?.friends || []);
  const inGameFriends = friendIds.map((f) => db.users[f]).filter(Boolean).filter((f) => statusOf(f.id) === 'ingame');
  if (inGameFriends.length) {
    page.append(el('section', { class: 'gv-section' },
      sectionHead('👥', 'دوستانت الان بازی می‌کنند', '#/friends'),
      el('div', { class: 'gv-hscroll' }, inGameFriends.map((f) => {
        const favGame = games.find((g) => g.id === f.stats.favorites[0]) || popular[0];
        return el('a', { class: 'gv-friend-play-card gv-card', href: `#/play/${favGame.id}` },
          avatar(f, 'md', { showDot: 'ingame' }),
          el('div', {},
            el('div', { style: 'font-weight:800', text: f.displayName }),
            el('div', { class: 'gv-muted-c', style: 'font-size:12px', text: '🎮 در حال بازی' })),
          el('div', { class: 'gv-friend-game', style: `background:linear-gradient(135deg, ${favGame.gradient[0]}, ${favGame.gradient[1]})` },
            el('span', { text: favGame.emoji })),
        );
      }))
    ));
  }

  page.append(row('⚡', 'بازی‌های سریع (زیر ۳ دقیقه)', games.filter((g) => g.tags.includes('سریع') || g.playTime.includes('۱–') || g.playTime.includes('۲–'))));
  page.append(row('🏆', 'برای رقابتی‌ها', games.filter((g) => g.categories.includes('competitive')), '#/leaderboard'));

  const favs = me.stats.favorites.map((id) => games.find((g) => g.id === id)).filter(Boolean);
  page.append(row('❤️', 'علاقه‌مندی‌های تو', favs, '#/games'));

  if (!me.stats.played) {
    page.append(emptyState('🚀', 'هنوز هیچ بازی نکردی! یکی از بازی‌های بالا را انتخاب کن و اولین دستاوردت را بگیر.',
      el('a', { class: 'gv-btn gv-btn-primary', href: `#/play/${popular[0].id}`, text: `▶ ${popular[0].title}` })));
  }
}
