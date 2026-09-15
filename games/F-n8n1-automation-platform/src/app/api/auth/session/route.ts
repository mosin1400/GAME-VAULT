import { getSessionUser } from "@/lib/server/auth";

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  return Response.json({ authenticated: Boolean(user), user });
}
