/**
 * Process-level AI driver injected into PiAgentCapabilities.
 * Real pi wiring plugs model/session APIs here; tests stub it.
 */
import type { AgentEvent, AgentRunOptions, LlmRunOptions } from "@monkey-mini-app/host";

export type PiAiDriver = {
  llm(prompt: string, opts?: LlmRunOptions): Promise<string>;
  agent(
    goal: string,
    opts?: AgentRunOptions & { onEvent?: (e: AgentEvent) => void },
  ): Promise<string>;
};

/** Stub driver used until a live pi model bridge is available. */
export function createUnavailableAiDriver(reason = "pi AI bridge not configured"): PiAiDriver {
  return {
    async llm() {
      throw new Error(reason);
    },
    async agent() {
      throw new Error(reason);
    },
  };
}

/** In-process echo driver for tests and local demos without pi desktop. */
export function createEchoAiDriver(): PiAiDriver {
  return {
    async llm(prompt) {
      return `pi-llm:${prompt}`;
    },
    async agent(goal, opts) {
      opts?.onEvent?.({ type: "status", status: "running" });
      opts?.onEvent?.({ type: "text-delta", text: goal });
      opts?.onEvent?.({ type: "status", status: "idle" });
      return `pi-agent:${goal}`;
    },
  };
}
