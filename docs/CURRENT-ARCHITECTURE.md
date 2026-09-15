# نقشهٔ فعلی پروژه

این سند، مرجع بستهٔ A است و هنوز بازآرایی ساختاری انجام نداده است.

| بخش | مسیر فعلی | مسئولیت |
| --- | --- | --- |
| ورودی سرور | `server.js` | راه‌اندازی HTTP و اتصال APIها به ماژول‌های مشترک |
| هستهٔ پروژه | `backend/core/project-utils.js` | مسیر امن، JSON، اعتبارسنجی متادیتا و تولید README |
| فایل‌های استاتیک | `backend/http/static-assets.js` | مسیر صفحه‌ها، Script/Styleهای فعال و Content-Typeها |
| CORS استادیو | `backend/http/theia-cors.js` | دسترسی امن Theia به API محلی با Cookie نشست مدیر |
| ابزارهای سیستم | `backend/tools/system-tools.js` | VS Code، Git، اجرای فرمان و آمار منابع پروژه |
| نشست کاربر | `backend/auth/session-service.js` | توکن نشست، مدیر، خروج و همگام‌سازی دادهٔ نشست |
| تاریخچهٔ پروژه | `backend/projects/history.js` | Snapshot و رویدادهای بازگشت امن |
| کاتالوگ بازی | `backend/projects/game-catalog.js` | فهرست بازی‌ها، نسخه‌ها و Tree فایل‌های پروژه |
| ورودی AI پروژه | `backend/ai/project-files.js` | جمع‌آوری امن فایل‌های متنی و حفاظت از game.json و README.md |
| رابط عمومی | `frontend/pages` و `frontend/scripts` | فهرست، جزئیات، پروفایل، مدیریت و رابط قدیمی |
| استایل عمومی | `frontend/styles` | ظاهر صفحات عمومی و مدیریت |
| Studio مستقل | `theia/` | برنامهٔ مرورگری Theia، Bundle و افزونه‌های Game Vault |
| فایل‌های بازی | `games/<slug>/versions/<version>/` | هر نسخه، مستقل با `game.json` و `README.md` |
| دادهٔ محلی | `.vault/` و `data/` | داده‌های عملیاتی برنامه؛ بدون خواندن اطلاعات محرمانه |
| خروجی ساخت | `builds/` | خروجی‌های تولیدشدهٔ نصب یا بسته‌بندی |
| تست‌های قرارداد | `tests/` | جلوگیری از شکستن مسیرها و رفتارهای اصلی |

## قراردادهای مسیر

- برنامهٔ اصلی: `http://127.0.0.1:8080`
- Studio Theia: `http://127.0.0.1:3010`
- Workspace بازی فقط از مسیر `games/<slug>/versions/<version>` ساخته می‌شود.
- `game.json` و `README.md` در هر نسخه اجباری‌اند.
- هیچ تستی نباید `.env` را بخواند یا مقدار آن را نمایش دهد.
