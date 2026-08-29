/** @monkey-mini-app/host-core — 工具暴露层：host 能力 → agent 工具定义（agent 无关）。
 *  基于 agent-core 的 mini_app_* 协议 + host-core 的 dashboard 执行引擎。
 *  adapter 只做「注册粘合」（dsh: defineTool → ctx.tools；PI: 对应工具 API）。
 *  AOP：统一 exec 管线带 before/after/error 切面——`on(phase, name?, handler)` 订阅
 *  （createHost 组装时订阅 app:open 等；adapter 订阅自己的副作用——execute 本身零污染）。 */
import { createAgentHandlers, listAgentTools, invokeAgentTool } from "./agent-handlers.js";
import type { AppsManager } from "./apps.js";

export type ToolDefinition = {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  execute?: (args: Record<string, unknown>, signal?: AbortSignal) => Promise<unknown>;
};

export type ToolHookContext = {
  name: string;
  args: Record<string, unknown>;
  signal?: AbortSignal;
  result?: unknown; // after 阶段有
};

export type ToolPhase = "before" | "after" | "error";

export type ToolHookHandler = (ctx: ToolHookContext, error?: unknown) => void | Promise<void>;

export type MiniAppTools = {
  tools: ToolDefinition[];
  invoke(name: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<unknown>;
  /** 工具执行切面订阅（AOP）：phase + 可选工具名 + handler；返回注销函数。 */
  on(phase: ToolPhase, name: string | undefined, handler: ToolHookHandler): () => void;
};

/** 基于 runtime + apps 生成 mini_app_* 工具（mini_app_call 走 dashboard 引擎）。 */
export function createMiniAppTools(runtime: {
  listApps(): Promise<unknown[]>;
  getApp(id: string): Promise<unknown>;
  registerAppFromFiles(id: string, files: Record<string, string>): Promise<unknown>;
  openTab(id: string, opts?: { title?: string }): Promise<unknown>;
  closeTab(tabId: string): Promise<void>;
  listTabs(): Promise<unknown[]>;
}, apps: AppsManager, runtimeRoot: string): MiniAppTools {
  const handlers = createAgentHandlers({
    runtime: runtime as never,
    runtimeRoot,
    resolveAppDir: (id) => apps.dirOf(id),
  });
  // mini_app_call 由 dashboard 执行引擎提供（agent 无关，不走模型协议）
  (handlers as unknown as { mini_app_call: (input: unknown, signal?: AbortSignal) => Promise<unknown> }).mini_app_call = async (
    input: unknown,
    signal?: AbortSignal
  ) => {
    const { appId, method, args } = input as { appId?: string; method?: string; args?: unknown };
    try {
      const value = await apps.call(apps.dirOf(String(appId || "")), String(method || ""), args ?? {}, signal);
      return { ok: true, value };
    } catch (e) {
      if (signal?.aborted) return { ok: false, error: "cancelled", cancelled: true };
      return { ok: false, error: String((e as Error)?.message || e) };
    }
  };

  // —— AOP 管线：before/after/error 切面（统一 exec，execute 与 invoke 都走）——
  const hooks: Array<{ phase: ToolPhase; name?: string; handler: ToolHookHandler }> = [];
  const runHooks = async (phase: ToolPhase, ctx: ToolHookContext, error?: unknown) => {
    for (const h of hooks) {
      if (h.phase !== phase) continue;
      if (h.name !== undefined && h.name !== ctx.name) continue;
      await h.handler(ctx, error);
    }
  };

  const exec = async (name: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<unknown> => {
    const ctx: ToolHookContext = { name, args, signal };
    await runHooks("before", ctx);
    try {
      ctx.result = await invokeAgentTool(handlers, name, args ?? {}, signal);
      await runHooks("after", ctx);
      return ctx.result;
    } catch (e) {
      await runHooks("error", ctx, e);
      throw e;
    }
  };

  // 工具定义自带 execute（走统一 exec 管线——切面对 execute 和 invoke 一致生效）
  const tools: ToolDefinition[] = listAgentTools().map((t) => ({
    ...t,
    execute: (args, signal) => exec(t.name, args ?? {}, signal),
  }));

  return {
    tools,
    invoke: (name, args, signal) => exec(name, args ?? {}, signal),
    on(phase, name, handler) {
      hooks.push({ phase, name, handler });
      return () => {
        const i = hooks.indexOf({ phase, name, handler } as never);
        if (i >= 0) hooks.splice(i, 1);
      };
    },
  };
}
