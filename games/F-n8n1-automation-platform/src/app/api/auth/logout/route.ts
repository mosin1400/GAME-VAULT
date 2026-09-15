import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { clearSessionCookie, SESSION_COOKIE } from "@/lib/server/auth";
import crypto from "crypto";

export async function POST(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const item = cookie.split(";").map((v) => v.trim()).find((v) => v.startsWith(`${SESSION_COOKIE}=`));
  if (item) {
    const token = decodeURIComponent(item.slice(SESSION_COOKIE.length + 1));
    await db.delete(sessions).where(eq(sessions.tokenHash, crypto.createHash("sha256").update(token).digest("hex")));
  }
  return new Response(null, { status: 204, headers: { "Set-Cookie": clearSessionCookie() } });
}
