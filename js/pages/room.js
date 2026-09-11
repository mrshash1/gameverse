/* ============================================================
   GameVerse — صفحهٔ اتاق: بازیکنان، میزبان، دعوت، شروع بازی
   ============================================================ */

import { el, fmtNum, copyText } from '../core/utils.js';
import { getDb } from '../core/store.js';
import { getGame } from '../data/registry.js';
import { API as SocialAPI } from '../api/mock-api-social.js';
import { avatar, emptyState, toast, confirmDlg } from '../core/ui.js';
import { navigate } from '../core/router.js';
import { Sound } from '../core/sound.js';

export async function render({ outlet, params }) {
  const code = params[0].toUpperCase();
  const db = getDb();
  const meId = db.session.userId;

  outlet.innerHTML = '';
  const page = el('div', { class: 'gv-page gv-fade-in' });
  outlet.append(page);

  let pollTimer = null;

  async function draw() {
    const room = await SocialAPI.rooms.get(code);
    page.innerHTML = '';
    if (!room) {
      page.append(emptyState('💨', 'این اتاق بسته شده یا وجود ندارد.',
        el('a', { class: 'gv-btn gv-btn-primary', href: '#/lobby', text: 'بازگشت به لابی' })));
      if (pollTimer) clearInterval(pollTimer);
      return;
    }
    const game = getGame(room.gameId);
    const isHost = room.hostId === meId;
    const isMember = room.players.some((p) => p.userId === meId);

    /* پیوستن سریع برای غیرعضوها (لینک دعوت) */
    if (!isMember) {
      page.append(el('section', { class: 'gv-card gv-pre-game', style: 'text-align:center' },
        el('h1', { text: `🎮 ${room.name}` }),
        el('p', { class: 'gv-muted-c', text: `به اتاق «${room.name}» دعوت شده‌ای — بازی: ${game?.title}` }),
        el('button', {
          class: 'gv-btn gv-btn-primary gv-btn-lg', text: '🚪 پیوستن به اتاق',
          onclick: async () => {
            const res = await SocialAPI.rooms.join(code);
            if (res.ok) { toast('وارد اتاق شدی!', 'success', '✅'); draw(); }
            else toast(res.reason, 'error', '🚫');
          },
        }),
      ));
      return;
    }

    page.append(el('section', { class: 'gv-card gv-room-detail' },
      el('div', { class: 'gv-between' },
        el('div', {},
          el('h1', { text: room.name }),
          el('div', { class: 'gv-row', style: 'flex-wrap:wrap;margin-top:8px' },
            el('span', { class: 'gv-badge gv-badge-primary', text: `🎮 ${game?.title}` }),
            el('span', { class: 'gv-badge gv-badge-info', text: `کد: ${room.code}` }),
            room.isPrivate ? el('span', { class: 'gv-badge gv-badge-warning', text: '🔒 خصوصی' }) : el('span', { class: 'gv-badge gv-badge-success', text: '🔓 باز' }),
          ),
        ),
        el('div', { class: 'gv-room-cover gv-room-cover-lg', style: { background: `linear-gradient(135deg, ${game?.gradient[0]}, ${game?.gradient[1]})` } },
          el('span', { text: game?.emoji })),
      ),

      el('div', { class: 'gv-label', style: 'margin-top:18px', text: `بازیکنان (${fmtNum(room.players.length)}/${fmtNum(room.maxPlayers)})` }),
      el('div', { class: 'gv-room-players' },
        room.players.map((p) => {
          const u = db.users[p.userId];
          const host = p.userId === room.hostId;
          return el('div', { class: 'gv-card gv-player-row' },
            avatar(u, 'md'),
            el('div', { style: 'flex:1' },
              el('div', { class: 'gv-row' },
                el('b', { text: u?.displayName || '؟' }),
                host ? el('span', { class: 'gv-badge gv-badge-warning', text: '👑 میزبان' }) : null,
                p.isBot ? el('span', { class: 'gv-badge gv-badge-muted', text: '🤖 نمایشی' }) : null,
              ),
              el('div', { class: 'gv-muted-c', style: 'font-size:12px', text: p.ready ? '✅ آماده' : '⏳ آماده نیست' }),
            ),
            isHost && !host ? el('button', {
              class: 'gv-btn gv-btn-danger gv-btn-sm', text: 'حذف',
              onclick: async () => {
                if (await confirmDlg({ title: 'حذف بازیکن', message: `${u?.displayName} از اتاق حذف شود؟`, danger: true, okLabel: 'حذف' })) {
                  await SocialAPI.rooms.kick(code, p.userId);
                  toast('بازیکن حذف شد', 'info', '👢');
                  draw();
                }
              },
            }) : null,
          );
        })
      ),

      el('div', { class: 'gv-room-actions' },
        isHost ? el('button', {
          class: 'gv-btn gv-btn-ghost', text: '🤖 افزودن بازیکن نمایشی',
          onclick: async () => {
            const res = await SocialAPI.rooms.addDemoPlayer(code);
            if (!res.ok) toast(res.reason || 'امکان افزودن نیست', 'error', '🤖');
            else { Sound.play('pop'); draw(); }
          },
        }) : null,
        el('button', {
          class: 'gv-btn gv-btn-secondary', text: '🔗 کپی لینک دعوت',
          onclick: async () => { await copyText(`${location.origin}${location.pathname}#/room/${code}`); toast('لینک دعوت کپی شد — برای دوستانت بفرست!', 'success', '🔗'); },
        }),
        el('button', {
          class: 'gv-btn gv-btn-secondary', text: '📋 کپی کد',
          onclick: async () => { await copyText(code); toast('کد اتاق کپی شد', 'success', '📋'); },
        }),
        isHost ? el('button', {
          class: 'gv-btn gv-btn-primary gv-btn-lg', text: `🚀 شروع بازی (${game?.title})`,
          onclick: () => {
            Sound.play('levelup');
            navigate(`/play/${room.gameId}?mode=${game?.modes.some((m) => m.id === 'ai') ? 'ai' : 'solo'}&room=${code}`);
          },
        }) : el('div', { class: 'gv-badge gv-badge-primary', text: '⏳ منتظر میزبان برای شروع…' }),
        el('button', {
          class: 'gv-btn gv-btn-danger', text: '🚪 خروج از اتاق',
          onclick: async () => {
            if (pollTimer) clearInterval(pollTimer);
            await SocialAPI.rooms.leave(code);
            toast('اتاق را ترک کردی', 'info', '👋');
            navigate('/lobby');
          },
        }),
        isHost ? el('button', {
          class: 'gv-btn gv-btn-ghost', text: '🗑️ بستن اتاق',
          onclick: async () => {
            if (await confirmDlg({ title: 'بستن اتاق', message: 'اتاق برای همه بسته می‌شود. مطمئنی؟', danger: true, okLabel: 'بستن' })) {
              if (pollTimer) clearInterval(pollTimer);
              await SocialAPI.rooms.close(code);
              navigate('/lobby');
            }
          },
        }) : null,
      ),
    ));
  }

  await draw();
  pollTimer = setInterval(draw, 4000); // به‌روزرسانی زندهٔ محلی
  return () => { if (pollTimer) clearInterval(pollTimer); };
}
