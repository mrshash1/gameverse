/* ============================================================
   GameVerse — جوایز: پاداش روزانه، زنجیره، مأموریت‌ها
   ============================================================ */

import { el, fmtNum } from '../core/utils.js';
import { getDb } from '../core/store.js';
import { API } from '../api/mock-api.js';
import { emptyState, toast, progressBar } from '../core/ui.js';
import { Sound } from '../core/sound.js';

export async function render({ outlet }) {
  const db = getDb();
  const me = db.users[db.session.userId];
  outlet.innerHTML = '';
  const page = el('div', { class: 'gv-page gv-fade-in' });
  outlet.append(page);

  page.append(el('div', { class: 'gv-page-head gv-between' },
    el('div', {},
      el('h1', { text: '🎁 جوایز و مأموریت‌ها' }),
      el('p', { class: 'gv-muted-c', text: 'هر روز وارد شو، مأموریت‌ها را انجام بده و سکه جمع کن.' }),
    ),
    el('span', { class: 'gv-badge gv-badge-warning', style: 'font-size:15px;padding:9px 16px', text: `🪙 ${fmtNum(me.coins)}` }),
  ));

  /* ---------------- پاداش روزانه ---------------- */
  const daily = await API.rewards.dailyStatus();
  const streak = daily.streak || 0;
  page.append(el('section', { class: 'gv-card gv-daily-card' },
    el('div', { class: 'gv-daily-flames', text: '🔥'.repeat(Math.min(7, Math.max(1, streak + (daily.canClaim ? 1 : 0)))) }),
    el('h2', { text: daily.canClaim ? 'پاداش امروزت آماده است!' : 'پاداش امروز گرفته شد ✓' }),
    el('p', { class: 'gv-muted-c', text: `زنجیرهٔ ورود روزانه: ${fmtNum(streak)} روز — هر روز پیوسته، جایزهٔ بزرگ‌تر!` }),
    el('div', { class: 'gv-streak-row' },
      Array.from({ length: 7 }, (_, i) => el('span', {
        class: `gv-streak-day ${i < streak ? 'on' : ''}`,
        text: i < streak ? '🔥' : `${fmtNum(i + 1)}`,
      })),
    ),
    el('button', {
      class: `gv-btn gv-btn-lg ${daily.canClaim ? 'gv-btn-primary' : 'gv-btn-ghost'}`,
      text: daily.canClaim ? `🎁 بگیر! (${fmtNum(20 + Math.min(streak + 1, 7) * 10)} سکه)` : 'فردا دوباره بیا 🌙',
      disabled: !daily.canClaim,
      onclick: async () => {
        const res = await API.rewards.claimDaily();
        if (res.ok) { Sound.play('coin'); toast(`${fmtNum(res.coins)} سکه گرفتی! زنجیره: ${fmtNum(res.streak)} روز`, 'reward', '🪙'); render({ outlet }); }
        else toast(res.reason || 'گرفتن ناموفق', 'error', '⚠️');
      },
    }),
  ));

  /* ---------------- مأموریت‌ها ---------------- */
  const missions = await API.rewards.missions();
  if (!missions) { page.append(emptyState('🔑', 'ابتدا وارد حساب شو.')); return; }

  const missionCard = (m, bucket) => {
    const done = m.p >= m.target;
    const pct = Math.min(100, (m.p / m.target) * 100);
    return el('div', { class: 'gv-card gv-mission-row' },
      el('span', { class: 'gv-mission-emoji', text: m.emoji }),
      el('div', { style: 'flex:1' },
        el('div', { class: 'gv-between' },
          el('b', { style: 'font-size:14px', text: m.title }),
          el('span', { class: 'gv-muted-c', style: 'font-size:12px', text: `${fmtNum(m.p)}/${fmtNum(m.target)}` }),
        ),
        el('div', { style: 'margin:8px 0' }, progressBar(pct)),
        el('div', { class: 'gv-row' },
          el('span', { class: 'gv-badge gv-badge-warning', text: `🪙 ${fmtNum(m.reward.coins)}` }),
          m.reward.xp ? el('span', { class: 'gv-badge gv-badge-primary', text: `+${fmtNum(m.reward.xp)} XP` }) : null,
        ),
      ),
      done && !m.claimed
        ? el('button', {
          class: 'gv-btn gv-btn-primary', text: 'بگیر!', onclick: async () => {
            const res = await API.rewards.claimMission(m.id);
            if (res.ok) { Sound.play('coin'); toast(`جایزهٔ مأموریت گرفته شد!`, 'reward', '🏅'); render({ outlet }); }
          },
        })
        : m.claimed ? el('span', { class: 'gv-badge gv-badge-success', text: '✓ گرفته شد' })
          : el('span', { class: 'gv-badge gv-badge-muted', text: 'در جریان' }),
    );
  };

  page.append(el('section', { class: 'gv-section' },
    el('h2', { class: 'gv-section-title', style: 'margin-bottom:12px', text: '📅 مأموریت‌های روزانه (هر ۲۴ ساعت ریست می‌شوند)' }),
    el('div', { style: 'display:flex;flex-direction:column;gap:10px' }, missions.daily.map((m) => missionCard(m, 'daily'))),
  ));

  page.append(el('section', { class: 'gv-section' },
    el('h2', { class: 'gv-section-title', style: 'margin-bottom:12px', text: '🗓 مأموریت‌های هفتگی (دوشنبه‌ها ریست می‌شوند)' }),
    el('div', { style: 'display:flex;flex-direction:column;gap:10px' }, missions.weekly.map((m) => missionCard(m, 'weekly'))),
  ));

  page.append(el('div', { class: 'gv-card', style: 'padding:16px;font-size:13px;line-height:2.1' },
    el('b', { text: '💡 چطور سکه جمع کنم؟' }),
    el('br'), el('span', { text: '• هر مسابقه: ۳ تا ۱۵ سکه بر اساس نتیجه و امتیاز' }),
    el('br'), el('span', { text: '• پاداش ورود روزانه: ۳۰ تا ۹۰ سکه با زنجیره' }),
    el('br'), el('span', { text: '• مأموریت‌ها: تا ۴۸۵ سکه در روز و هفته' }),
    el('br'), el('span', { text: '• ارتقای سطح: ۱۰ سکه × شمارهٔ سطح جدید' }),
  ));
}
