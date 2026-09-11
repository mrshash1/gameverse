/* ============================================================
   GameVerse — دوستان: درخواست‌ها، فهرست، جست‌وجو، پیشنهادها
   ============================================================ */

import { el, fmtNum, debounce } from '../core/utils.js';
import { getDb } from '../core/store.js';
import { API as SocialAPI } from '../api/mock-api-social.js';
import { API } from '../api/mock-api.js';
import { avatar, statusOf, STATUS_LABEL, emptyState, toast, confirmDlg } from '../core/ui.js';
import { navigate } from '../core/router.js';
import { Sound } from '../core/sound.js';

export async function render({ outlet }) {
  const db = getDb();
  outlet.innerHTML = '';
  const page = el('div', { class: 'gv-page gv-fade-in' });
  outlet.append(page);

  page.append(el('div', { class: 'gv-page-head' },
    el('h1', { text: '👥 دوستان' }),
    el('p', { class: 'gv-muted-c', text: 'درخواست‌ها را مدیریت کن، بازیکنان جدید پیدا کن و با دوستانت رقابت کن.' }),
  ));

  const content = el('div');
  page.append(content);

  async function draw() {
    const graph = await SocialAPI.social.graph();
    content.innerHTML = '';

    /* ---------- درخواست‌های دریافتی ---------- */
    if (graph.incoming.length) {
      content.append(section('🙋 درخواست‌های دریافتی', graph.incoming.map((u) =>
        row(u, { showDot: false, actions: [
          el('button', { class: 'gv-btn gv-btn-success gv-btn-sm', text: '✓ پذیرش', onclick: async () => { await SocialAPI.social.accept(u.id); Sound.play('pop'); toast(`${u.displayName} حالا دوست توست!`, 'success', '🎉'); draw(); } }),
          el('button', { class: 'gv-btn gv-btn-ghost gv-btn-sm', text: '✕ رد', onclick: async () => { await SocialAPI.social.reject(u.id); draw(); } }),
        ] }))));
    }

    /* ---------- دوستان ---------- */
    content.append(section(`🤝 دوستان (${fmtNum(graph.friends.length)})`,
      graph.friends.length
        ? graph.friends.map((u) => row(u, {
          statusText: STATUS_LABEL[statusOf(u.id)],
          actions: [
            el('button', { class: 'gv-btn gv-btn-ghost gv-btn-sm', text: 'پروفایل', onclick: () => navigate(`/profile/${u.id}`) }),
            el('button', { class: 'gv-btn gv-btn-danger gv-btn-sm', text: 'حذف', onclick: async () => { if (await confirmDlg({ title: 'حذف دوست', message: `${u.displayName} از فهرست دوستان حذف شود؟`, danger: true, okLabel: 'حذف' })) { await SocialAPI.social.remove(u.id); draw(); } } }),
          ],
        }))
        : [emptyState('🫂', 'هنوز دوستی نداری! از پیشنهادهای پایین شروع کن یا منتظر درخواست بمان.')]
    ));

    /* ---------- ارسال‌شده ---------- */
    if (graph.outgoing.length) {
      content.append(section('⏳ در انتظار پاسخ', graph.outgoing.map((u) =>
        row(u, { statusText: 'درخواست ارسال شده…', actions: [] }))));
    }

    /* ---------- جست‌وجو + پیشنهادها ---------- */
    const searchIn = el('input', { class: 'gv-input', placeholder: '🔍 جست‌وجوی بازیکن با نام…' });
    const results = el('div', { style: 'margin-top:10px' });
    searchIn.addEventListener('input', debounce(async () => {
      results.innerHTML = '';
      const found = await API.users.search(searchIn.value);
      const meId = db.session.userId;
      results.append(...found.filter((u) => u.id !== meId).map((u) => row(u, {
        actions: [el('button', { class: 'gv-btn gv-btn-secondary gv-btn-sm', text: '➕ افزودن', onclick: async () => { await SocialAPI.social.request(u.id); toast('درخواست ارسال شد', 'success', '🙋'); draw(); } })],
      })));
    }, 250));

    content.append(section('🔍 پیدا کردن بازیکنان', [searchIn, results]));
    const suggestions = (await SocialAPI.social.suggestions()).slice(0, 6);
    if (suggestions.length) {
      content.append(section('✨ پیشنهاد برای تو', suggestions.map((u) => row(u, {
        actions: [el('button', { class: 'gv-btn gv-btn-secondary gv-btn-sm', text: '➕ افزودن', onclick: async () => { await SocialAPI.social.request(u.id); toast(`درخواست برای ${u.displayName} ارسال شد`, 'success', '🙋'); draw(); } })],
      }))));
    }
  }

  function section(title, items) {
    return el('section', { class: 'gv-section' },
      el('h2', { class: 'gv-section-title', style: 'margin-bottom:12px', text: title }),
      el('div', { style: 'display:flex;flex-direction:column;gap:10px' }, items),
    );
  }

  function row(u, { actions = [], statusText = '', showDot = true }) {
    return el('div', { class: 'gv-card gv-friend-row' },
      avatar(u, 'md', { showDot: showDot ? statusOf(u.id) : null }),
      el('div', { style: 'flex:1' },
        el('b', { text: u.displayName }),
        el('div', { class: 'gv-muted-c', style: 'font-size:12px', text: statusText || `سطح ${fmtNum(u.level)} · ${fmtNum(u.stats.wins)} برد` }),
      ),
      ...actions,
    );
  }

  await draw();
}
