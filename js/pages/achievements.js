/* ============================================================
   GameVerse — دستاوردها: قفل‌شده/بازشده، پیشرفت، امتیاز کل
   ============================================================ */

import { el, fmtNum, timeAgo } from '../core/utils.js';
import { API } from '../api/mock-api.js';
import { emptyState, toast } from '../core/ui.js';

export async function render({ outlet }) {
  outlet.innerHTML = '';
  const page = el('div', { class: 'gv-page gv-fade-in' });
  outlet.append(page);

  const { all, unlocked } = await API.achievements.mine();
  const unlockedList = all.filter((a) => unlocked[a.id]);
  const totalPoints = unlockedList.reduce((s, a) => s + a.points, 0);
  const maxPoints = all.reduce((s, a) => s + a.points, 0);

  page.append(el('div', { class: 'gv-page-head' },
    el('h1', { text: '🏅 دستاوردها' }),
    el('p', { class: 'gv-muted-c', text: `تا این لحظه ${fmtNum(unlockedList.length)} از ${fmtNum(all.length)} دستاورد را باز کرده‌ای — ${fmtNum(totalPoints)} از ${fmtNum(maxPoints)} امتیاز.` }),
  ));

  const bar = el('div', { class: 'gv-progress', style: 'margin-bottom:20px' },
    el('div', { style: `width:${(unlockedList.length / all.length) * 100}%` }));
  page.append(bar);

  if (!unlockedList.length) {
    page.append(emptyState('🎯', 'هنوز هیچ دستاوردی باز نکرده‌ای! اولین بازی‌ات را انجام بده تا مدال اول را بگیری.',
      el('a', { class: 'gv-btn gv-btn-primary', href: '#/games', text: '🎮 شروع بازی' })));
  }

  const grid = el('div', { class: 'gv-ach-grid' });
  page.append(grid);

  /* بازشده‌ها اول، بعد قفل‌شده‌ها */
  const sorted = [...all].sort((a, b) => (unlocked[b.id] ? 1 : 0) - (unlocked[a.id] ? 1 : 0));
  sorted.forEach((a) => {
    const at = unlocked[a.id];
    grid.append(el('div', { class: `gv-card gv-ach-card ${at ? 'unlocked' : ''}` },
      el('div', { class: 'gv-ach-emoji', text: a.emoji }),
      el('div', { class: 'gv-ach-title', text: a.title }),
      el('div', { class: 'gv-ach-desc', text: a.desc }),
      el('div', { class: 'gv-ach-foot' },
        el('span', { class: `gv-badge ${at ? 'gv-badge-success' : 'gv-badge-muted'}`, text: at ? `✓ ${timeAgo(at)}` : `🔒 ${fmtNum(a.points)} امتیاز` })),
    ));
  });
}
