// ==========================================================================
// Expression Editor ساده: پردازش عبارات {{ }} درون پارامترهای نود
// مثال: "سلام {{$json.name}}" یا "{{$json.price * 1.09}}"
// ==========================================================================
import type { FlowItem } from "./types";

export interface ExpressionScope {
  $json: Record<string, unknown>;
  $item: FlowItem;
  $index: number;
  $vars: Record<string, string>;
  $items: FlowItem[];
  $now: string;
}

function evalExpression(expr: string, scope: ExpressionScope): unknown {
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(
      "$json",
      "$item",
      "$index",
      "$vars",
      "$items",
      "$now",
      `"use strict"; return (${expr});`,
    );
    return fn(scope.$json, scope.$item, scope.$index, scope.$vars, scope.$items, scope.$now);
  } catch (err) {
    return `#EXPR_ERROR: ${(err as Error).message}`;
  }
}

/** جایگزینی همه‌ی الگوهای {{ ... }} درون یک رشته */
function resolveString(template: string, scope: ExpressionScope): unknown {
  const fullMatch = template.match(/^\{\{([\s\S]*)\}\}$/);
  if (fullMatch) {
    // کل رشته یک عبارت است -> نوع اصلی مقدار (عدد، شی، ...) حفظ شود
    return evalExpression(fullMatch[1], scope);
  }
  return template.replace(/\{\{([\s\S]*?)\}\}/g, (_m, expr) => {
    const value = evalExpression(expr, scope);
    return typeof value === "string" ? value : JSON.stringify(value);
  });
}

/** به‌صورت بازگشتی درون شیء/آرایه/رشته عبارات را resolve می‌کند */
export function resolveExpressionDeep(input: unknown, scope: ExpressionScope): unknown {
  if (typeof input === "string") {
    return resolveString(input, scope);
  }
  if (Array.isArray(input)) {
    return input.map((v) => resolveExpressionDeep(v, scope));
  }
  if (input && typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      out[k] = resolveExpressionDeep(v, scope);
    }
    return out;
  }
  return input;
}

export function buildScope(item: FlowItem, index: number, allItems: FlowItem[], vars: Record<string, string>): ExpressionScope {
  return {
    $json: item?.json ?? {},
    $item: item,
    $index: index,
    $vars: vars,
    $items: allItems,
    $now: new Date().toISOString(),
  };
}
