/* ============================================================
   GameVerse — لابی: فهرست اتاق‌ها، ساخت، پیوستن با کد
   ============================================================ */

import { el, fmtNum, copyText } from '../core/utils.js';
import { getDb } from '../core/store.js';
import { getGame } from '../data/registry.js';
import { API as SocialAPI } from '../api/mock-api-social.js';
import { emptyState, toast, modal } from '../core/ui.js';
import { navigate } from '../core/router.js';
import { Sound } from '../core/sound.js';
import { gamesWithFlags } from '../api/mock-api.js';

const MODES = [
  { id: 'casual', label: '🎉 تفریحی' },
  { id: 'ranked', label: '🏆 رنکد' },
  { id: 'quick', label: '⚡ سریع' },
];

export async function render({ outlet }) {
  const db = getDb();
  outlet.innerHTML = '';
  const page = el('div', { class: 'gv-page gv-fade-in' });
  outlet.append(page);

  page.append(el('div', { class: 'gv-page-head' },
    el('h1', { text: '🏟️ لابی بازی‌ها' }),
    el('p', { class: 'gv-muted-c', text: 'اتاق بساز، با کد وارد شو یا به اتاق‌های باز بپیوند.' }),
  ));

  /* ---------------- اکشن‌ها ---------------- */
  const joinInput = el('input', { class: 'gv-input', placeholder: 'کد اتاق (مثلاً GVX42A)', style: 'text-transform:uppercase', maxlength: '6' });
  page.append(el('div', { class: 'gv-lobby-actions gv-card' },
    el('button', { class: 'gv-btn gv-btn-primary', text: '➕ ساخت اتاق جدید', onclick: createRoomModal }),
    el('div', { class: 'gv-row' },
      joinInput,
      el('button', {
        class: 'gv-btn gv-btn-secondary', text: 'ورود با کد',
        onclick: async () => {
          const code = joinInput.value.trim().toUpperCase();
          if (code.length < 4) return toast('کد اتاق ۶ کاراکتر است', 'error', '⚠️');
          const res = await SocialAPI.rooms.join(code);
          if (res.ok) { Sound.play('pop'); navigate(`/room/${code}`); }
          else toast(res.reason || 'ورود ناموفق بود', 'error', '🚪');
        },
      }),
    ),
    el('p', { class: 'gv-muted-c', style: 'font-size:12px;line-height:1.9', text: '💡 نسخهٔ فعلی اتاق‌ها را به‌صورت محلی مدیریت می‌کند و بازیکنان نمایشی برچسب «ربات» دارند؛ چندنفرهٔ ریل‌تایم (WebSocket) در معماری بک‌اند طراحی شده است (docs/BACKEND.md).' }),
  ));

  /* ---------------- اتاق‌های فعال ---------------- */
  const listWrap = el('div', { class: 'gv-section' });
  page.append(listWrap);

  async function renderRooms() {
    const rooms = await SocialAPI.rooms.list();
    listWrap.innerHTML = '';
    listWrap.append(el('h2', { class: 'gv-section-title', style: 'margin-bottom:12px', text: `🚪 اتاق‌های باز (${fmtNum(rooms.length)})` }));
    if (!rooms.length) {
      listWrap.append(emptyState('🪑', 'فعلاً اتاقی باز نیست — اولین نفر باش!', el('button', { class: 'gv-btn gv-btn-primary', text: '➕ ساخت اتاق', onclick: createRoomModal })));
      return;
    }
    const grid = el('div', { class: 'gv-rooms-grid' });
    rooms.forEach((room) => {
      const game = getGame(room.gameId);
      const host = db.users[room.hostId];
      grid.append(el('div', { class: 'gv-card gv-room-card' },
        el('div', { class: 'gv-room-cover', style: { background: `linear-gradient(135deg, ${game?.gradient[0] || '#7c3aed'}, ${game?.gradient[1] || '#06b6d4'})` } },
          el('span', { text: game?.emoji || '🎮' })),
        el('div', { class: 'gv-room-body' },
          el('div', { class: 'gv-between' },
            el('b', { text: room.name }),
            room.isPrivate ? el('span', { class: 'gv-badge gv-badge-warning', text: '🔒 خصوصی' }) : el('span', { class: 'gv-badge gv-badge-success', text: '🔓 باز' }),
          ),
          el('div', { class: 'gv-room-meta' },
            el('span', { text: `🎮 ${game?.title || '؟'}` }),
            el('span', { text: `👥 ${fmtNum(room.players.length)}/${fmtNum(room.maxPlayers)}` }),
            MODES.find((m) => m.id === room.mode) ? el('span', { text: MODES.find((m) => m.id === room.mode).label }) : null,
          ),
          el('div', { class: 'gv-between', style: 'margin-top:10px' },
            el('span', { class: 'gv-muted-c', style: 'font-size:12px', text: `👑 میزبان: ${host?.displayName || '؟'}` }),
            el('button', {
              class: 'gv-btn gv-btn-secondary gv-btn-sm', text: 'پیوستن ›',
              onclick: async () => {
                const res = await SocialAPI.rooms.join(room.code);
                if (res.ok) { Sound.play('pop'); navigate(`/room/${room.code}`); }
                else toast(res.reason, 'error', '🚪');
              },
            }),
          ),
        ),
      ));
    });
    listWrap.append(grid);
  }

  /* ---------------- مودال ساخت اتاق ---------------- */
  function createRoomModal() {
    Sound.play('click');
    const games = gamesWithFlags().filter((g) => g.active !== false);
    let mode = 'casual', maxPlayers = 4, isPrivate = false;
    const nameIn = el('input', { class: 'gv-input', placeholder: 'نام اتاق (اختیاری)', maxlength: '30' });
    const gameSel = el('select', { class: 'gv-select' }, games.map((g) => el('option', { value: g.id, text: `${g.emoji} ${g.title}` })));
    const modeTabs = el('div', { class: 'gv-tabs' }, MODES.map((m) => el('button', {
      class: `gv-tab ${m.id === mode ? 'active' : ''}`, text: m.label,
      onclick: (e) => { mode = m.id; [...modeTabs.children].forEach((c) => c.classList.remove('active')); e.currentTarget.classList.add('active'); },
    })));
    const maxSel = el('select', { class: 'gv-select' }, [2, 3, 4, 6, 8].map((n) => el('option', { value: n, text: `${fmtNum(n)} نفر` })));
    maxSel.addEventListener('change', () => (maxPlayers = Number(maxSel.value)));
    const privCheck = el('input', { type: 'checkbox', onchange: () => (isPrivate = privCheck.checked) });

    modal({
      title: '🏟️ ساخت اتاق جدید',
      content: el('div', { style: 'display:flex;flex-direction:column;gap:14px' },
        el('div', {}, el('label', { class: 'gv-label', text: 'نام اتاق' }), nameIn),
        el('div', {}, el('label', { class: 'gv-label', text: 'بازی' }), gameSel),
        el('div', {}, el('label', { class: 'gv-label', text: 'حالت' }), modeTabs),
        el('div', {}, el('label', { class: 'gv-label', text: 'ظرفیت' }), maxSel),
        el('label', { class: 'gv-row', style: 'cursor:pointer;font-size:14px' }, privCheck, el('span', { text: '🔒 اتاق خصوصی (فقط با کد دعوت)' })),
      ),
      actions: [
        { label: 'انصراف' },
        {
          label: '🚀 بساز', class: 'gv-btn-primary',
          onClick: async (close) => {
            const room = await SocialAPI.rooms.create({ name: nameIn.value, gameId: gameSel.value, mode, maxPlayers, isPrivate });
            close();
            Sound.play('levelup');
            toast(`اتاق ساخته شد! کد دعوت: ${room.code}`, 'success', '✅');
            navigate(`/room/${room.code}`);
          },
        },
      ],
    });
  }

  await renderRooms();
}
