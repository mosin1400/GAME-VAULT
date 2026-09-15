/**
 * اعتبارنامهٔ Bale Bot API
 * -------------------------
 * توکن بات از @BotFather در بله دریافت می‌شود.
 * آدرس پایه: https://tapi.bale.ai/bot{TOKEN}/...
 */
import type { IAuthenticateGeneric, ICredentialTestRequest, ICredentialType, INodeProperties } from "n8n-workflow";

export class BaleApi implements ICredentialType {
  name = "baleApi";
  displayName = "Bale Bot API";
  documentationUrl = "https://docs.bale.ai/";

  properties: INodeProperties[] = [
    {
      displayName: "Bot Token",
      name: "token",
      type: "string",
      typeOptions: { password: true },
      default: "",
      required: true,
      description: "توکن بات که از BotFather بله گرفته‌اید",
    },
    {
      displayName: "API Base URL",
      name: "baseUrl",
      type: "string",
      default: "https://tapi.bale.ai",
      description: "برای سروش یا سرورهای سازگار دیگر قابل تغییر است",
    },
  ];

  /** توکن در مسیر URL است؛ نیازی به هدر نیست */
  authenticate: IAuthenticateGeneric = {
    type: "generic",
    properties: {},
  };

  /** تست اعتبارنامه با getMe */
  test: ICredentialTestRequest = {
    request: {
      baseURL: "={{$credentials.baseUrl}}",
      url: "=/bot{{$credentials.token}}/getMe",
      method: "GET",
    },
  };
}
