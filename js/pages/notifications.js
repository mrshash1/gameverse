/* ============================================================
   GameVerse — مرکز اعلان‌ها با دسته‌بندی
   ============================================================ */

import { el, fmtNum, timeAgo } from '../core/utils.js';
import { API as SocialAPI } from '../api/mock-api-social.js';
import { emptyState, toast } from '../core/ui.js';

const CATS = [
  { id: 'all', label: 'همه', emoji: '📬' },
  { id: 'social', label: 'اجتماعی', emoji: '👥' },
  { id: 'game', label: 'بازی', emoji: '🎮' },
  { id: 'reward', label: 'جایزه', emoji: '🎁' },
  { id: 'system', label: 'سیستم', emoji: '⚙️' },
];

export async function render({ outlet }) {
  let cat = 'all';
  outlet.innerHTML = '';
  const page = el('div', { class: 'gv-page gv-fade-in' });
  outlet.append(page);

  page.append(el('div', { class: 'gv-page-head gv-between' },
    el('div', {},
      el('h1', { text: '🔔 اعلان‌ها' }),
      el('p', { class: 'gv-muted-c', text: 'درخواست دوستی، دستاوردها، جوایز و پیام‌های سیستم.' }),
    ),
    el('button', { class: 'gv-btn gv-btn-ghost gv-btn-sm', text: '✓ همه خوانده شد', onclick: async () => { await SocialAPI.notifications.markAll(); toast('همهٔ اعلان‌ها خوانده شدند', 'success', '✓'); draw(); } }),
  ));

  const tabs = el('div', { class: 'gv-tabs' }, CATS.map((c) => el('button', {
    class: `gv-tab ${c.id === 'all' ? 'active' : ''}`, text: `${c.emoji} ${c.label}`,
    onclick: () => {
      cat = c.id;
      [...tabs.children].forEach((t) => t.classList.remove('active'));
      tabs.children[CATS.indexOf(c)].classList.add('active');
      draw();
    },
  })));
  page.append(tabs);

  const list = el('div', { class: 'gv-section', style: 'display:flex;flex-direction:column;gap:10px' });
  page.append(list);

  async function draw() {
    const items = await SocialAPI.notifications.list();
    const filtered = cat === 'all' ? items : items.filter((n) => n.cat === cat);
    list.innerHTML = '';
    if (!filtered.length) {
      list.append(emptyState('📭', 'اعلانی در این دسته نیست. هر وقت خبر مهمی باشد اینجا می‌بینی!'));
      return;
    }
    filtered.forEach((n) => {
      list.append(el('div', {
        class: `gv-card gv-notif-row ${n.read ? '' : 'unread'}`,
        onclick: async () => { if (!n.read) { await SocialAPI.notifications.markOne(n.id); draw(); } },
      },
        el('span', { class: 'gv-notif-icon', text: n.icon || '🔔' }),
        el('div', { style: 'flex:1' },
          el('div', { class: 'gv-between' },
            el('b', { style: 'font-size:13.5px', text: n.title }),
            el('span', { class: 'gv-muted-c', style: 'font-size:11px', text: timeAgo(n.at) }),
          ),
          n.body ? el('div', { class: 'gv-muted-c', style: 'font-size:12.5px;margin-top:3px', text: n.body }) : null,
        ),
        !n.read ? el('span', { class: 'gv-dot online', style: 'flex-shrink:0' }) : null,
      ));
    });
  }

  await draw();
}
