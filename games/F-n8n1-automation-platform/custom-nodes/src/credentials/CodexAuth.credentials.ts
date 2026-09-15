import type { ICredentialType } from "../types";
/** Codex – احراز هویت با device-code (بدون API Key پولی)
 *  مراحل: `codex login --device-code` → توکن‌ها در ~/.codex/auth.json */
export class CodexAuth implements ICredentialType {
  name = "codexAuth";
  displayName = "Codex (device-code auth)";
  properties = [
    { displayName: "Access Token", name: "accessToken", type: "string" as const, default: "", typeOptions: { password: true } },
    { displayName: "Refresh Token", name: "refreshToken", type: "string" as const, default: "", typeOptions: { password: true } },
    { displayName: "Account ID", name: "accountId", type: "string" as const, default: "" },
    { displayName: "Base URL", name: "baseUrl", type: "string" as const, default: "https://chatgpt.com/backend-api/codex" },
  ];
}
