/** dsh-plugin 适配层：HostAdapter 实现（dsh 唯一 agent 耦合点）。
 *  能力（bash/llm/agent/tool/mcp）从 dsh ctx 取；工具注册（defineTool）在 attach；
 *  llm/agent 不兜底：宿主无能力则明确失败（删除自造 provider/harness）。 */
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import {
  stringifyToolResult,
  withJsonInstruction,
  coerceSchemaJson,
  type HostAdapter,
  type HostCapabilities,
  type HostServices,
  type ToolDefinition,
  createUiCore,
} from "@monkey-mini-app/host-core";
import { getSkillDir, getSkillMarkdown } from "./skills.js";

type LooseCtx = {
  tools?: {
    register: (tool: unknown) => void | (() => void);
    get?: (name: string) => unknown;
  };
  get?: (name: string) => unknown;
  provide?: (key: string, value: unknown) => void;
  [key: string]: unknown;
};

/** dsh 流格式收集：只收 text-delta + block-end（忽略 reasoning-* / usage）。 */
async function collectLlmStream(
  llmSvc: { stream: (req: unknown) => AsyncIterable<unknown> },
  prompt: string,
  route: { provider: string; model: string },
  opts?: Record<string, unknown>
) {
  const { prompt: text, system } = withJsonInstruction(prompt, opts);
  const req = {
    provider: route.provider,
    model: route.model,
    messages: [{ role: "user", content: [{ type: "text", text }] }],
    system,
    maxTokens: (opts && opts.maxTokens) || 1024,
  };
  const acc: string[] = [];
  let sawDelta = false;
  for await (const chunk of llmSvc.stream(req) as AsyncIterable<any>) {
    if (!chunk) continue;
    const type = chunk.type;
    if (type === "text-delta" && typeof chunk.text === "string") {
      sawDelta = true;
      acc.push(chunk.text);
    } else if (type === "block-end" && chunk.block && typeof chunk.block.text === "string") {
      if (!sawDelta) acc.push(chunk.block.text);
    }
  }
  const out = acc.join("");
  if (!out) throw new Error("llm stream empty");
  return coerceSchemaJson(out, opts);
}

/** 安全枚举 dsh 工具：register 可用但服务 Proxy 不可遍历（Object.keys 触发 inject 检查）——
 *  枚举失败返回 []（工具标签页友好降级，不抛错）。 */
/** 枚举 dsh 工具：ToolRuntime 公开 API 是 schemas(scope?)（工具 schema 清单）——
 *  用 schemas() 拿真实工具列表（read/write/bash/mcp + mini_app_*）；失败降级 []。 */
function safeListTools(ctx: LooseCtx): Array<Record<string, unknown>> {
  try {
    const t = toolsOf(ctx) as {
      schemas?: (scope?: unknown) => Array<{ name?: string; description?: string; parameters?: Record<string, unknown> }>;
    } | undefined;
    if (typeof t?.schemas === "function") {
      const list = t.schemas();
      if (Array.isArray(list)) {
        // ToolSchema = { name, description, parameters(JSON Schema) }——完整带出参数定义
        return list.map((x) => ({
          name: String(x.name || ""),
          description: String(x.description || ""),
          parameters: x.parameters ?? null,
        }));
      }
    }
    return [];
  } catch {
    return [];
  }
}

/** cordis 服务访问：ctx.<name> 属性（inject 声明注入）优先；get 兜底（registry 服务）。 */
function toolsOf(ctx: LooseCtx): unknown {
  const direct = (ctx as Record<string, unknown>).tools;
  if (direct !== undefined) return direct;
  try {
    if (typeof ctx.get === "function") return ctx.get("tools");
  } catch {
    /* ignore */
  }
  return undefined;
}

export function buildDshAdapter(ctx: LooseCtx, opts: { runtimeRoot: string }): HostAdapter {
  const get = (name: string) => {
    try {
      if (typeof ctx.get === "function") return ctx.get(name);
    } catch {
      /* ignore */
    }
    return (ctx as Record<string, unknown>)[name];
  };

  // —— 宿主能力（app ctx 数据源；llm/agent 走宿主，不兜底）——
  const caps: HostCapabilities = {
    bash: async (command) => {
      const { execFile } = await import("node:child_process");
      const { promisify } = await import("node:util");
      const execFileAsync = promisify(execFile);
      const { stdout, stderr } = await execFileAsync("bash", ["-c", command], {
        timeout: 120_000,
        maxBuffer: 8 * 1024 * 1024,
        env: process.env,
      });
      return {
        stdout: String(stdout ?? ""),
        stderr: String(stderr ?? ""),
        exitCode: 0,
      };
    },
    llm: async (prompt, opts) => {
      const llmSvc = get("llm") || get("model") || get("chat");
      const route = resolveLlmRoute(ctx, opts);
      if (llmSvc && typeof (llmSvc as { stream?: unknown }).stream === "function") {
        try {
          return await collectLlmStream(llmSvc as { stream: (r: unknown) => AsyncIterable<unknown> }, prompt, route, opts);
        } catch (e) {
          console.warn("[mini-api] ctx.llm.stream failed", e instanceof Error ? e.message : e);
        }
      }
      if (typeof llmSvc === "function") {
        return stringifyToolResult(await (llmSvc as (p: string, o?: unknown) => Promise<unknown>)(prompt, opts));
      }
      throw new Error("llm: no dsh model service bound (ctx.llm)");
    },
    // ctx.agent = 发起带 harness/tools 循环的任务。dsh 的 ctx.subagents 仅控制
    // 已运行子代理（followup/interrupt/listChildren），无 run/spawn 发起接口——
    // 有 run/spawn 则对接，否则明确失败（不自行用 llm 模拟 harness）。
    agent: async (goal, opts) => {
      const agents = get("agents") || get("subagents");
      if (agents && typeof (agents as { run?: unknown }).run === "function") {
        return stringifyToolResult(await (agents as { run: (g: string, o?: unknown) => Promise<unknown> }).run(goal, opts));
      }
      if (agents && typeof (agents as { spawn?: unknown }).spawn === "function") {
        return stringifyToolResult(await (agents as { spawn: (o: unknown) => Promise<unknown> }).spawn({ goal, ...(opts || {}) }));
      }
      throw new Error(
        "agent: dsh 无 agent 发起服务（ctx.subagents 仅 followup/interrupt 控制；发起由模型工具委派）。ctx.agent 在 dsh 下不可用，PI 接入时可提供。"
      );
    },
    tool: async (name, args) => {
      const tools = toolsOf(ctx);
      if (!tools) throw new Error("tool: no dsh tools service");
      const t = (tools as { get?: (n: string) => unknown }).get
        ? (tools as { get: (n: string) => unknown }).get(name)
        : (tools as Record<string, unknown>)[name];
      if (t && typeof (t as { execute?: unknown }).execute === "function") {
        return stringifyToolResult(await (t as { execute: (a: unknown, s?: { signal?: AbortSignal }) => Promise<unknown> }).execute(args || {}));
      }
      throw new Error(`tool not found: ${name}`);
    },
    mcp: async (name, args) => {
      const mcpSvc = get("mcp");
      if (!mcpSvc) throw new Error("mcp: no dsh mcp service");
      const call = (mcpSvc as { call?: unknown }).call
        ? (mcpSvc as { call: (n: string, a?: unknown) => Promise<unknown> }).call
        : (mcpSvc as Record<string, unknown>)["execute"];
      if (typeof call !== "function") throw new Error("mcp: service has no call");
      return stringifyToolResult(await call(name, args));
    },
    credentials: () => {
      const cred = get("credentials");
      if (!cred) return {};
      if (typeof (cred as { getAll?: unknown }).getAll === "function") return (cred as { getAll: () => Record<string, string> }).getAll() || {};
      if (typeof cred === "object") return { ...(cred as Record<string, string>) };
      return {};
    },
    config: () => {
      const cfg = get("config");
      if (cfg && typeof cfg === "object") return { ...(cfg as Record<string, unknown>) };
      return {};
    },
    listTools: () => safeListTools(ctx),
  };

  return {
    capabilities: () => caps,
    listTools: () => safeListTools(ctx),
    onHostPortChanged: () => {
      // client 从 /api/pending-open + host-config 感知端口；无额外动作
    },
    async attach(_ctx: unknown, services: HostServices) {
      // 1. 工具注册（services.tools 由 host-core 生成——mini_app_* 基于 runtime+apps）
      const defineTool = await loadDefineTool();
      registerTools(ctx, services.tools.tools, defineTool);
      // 2. extra 工具（ctx.tools 列表——dsh 特有）
      registerListCtxTools(ctx, defineTool);
      // 4. skill 安装
      installSkill();
      // 5. 服务暴露（其他 dsh 插件/诊断）
      if (typeof ctx.provide === "function") {
        ctx.provide("monkeyMiniApp", {
          runtime: services.runtime,
          tools: services.tools,
          runtimeRoot: opts.runtimeRoot,
          skillDir: getSkillDir(),
          skillMarkdown: getSkillMarkdown(),
          ui: (() => {
            const u = createUiCore(services.runtime as never);
            void u.refresh();
            return u;
          })(),
        });
      }
    },
  };
}

function resolveLlmRoute(ctx: LooseCtx, opts?: Record<string, unknown>): { provider: string; model: string } {
  const cfg = ctx.get ? (ctx.get("config") as { llm?: { provider?: string; model?: string } } | undefined) : undefined;
  const llm = cfg?.llm || {};
  return {
    provider: (typeof opts?.provider === "string" && opts.provider) || llm.provider || "deepseek-official",
    model: (typeof opts?.model === "string" && opts.model) || llm.model || "deepseek-v4-flash",
  };
}

function snapshotDshTools(tools: unknown): Array<Record<string, unknown>> {
  if (!tools) return [];
  const rows: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();
  const push = (raw: unknown, fallbackName?: string) => {
    const t = raw as { name?: unknown; title?: unknown; id?: unknown; description?: unknown };
    const name = String(t.name || t.title || t.id || fallbackName || "");
    if (!name || seen.has(name)) return;
    seen.add(name);
    rows.push({ name, description: String(t.description || "") });
  };
  const list = (tools as { list?: unknown }).list
    ? (tools as { list: () => unknown }).list()
    : undefined;
  if (Array.isArray(list)) {
    for (const item of list) push(item);
  } else {
    for (const key of Object.keys(tools as Record<string, unknown>)) {
      push((tools as Record<string, unknown>)[key], key);
    }
  }
  return rows;
}

async function loadDefineTool(): Promise<null | ((opts: Record<string, unknown>) => unknown)> {
  try {
    const mod = await import(/* @vite-ignore */ "@deepseek-ai/dsh-tools");
    return (mod as { defineTool?: (opts: Record<string, unknown>) => unknown }).defineTool ?? null;
  } catch {
    return null;
  }
}

function registerTools(
  ctx: LooseCtx,
  tools: ToolDefinition[],
  defineTool: null | ((opts: Record<string, unknown>) => unknown)
): Array<() => void> {
  const disposers: Array<() => void> = [];
  const toolsSvc = toolsOf(ctx) as { register?: (t: unknown) => void | (() => void) } | undefined;
  if (!toolsSvc?.register) {
    console.warn("[monkey-mini-app] ctx.tools missing; inject=['tools'] required for model-facing tools");
    return disposers;
  }
  for (const toolDef of tools) {
    const props = ((toolDef.inputSchema as { properties?: Record<string, { type?: string; description?: string }> } | undefined)?.properties ?? {}) as Record<string, { type?: string; description?: string }>;
    const required = new Set((toolDef.inputSchema as { required?: string[] } | undefined)?.required ?? []);
    const parameters: Record<string, unknown> = {};
    for (const [key, schema] of Object.entries(props)) {
      parameters[key] = {
        type: schema.type ?? "string",
        required: required.has(key),
        description: schema.description ?? key,
      };
    }
    const execute = async (args: Record<string, unknown>, toolCtx?: { signal?: AbortSignal }) => {
      return toolDef.execute ? await toolDef.execute(args ?? {}, toolCtx?.signal) : { ok: false, error: "no execute" };
    };
    const built = defineTool
      ? defineTool({
          name: toolDef.name,
          description: toolDef.description,
          parameters,
          output: { schema: { type: "object", additionalProperties: true }, render: (_a: unknown, v: unknown) => [{ type: "text", text: typeof v === "string" ? v : JSON.stringify(v, null, 2) }] },
          execute,
        })
      : {
          name: toolDef.name,
          description: toolDef.description,
          parameters,
          output: { schema: { type: "object", additionalProperties: true }, render: (_a: unknown, v: unknown) => [{ type: "text", text: JSON.stringify(v, null, 2) }] },
          execute,
        };
    try {
      const ret = toolsSvc.register(built);
      if (typeof ret === "function") disposers.push(ret);
    } catch (e) {
      console.warn(`[monkey-mini-app] tools.register failed for ${toolDef.name}:`, e);
    }
  }
  return disposers;
}

function registerListCtxTools(ctx: LooseCtx, _defineTool: null | ((opts: Record<string, unknown>) => unknown)) {
  const toolsSvc = toolsOf(ctx) as { register?: (t: unknown) => void | (() => void) } | undefined;
  if (!toolsSvc?.register) return;
  try {
    const extra = {
      name: "mini_app_list_ctx_tools",
      description: "List live dsh tools for ctx.tool(name, args) inside main.api.ts. Call ONLY when the app will use ctx.tool. Skip for storage/bash/llm-only apps.",
      parameters: {},
      output: {
        schema: { type: "object", additionalProperties: true },
        render: (_a: unknown, v: unknown) => [{ type: "text", text: typeof v === "string" ? v : JSON.stringify(v, null, 2) }],
      },
      async execute() {
        // cordis：ctx.tools 属性访问需 inject 声明——用 get("tools") 安全获取
        const toolsSvc = toolsOf(ctx);
        const listed = snapshotDshTools(toolsSvc);
        return {
          count: listed.length,
          note: "These names are for ctx.tool(name, args) inside main.api.ts. Prefer storage/bash/llm when possible.",
          tools: listed,
        };
      },
    };
    const ret = toolsSvc.register(extra);
    if (typeof ret === "function") return ret;
  } catch (e) {
    console.warn("[monkey-mini-app] register mini_app_list_ctx_tools failed", e);
  }
  return null;
}

function installSkill() {
  try {
    const skillSrc = getSkillDir();
    const skillDst = path.join(os.homedir(), ".dsh", "skills", "monkey-mini-app");
    fs.mkdirSync(path.dirname(skillDst), { recursive: true });
    fs.cpSync(skillSrc, skillDst, { recursive: true });
  } catch (e) {
    console.warn("[monkey-mini-app] skill install skipped:", e);
  }
}
