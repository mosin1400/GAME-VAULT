# OpenRouter API boundary

کلید OpenRouter را داخل `app.js` یا هر فایل قابل مشاهده در مرورگر نگذارید؛ حتی اگر رمزگذاری یا obfuscate شود، کاربر می‌تواند آن را استخراج کند.

در نسخه‌ی سمت‌سرور، یک endpoint مثل `POST /api/ai` بسازید که این دو مقدار را از environment بخواند:

- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`

و درخواست را از سمت سرور به `https://openrouter.ai/api/v1/chat/completions` ارسال کند. فایل `.env` واقعی باید کنار این پوشه قرار بگیرد و در Git ثبت نشود. فایل `.env.example` فقط نمونه‌ی نام متغیرهاست و هیچ کلید واقعی ندارد.

این نسخه‌ی static برای مدیریت محلی بازی‌هاست؛ اتصال AI عمداً فعال نشده تا کلید شما امن بماند.
