/** @monkey-mini-app/host-core — LLM 流 / 工具结果序列化 / 路由（agent 无关）。 */
import { readHostConfig, type HostConfig } from "./host-config.js";

let hostRuntimeRoot = "";

/** 注入 host runtime root（组合根在接入层调用：dsh apply / PI 启动）。 */
export function setHostRuntimeRoot(root: string): void {
  hostRuntimeRoot = root;
}

export function stringifyToolResult(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/** Live runtime root + bound port so ctx.config / llm routing never dump dsh settings. */

function currentHostConfig(): HostConfig {
  return readHostConfig(hostRuntimeRoot);
}

export function resolveLlmRoute(opts?: Record<string, unknown>) {
  const file = currentHostConfig();
  const provider =
    (typeof opts?.provider === "string" && opts.provider) || file.llm.provider;
  const model =
    (typeof opts?.model === "string" && opts.model) || file.llm.model;
  return { provider, model };
}

export function withJsonInstruction(prompt: string, opts?: Record<string, unknown>) {
  if (!opts || opts.schema == null) {
    return { prompt, system: typeof opts?.system === "string" ? opts.system : undefined };
  }
  const schemaText = JSON.stringify(opts.schema);
  const system = [
    typeof opts.system === "string" ? opts.system : "",
    "Return ONLY a JSON object matching this JSON Schema. No markdown fences, no preamble.",
    schemaText,
  ]
    .filter(Boolean)
    .join("\n\n");
  return { prompt, system };
}

/** When opts.schema is set, peel markdown / preamble so JSON.parse in apps can succeed. */
export function coerceSchemaJson(text: string, opts?: Record<string, unknown>): string {
  if (!opts || opts.schema == null) return text;
  const t = String(text || "").trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1].trim() : t;
  if (body.startsWith("{") || body.startsWith("[")) return body;
  const startObj = body.indexOf("{");
  const endObj = body.lastIndexOf("}");
  if (startObj >= 0 && endObj > startObj) return body.slice(startObj, endObj + 1);
  const startArr = body.indexOf("[");
  const endArr = body.lastIndexOf("]");
  if (startArr >= 0 && endArr > startArr) return body.slice(startArr, endArr + 1);
  return body;
}
