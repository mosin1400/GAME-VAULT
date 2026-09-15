import type { ICredentialType } from "../types";
/** Credential ربات سروش پلاس */
export class SoroushApi implements ICredentialType {
  name = "soroushApi";
  displayName = "Soroush Plus Bot API";
  properties = [{ displayName: "Bot Token", name: "botToken", type: "string" as const, default: "", typeOptions: { password: true } }];
}
