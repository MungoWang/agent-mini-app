import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type {
  AgentRunOptions,
  AppCallContext,
  HostCapabilities,
  LlmRunOptions,
} from "@monkey-mini-app/host";

import { runDshAgentOneShot } from "./agent-one-shot.ts";
import { getService, isRecord, toolsOf, type DshCtx, type DshLlmService } from "./ctx.ts";
import { resolveLlmRoute } from "./llm-route.ts";
import { collectLlmStream, stringifyToolResult } from "./llm-stream.ts";

const execFileAsync = promisify(execFile);

type ExecFileError = {
  stdout?: string;
  stderr?: string;
  code?: number | string;
};

export function listDshTools(ctx: DshCtx): Array<Record<string, unknown>> {
  try {
    const t = toolsOf(ctx);
    if (typeof t?.schemas === "function") {
      const list = t.schemas();
      if (Array.isArray(list)) {
        return list.map((x) => ({
          name: String(x.name || ""),
          description: String(x.description || ""),
          parameters: x.parameters ?? { type: "object", properties: {} },
        }));
      }
    }
    return [];
  } catch {
    return [];
  }
}

/** dsh ctx-facing capabilities. Fail loud when the host has no llm/agent/tool/mcp. */
export class DshCapabilities implements HostCapabilities {
  constructor(private readonly dsh: DshCtx) {}

  async bash(
    _ctx: AppCallContext,
    command: string,
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    try {
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
    } catch (cause) {
      const err = cause as ExecFileError;
      const exitCode = typeof err.code === "number" ? err.code : 1;
      return {
        stdout: String(err.stdout ?? ""),
        stderr: String(err.stderr ?? (cause instanceof Error ? cause.message : String(cause))),
        exitCode,
      };
    }
  }

  async llm(ctx: AppCallContext, prompt: string, opts?: LlmRunOptions): Promise<string> {
    const llmSvc =
      getService(this.dsh, "llm") || getService(this.dsh, "model") || getService(this.dsh, "chat");
    const route = resolveLlmRoute(this.dsh, opts, ctx.hostLlm);
    if (isRecord(llmSvc) && typeof llmSvc.stream === "function") {
      return collectLlmStream(llmSvc as DshLlmService, prompt, route, opts);
    }
    if (typeof llmSvc === "function") {
      return stringifyToolResult(
        await (llmSvc as (p: string, o?: unknown) => Promise<unknown>)(prompt, opts),
      );
    }
    throw new Error("llm: no dsh model service bound (ctx.llm)");
  }

  async agent(ctx: AppCallContext, goal: string, opts?: AgentRunOptions): Promise<string> {
    const agents = getService(this.dsh, "agents") || getService(this.dsh, "subagents");
    if (isRecord(agents) && typeof agents.run === "function") {
      return stringifyToolResult(
        await (agents.run as (g: string, o?: unknown) => Promise<unknown>)(goal, opts),
      );
    }
    if (isRecord(agents) && typeof agents.spawn === "function") {
      return stringifyToolResult(
        await (agents.spawn as (o: unknown) => Promise<unknown>)({ goal, ...(opts || {}) }),
      );
    }
    return runDshAgentOneShot(this.dsh, goal, opts, { callCtx: ctx });
  }

  async tool(
    _ctx: AppCallContext,
    name: string,
    args?: Record<string, unknown>,
  ): Promise<unknown> {
    const tools = toolsOf(this.dsh);
    if (!tools) throw new Error("tool: no dsh tools service");
    const t = typeof tools.get === "function" ? tools.get(name) : undefined;
    if (isRecord(t) && typeof t.execute === "function") {
      return stringifyToolResult(
        await (t.execute as (a: unknown) => Promise<unknown>)(args || {}),
      );
    }
    throw new Error(`tool not found: ${name}`);
  }

  async mcp(
    _ctx: AppCallContext,
    name: string,
    args?: Record<string, unknown>,
  ): Promise<unknown> {
    const mcpSvc = getService(this.dsh, "mcp");
    if (!mcpSvc) throw new Error("mcp: no dsh mcp service");
    const call = isRecord(mcpSvc)
      ? typeof mcpSvc.call === "function"
        ? mcpSvc.call
        : mcpSvc.execute
      : undefined;
    if (typeof call !== "function") throw new Error("mcp: service has no call");
    return stringifyToolResult(await (call as (n: string, a?: unknown) => Promise<unknown>)(name, args));
  }

  credentials(_ctx: AppCallContext): Record<string, string> {
    const cred = getService(this.dsh, "credentials");
    if (!cred) return {};
    if (isRecord(cred) && typeof cred.getAll === "function") {
      const all = (cred.getAll as () => Record<string, string>)() || {};
      return { ...all };
    }
    if (isRecord(cred)) {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(cred)) {
        if (typeof v === "string") out[k] = v;
      }
      return out;
    }
    return {};
  }

  config(_ctx: AppCallContext): Record<string, unknown> {
    const cfg = getService(this.dsh, "config");
    return isRecord(cfg) ? { ...cfg } : {};
  }

  listTools(_ctx: AppCallContext): unknown[] {
    return listDshTools(this.dsh);
  }
}
