/**
 * PiAiDriver backed by the official pi SDK.
 *
 * Session isolation: each llm/agent call opens an ephemeral in-memory AgentSession
 * (`SessionManager.inMemory()`), runs, then disposes — never touches the user's chat JSONL.
 *
 * - llm: ModelRuntime.complete (single-turn, no tools)
 * - agent: session.prompt + subscribe → AgentEvent stream, then getLastAssistantText()
 */
import type { AgentEvent, AgentRunOptions, LlmRunOptions } from "@monkey-mini-app/host";

import type { PiAiDriver } from "./ai-driver.ts";
import {
  loadPiCodingAgent,
  mapPiSessionEvent,
  openEphemeralSession,
  textFromAssistantContent,
  type PiSdkRuntimeOptions,
} from "./sdk-runtime.ts";

export type CreatePiSdkAiDriverOptions = PiSdkRuntimeOptions & {
  /** Tools enabled for agent() ephemeral sessions. Default: coding defaults via omit noTools. */
  agentTools?: string[];
};

export async function createPiSdkAiDriver(
  options: CreatePiSdkAiDriverOptions = {},
): Promise<PiAiDriver & { dispose(): void }> {
  const pi = await loadPiCodingAgent();
  const modelRuntime = await pi.ModelRuntime.create();

  const resolveModel = (opts?: { provider?: string; model?: string }) => {
    const provider = opts?.provider ?? options.provider;
    const modelId = opts?.model ?? options.model;
    if (provider && modelId) {
      const found = modelRuntime.getModel(provider, modelId);
      if (found) return found;
    }
    const available = [...modelRuntime.getModels()];
    if (available.length === 0) {
      throw new Error(
        "pi ModelRuntime has no models — configure ~/.pi/agent/auth.json or provider API keys",
      );
    }
    return available[0]!;
  };

  return {
    async llm(prompt, opts?: LlmRunOptions) {
      const model = resolveModel(opts);
      const assistant = await modelRuntime.complete(
        model,
        {
          systemPrompt: opts?.system,
          messages: [
            {
              role: "user" as const,
              content: prompt,
              timestamp: Date.now(),
            },
          ],
        },
        {
          signal: opts?.signal,
          maxTokens: opts?.maxTokens,
        } as never,
      );
      return textFromAssistantContent(
        assistant.content as Array<{ type: string; text?: string }>,
      );
    },

    async agent(goal, opts?: AgentRunOptions) {
      const ephemeral = await openEphemeralSession(pi, {
        cwd: opts?.cwd ?? options.cwd,
        agentDir: options.agentDir,
        provider: opts?.provider ?? options.provider,
        model: opts?.model ?? options.model,
        ...(options.agentTools
          ? { tools: options.agentTools }
          : { tools: ["read", "bash", "edit", "write"] }),
      });
      const { session } = ephemeral;
      const unsub = session.subscribe((event) => {
        const mapped = mapPiSessionEvent(event as { type: string });
        if (mapped) {
          try {
            opts?.onEvent?.(mapped);
          } catch {
            /* ignore */
          }
        }
      });
      const onAbort = () => {
        void session.abort();
      };
      opts?.signal?.addEventListener("abort", onAbort, { once: true });
      try {
        opts?.onEvent?.({ type: "status", status: "running" });
        await session.prompt(goal);
        await session.waitForIdle();
        const text = session.getLastAssistantText() ?? "";
        opts?.onEvent?.({ type: "done", text });
        opts?.onEvent?.({ type: "status", status: "idle" });
        return text;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        opts?.onEvent?.({ type: "error", message });
        opts?.onEvent?.({ type: "done", text: "" });
        throw err;
      } finally {
        opts?.signal?.removeEventListener("abort", onAbort);
        unsub();
        ephemeral.dispose();
      }
    },

    dispose() {
      /* ModelRuntime has no dispose; ephemeral sessions are per-call */
    },
  };
}
