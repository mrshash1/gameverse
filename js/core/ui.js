/* ============================================================
   GameVerse — کتابخانهٔ کامپوننت‌های بازاستفاده
   Toast, Modal, Avatar, GameCard, Progress, Badges, …
   ============================================================ */

import { el, fmtNum } from './utils.js';
import { Sound } from './sound.js';

/* ---------------- Toast ---------------- */
let toastBox = null;
export function toast(msg, type = 'info', icon = '✨') {
  if (!toastBox) {
    toastBox = el('div', { class: 'gv-toasts' });
    document.body.append(toastBox);
  }
  const t = el('div', { class: `gv-toast ${type}` }, el('span', { text: icon }), el('span', { text: msg }));
  toastBox.append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 2800);
  while (toastBox.children.length > 4) toastBox.firstChild.remove();
}

/* ---------------- Modal ---------------- */
export function modal({ title, content, actions = [], onClose, wide = false }) {
  const back = el('div', { class: 'gv-modal-back' });
  const close = () => { back.remove(); onClose?.(); };
  back.addEventListener('click', (e) => { if (e.target === back) close(); });
  const dlg = el('div', { class: 'gv-modal', role: 'dialog', 'aria-modal': 'true', style: wide ? 'width:min(96vw,640px)' : '' },
    el('div', { class: 'gv-modal-head' },
      el('span', { text: title }),
      el('button', { class: 'gv-btn gv-btn-ghost gv-btn-icon', 'aria-label': 'بستن', onclick: close, text: '✕' })
    ),
    el('div', { class: 'gv-modal-body' }, content)
  );
  if (actions.length) {
    dlg.append(el('div', { class: 'gv-modal-foot' },
      actions.map((a) => el('button', {
        class: `gv-btn ${a.class || 'gv-btn-ghost'}`,
        onclick: () => a.onClick ? a.onClick(close) : close(),
        text: a.label,
      }))
    ));
  }
  back.append(dlg);
  document.body.append(back);
  return close;
}

export function confirmDlg({ title = 'تأیید', message, danger = false, okLabel = 'تأیید' }) {
  return new Promise((resolve) => {
    modal({
      title,
      content: el('p', { style: 'line-height:2;font-size:14.5px', text: message }),
      actions: [
        { label: 'انصراف', onClick: (close) => { close(); resolve(false); } },
        { label: okLabel, class: danger ? 'gv-btn-danger' : 'gv-btn-primary', onClick: (close) => { close(); resolve(true); } },
      ],
      onClose: () => resolve(false),
    });
  });
}

/* ---------------- Avatar ---------------- */
export function avatar(user, size = 'md', { showDot = null } = {}) {
  const a = el('span', {
    class: `gv-avatar ${size} ${user?.frame && user.frame !== 'default' ? 'f-' + user.frame : ''}`,
    style: user?.avatar?.color ? { background: user.avatar.color } : {},
    text: user?.avatar?.emoji || '🙂',
  });
  if (showDot) {
    a.style.position = 'relative';
    a.append(el('span', { class: `gv-dot ${showDot}`, style: 'position:absolute;bottom:-1px;left:-1px;' }));
  }
  return a;
}

/* نشان وضعیت شبیه‌سازی‌شدهٔ کاربران نمایشی (پایدار در طول روز) */
export function statusOf(userId, isMe = false) {
  if (isMe) return 'online';
  let h = 0;
  for (const c of String(userId)) h = (h * 31 + c.charCodeAt(0)) % 997;
  const dayShift = Number(new Date().getHours());
  const v = (h + dayShift) % 10;
  if (v < 4) return 'online';
  if (v < 6) return 'ingame';
  if (v < 8) return 'offline';
  return 'away';
}
export const STATUS_LABEL = { online: '🟢 آنلاین', ingame: '🎮 در حال بازی', away: '🟡 غایب', offline: '⚪ آفلاین' };

/* ---------------- GameCard ---------------- */
export function gameCard(game) {
  return el('a', { class: 'gv-game-card', href: `#/game/${game.id}` },
    el('div', { class: 'gv-game-cover', style: { background: `linear-gradient(135deg, ${game.gradient[0]}, ${game.gradient[1]})` } },
      el('span', { class: 'gv-game-emoji', text: game.emoji }),
      el('span', { class: 'gv-badge gv-badge-muted gv-game-players', text: `👥 ${game.players}` }),
      el('span', { class: 'gv-game-play', text: '▶' })
    ),
    el('div', { class: 'gv-game-info' },
      el('div', { class: 'gv-game-title', text: game.title }),
      el('div', { class: 'gv-game-meta' },
        el('span', { class: 'gv-rate', text: `★ ${fmtNum(game.rating)}` }),
        el('span', { class: 'gv-muted-c', text: game.playTime }),
      )
    )
  );
}

/* ---------------- Progress ---------------- */
export function progressBar(pct, { height = '' } = {}) {
  return el('div', { class: 'gv-progress', style: height ? `height:${height}` : '' },
    el('div', { style: `width:${Math.max(0, Math.min(100, pct))}%` })
  );
}

/* ---------------- Badges ---------------- */
const TIERS = [
  [0, 'برنز', '🥉', '#cd7f32'],
  [1100, 'نقره', '🥈', '#a8b2c1'],
  [1300, 'طلا', '🥇', '#f5b301'],
  [1500, 'پلاتین', '💠', '#67e8f9'],
  [1700, 'الماس', '💎', '#a78bfa'],
  [1850, 'استاد', '👑', '#f43f5e'],
];
export function tierOf(rating) {
  let cur = TIERS[0];
  for (const t of TIERS) if (rating >= t[0]) cur = t;
  return cur;
}
export function tierBadge(rating) {
  const [min, label, emoji, color] = tierOf(rating);
  return el('span', { class: 'gv-badge', style: `background:${color}22;color:${color}`, text: `${emoji} ${label}` });
}

/* ---------------- سایر ---------------- */
export function statCard(value, label, icon = '') {
  return el('div', { class: 'gv-card gv-stat-card' },
    el('div', { class: 'gv-stat-value' }, icon && el('span', { text: icon + ' ' }), el('span', { text: value })),
    el('div', { class: 'gv-stat-label', text: label })
  );
}

export function sectionHead(emoji, title, moreHref = null) {
  return el('div', { class: 'gv-section-head' },
    el('div', { class: 'gv-section-title' }, el('span', { text: emoji }), el('span', { text: title })),
    moreHref && el('a', { class: 'gv-more-link', href: moreHref, text: 'مشاهدهٔ همه ›' })
  );
}

export function emptyState(icon, msg, cta = null) {
  return el('div', { class: 'gv-empty' },
    el('div', { class: 'icon', text: icon }),
    el('div', { class: 'msg', text: msg }),
    cta
  );
}

export function clickSound(fn) {
  return (...args) => { Sound.play('click'); fn(...args); };
}
