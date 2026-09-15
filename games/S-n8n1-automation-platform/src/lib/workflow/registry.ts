// ==========================================================================
// رجیستری مرکزی نودها: ترکیب همه‌ی نودهای قابل‌اجرا + کاتالوگ گسترده
// ==========================================================================
import type { CatalogEntry, NodeDefinition, NodeGroup } from "./types";
import { coreNodes } from "./nodes/core";
import { networkNodes } from "./nodes/network";
import { messagingNodes } from "./nodes/messaging";
import { databaseNodes } from "./nodes/database";
import { aiNodes } from "./nodes/ai";
import { productivityNodes } from "./nodes/productivity";
import { subWorkflowNodes } from "./nodes/subworkflow";

export const executableNodes: NodeDefinition[] = [
  ...coreNodes,
  ...networkNodes,
  ...messagingNodes,
  ...databaseNodes,
  ...aiNodes,
  ...productivityNodes,
  ...subWorkflowNodes,
];

const executableByType = new Map(executableNodes.map((n) => [n.type, n]));

export function getNodeDefinition(type: string): NodeDefinition | undefined {
  return executableByType.get(type);
}

// --------------------------------------------------------------------------
// کاتالوگ گسترده: فهرست بزرگی از یکپارچه‌سازی‌ها/سرویس‌ها برای مرور در پنل
// نودها (بخشی اجرای واقعی دارند «executable: true»، بقیه به‌عنوان الگوی آماده
// برای پیکربندی سریع با HTTP Request ذخیره می‌شوند). این ساختار امکان توسعه‌ی
// آسان و افزودن Executor واقعی به هر مورد را در آینده فراهم می‌کند.
// --------------------------------------------------------------------------
interface CatalogSeed { name: string; category: string; group: NodeGroup; desc?: string }

const catalogSeeds: CatalogSeed[] = [
  // ارتباطات و پیام‌رسان‌ها
  ...["Microsoft Teams", "Mattermost", "WhatsApp Business", "Rocket.Chat", "Signal", "Viber", "WeChat Work", "LINE", "Zalo"]
    .map((name) => ({ name, category: "Communication", group: "communication" as NodeGroup })),
  // مدیریت پروژه
  ...["Jira", "Trello", "Asana", "Monday.com", "ClickUp", "Linear", "Basecamp", "Wrike", "Smartsheet"]
    .map((name) => ({ name, category: "Project Management", group: "productivity" as NodeGroup })),
  ...["Notion", "Todoist", "Evernote", "Coda", "Airtable", "OneNote"]
    .map((name) => ({ name, category: "Productivity", group: "productivity" as NodeGroup })),
  // Google Workspace
  ...["Google Sheets", "Google Drive", "Gmail", "Google Calendar", "Google Docs", "Google Slides", "Google Tasks", "Google Analytics", "BigQuery", "Google Forms", "Google Contacts"]
    .map((name) => ({ name, category: "Google Workspace", group: "productivity" as NodeGroup })),
  // Microsoft 365
  ...["Excel Online", "Outlook", "OneDrive", "SharePoint", "Dynamics 365", "Microsoft SQL Server", "Microsoft Entra (Azure AD)", "Teams Calendar", "Power BI"]
    .map((name) => ({ name, category: "Microsoft 365", group: "productivity" as NodeGroup })),
  // CRM و فروش
  ...["HubSpot", "Salesforce", "Pipedrive", "Zoho CRM", "ActiveCampaign", "Copper", "Freshsales", "Close CRM"]
    .map((name) => ({ name, category: "CRM & Sales", group: "productivity" as NodeGroup })),
  // مارکتینگ و ایمیل
  ...["Mailchimp", "SendGrid", "Brevo", "ConvertKit", "GetResponse", "MailerLite", "Klaviyo", "Customer.io"]
    .map((name) => ({ name, category: "Marketing & Email", group: "communication" as NodeGroup })),
  // دیتابیس‌ها
  ...["MySQL", "MongoDB", "Microsoft SQL", "SQLite", "Supabase", "CockroachDB", "Redis", "Cassandra", "MariaDB", "Elasticsearch"]
    .map((name) => ({ name, category: "Database", group: "database" as NodeGroup })),
  ...["Pinecone", "Weaviate", "Milvus", "Qdrant", "Chroma"]
    .map((name) => ({ name, category: "Vector Databases (RAG)", group: "ai" as NodeGroup })),
  // ذخیره‌سازی فایل
  ...["Google Drive", "OneDrive", "Dropbox", "Nextcloud", "Seafile", "Box", "FTP", "SFTP", "AWS S3", "MinIO"]
    .map((name) => ({ name, category: "Cloud Storage & Files", group: "database" as NodeGroup })),
  // DevOps
  ...["GitLab", "Bitbucket", "Docker", "Kubernetes", "PagerDuty", "ServiceNow", "Jenkins", "CircleCI", "Datadog", "Grafana", "Sentry"]
    .map((name) => ({ name, category: "Development & DevOps", group: "devops" as NodeGroup })),
  // تجارت الکترونیک و پرداخت
  ...["Shopify", "WooCommerce", "Amazon", "Stripe", "PayPal", "Square", "Magento", "BigCommerce", "Zarinpal", "IDPay"]
    .map((name) => ({ name, category: "E-Commerce & Payments", group: "productivity" as NodeGroup })),
  // AI/LLM providers
  ...["OpenAI", "Anthropic Claude", "Google Gemini", "Codex", "Ollama (Local LLM)", "Cohere", "Mistral AI", "HuggingFace", "Azure OpenAI", "Perplexity"]
    .map((name) => ({ name, category: "AI Providers", group: "ai" as NodeGroup })),
  // IoT/شبکه
  ...["CoAP", "OPC-UA", "BACnet", "Zigbee Gateway", "LoRaWAN"]
    .map((name) => ({ name, category: "IoT & Network", group: "iot" as NodeGroup })),
];

export const catalog: CatalogEntry[] = [
  ...executableNodes.map((n) => ({
    type: n.type,
    name: n.name,
    category: n.category,
    group: n.group,
    description: n.description,
    executable: true,
  })),
  ...catalogSeeds.map((seed) => ({
    type: `template:${seed.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    name: seed.name,
    category: seed.category,
    group: seed.group,
    description: seed.desc || `اتصال به ${seed.name} (قالب آماده – برای اجرای واقعی از HTTP Request یا Credential اختصاصی استفاده کنید)`,
    executable: false,
  })),
];

export function getCategories(): string[] {
  return Array.from(new Set(catalog.map((c) => c.category)));
}
