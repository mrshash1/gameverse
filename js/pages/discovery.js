/* ============================================================
   GameVerse — صفحهٔ کشف بازی‌ها: جست‌وجو، فیلتر دسته، مرتب‌سازی
   ============================================================ */

import { el, fmtNum, debounce } from '../core/utils.js';
import { gamesWithFlags } from '../api/mock-api.js';
import { gameCard, emptyState } from '../core/ui.js';
import { CATEGORIES, categoryCounts } from '../data/registry.js';

const SORTS = [
  { id: 'popular', label: '🔥 محبوب‌ترین' },
  { id: 'newest', label: '🆕 جدیدترین' },
  { id: 'rating', label: '★ بهترین امتیاز' },
  { id: 'title', label: '🔤 الفبا' },
];

export async function render({ outlet, query }) {
  let q = query.q || '';
  let cat = query.cat || '';
  let sort = query.sort || 'popular';

  outlet.innerHTML = '';
  const page = el('div', { class: 'gv-page gv-fade-in' });
  outlet.append(page);

  page.append(el('div', { class: 'gv-page-head' },
    el('h1', { text: '🎮 همهٔ بازی‌ها' }),
    el('p', { class: 'gv-muted-c', text: 'جست‌وجو کن، دسته را فیلتر کن و بازی بعدی‌ات را پیدا کن.' }),
  ));

  const searchInput = el('input', { class: 'gv-input', placeholder: '🔍 جست‌وجوی بازی یا برچسب…', value: q, 'aria-label': 'جست‌وجو' });
  const sortSel = el('select', { class: 'gv-select', 'aria-label': 'مرتب‌سازی' },
    SORTS.map((s) => el('option', { value: s.id, ...(sort === s.id ? { selected: true } : {}), text: s.label })));
  const chipsRow = el('div', { class: 'gv-chips-row' });
  const grid = el('div', { class: 'gv-games-grid' });
  const countLine = el('div', { class: 'gv-muted-c', style: 'font-size:13px;margin:10px 2px' });

  page.append(
    el('div', { class: 'gv-filter-bar' }, searchInput, sortSel),
    chipsRow,
    countLine,
    grid,
  );

  function renderChips() {
    const counts = categoryCounts();
    chipsRow.innerHTML = '';
    chipsRow.append(el('button', {
      class: `gv-chip ${!cat ? 'active' : ''}`, text: 'همه',
      onclick: () => { cat = ''; renderChips(); renderGrid(); },
    }));
    CATEGORIES.forEach((c) => {
      if (!counts[c.id]) return;
      chipsRow.append(el('button', {
        class: `gv-chip ${cat === c.id ? 'active' : ''}`, text: `${c.emoji} ${c.label}`,
        onclick: () => { cat = cat === c.id ? '' : c.id; renderChips(); renderGrid(); Sound.play('click'); },
      }));
    });
  }

  function renderGrid() {
    const games = gamesWithFlags().filter((g) => g.active !== false);
    let list = games;
    if (q) list = list.filter((g) => g.title.includes(q) || g.tags.some((t) => t.includes(q)) || g.short.includes(q));
    if (cat) list = list.filter((g) => g.categories.includes(cat));
    const sorters = {
      popular: (a, b) => b.seedPlays - a.seedPlays,
      newest: (a, b) => b.addedAt.localeCompare(a.addedAt),
      rating: (a, b) => b.rating - a.rating,
      title: (a, b) => a.title.localeCompare(b.title, 'fa'),
    };
    list = [...list].sort(sorters[sort] || sorters.popular);
    countLine.textContent = list.length
      ? `${fmtNum(list.length)} بازی پیدا شد${cat ? ` در «${CATEGORIES.find((c) => c.id === cat)?.label}»` : ''}`
      : '';
    grid.innerHTML = '';
    if (!list.length) {
      grid.append(emptyState('🔍', 'نتیجه‌ای پیدا نشد؛ فیلترها را عوض کن یا عبارت دیگری بنویس.'));
      return;
    }
    list.forEach((g) => grid.append(gameCard(g)));
  }

  searchInput.addEventListener('input', debounce(() => { q = searchInput.value.trim(); renderGrid(); }, 220));
  sortSel.addEventListener('change', () => { sort = sortSel.value; renderGrid(); });

  renderChips();
  renderGrid();
}
