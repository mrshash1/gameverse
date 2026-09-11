/* ============================================================
   GameVerse — پل ارتباطی صفحات با پوستهٔ اپ (بدون وابستگی حلقوی)
   ============================================================ */

import { el } from './core/utils.js';
import { getDb } from './core/store.js';
import { API } from './api/mock-api.js';
import { avatar, toast } from './core/ui.js';
import { Sound } from './core/sound.js';
import { fmtNum } from './core/utils.js';

let bellBadge = null;

export function setBellRef(node) { bellBadge = node; }
export function refreshBellBadge() {
  if (!bellBadge) return;
  import('./api/mock-api-social.js').then(({ API: S }) => {
    S.notifications.unreadCount().then((n) => {
      bellBadge.textContent = fmtNum(n);
      bellBadge.classList.toggle('gv-hidden', !n);
    });
  });
}

export function renderUserMenu() {
  const box = document.getElementById('gv-user-menu');
  if (!box) return;
  const db = getDb();
  const me = db.session.userId ? db.users[db.session.userId] : null;
  box.innerHTML = '';
  if (!me) return;
  const btn = el('button', { class: 'gv-user-btn', 'aria-label': 'منوی کاربر' }, avatar(me, 'sm'));
  const menu = el('div', { class: 'gv-menu gv-hidden' },
    menuItem('👤 پروفایل من', '#/profile'),
    menuItem('🏅 دستاوردها', '#/achievements'),
    menuItem('👥 دوستان', '#/friends'),
    menuItem('⚙️ تنظیمات', '#/settings'),
    ...(db.session.adminMode ? [menuItem('🛠️ مدیریت', '#/admin')] : []),
    el('hr'),
    el('button', { class: 'gv-menu-item danger', text: '🚪 خروج', onclick: async () => { await API.me.logout(); location.reload(); } }),
  );
  btn.addEventListener('click', (e) => { e.stopPropagation(); menu.classList.toggle('gv-hidden'); });
  menu.addEventListener('click', () => menu.classList.add('gv-hidden'));
  document.addEventListener('click', () => menu.classList.add('gv-hidden'));
  box.append(btn, menu);
}

function menuItem(label, href) { return el('a', { class: 'gv-menu-item', href, text: label }); }

export function soundToggleHandler(e) {
  const m = Sound.toggle();
  if (e?.currentTarget) e.currentTarget.textContent = m ? '🔇' : '🔊';
  toast(m ? 'صدا خاموش شد' : 'صدا روشن شد', 'info', m ? '🔇' : '🔊');
}
