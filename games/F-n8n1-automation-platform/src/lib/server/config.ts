export type AppConfig = {
  nodeEnv: "development" | "test" | "production";
  databaseUrl: string;
  encryptionKey: string;
  appUrl: string;
  allowShellNodes: boolean;
  nodeFunctionAllowExternal: string[];
  redisUrl?: string;
  mqttUrl?: string;
  s3Endpoint?: string;
};

const DEV_KEY = "flowforge-dev-encryption-key-change-me";

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value.trim() === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = (env.NODE_ENV ?? "development") as AppConfig["nodeEnv"];
  const databaseUrl = env.DATABASE_URL?.trim();
  const encryptionKey = env.ENCRYPTION_KEY?.trim() || DEV_KEY;

  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  if (nodeEnv === "production" && (encryptionKey === DEV_KEY || encryptionKey.length < 32)) {
    throw new Error("ENCRYPTION_KEY must be at least 32 characters and cannot use the development default");
  }

  return {
    nodeEnv,
    databaseUrl,
    encryptionKey,
    appUrl: env.APP_URL?.trim() || "http://localhost:3000",
    allowShellNodes: bool(env.ALLOW_SHELL_NODES, nodeEnv !== "production"),
    nodeFunctionAllowExternal: (env.NODE_FUNCTION_ALLOW_EXTERNAL ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    redisUrl: env.REDIS_URL?.trim() || undefined,
    mqttUrl: env.MQTT_URL?.trim() || undefined,
    s3Endpoint: env.S3_ENDPOINT?.trim() || undefined,
  };
}

export { DEV_KEY };
