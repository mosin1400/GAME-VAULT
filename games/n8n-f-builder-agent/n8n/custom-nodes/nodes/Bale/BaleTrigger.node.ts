/**
 * نود Bale Trigger (Webhook)
 * ===========================
 * هنگام فعال‌شدن Workflow، به‌طور خودکار setWebhook روی آدرس n8n انجام می‌دهد
 * و هنگام غیرفعال‌شدن deleteWebhook می‌زند. هر Update بله به‌عنوان یک item خارج می‌شود.
 *
 * خروجی نمونه:
 * { update_id, message: { message_id, from, chat: { id }, text, date } }
 */
import type {
  IDataObject,
  IHookFunctions,
  INodeType,
  INodeTypeDescription,
  IWebhookFunctions,
  IWebhookResponseData,
} from "n8n-workflow";
import type { NodeConnectionType } from "n8n-workflow";
import { baleApiRequest } from "./GenericFunctions";

export class BaleTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: "Bale Trigger",
    name: "baleTrigger",
    icon: "file:bale.svg",
    group: ["trigger"],
    version: 1,
    description: "شروع Workflow با دریافت پیام/رویداد از بات بله",
    defaults: { name: "Bale Trigger" },
    inputs: [],
    outputs: ["main" as NodeConnectionType],
    credentials: [{ name: "baleApi", required: true }],
    webhooks: [
      {
        name: "default",
        httpMethod: "POST",
        responseMode: "onReceived",
        path: "webhook",
      },
    ],
    properties: [
      {
        displayName: "Updates",
        name: "updates",
        type: "multiOptions",
        options: [
          { name: "Message", value: "message" },
          { name: "Edited Message", value: "edited_message" },
          { name: "Callback Query (Inline Buttons)", value: "callback_query" },
          { name: "Channel Post", value: "channel_post" },
        ],
        default: ["message"],
        description: "فقط این نوع Updateها Workflow را اجرا می‌کنند",
      },
      {
        displayName: "Only Text Messages",
        name: "onlyText",
        type: "boolean",
        default: false,
        description: "پیام‌های بدون متن (عکس/فایل بدون caption) نادیده گرفته شوند",
      },
      {
        displayName: "Secret (Optional)",
        name: "secret",
        type: "string",
        typeOptions: { password: true },
        default: "",
        description: "اگر تنظیم شود در query string آدرس Webhook قرار می‌گیرد و درخواست‌های فاقد آن رد می‌شوند",
      },
    ],
  };

  /** چرخهٔ حیات Webhook: بررسی / ساخت / حذف */
  webhookMethods = {
    default: {
      /** آیا Webhook فعلی بله همین آدرس است؟ */
      async checkExists(this: IHookFunctions): Promise<boolean> {
        const webhookUrl = buildUrl(this.getNodeWebhookUrl("default") as string, this.getNodeParameter("secret", "") as string);
        try {
          const info = await baleApiRequest.call(this, "getWebhookInfo", {}, "GET");
          return info.url === webhookUrl;
        } catch {
          return false;
        }
      },
      /** ثبت Webhook در بله */
      async create(this: IHookFunctions): Promise<boolean> {
        const webhookUrl = buildUrl(this.getNodeWebhookUrl("default") as string, this.getNodeParameter("secret", "") as string);
        await baleApiRequest.call(this, "setWebhook", { url: webhookUrl });
        return true;
      },
      /** حذف Webhook هنگام غیرفعال‌شدن */
      async delete(this: IHookFunctions): Promise<boolean> {
        try {
          await baleApiRequest.call(this, "deleteWebhook", {});
        } catch {
          return false;
        }
        return true;
      },
    },
  };

  /** پردازش هر Update دریافتی */
  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const body = this.getBodyData() as IDataObject;
    const updates = this.getNodeParameter("updates", ["message"]) as string[];
    const onlyText = this.getNodeParameter("onlyText", false) as boolean;
    const secret = this.getNodeParameter("secret", "") as string;

    // بررسی secret
    if (secret) {
      const query = this.getQueryData() as IDataObject;
      if (query.secret !== secret) {
        return { noWebhookResponse: false, workflowData: undefined, webhookResponse: { status: 401 } };
      }
    }

    // تشخیص نوع Update
    const kind = updates.find((u) => body[u] !== undefined);
    if (!kind) return { workflowData: undefined }; // نوع مورد نظر نیست → نادیده

    if (onlyText) {
      const msg = body[kind] as IDataObject | undefined;
      if (!msg || (!msg.text && !msg.caption)) return { workflowData: undefined };
    }

    return {
      workflowData: [this.helpers.returnJsonArray([{ ...body, update_type: kind }])],
    };
  }
}

/** افزودن secret به آدرس Webhook */
function buildUrl(url: string, secret: string): string {
  if (!secret) return url;
  return `${url}${url.includes("?") ? "&" : "?"}secret=${encodeURIComponent(secret)}`;
}
