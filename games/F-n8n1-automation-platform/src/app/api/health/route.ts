import { db } from "@/db";
import { sql } from "drizzle-orm";
import { loadConfig } from "@/lib/server/config";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = loadConfig();
    await db.execute(sql`select 1`);
    return Response.json({
      ok: true,
      services: {
        database: "ok",
        redis: config.redisUrl ? "configured" : "optional",
        mqtt: config.mqttUrl ? "configured" : "optional",
        objectStorage: config.s3Endpoint ? "configured" : "optional",
      },
    });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "health check failed" }, { status: 500 });
  }
}
