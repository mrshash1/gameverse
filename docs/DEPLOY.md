# Deploy / Update — گیت‌هاب پیجز

## وضعیت فعلی
این پروژه روی ریپوی `mrshash1/gameverse` پوش شده و GitHub Pages از شاخه‌ی `main` (پوشه‌ی ریشه) سرو می‌کند:
`https://mrshash1.github.io/gameverse/`

## آپدیت نسخه‌ی جدید
```bash
git clone https://github.com/mrshash1/gameverse.git
cd gameverse
# فایل‌ها را عوض کن…
git add -A && git commit -m "update" && git push
```
تا ~۱ دقیقه بعد، Pages خودکار build می‌کند (Status در تب Actions/Deployments).

## نکته‌های مهم
- `index.html` باید در **ریشه** باشد (هست).
- فایل `.nojekyll` موجود است تا GitHub پردازش Jekyll انجام ندهد.
- همه‌ی مسیرها **relative** هستند (`css/…`, `js/…`, `games/…`) — پس زیرپوشه بودن سایت (`/gameverse/`) مشکلی ندارد.
- `vendor/trystero-nostr.mjs` و فونت‌ها لوکال‌اند؛ هیچ CDN الزامی در اجرا نیست.
- برای آپدیت با توکن: توکن جدید را از GitHub → Settings → Developer settings بگیرید و به‌جای قدیمی بگذارید.
