import type { ICredentialType } from "../types";
/** Credential ربات بله – توکن از @BotFather در بله */
export class BaleApi implements ICredentialType {
  name = "baleApi";
  displayName = "Bale Bot API";
  properties = [{ displayName: "Bot Token", name: "botToken", type: "string" as const, default: "", typeOptions: { password: true } }];
}
