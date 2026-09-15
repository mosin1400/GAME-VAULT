# Game Vault: ورودی بررسی معماری و برنامهٔ تحویل

Date: 2026-09-15. این خروجی برای بررسی تصمیم‌ها و اجرای مرحله‌ای آماده شده است.
به‌روزرسانی اجرا: [گزارش P00/P01](2026-09-15-implementation-progress.md)؛ بکاپ و بازیابی بایت‌ها تأیید شده، اما freeze/runtime هنوز gate باز دارند. اصلاح static در سورس آزموده شده؛ پردازهٔ قدیمی هنوز restart نشده است. دادهٔ واقعی مهاجرت نکرده و runtime چندکاربرهٔ جدید هنوز پیاده‌سازی نشده است.

## پاسخ تصمیم استقرار

انتخاب اولیه Linux با دو VM مستقل است: control plane برای حساب/داده/API و worker برای کد کاربران.
هر کاربر برای هر نسخه working copy، volume، Theia و terminal جدا دارد.
اجرای worker با Docker/runsc و محدودیت واقعی cgroup، دیسک XFS/prjquota و شبکهٔ بسته انجام می‌شود.
Kubernetes در شروع لازم نیست؛ سازگاری واقعی PTY، language server و filesystem با runsc پیش از فعال‌سازی عمومی آزموده می‌شود.

## ده اصلاح و محل قرارداد

| درخواست | تصمیم اجرایی | سند / بسته |
| --- | --- | --- |
| 1. مالکیت چندکاربره | یک owner در project row؛ maintainer/developer/viewer مستقل از system admin؛ public release مجوز source نیست | [داده و دسترسی](specs/2026-09-15-data-access-model.md)، P03 |
| 2. امنیت Theia | worker جدا، sandbox/volume/terminal اختصاصی، بدون secrets/socket/host network، gateway با revocation | [معماری](specs/2026-09-15-production-architecture-design.md)، P09 |
| 3. مرجع داده | DB برای metadata/ACL؛ snapshot bytes برای source؛ game.json خروجی با پیشنهاد تغییر و revision | معماری، P05/P09 |
| 4. SQL و فایل | UUID ثابت، label مستقل؛ journal/stage/hash/CAS/fence/reconciler؛ حذف tombstone و retention | [مهاجرت و بازیابی](specs/2026-09-15-migration-recovery.md)، P05 |
| 5. حساب‌ها | signup/verify/reset/device expiry/revoke-all/throttle؛ Google subject با linking صریح و recent-auth | داده و دسترسی، P04/P13 |
| 6. فناوری | PostgreSQL برای concurrency/transaction/operations؛ OAuth مستقل؛ Redis فقط با نیاز اندازه‌گیری‌شده | معماری، P02/P03 |
| 7. frontend و sync | React/Vite، Query برای server state، React/URL برای UI state، outbox/SSE، ماتریس حالات صفحه | [برنامهٔ تحویل](plans/2026-09-15-production-delivery-program.md)، P07/P08 |
| 8. مهاجرت برگشت‌پذیر | inventory/freeze/backup/hash/restore، mapping ثابت، quarantine فرمت ناشناخته، حفظ محدودیت تاریخچهٔ قدیمی | مهاجرت، P00/P06/P12 |
| 9. اعتبار audit | B/S/R/L/D با شاهد، بازتولید و اصلاح ادعاهای بیش‌ازحد قبلی | [audit](specs/2026-09-15-validated-audit.md) |
| 10. بسته‌های قابل تحویل | هر بسته هدف/فایل/interface/dependency/test/acceptance/rollback؛ تغییر domainها جدا | برنامهٔ تحویل و [پلن دقیق نخست](plans/2026-09-15-inventory-backup.md) |

## وضعیت شواهد

[baseline](evidence/2026-09-15-baseline.json) و `node scripts/audit-production-baseline.cjs` شاهدهای فعلی را ثبت می‌کنند.
بدون ورود، server.js و operational users file در HTTP قابل دریافت‌اند؛ body محرمانه در خروجی ذخیره نشده است.
Snapshot باینری hash-equal نماند و فایل 1MB را حذف کرد؛ در سه trial هم‌زمان، 20 نظر ارسال و یک نظر ذخیره شد.
46 تست موجود اجرا شد: 40 pass، شش fail؛ چهار مورد ارجاع‌های باقی‌مانده از legacy و دو مورد fixture/layout داده بودند.
بازاعتبارسنجی authenticated launch/host terminal و browser/mobile در این نوبت انجام نشده و به‌عنوان B معرفی نشده است.

## ترتیب نخست

P00 inventory و backup/restore قابل اثبات می‌سازد؛ P01 افشای فایل و cleanup legacy را می‌بندد.
P02 فقط API typed را می‌آورد؛ P03 داده/دسترسی، P04 حساب و P05 عملیات فایل مستقل‌اند.
مهاجرت واقعی، community تراکنشی، frontend، مدیریت، Theia، Agent و build هرکدام gate خود را دارند.
P12 فقط پس از مسیرهای واقعی کاربر، ایزوله‌سازی، fault injection و rollback rehearsal استقرار عمومی را فعال می‌کند.
P13 ورود گوگل را جداگانه اضافه می‌کند.

نمونه‌کدهای P00 در حافظه اجرا و روی fixture موقت آزموده شدند: پنج تست preservation/rejection پاس شدند.
این بررسی نمونه‌کد، جای backup واقعی و بازیابی محیط پروژه را نمی‌گیرد.
