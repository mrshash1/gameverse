# 🏗️ معماری بک‌اند آیندهٔ گیماورس

این سند نقشهٔ کامل تبدیل نسخهٔ استاتیک فعلی به پلتفرم واقعی چندنفره را مشخص می‌کند. نسخهٔ فعلی طوری نوشته شده که **بدون تغییر صفحات**، فقط با پیاده‌سازی همین قراردادها، به سرور وصل شود.

## ۱. پشتهٔ فناوری پیشنهادی

| لایه | فناوری | چرا |
|---|---|---|
| API | **NestJS** (Node + TypeScript) | ماژولار، DI، هم‌سو با ساختار ماژول‌های فعلی |
| دیتابیس | **PostgreSQL** | تراکنش اتمic برای اقتصاد بازی (سکه/XP) |
| کش/حضور | **Redis** | وضعیت آنلاین، اتاق‌ها، rate-limit، صف matchmaking |
| ریل‌تایم | **WebSocket (Socket.IO)** | اتاق‌ها، حضور، چت، بازی زنده |
| احراز | JWT (access+refresh) + OAuth (Google/GitHub) | ساده و استاندارد |
| میزبانی | VPS/Docker یا Cloud Run + CDN برای فرانت | مقیاس‌پذیر |
| فرانت | همین کد + `api/real-api.js` جای `mock-api.js` | قرارداد یکسان async |

## ۲. مدل داده (ERD خلاصه)

```
users(id, username UNIQUE, display_name, avatar_json, bio, xp, level, coins,
      rating, banned, created_at)
user_stats(user_id, played, wins, losses, draws, best_streak, per_game_json)
games(id, title, meta_json, active, featured)                 ← از registry
matches(id, game_id, mode, started_at, ended_at, status)
match_participants(match_id, user_id, score, outcome, xp, coins, rating_delta)
friendships(user_id, friend_id, status[pending/accepted/blocked])
notifications(id, user_id, type, cat, title, body, read, created_at)
achievements(user_id, achievement_id, unlocked_at)
missions(user_id, period_key[daily/weekly], mission_id, progress, claimed)
rooms(id, code UNIQUE, host_id, game_id, mode, max_players, is_private, status)
room_members(room_id, user_id, ready, joined_at)
reports(id, reporter_id, target_id, reason, status, resolution)
sessions(user_id, refresh_token_hash, device, last_seen)
```

## ۳. سطح API (REST + WebSocket)

```
POST /auth/register | /auth/login | /auth/refresh
GET  /me                     PATCH /me
GET  /games                  GET /games/:id/leaderboard?scope=weekly|all|friends
POST /matches/:id/result     ← ⭐ تنها نقطهٔ ثبت نتیجه (امضاشده)
GET  /me/history | /me/achievements | /me/missions
POST /rewards/daily/claim    POST /missions/:id/claim
GET  /leaderboard?scope=global|weekly|friends&metric=xp|wins|played
POST /friends/:id/request | /accept | /reject | DELETE /friends/:id | POST /friends/:id/block
GET  /notifications          POST /notifications/read-all
POST /rooms | POST /rooms/:code/join | DELETE /rooms/:code | POST /rooms/:code/kick
POST /reports                GET /admin/analytics/overview
WS  events: presence.update, room.state, match.tick, chat.message, invite.incoming
```

نکتهٔ کلیدی: توابع `mock-api.js` همین شکل‌اند — جایگزینی یعنی پیاده‌سازی `fetch` داخل همان امضاها.

## ۴. چندنفرهٔ واقعی (جایگزین شبیه‌سازی فعلی)

- **اتاق:** state در Redis؛ میزبان = `host_id`؛ شروع بازی ⇒ ساخت `match` و ارسال `match:start` به اعضا
- **بازی‌های نوبتی (دوز/چهار در یک ردیف/سنگ‌کاغذ):** سرور اعتبار نوبت و حرکت قانونی را چک می‌کند؛ هر حرکت broadcast
- **هم‌زمان سریع (ری‌اکشن):** سرور زمان‌سنج مرجع است؛ تایم‌استمپ سرور ملاک رتبه
- **Matchmaking:** صف Redis با کلید `game+mode`؛ بازهٔ رتبه تدریجی باز می‌شود (±100 → ±300)؛ در نظر گرفتن latency/region (آماده در نقشهٔ راه)
- **Tournament:** جدول براکت ۸/۱۶/۳۲؛ پیشرفت خودکار با برندهٔ هر مسابقه

## ۵. ELO واقعی

```
expected = 1 / (1 + 10^((R_opp − R_me)/400))
R' = R + K × (S − expected)        K=32 برای <۳۰ مسابقه، سپس K=16
```
نسخهٔ فعلی همین فرمول را با رتبهٔ ثابت ربات اجرا می‌کند (`matches.submit`) — در سرور `R_opp` رتبهٔ واقعی حریف انسانی است. رده‌ها (برنز→استاد) فقط نمایش آستانه‌ها هستند و سراسری‌اند؛ رتبهٔ جدا برای هر بازی در سطح ۲ نقشهٔ راه است.

## ۶. Anti-Cheat (سمت سرور — جدی)

1. **قانون طلایی:** کلاینت هرگز امتیاز/XP/سکه/برد را «ثبت» نمی‌کند؛ فقط رویدادهای خام می‌فرستد
2. **بازپخش (Replay):** برای بازی‌های منطقی (دوز/چهار در یک ردیف) دنبالهٔ حرکت‌ها روی سرور اجرا و نتیجه بازتولید می‌شود
3. **تحلیل آماری:** نرخ برد، سرعت پاسخ و توزیع امتیاز در برابر هم‌سطح‌ها؛ ناهنجاری ⇒ بازداشت موقت بررسی انسانی
4. **Rate-limit:** Redis token-bucket روی همهٔ endpointهای نوشتن
5. **امضای نتیجه:** `POST /matches/:id/result` فقط با `match_token` که در `match:start` صادر شده (یک‌بارمصرف، مهلت‌دار)
6. **اقتصاد اتمیک:** تراکنش DB برای XP/سکه/مأموریت — بدون double-spend
7. اعتبارسنجی محدودهٔ منطقی فعلی (`sdk.js → BOUNDS`) به‌عنوان لایهٔ اول روی سرور هم می‌ماند

## ۷. مقیاس‌پذیری و کیفیت

- CDN برای فرانت؛ HTTP/2؛ فشرده‌سازی brotli
- کش خواندنی‌ها (رده‌بندی با materialized view هر ۶۰ ثانیه)
- لاگ ساخت‌یافته + متریکس Prometheus + آلرت
- Migrationهای Prisma/Knex؛ بکاپ روزانه
- i18n سمت کلاینت با فایل‌های locale جدا (fa/en/ar)
