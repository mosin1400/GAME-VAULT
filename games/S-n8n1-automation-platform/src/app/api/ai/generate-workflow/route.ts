// ==========================================================================
// AI Workflow Builder: ساخت Workflow با توصیف زبان طبیعی
// اگر OPENAI_API_KEY تنظیم شده باشد، از مدل زبانی برای تولید JSON استفاده
// می‌شود؛ در غیر این‌صورت یک الگوی ابتدایی heuristic بر اساس کلیدواژه‌ها ساخته
// می‌شود تا تجربه بدون کلید API هم کار کند.
// ==========================================================================
import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import type { WorkflowEdge, WorkflowNode } from "@/lib/workflow/types";

function makeNode(type: string, name: string, x: number, y: number, parameters: Record<string, unknown> = {}): WorkflowNode {
  return { id: nanoid(8), type: "automationNode", position: { x, y }, data: { id: nanoid(8), type, name, parameters } };
}

function heuristicWorkflow(prompt: string) {
  const lower = prompt.toLowerCase();
  const nodes: WorkflowNode[] = [];
  const edges: WorkflowEdge[] = [];
  let x = 80;
  const y = 160;

  const trigger = lower.includes("webhook") || lower.includes("وب‌هوک")
    ? makeNode("webhookTrigger", "Webhook", x, y, { path: "generated", method: "POST" })
    : lower.includes("زمان") || lower.includes("هر روز") || lower.includes("schedule") || lower.includes("cron")
      ? makeNode("scheduleTrigger", "زمان‌بندی", x, y, { cronExpression: "0 9 * * *" })
      : makeNode("manualTrigger", "شروع دستی", x, y);
  nodes.push(trigger);
  x += 260;

  let previous = trigger;
  const connect = (next: WorkflowNode) => {
    edges.push({ id: nanoid(8), source: previous.id, target: next.id });
    nodes.push(next);
    previous = next;
    x += 260;
  };

  if (lower.includes("http") || lower.includes("api")) {
    connect(makeNode("httpRequest", "HTTP Request", x, y, { method: "GET", url: "https://api.example.com" }));
  }
  if (lower.includes("if") || lower.includes("شرط")) {
    connect(makeNode("if", "شرط", x, y));
  }
  if (lower.includes("bale") || lower.includes("بله")) {
    connect(makeNode("baleMessenger", "بله", x, y, { text: "{{$json.message}}" }));
  }
  if (lower.includes("سروش") || lower.includes("soroush")) {
    connect(makeNode("soroushMessenger", "سروش", x, y, { body: "{{$json.message}}" }));
  }
  if (lower.includes("تلگرام") || lower.includes("telegram")) {
    connect(makeNode("telegram", "Telegram", x, y, { text: "{{$json.message}}" }));
  }
  if (lower.includes("slack")) {
    connect(makeNode("slack", "Slack", x, y, { text: "{{$json.message}}" }));
  }
  if (lower.includes("ایمیل") || lower.includes("email")) {
    connect(makeNode("sendEmail", "Email", x, y));
  }
  if (lower.includes("ai") || lower.includes("هوش مصنوعی") || lower.includes("gpt")) {
    connect(makeNode("aiAgent", "AI Agent", x, y, { userMessage: "{{$json.message}}" }));
  }
  if (nodes.length === 1) {
    connect(makeNode("set", "تنظیم فیلدها", x, y));
  }

  return { name: prompt.slice(0, 60) || "Workflow تولیدشده با AI", nodes, edges };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const prompt = String(body.prompt || "").trim();
  if (!prompt) return Response.json({ error: "prompt الزامی است" }, { status: 400 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content:
                "شما یک سازنده‌ی Workflow اتوماسیون هستید. فقط یک JSON خام با فرمت {name, nodes:[{type,name,parameters}], edges:[{from,to}]} برگردانید. انواع نود مجاز: manualTrigger, webhookTrigger, scheduleTrigger, httpRequest, code, set, if, switch, filter, merge, slack, telegram, baleMessenger, soroushMessenger, sendEmail, aiAgent, postgresQuery. بدون توضیح اضافه، فقط JSON.",
            },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
        }),
      });
      const json = await res.json();
      const content = json?.choices?.[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        const nodes: WorkflowNode[] = (parsed.nodes || []).map((n: { type: string; name?: string; parameters?: Record<string, unknown> }, i: number) =>
          makeNode(n.type, n.name || n.type, 80 + i * 260, 160, n.parameters || {}),
        );
        const edges: WorkflowEdge[] = (parsed.edges || []).map((e: { from: number; to: number }) => ({
          id: nanoid(8),
          source: nodes[e.from]?.id,
          target: nodes[e.to]?.id,
        })).filter((e: WorkflowEdge) => e.source && e.target);
        return Response.json({ name: parsed.name || prompt.slice(0, 60), nodes, edges, aiGenerated: true });
      }
    } catch {
      // در صورت خطا، به روش heuristic برمی‌گردیم
    }
  }

  const generated = heuristicWorkflow(prompt);
  return Response.json({ ...generated, aiGenerated: false });
}
