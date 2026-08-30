import type { JsonInstructOptions, LlmRunOptions, ModelRouteOptions } from "@monkey-mini-app/host";

import type { DshLlmService } from "./ctx.ts";

export function stringifyToolResult(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function withJsonInstruction(
  prompt: string,
  opts?: JsonInstructOptions,
): { prompt: string; system: string | undefined } {
  if (!opts || opts.schema == null) {
    return { prompt, system: opts?.system };
  }
  const schemaText = JSON.stringify(opts.schema);
  const system = [
    opts.system ?? "",
    "Return ONLY a JSON object matching this JSON Schema. No markdown fences, no preamble.",
    schemaText,
  ]
    .filter(Boolean)
    .join("\n\n");
  return { prompt, system };
}

/** When opts.schema is set, peel markdown / preamble so JSON.parse in apps can succeed. */
export function coerceSchemaJson(text: string, opts?: JsonInstructOptions): string {
  if (!opts || opts.schema == null) return text;
  const t = String(text || "").trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fence?.[1] ?? t).trim();
  if (body.startsWith("{") || body.startsWith("[")) return body;
  const startObj = body.indexOf("{");
  const endObj = body.lastIndexOf("}");
  if (startObj >= 0 && endObj > startObj) return body.slice(startObj, endObj + 1);
  const startArr = body.indexOf("[");
  const endArr = body.lastIndexOf("]");
  if (startArr >= 0 && endArr > startArr) return body.slice(startArr, endArr + 1);
  return body;
}

type LlmStreamChunk = {
  type?: unknown;
  text?: unknown;
  block?: { text?: unknown };
};

function asChunk(value: unknown): LlmStreamChunk | null {
  if (typeof value !== "object" || value === null) return null;
  return value as LlmStreamChunk;
}

/** dsh 流格式收集：只收 text-delta + block-end（忽略 reasoning-* / usage）。 */
export async function collectLlmStream(
  llmSvc: DshLlmService,
  prompt: string,
  route: Required<ModelRouteOptions>,
  opts?: LlmRunOptions,
): Promise<string> {
  const { prompt: text, system } = withJsonInstruction(prompt, opts);
  const req = {
    provider: route.provider,
    model: route.model,
    messages: [{ role: "user", content: [{ type: "text", text }] }],
    system,
    maxTokens: opts?.maxTokens ?? 1024,
  };
  const acc: string[] = [];
  let sawDelta = false;
  for await (const raw of llmSvc.stream(req)) {
    const chunk = asChunk(raw);
    if (!chunk) continue;
    const type = chunk.type;
    if (type === "text-delta" && typeof chunk.text === "string") {
      sawDelta = true;
      acc.push(chunk.text);
    } else if (
      type === "block-end" &&
      chunk.block &&
      typeof chunk.block.text === "string"
    ) {
      if (!sawDelta) acc.push(chunk.block.text);
    }
  }
  const out = acc.join("");
  if (!out) throw new Error("llm stream empty");
  return coerceSchemaJson(out, opts);
}
