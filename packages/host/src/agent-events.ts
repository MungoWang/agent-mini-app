/**
 * Process events for ctx.agent — optional observation surface.
 * Final answer remains Promise<string>; apps opt in via opts.onEvent.
 */
import type { AgentCwdType } from "./agent-cwd.ts";
import type { ModelCallOptions } from "./model-call.ts";

export type { AgentCwdType } from "./agent-cwd.ts";

/**
 * Why a turn ended (from dsh session `turn/end.reason`).
 * Kept loose so hosts can pass through new kinds without breaking apps.
 */
export type AgentTurnEndReason = {
  kind: string;
  /** Nested details when kind is error / aborted / etc. */
  error?: unknown;
  reason?: unknown;
};

export type AgentEvent =
  | { type: "status"; status: "running" | "idle" }
  | { type: "text-delta"; text: string }
  | { type: "tool"; phase: "start" | "end"; name: string; args?: unknown; result?: unknown }
  | { type: "turn"; phase: "start"; turn: number }
  | { type: "turn"; phase: "end"; turn: number; reason?: AgentTurnEndReason }
  | { type: "error"; message: string }
  | { type: "done"; text: string };

export type AgentEventHandler = (event: AgentEvent) => void;

/** Options for HostCapabilities.agent / ctx.agent (extends shared model-call fields). */
export interface AgentRunOptions extends ModelCallOptions {
  /**
   * Soft cap on agent turns (host cancels after this many `turn` end events).
   * dsh AgentOptions has no native maxIterations — enforced by the one-shot runner.
   */
  maxIterations?: number;
  /** Optional live projection of the agent run (does not change the string return). */
  onEvent?: AgentEventHandler;
  /**
   * Working-directory mode for the agent session (default `"process"`).
   * - app: current mini-app directory (from AppRuntime.appDir)
   * - process: dsh process.cwd()
   * - temp: fresh directory under os.tmpdir()
   * - custom: requires `cwd` absolute path
   *
   * If `cwd` is set without cwdType, treated as custom.
   * If `cwd` is set with cwdType other than custom → error.
   */
  cwdType?: AgentCwdType;
  /** Absolute path; only with cwdType "custom", or alone (implies custom). */
  cwd?: string;
}
