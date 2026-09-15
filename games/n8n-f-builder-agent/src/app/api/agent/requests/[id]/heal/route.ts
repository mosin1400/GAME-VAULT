/**
 * POST /api/agent/requests/:id/heal  { error? }
 * راه‌اندازی دستی Self-Heal (یا گزارش خطا از n8n Error Workflow)
 */
import { after } from "next/server";
import { selfHeal } from "@/lib/agent/builder";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  const body = (await req.json().catch(() => ({}))) as { error?: string; wait?: boolean };
  const error = body.error?.trim() || "کاربر درخواست بازسازی/ترمیم Workflow را داد";
  if (body.wait) {
    await selfHeal(id, error);
  } else {
    after(() => selfHeal(id, error));
  }
  return Response.json({ ok: true, id });
}
