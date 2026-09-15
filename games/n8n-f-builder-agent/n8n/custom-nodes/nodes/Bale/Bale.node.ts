/**
 * نود Bale Messenger (Actions)
 * =============================
 * ارسال متن، عکس، فایل، پاسخ به دکمه‌ها، دریافت اطلاعات بات و مدیریت Webhook.
 * API: https://tapi.bale.ai/bot{TOKEN}/{method}
 *
 * تست محلی:  npx n8n-node-dev build   (سپس n8n را ری‌استارت کنید)
 */
import type {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from "n8n-workflow";
import { NodeOperationError, type NodeConnectionType } from "n8n-workflow";
import { baleApiRequest, baleApiUpload } from "./GenericFunctions";

export class Bale implements INodeType {
  description: INodeTypeDescription = {
    displayName: "Bale",
    name: "bale",
    icon: "file:bale.svg",
    group: ["output"],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: "ارسال و مدیریت پیام در پیام‌رسان بله",
    defaults: { name: "Bale" },
    inputs: ["main" as NodeConnectionType],
    outputs: ["main" as NodeConnectionType],
    credentials: [{ name: "baleApi", required: true }],
    /** این نود می‌تواند به‌عنوان Tool در AI Agent هم استفاده شود */
    usableAsTool: true,
    properties: [
      /* ---------- Resource ---------- */
      {
        displayName: "Resource",
        name: "resource",
        type: "options",
        noDataExpression: true,
        options: [
          { name: "Message", value: "message" },
          { name: "Bot", value: "bot" },
          { name: "Webhook", value: "webhook" },
        ],
        default: "message",
      },

      /* ---------- Message operations ---------- */
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        displayOptions: { show: { resource: ["message"] } },
        options: [
          { name: "Send Text", value: "sendMessage", action: "Send a text message" },
          { name: "Send Photo", value: "sendPhoto", action: "Send a photo" },
          { name: "Send Document", value: "sendDocument", action: "Send a file" },
          { name: "Edit Text", value: "editMessageText", action: "Edit a message" },
          { name: "Delete", value: "deleteMessage", action: "Delete a message" },
          { name: "Answer Callback Query", value: "answerCallbackQuery", action: "Answer an inline button" },
        ],
        default: "sendMessage",
      },

      /* ---------- Bot operations ---------- */
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        displayOptions: { show: { resource: ["bot"] } },
        options: [
          { name: "Get Me", value: "getMe", action: "Get bot info" },
          { name: "Get Updates", value: "getUpdates", action: "Poll updates" },
        ],
        default: "getMe",
      },

      /* ---------- Webhook operations ---------- */
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        displayOptions: { show: { resource: ["webhook"] } },
        options: [
          { name: "Set Webhook", value: "setWebhook", action: "Set webhook URL" },
          { name: "Delete Webhook", value: "deleteWebhook", action: "Delete webhook" },
          { name: "Get Webhook Info", value: "getWebhookInfo", action: "Get webhook info" },
        ],
        default: "getWebhookInfo",
      },

      /* ---------- Common fields ---------- */
      {
        displayName: "Chat ID",
        name: "chatId",
        type: "string",
        default: "",
        required: true,
        displayOptions: {
          show: {
            resource: ["message"],
            operation: ["sendMessage", "sendPhoto", "sendDocument", "editMessageText", "deleteMessage"],
          },
        },
        description: "شناسهٔ چت مقصد (مثلاً ={{ $json.message.chat.id }})",
      },
      {
        displayName: "Text",
        name: "text",
        type: "string",
        typeOptions: { rows: 4 },
        default: "",
        required: true,
        displayOptions: { show: { resource: ["message"], operation: ["sendMessage", "editMessageText"] } },
      },
      {
        displayName: "Message ID",
        name: "messageId",
        type: "string",
        default: "",
        required: true,
        displayOptions: { show: { resource: ["message"], operation: ["editMessageText", "deleteMessage"] } },
      },
      {
        displayName: "Callback Query ID",
        name: "callbackQueryId",
        type: "string",
        default: "",
        required: true,
        displayOptions: { show: { resource: ["message"], operation: ["answerCallbackQuery"] } },
      },
      {
        displayName: "Caption",
        name: "caption",
        type: "string",
        default: "",
        displayOptions: { show: { resource: ["message"], operation: ["sendPhoto", "sendDocument"] } },
      },
      {
        displayName: "Input Type",
        name: "inputType",
        type: "options",
        options: [
          { name: "URL / File ID", value: "url" },
          { name: "Binary Data", value: "binary" },
        ],
        default: "url",
        displayOptions: { show: { resource: ["message"], operation: ["sendPhoto", "sendDocument"] } },
      },
      {
        displayName: "File URL or file_id",
        name: "fileUrl",
        type: "string",
        default: "",
        displayOptions: { show: { resource: ["message"], operation: ["sendPhoto", "sendDocument"], inputType: ["url"] } },
      },
      {
        displayName: "Binary Property",
        name: "binaryProperty",
        type: "string",
        default: "data",
        displayOptions: { show: { resource: ["message"], operation: ["sendPhoto", "sendDocument"], inputType: ["binary"] } },
      },
      {
        displayName: "Webhook URL",
        name: "webhookUrl",
        type: "string",
        default: "",
        required: true,
        displayOptions: { show: { resource: ["webhook"], operation: ["setWebhook"] } },
      },
      {
        displayName: "Additional Fields",
        name: "additionalFields",
        type: "collection",
        placeholder: "Add Field",
        default: {},
        displayOptions: { show: { resource: ["message"], operation: ["sendMessage", "sendPhoto", "sendDocument"] } },
        options: [
          { displayName: "Reply To Message ID", name: "reply_to_message_id", type: "number", default: 0 },
          {
            displayName: "Reply Markup (JSON)",
            name: "reply_markup",
            type: "json",
            default: "",
            description: "کیبورد اینلاین/معمولی به‌صورت JSON",
          },
          { displayName: "Disable Notification", name: "disable_notification", type: "boolean", default: false },
        ],
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const resource = this.getNodeParameter("resource", 0) as string;
    const operation = this.getNodeParameter("operation", 0) as string;

    for (let i = 0; i < items.length; i++) {
      try {
        let result: IDataObject = {};

        /* ===== Message ===== */
        if (resource === "message") {
          const additional = (this.getNodeParameter("additionalFields", i, {}) as IDataObject) ?? {};
          if (typeof additional.reply_markup === "string" && additional.reply_markup) {
            additional.reply_markup = JSON.parse(additional.reply_markup as string);
          }
          if (!additional.reply_to_message_id) delete additional.reply_to_message_id;

          if (operation === "sendMessage") {
            result = await baleApiRequest.call(this, "sendMessage", {
              chat_id: this.getNodeParameter("chatId", i) as string,
              text: this.getNodeParameter("text", i) as string,
              ...additional,
            });
          } else if (operation === "sendPhoto" || operation === "sendDocument") {
            const chatId = this.getNodeParameter("chatId", i) as string;
            const caption = this.getNodeParameter("caption", i, "") as string;
            const inputType = this.getNodeParameter("inputType", i) as string;
            const field = operation === "sendPhoto" ? "photo" : "document";

            if (inputType === "binary") {
              const prop = this.getNodeParameter("binaryProperty", i) as string;
              const binary = this.helpers.assertBinaryData(i, prop);
              const buffer = await this.helpers.getBinaryDataBuffer(i, prop);
              result = await baleApiUpload.call(this, operation, field, buffer, binary.fileName ?? "file", {
                chat_id: chatId,
                caption,
                ...additional,
              });
            } else {
              result = await baleApiRequest.call(this, operation, {
                chat_id: chatId,
                [field]: this.getNodeParameter("fileUrl", i) as string,
                caption,
                ...additional,
              });
            }
          } else if (operation === "editMessageText") {
            result = await baleApiRequest.call(this, "editMessageText", {
              chat_id: this.getNodeParameter("chatId", i) as string,
              message_id: Number(this.getNodeParameter("messageId", i)),
              text: this.getNodeParameter("text", i) as string,
            });
          } else if (operation === "deleteMessage") {
            result = await baleApiRequest.call(this, "deleteMessage", {
              chat_id: this.getNodeParameter("chatId", i) as string,
              message_id: Number(this.getNodeParameter("messageId", i)),
            });
          } else if (operation === "answerCallbackQuery") {
            result = await baleApiRequest.call(this, "answerCallbackQuery", {
              callback_query_id: this.getNodeParameter("callbackQueryId", i) as string,
            });
          }
        }

        /* ===== Bot ===== */
        if (resource === "bot") {
          result = await baleApiRequest.call(this, operation, {}, "GET");
        }

        /* ===== Webhook ===== */
        if (resource === "webhook") {
          if (operation === "setWebhook") {
            result = await baleApiRequest.call(this, "setWebhook", {
              url: this.getNodeParameter("webhookUrl", i) as string,
            });
          } else {
            result = await baleApiRequest.call(this, operation, {}, "GET");
          }
        }

        returnData.push({ json: typeof result === "object" ? result : { result }, pairedItem: { item: i } });
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
          continue;
        }
        throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
      }
    }
    return [returnData];
  }
}
