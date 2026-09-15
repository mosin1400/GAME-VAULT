# Automation Builder Agent (n8n × Codex × Bale)

اپ Next.js + PostgreSQL که به‌عنوان «Agent سازندهٔ اتوماسیون» عمل می‌کند:
درخواست زبان طبیعی → Codex → JSON Workflow → اعتبارسنجی → ساخت و فعال‌سازی در n8n → مانیتور و Self-Heal → گزارش در بله.

- داشبورد: `/` — فرم وب، وضعیت اتصال‌ها، فهرست درخواست‌ها
- جزئیات هر درخواست: `/requests/:id` — خط زمانی ۴ لایه، لاگ، JSON Workflow، Self-Heal
- مستندات: `/docs` و [`n8n/README.md`](n8n/README.md) (docker-compose، نودهای سفارشی TypeScript، Workflow الگو)

## اجرا (توسعه)
```bash
cp .env .env.local   # متغیرها را طبق n8n/.env.example اضافه کنید
npx drizzle-kit push
npm run dev
```
بدون تنظیم Codex/n8n هم کار می‌کند (حالت heuristic + شبیه‌سازی) و JSON آمادهٔ import تولید می‌کند.
