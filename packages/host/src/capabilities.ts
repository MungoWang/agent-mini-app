import type { AgentRunOptions } from "./agent-events.ts";
import type { AppCallContext } from "./app-runtime.ts";
import { HostError } from "./errors.ts";
import type { LlmRunOptions } from "./model-call.ts";
import { DEFAULT_AGENT_ATTEMPTS, runLlmAttempts } from "./model-call.ts";

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
  /**
   * Fire one UI event to this app's open views (SSE). Injected by `createHost`,
   * so adapters do not implement it.
   */
  push?(ctx: AppCallContext, name: string, data?: unknown): void;
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
  /** Push one event to the app's UI (`useApp().on(name, cb)`); never throws. */
  push(name: string, data?: unknown): void;
};

function missingCap(name: string): never {
  throw new HostError("CAPABILITY_UNAVAILABLE", `${name}: host capability not available`);
}

/**
 * Wrap `opts.streamTo` into a real `onEvent` that mirrors agent progress onto the
 * app's UI channel, so an adapter never has to know about the event bus.
 * The caller's own `onEvent` (if any) still runs first.
 */
export function withAgentStreamBridge(
  ctx: AppCallContext,
  caps: HostCapabilities,
  opts?: AgentRunOptions,
): AgentRunOptions | undefined {
  if (!opts?.streamTo || !caps.push) return opts;
  const channel = opts.streamTo;
  const userOnEvent = opts.onEvent;
  return {
    ...opts,
    onEvent: (event) => {
      try {
        userOnEvent?.(event);
      } catch {
        /* a broken observer must not abort the run */
      }
      caps.push?.(ctx, channel, event);
    },
  };
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
  const { llm, agent } = caps;
  return {
    bash: async (command) => (caps.bash ? caps.bash(ctx, command) : missingCap("bash")),
    // Both model paths go through the attempt engine so the retry budget, the output ceiling and
    // the `schema` guarantee are the same on every host, not adapter-specific politeness.
    llm: llm
      ? async (prompt, opts) => runLlmAttempts(prompt, opts, (input, o) => llm(ctx, input, o))
      : async () => missingCap("llm"),
    agent: agent
      ? async (goal, opts) =>
          runLlmAttempts(
            goal,
            opts,
            (input, o) => agent(ctx, input, withAgentStreamBridge(ctx, caps, o)),
            { attempts: DEFAULT_AGENT_ATTEMPTS },
          )
      : async () => missingCap("agent"),
    tool: async (name, args) => (caps.tool ? caps.tool(ctx, name, args) : missingCap("tool")),
    mcp: async (name, args) => (caps.mcp ? caps.mcp(ctx, name, args) : missingCap("mcp")),
    credentials: () => (caps.credentials ? caps.credentials(ctx) : {}),
    config: () => (caps.config ? caps.config(ctx) : {}),
    listTools: () => (caps.listTools ? caps.listTools(ctx) : []),
    push: (name, data) => {
      try {
        caps.push?.(ctx, name, data);
      } catch (err) {
        // Progress events are best-effort: never fail the API call over one.
        console.warn("[ctx.push] failed", err);
      }
    },
  };
}
