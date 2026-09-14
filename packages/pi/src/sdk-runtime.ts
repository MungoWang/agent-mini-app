/**
 * Shared pi SDK runtime for isolated AgentCapabilities.
 *
 * AI and tool calls must NOT mutate the user's interactive chat session.
 * We use `createAgentSession` + `SessionManager.inMemory()` for ephemeral work sessions.
 */
import type { AgentEvent } from "@monkey-mini-app/host";

export type PiSdkModule = typeof import("@earendil-works/pi-coding-agent");

let cached: Promise<PiSdkModule> | undefined;

export function loadPiCodingAgent(): Promise<PiSdkModule> {
  cached ??= import("@earendil-works/pi-coding-agent").catch((err) => {
    cached = undefined;
    throw new Error(
      `pi SDK unavailable (@earendil-works/pi-coding-agent): ${err instanceof Error ? err.message : String(err)}`,
    );
  });
  return cached;
}

export type PiSdkRuntimeOptions = {
  cwd?: string;
  agentDir?: string;
  /** Provider/model override for ephemeral sessions */
  provider?: string;
  model?: string;
};

export type EphemeralSession = {
  session: import("@earendil-works/pi-coding-agent").AgentSession;
  dispose(): void;
};

/**
 * Open an in-memory AgentSession (no JSONL persistence) for one mini-app capability call.
 */
export async function openEphemeralSession(
  pi: PiSdkModule,
  options: PiSdkRuntimeOptions & {
    /** Tool allowlist; empty = noTools "all" for pure llm */
    tools?: string[];
    noTools?: "all" | "builtin";
  } = {},
): Promise<EphemeralSession> {
  const modelRuntime = await pi.ModelRuntime.create();
  let model =
    options.provider && options.model
      ? modelRuntime.getModel(options.provider, options.model)
      : undefined;
  if (!model) {
    const available = [...modelRuntime.getModels()];
    model = available[0];
  }
  const { session } = await pi.createAgentSession({
    cwd: options.cwd ?? process.cwd(),
    agentDir: options.agentDir,
    modelRuntime,
    model,
    sessionManager: pi.SessionManager.inMemory(options.cwd ?? process.cwd()),
    settingsManager: pi.SettingsManager.inMemory(),
    ...(options.tools
      ? { tools: options.tools }
      : options.noTools
        ? { noTools: options.noTools }
        : { noTools: "all" as const }),
  });
  return {
    session,
    dispose() {
      session.dispose();
    },
  };
}

export function textFromAssistantContent(
  content: ReadonlyArray<{ type: string; text?: string }>,
): string {
  return content
    .filter((c) => c.type === "text" && typeof c.text === "string")
    .map((c) => c.text as string)
    .join("");
}

/** Map pi session subscribe events → MMA AgentEvent (best-effort). */
export function mapPiSessionEvent(event: { type: string; [k: string]: unknown }): AgentEvent | undefined {
  if (event.type === "message_update") {
    const ame = event.assistantMessageEvent as
      | { type?: string; delta?: string }
      | undefined;
    if (ame?.type === "text_delta" && typeof ame.delta === "string") {
      return { type: "text-delta", text: ame.delta };
    }
  }
  if (event.type === "turn_start") {
    const turn = typeof event.turnIndex === "number" ? event.turnIndex + 1 : 1;
    return { type: "turn", phase: "start", turn };
  }
  if (event.type === "turn_end") {
    const turn = typeof event.turnIndex === "number" ? event.turnIndex + 1 : 1;
    return { type: "turn", phase: "end", turn, reason: { kind: "stop" } };
  }
  if (event.type === "tool_execution_start") {
    return {
      type: "tool",
      phase: "start",
      name: String(event.toolName ?? "tool"),
    };
  }
  if (event.type === "tool_execution_end") {
    return {
      type: "tool",
      phase: "end",
      name: String(event.toolName ?? "tool"),
      result: event.isError ? { error: true } : event.result,
    };
  }
  if (event.type === "agent_start") {
    return { type: "status", status: "running" };
  }
  if (event.type === "agent_end" || event.type === "agent_settled") {
    return { type: "status", status: "idle" };
  }
  return undefined;
}
