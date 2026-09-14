import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type {
  AgentCapabilities,
  AgentRunOptions,
  AppCallContext,
  LlmRunOptions,
} from "@monkey-mini-app/host";

import type { PiAiDriver } from "./ai-driver.ts";
import type { PiEnvDriver } from "./env-driver.ts";
import { createUnavailableEnvDriver } from "./env-driver.ts";

const execFileAsync = promisify(execFile);

/**
 * pi AgentCapabilities — same surface as DshCapabilities where it matters.
 *
 * - llm / agent / bash / tool / mcp / listTools: implemented
 * - credentials: always `{}` (no Agent Client store; Host already defaults to {})
 * - config: **omitted** so Host uses `publicAppConfig(host.json)` (theme/locale/port/…)
 */
export class PiAgentCapabilities implements AgentCapabilities {
  constructor(
    private readonly ai: PiAiDriver,
    private readonly env: PiEnvDriver = createUnavailableEnvDriver(),
  ) {}

  async bash(_ctx: AppCallContext, command: string) {
    try {
      const { stdout, stderr } = await execFileAsync("bash", ["-lc", command], {
        maxBuffer: 2 * 1024 * 1024,
      });
      return { stdout: String(stdout), stderr: String(stderr), exitCode: 0 };
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string; code?: number };
      return {
        stdout: String(e.stdout ?? ""),
        stderr: String(e.stderr ?? (err instanceof Error ? err.message : String(err))),
        exitCode: typeof e.code === "number" ? e.code : 1,
      };
    }
  }

  async llm(ctx: AppCallContext, prompt: string, opts?: LlmRunOptions) {
    void ctx;
    return this.ai.llm(prompt, opts);
  }

  async agent(ctx: AppCallContext, goal: string, opts?: AgentRunOptions) {
    void ctx;
    return this.ai.agent(goal, opts);
  }

  async tool(_ctx: AppCallContext, name: string, args?: Record<string, unknown>) {
    return this.env.tool(name, args);
  }

  async mcp(_ctx: AppCallContext, name: string, args?: Record<string, unknown>) {
    return this.env.mcp(name, args);
  }

  listTools(_ctx: AppCallContext): unknown[] {
    return this.env.listTools();
  }

  credentials(_ctx: AppCallContext): Record<string, string> {
    return {};
  }

  // config intentionally omitted → AppsManager.publicAppConfig(host.json)
}
