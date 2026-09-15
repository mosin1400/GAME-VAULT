import crypto from "crypto";
import { promisify } from "util";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";

const scrypt = promisify(crypto.scrypt);
export const SESSION_COOKIE = "flowforge_session";
const SESSION_DAYS = 7;

export type SessionUser = {
  id: number;
  email: string;
  name: string;
  role: string;
};

function tokenHash(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12) throw new Error("Password must be at least 12 characters");
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, encoded: string | null): Promise<boolean> {
  if (!encoded?.startsWith("scrypt:")) return false;
  const [, salt, expectedHex] = encoded.split(":");
  if (!salt || !expectedHex) return false;
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(expectedHex, "hex");
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export async function createSession(userId: number): Promise<string> {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({ tokenHash: tokenHash(token), userId, expiresAt });
  return token;
}

export function sessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 24 * 60 * 60}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

function cookieValue(request: Request): string | null {
  const value = request.headers.get("cookie") ?? "";
  const match = value.split(";").map((v) => v.trim()).find((v) => v.startsWith(`${SESSION_COOKIE}=`));
  return match ? decodeURIComponent(match.slice(SESSION_COOKIE.length + 1)) : null;
}

export async function getSessionUser(request: Request): Promise<SessionUser | null> {
  const token = cookieValue(request);
  if (!token) return null;
  const [row] = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, tokenHash(token)), gt(sessions.expiresAt, new Date())));
  return row?.user ? { id: row.user.id, email: row.user.email, name: row.user.name, role: row.user.role } : null;
}

export async function requireSession(request: Request): Promise<SessionUser> {
  const user = await getSessionUser(request);
  if (!user) throw new Response(JSON.stringify({ error: "احراز هویت لازم است" }), { status: 401, headers: { "Content-Type": "application/json" } });
  return user;
}

export async function requireRole(request: Request, allowed: string[]): Promise<SessionUser> {
  const user = await requireSession(request);
  if (!allowed.includes(user.role)) throw new Response(JSON.stringify({ error: "دسترسی کافی نیست" }), { status: 403, headers: { "Content-Type": "application/json" } });
  return user;
}
