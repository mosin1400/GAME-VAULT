/**
 * توابع مشترک نودهای بله
 * ------------------------
 * فراخوانی Bot API بله (سازگار با Telegram Bot API):
 *   {baseUrl}/bot{token}/{method}
 */
import type {
  IExecuteFunctions,
  IHookFunctions,
  ILoadOptionsFunctions,
  IWebhookFunctions,
  IDataObject,
  IHttpRequestMethods,
  IHttpRequestOptions,
} from "n8n-workflow";
import { NodeApiError, type JsonObject } from "n8n-workflow";

type Ctx = IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions | IWebhookFunctions;

/** فراخوانی یک متد Bot API با بدنهٔ JSON */
export async function baleApiRequest(
  this: Ctx,
  method: string,
  body: IDataObject = {},
  httpMethod: IHttpRequestMethods = "POST",
): Promise<IDataObject> {
  const credentials = (await this.getCredentials("baleApi")) as { token: string; baseUrl?: string };
  const baseUrl = (credentials.baseUrl || "https://tapi.bale.ai").replace(/\/$/, "");

  const options: IHttpRequestOptions = {
    method: httpMethod,
    url: `${baseUrl}/bot${credentials.token}/${method}`,
    json: true,
    body: httpMethod === "GET" ? undefined : body,
    qs: httpMethod === "GET" ? body : undefined,
  };

  try {
    const response = (await this.helpers.httpRequest(options)) as IDataObject;
    if (response.ok === false) {
      throw new NodeApiError(this.getNode(), response as unknown as JsonObject, {
        message: `Bale API error: ${response.description ?? "unknown"}`,
      });
    }
    return (response.result ?? response) as IDataObject;
  } catch (error) {
    if (error instanceof NodeApiError) throw error;
    throw new NodeApiError(this.getNode(), error as never);
  }
}

/**
 * ارسال فایل/عکس به‌صورت multipart (وقتی دادهٔ باینری داریم)
 * بله همانند تلگرام فیلدهای photo/document را در فرم می‌پذیرد.
 */
export async function baleApiUpload(
  this: IExecuteFunctions,
  method: string,
  fieldName: string,
  buffer: Buffer,
  fileName: string,
  extraFields: IDataObject = {},
): Promise<IDataObject> {
  const credentials = (await this.getCredentials("baleApi")) as { token: string; baseUrl?: string };
  const baseUrl = (credentials.baseUrl || "https://tapi.bale.ai").replace(/\/$/, "");

  // ساخت بدنهٔ multipart با FormData داخلی Node 18+
  const form = new FormData();
  for (const [k, v] of Object.entries(extraFields)) {
    if (v !== undefined && v !== null && v !== "") form.append(k, String(v));
  }
  form.append(fieldName, new Blob([new Uint8Array(buffer)]), fileName);

  const response = (await this.helpers.httpRequest({
    method: "POST",
    url: `${baseUrl}/bot${credentials.token}/${method}`,
    body: form as unknown as IDataObject,
    json: true,
  })) as IDataObject;

  if (response.ok === false) {
    throw new NodeApiError(this.getNode(), response as unknown as JsonObject, {
      message: `Bale API error: ${response.description ?? "unknown"}`,
    });
  }
  return (response.result ?? response) as IDataObject;
}
