/**
 * لایهٔ ۱ — ورودی از فرم وب
 * POST /api/agent/build  { prompt }
 * درخواست ثبت می‌شود و پردازش در پس‌زمینه (after) ادامه می‌یابد.
 */
import { after } from "next/server";
import { z } from "zod";
import { createRequest, processRequest } from "@/lib/agent/builder";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  prompt: z.string().min(5, "درخواست خیلی کوتاه است").max(4000),
  userName: z.string().max(100).optional(),
  /** اگر true باشد پاسخ تا پایان پردازش صبر می‌کند (برای تست) */
  wait: z.boolean().optional(),
});

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ ok: false, error: parsed.error.issues[0]?.message ?? "ورودی نامعتبر" }, { status: 400 });
  }
  const { prompt, userName, wait } = parsed.data;
  const id = await createRequest({ source: "web", text: prompt, userName });

  if (wait) {
    await processRequest(id);
  } else {
    after(() => processRequest(id));
  }
  return Response.json({ ok: true, id });
}
