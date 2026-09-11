/* ============================================================
   GameVerse — تنظیمات: صدا، تم، داده‌ها، حالت مدیریت
   ============================================================ */

import { el, fmtNum } from '../core/utils.js';
import { getDb, update, wipeDb } from '../core/store.js';
import { API } from '../api/mock-api.js';
import { API as SocialAPI } from '../api/mock-api-social.js';
import { toast, confirmDlg } from '../core/ui.js';
import { Sound } from '../core/sound.js';
import { renderUserMenu } from '../app-bridge.js';

export async function render({ outlet }) {
  const db = getDb();
  outlet.innerHTML = '';
  const page = el('div', { class: 'gv-page gv-fade-in gv-settings' });
  outlet.append(page);

  page.append(el('div', { class: 'gv-page-head' },
    el('h1', { text: '⚙️ تنظیمات' }),
  ));

  /* ---------------- صدا ---------------- */
  const volSlider = el('input', { type: 'range', min: '0', max: '100', value: String(Math.round(Sound.volume * 100)) });
  volSlider.addEventListener('input', () => Sound.setVolume(volSlider.value / 100));
  page.append(card('🔊 صدا',
    row('افکت‌های صوتی', toggle(Sound.muted ? false : true, (v) => {
      if (Sound.muted === v) Sound.toggle();
      elToast();
    })),
    row('بلندی صدا', volSlider),
    el('p', { class: 'gv-muted-c', style: 'font-size:12px', text: 'صداها با WebAudio ساخته می‌شوند — بدون فایل صوتی.' }),
  ));

  /* ---------------- تم ---------------- */
  page.append(card('🎨 ظاهر',
    row('تم تاریک (پیش‌فرض)', toggle(document.documentElement.dataset.theme === 'dark', (v) => {
      document.documentElement.dataset.theme = v ? 'dark' : 'light';
      localStorage.setItem('gv_theme', v ? 'dark' : 'light');
      toast(v ? 'تم تاریک فعال شد' : 'تم روشن فعال شد', 'success', '🎨');
    })),
    row('زبان', el('span', { class: 'gv-badge gv-badge-info', text: '🇮🇷 فارسی (RTL)' })),
    el('p', { class: 'gv-muted-c', style: 'font-size:12px', text: 'ساختار i18n آماده است؛ انگلیسی و عربی در نقشهٔ راه قرار دارند (docs/ROADMAP.md).' }),
  ));

  /* ---------------- اتصال ---------------- */
  page.append(card('📡 وضعیت اتصال',
    row('اتصال مرورگر', el('span', { class: `gv-badge ${navigator.onLine ? 'gv-badge-success' : 'gv-badge-danger'}`, text: navigator.onLine ? '🟢 آنلاین' : '🔴 آفلاین' })),
    row('ذخیره‌سازی', el('span', { class: 'gv-badge gv-badge-primary', text: '💾 محلی (localStorage)' })),
    el('p', { class: 'gv-muted-c', style: 'font-size:12px', text: 'نسخهٔ فعلی کاملاً آفلاین‌پذیر است؛ داده‌ها در مرورگر شما ذخیره و به‌صورت خودکار ذخیره می‌شوند.' }),
  ));

  /* ---------------- حالت مدیریت ---------------- */
  page.append(card('🛠️ پنل مدیریت (نمایشی)',
    row('نمایش منوی مدیریت', toggle(db.session.adminMode, async (v) => {
      await SocialAPI.admin.setAdminMode(v);
      renderUserMenu();
      toast(v ? 'حالت مدیریت فعال شد — از منوی پروفایل وارد شو' : 'حالت مدیریت خاموش شد', 'info', '🛠️');
    })),
    el('p', { class: 'gv-muted-c', style: 'font-size:12px', text: 'در نسخهٔ واقعی، مدیریت با نقش و مجوز سمت سرور کنترل می‌شود. اینجا فقط برای نمایش پنل است.' }),
  ));

  /* ---------------- داده‌ها ---------------- */
  page.append(card('💾 داده‌های من',
    row('خروجی گرفتن', el('button', {
      class: 'gv-btn gv-btn-secondary gv-btn-sm', text: '⬇️ دانلود JSON',
      onclick: () => {
        const blob = new Blob([localStorage.getItem('gv_db_v1') || '{}'], { type: 'application/json' });
        const a = el('a', { href: URL.createObjectURL(blob), download: 'gameverse-backup.json' });
        document.body.append(a); a.click(); a.remove();
        toast('فایل پشتیبان دانلود شد', 'success', '⬇️');
      },
    })),
    row('پاک‌سازی کامل', el('button', {
      class: 'gv-btn gv-btn-danger gv-btn-sm', text: '🗑️ پاک کن',
      onclick: async () => {
        if (await confirmDlg({ title: 'پاک‌سازی کامل', message: 'همهٔ پیشرفت‌ها، دوستان و سکه‌ها برای همیشه حذف می‌شوند. مطمئنی؟', danger: true, okLabel: 'پاک کن' })) wipeDb();
      },
    })),
  ));

  page.append(card('ℹ️ درباره',
    el('p', { style: 'font-size:13px;line-height:2' },
      el('b', { text: 'گیماورس نسخهٔ ۱.۰' }), el('br'),
      el('span', { class: 'gv-muted-c', text: 'پلتفرم اجتماعی چندبازی — نمونهٔ اولیهٔ کامل و استاتیک (قابل اجرا روی GitHub Pages). معماری بک‌اند در docs/BACKEND.md مستند شده است.' }),
    ),
  ));

  function card(title, ...body) {
    return el('section', { class: 'gv-card', style: 'padding:18px;margin-bottom:16px' },
      el('h2', { class: 'gv-section-title', style: 'margin-bottom:14px;font-size:16px', text: title }), ...body);
  }
  function row(label, control) {
    return el('div', { class: 'gv-between', style: 'padding:8px 0;font-size:14px' }, el('span', { text: label }), control);
  }
  function toggle(on, onChange) {
    const t = el('button', { class: `gv-toggle ${on ? 'on' : ''}`, role: 'switch', 'aria-checked': String(on) });
    t.addEventListener('click', () => { const now = !t.classList.contains('on'); t.classList.toggle('on', now); t.setAttribute('aria-checked', String(now)); onChange(now); });
    return t;
  }
  function elToast() { toast('تنظیم صدا ذخیره شد', 'success', '🔊'); }
}
