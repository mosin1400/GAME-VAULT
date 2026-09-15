import { db } from '@/db';
import { customNodes, workflows } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getSessionUser } from '@/lib/server/auth';
import { validateNodeSpec, customNodeDefinition } from '@/lib/agent/node-spec';
import { audit } from '@/lib/server/utils';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: 'احراز هویت لازم است' }, { status: 401 });
  if (!['owner', 'admin'].includes(user.role)) return Response.json({ error: 'فقط مدیر می‌تواند کد نود جدید نصب کند' }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (body?.confirmCode !== true) return Response.json({ error: 'تأیید بررسی کد لازم است' }, { status: 400 });
  const check = validateNodeSpec(body.spec);
  if (!check.spec) return Response.json({ error: check.errors.join('؛ ') }, { status: 422 });
  try {
    const [row] = await db.insert(customNodes).values({ type: check.spec.type, specification: check.spec, createdBy: user.id }).onConflictDoNothing().returning();
    if (!row) return Response.json({ error: 'نود قبلاً نصب شده است؛ نام type جدید انتخاب کنید' }, { status: 409 });
    await audit('install', 'custom-node', row.id, { type: row.type }, user.email);
    return Response.json({ installed: true, node: customNodeDefinition(check.spec) }, { status: 201 });
  } catch { return Response.json({ error: 'نصب ناموفق بود؛ schema دیتابیس را به‌روز کنید' }, { status: 500 }); }
}
export async function DELETE(request: Request) {
  const user = await getSessionUser(request);
  if (!user || !['owner', 'admin'].includes(user.role)) return Response.json({ error: 'دسترسی کافی نیست' }, { status: 403 });
  const type = new URL(request.url).searchParams.get('type') ?? '';
  if (!/^custom\.[a-z][a-z0-9_]{1,60}$/.test(type)) return Response.json({ error: 'type نامعتبر است' }, { status: 400 });
  const references = await db.select({ id: workflows.id, nodes: workflows.nodes }).from(workflows);
  if (references.some(w => w.nodes.some(n => n.type === type))) return Response.json({ error: 'این نود در Workflow استفاده شده است؛ ابتدا وابستگی‌ها را تغییر دهید' }, { status: 409 });
  await db.delete(customNodes).where(eq(customNodes.type, type));
  await audit('delete', 'custom-node', type, {}, user.email);
  return Response.json({ deleted: true });
}
