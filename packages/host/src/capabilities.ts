import type { AgentRunOptions } from "./agent-events.ts";
import type { AppCallContext } from "./app-runtime.ts";
import { HostError } from "./errors.ts";
import type { LlmRunOptions } from "./model-call.ts";

/**
 * Stateless host capabilities. First argument is always the call context;
 * user opts (2nd/3rd) stay pristine — do not mutate them.
 */
export interface HostCapabilities {
  bash?(
    ctx: AppCallContext,
    command: string,
  ): Promise<{ stdout: string; stderr: string; exitCode: number }>;
  llm?(ctx: AppCallContext, prompt: string, opts?: LlmRunOptions): Promise<string>;
  /** Final answer is always a string; pass `opts.onEvent` for live process events. */
  agent?(ctx: AppCallContext, goal: string, opts?: AgentRunOptions): Promise<string>;
  tool?(ctx: AppCallContext, name: string, args?: Record<string, unknown>): Promise<unknown>;
  mcp?(ctx: AppCallContext, name: string, args?: Record<string, unknown>): Promise<unknown>;
  /** May later scope by app/call; pass ctx even if unused today. */
  credentials?(ctx: AppCallContext): Record<string, string>;
  /** May later scope by app/call; pass ctx even if unused today. */
  config?(ctx: AppCallContext): Record<string, unknown>;
  listTools?(ctx: AppCallContext): unknown[];
}

/**
 * Author-facing methods (no leading ctx — bound by bindCapsToContext).
 * `credentials` / `config` are methods here; AppsManager exposes them as `ctx.*` properties.
 */
export type BoundHostCapabilities = {
  bash(command: string): Promise<{ stdout: string; stderr: string; exitCode: number }>;
  llm(prompt: string, opts?: LlmRunOptions): Promise<string>;
  agent(goal: string, opts?: AgentRunOptions): Promise<string>;
  tool(name: string, args?: Record<string, unknown>): Promise<unknown>;
  mcp(name: string, args?: Record<string, unknown>): Promise<unknown>;
  credentials(): Record<string, string>;
  config(): Record<string, unknown>;
  listTools(): unknown[];
};

function missingCap(name: string): never {
  throw new HostError("CAPABILITY_UNAVAILABLE", `${name}: host capability not available`);
}

/**
 * Bind caps.*(ctx, …) onto author-facing methods.
 * Keep this list next to HostCapabilities so new tools are not forgotten.
 */
export function bindCapsToContext(
  ctx: AppCallContext,
  caps: HostCapabilities,
): BoundHostCapabilities {
  // Hand-written (not Object.keys): keep next to HostCapabilities so new methods are not forgotten.
  // async wrappers turn missingCap sync throws into Promise rejections.
  return {
    bash: async (command) => (caps.bash ? caps.bash(ctx, command) : missingCap("bash")),
    llm: async (prompt, opts) => (caps.llm ? caps.llm(ctx, prompt, opts) : missingCap("llm")),
    agent: async (goal, opts) => (caps.agent ? caps.agent(ctx, goal, opts) : missingCap("agent")),
    tool: async (name, args) => (caps.tool ? caps.tool(ctx, name, args) : missingCap("tool")),
    mcp: async (name, args) => (caps.mcp ? caps.mcp(ctx, name, args) : missingCap("mcp")),
    credentials: () => (caps.credentials ? caps.credentials(ctx) : {}),
    config: () => (caps.config ? caps.config(ctx) : {}),
    listTools: () => (caps.listTools ? caps.listTools(ctx) : []),
  };
}
