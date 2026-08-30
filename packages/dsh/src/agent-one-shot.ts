/**
 * Thin one-shot agent runner over dsh Agent SDK.
 * create → followup(goal) → whenIdle → fold final text → dispose.
 * Optional opts.onEvent projects live session events (status / turn / text-delta / tool / done).
 */
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";

import {
  effectiveSignal,
  isMiniAppToolName,
  resolveAgentCwd,
  type AgentEventHandler,
  type AgentRunOptions,
  type AppCallContext,
} from "@monkey-mini-app/host";

import { createSessionEventProjector, emitAgentEvent } from "./agent-event-project.ts";
import { getService, isRecord, toolsOf, type DshCtx } from "./ctx.ts";
import { coerceSchemaJson, withJsonInstruction } from "./llm-stream.ts";
import { resolveLlmRoute } from "./llm-route.ts";

type AgentHandle = {
  agent: {
    id?: unknown;
    followup: (message: unknown) => void;
    whenIdle: () => Promise<void>;
    cancel: (cause: unknown, options?: unknown) => void;
    session: { events: readonly unknown[]; id?: unknown };
  };
  dispose: () => Promise<void>;
};

type AgentsService = {
  create: (options: Record<string, unknown>) => Promise<AgentHandle>;
};

export type DshAgentHelpers = {
  SessionId: (id: string) => unknown;
  createUserMessage: (input: { content: unknown[]; source: unknown }) => unknown;
  finalAssistantOutput: (events: readonly unknown[]) => unknown[] | undefined;
};

export type AgentOneShotDeps = {
  loadHelpers?: () => Promise<DshAgentHelpers | null>;
  /** Override poll interval for tests (ms). */
  pollMs?: number;
  /** Mini-app call context (appId/appDir/signal/hostLlm). */
  callCtx?: AppCallContext;
};

let helpersPromise: Promise<DshAgentHelpers | null> | null = null;
/** Last load failure detail (for a clearer throw). Cleared on success. */
let helpersLoadError: string | undefined;

function loadDshHelpers(): Promise<DshAgentHelpers | null> {
  if (!helpersPromise) {
    helpersPromise = (async () => {
      try {
        const [sessionMod, llmMod, subagentMod] = await Promise.all([
          import(/* @vite-ignore */ "@deepseek-ai/dsh-session"),
          import(/* @vite-ignore */ "@deepseek-ai/dsh-llm"),
          import(/* @vite-ignore */ "@deepseek-ai/dsh-subagent"),
        ]);
        const SessionId = (sessionMod as { SessionId?: (id: string) => unknown }).SessionId;
        const createUserMessage = (
          llmMod as { createUserMessage?: DshAgentHelpers["createUserMessage"] }
        ).createUserMessage;
        const finalAssistantOutput = (
          subagentMod as { finalAssistantOutput?: DshAgentHelpers["finalAssistantOutput"] }
        ).finalAssistantOutput;
        if (!SessionId || !createUserMessage || !finalAssistantOutput) {
          helpersLoadError =
            "exports missing SessionId / createUserMessage / finalAssistantOutput";
          return null;
        }
        helpersLoadError = undefined;
        return { SessionId, createUserMessage, finalAssistantOutput };
      } catch (cause) {
        helpersLoadError = cause instanceof Error ? cause.message : String(cause);
        return null;
      }
    })();
  }
  return helpersPromise.then((helpers) => {
    // Do not permanently cache failures — deps may appear after install without a full process restart of this module.
    if (!helpers) helpersPromise = null;
    return helpers;
  });
}

function contentBlocksToText(blocks: unknown): string {
  if (!Array.isArray(blocks)) return "";
  const parts: string[] = [];
  for (const block of blocks) {
    if (!isRecord(block)) continue;
    if (block.type === "text" && typeof block.text === "string") parts.push(block.text);
  }
  return parts.join("");
}

/** Best-effort fold when @deepseek-ai/dsh-subagent is unavailable. */
function heuristicFinalText(events: readonly unknown[]): string {
  let last = "";
  for (const ev of events) {
    if (!isRecord(ev)) continue;
    const data = isRecord(ev.data) ? ev.data : ev;
    const msg = isRecord(data.message) ? data.message : isRecord(data) ? data : null;
    if (!msg || msg.role !== "assistant") continue;
    const text = contentBlocksToText(msg.content);
    if (text.trim()) last = text;
  }
  return last;
}

type TurnEndSummary = {
  turn: number | "?";
  kind: string;
  /** Human-facing detail extracted from error/aborted payloads. */
  detail?: string;
};

function readTurnEndSummaries(events: readonly unknown[]): TurnEndSummary[] {
  const out: TurnEndSummary[] = [];
  for (const ev of events) {
    if (!isRecord(ev) || ev.type !== "turn/end") continue;
    const data = isRecord(ev.data) ? ev.data : ev;
    const reason = data.reason;
    const kind =
      isRecord(reason) && typeof reason.kind === "string"
        ? reason.kind
        : typeof reason === "string"
          ? reason
          : "unknown";
    const turn = typeof data.turn === "number" ? data.turn : "?";
    let detail: string | undefined;
    if (isRecord(reason) && isRecord(reason.error)) {
      const code = typeof reason.error.code === "string" ? reason.error.code : "";
      const message = typeof reason.error.message === "string" ? reason.error.message : "";
      detail = [code, message].filter(Boolean).join(": ") || undefined;
    } else if (isRecord(reason) && reason.reason !== undefined) {
      detail = typeof reason.reason === "string" ? reason.reason : JSON.stringify(reason.reason);
    }
    out.push({ turn, kind, detail });
  }
  return out;
}

/** Read-only diagnostic summary for empty-result failures. */
function summarizeSessionEvents(events: readonly unknown[]): string {
  const types: string[] = [];
  for (const ev of events) {
    if (!isRecord(ev)) continue;
    types.push(typeof ev.type === "string" ? ev.type : "?");
  }
  const turnEnds = readTurnEndSummaries(events).map((t) => {
    const base = `t${t.turn}:${t.kind}`;
    return t.detail ? `${base}(${t.detail.slice(0, 160)})` : base;
  });
  const typeSeq = types.length ? types.join(" → ") : "(no events)";
  const ends = turnEnds.length ? turnEnds.join(", ") : "(no turn/end)";
  return `events=[${typeSeq}]; turnEnds=[${ends}]`;
}

/**
 * Prefer the last hard turn failure as the primary error (assembly / model / blocked).
 * Falls back to undefined when turns completed without a structured failure.
 */
function primaryTurnFailureMessage(events: readonly unknown[]): string | undefined {
  const ends = readTurnEndSummaries(events);
  for (let i = ends.length - 1; i >= 0; i--) {
    const t = ends[i];
    if (t.kind === "error") {
      return t.detail
        ? `agent: turn ${t.turn} failed: ${t.detail}`
        : `agent: turn ${t.turn} failed`;
    }
    if (t.kind === "blocked") {
      return `agent: turn ${t.turn} blocked (pre-step rejected)`;
    }
    if (t.kind === "aborted") {
      return t.detail
        ? `agent: turn ${t.turn} aborted: ${t.detail}`
        : `agent: turn ${t.turn} aborted`;
    }
  }
  return undefined;
}

function asAgentsService(value: unknown): AgentsService | null {
  if (!isRecord(value) || typeof value.create !== "function") return null;
  return value as AgentsService;
}

function buildGoalText(goal: string, opts?: AgentRunOptions): string {
  const { prompt, system } = withJsonInstruction(goal, opts);
  if (!system) return prompt;
  return `${system}\n\n---\n\n${prompt}`;
}

function onEventOf(opts?: AgentRunOptions): AgentEventHandler | undefined {
  return typeof opts?.onEvent === "function" ? opts.onEvent : undefined;
}

/**
 * Headless one-shot composition:
 * - mount default agent preset (bash/read live on the preset layer, not global)
 * - deny host `mini_app_*` tools (main-chat only)
 * - pin approval=never + open sandbox for unattended runs
 */
async function composeOneShotSetup(agentCtx: DshCtx): Promise<{ commit(): void } | void> {
  // dsh: tools/prompt on the agent plane resolve agent → preset → global.
  // Without mount(), the agent only sees global plugins (MCP/memory) — no bash.
  const presets = getService(agentCtx, "agentPresets");
  if (isRecord(presets) && typeof presets.mount === "function") {
    await presets.mount(agentCtx);
  } else {
    console.warn(
      "[monkey-mini-app] agentPresets.mount unavailable; ctx.agent one-shot will lack preset tools (bash/read)",
    );
  }

  const tools = toolsOf(agentCtx) ?? (isRecord(agentCtx) ? (agentCtx.tools as DshCtx["tools"]) : undefined);
  if (tools && typeof tools.restrict === "function") {
    const rows: unknown[] = [];
    if (typeof tools.schemas === "function") {
      const list = tools.schemas();
      if (Array.isArray(list)) rows.push(...list);
    } else if (typeof tools.list === "function") {
      const list = tools.list();
      if (Array.isArray(list)) rows.push(...list);
    }
    for (const row of rows) {
      const name = isRecord(row) && typeof row.name === "string" ? row.name : "";
      if (!isMiniAppToolName(name)) continue;
      try {
        tools.restrict({ deny: [name] });
      } catch {
        /* unknown / already masked — skip */
      }
    }
  }

  return {
    commit() {
      const agent = isRecord(agentCtx) ? agentCtx.agent : undefined;
      const session =
        isRecord(agent) && isRecord(agent.session) && typeof agent.session.append === "function"
          ? agent.session
          : undefined;
      if (!session) return;
      try {
        session.append("approval/policy", { policy: "never", source: "delegation" });
      } catch {
        /* optional capability */
      }
      try {
        session.append("sandbox/mode", { mode: "danger-full-access", source: "delegation" });
      } catch {
        /* optional capability */
      }
      try {
        session.append("permission/preset", {
          preset: "danger-full-access",
          source: "delegation",
        });
      } catch {
        /* optional capability */
      }
    },
  };
}

/**
 * Drain newly appended session.events into the projector.
 */
function drainSessionEvents(
  events: readonly unknown[],
  cursor: { i: number },
  projector: ReturnType<typeof createSessionEventProjector>,
): void {
  while (cursor.i < events.length) {
    projector.push(events[cursor.i]);
    cursor.i += 1;
  }
}

/**
 * Run one ephemeral dsh Agent to completion and return the final assistant text.
 * `opts` is caller intent (never mutated). Call facts come from `deps.callCtx`.
 */
export async function runDshAgentOneShot(
  dsh: DshCtx,
  goal: string,
  opts?: AgentRunOptions,
  deps?: AgentOneShotDeps,
): Promise<string> {
  const callCtx = deps?.callCtx;
  const agents = asAgentsService(getService(dsh, "agents"));
  if (!agents) {
    throw new Error(
      "agent: dsh agents factory unbound (ctx.agents.create). Ensure @deepseek-ai/dsh-agent-loop is loaded.",
    );
  }

  const helpers = await (deps?.loadHelpers ?? loadDshHelpers)();
  if (!helpers) {
    const detail = helpersLoadError ? `: ${helpersLoadError}` : "";
    throw new Error(
      `agent: dsh SDK helpers unavailable (@deepseek-ai/dsh-session / dsh-llm / dsh-subagent)${detail}`,
    );
  }

  const userOnEvent = onEventOf(opts);
  const route = resolveLlmRoute(dsh, opts, callCtx?.hostLlm);
  // deployment:persona interpolates {{provider}} / {{model}} / {{cwd}} strictly.
  if (!route.provider.trim() || !route.model.trim()) {
    throw new Error(
      `agent: unresolved model route (need provider+model for prompt assembly; got provider=${JSON.stringify(route.provider)} model=${JSON.stringify(route.model)})`,
    );
  }
  const maxTokens = opts?.maxTokens;
  const maxIterations =
    typeof opts?.maxIterations === "number" && Number.isFinite(opts.maxIterations) && opts.maxIterations > 0
      ? Math.floor(opts.maxIterations)
      : undefined;
  const signal = effectiveSignal(
    opts?.signal instanceof AbortSignal ? opts.signal : undefined,
    callCtx,
  );
  const sessionId = helpers.SessionId(randomUUID());
  const goalText = buildGoalText(String(goal || ""), opts);
  const cwd = resolveAgentCwd(
    { cwdType: opts?.cwdType, cwd: opts?.cwd },
    { appDir: callCtx?.appDir },
  );
  const cleanupTemp = opts?.cwdType === "temp" ? cwd : undefined;

  const handle = await agents.create({
    sessionId,
    // Absolute cwd required for {{cwd}} in deployment:persona; origin marks ephemeral isolation.
    meta: { origin: "subagent", cwd },
    agentOptions: {
      provider: route.provider,
      model: route.model,
      ...(maxTokens != null ? { maxTokens } : {}),
    },
    // Headless: never ask (no UI), open sandbox, hide mini_app_* from this agent.
    setup: (agentCtx: DshCtx) => composeOneShotSetup(agentCtx),
    ...(signal ? { signal } : {}),
  });

  // Fallback if setup.commit could not see session yet (older factories).
  try {
    const approval = getService(dsh, "approval");
    if (
      isRecord(approval) &&
      typeof approval.setPolicy === "function" &&
      isRecord(handle.agent)
    ) {
      approval.setPolicy(handle.agent, "never");
    }
  } catch {
    /* optional */
  }

  const onAbort = () => {
    try {
      handle.agent.cancel("host", { keepInbox: false });
    } catch {
      /* ignore */
    }
  };

  // Soft maxIterations: dsh AgentOptions has no native field — cancel after N turn ends.
  let turnEnds = 0;
  let hitIterationLimit = false;
  const onEvent: AgentEventHandler | undefined =
    userOnEvent || maxIterations
      ? (ev) => {
          if (ev.type === "turn" && ev.phase === "end" && maxIterations) {
            turnEnds += 1;
            if (turnEnds >= maxIterations && !hitIterationLimit) {
              hitIterationLimit = true;
              try {
                handle.agent.cancel("host", { keepInbox: false });
              } catch {
                /* ignore */
              }
            }
          }
          userOnEvent?.(ev);
        }
      : undefined;

  const projector = createSessionEventProjector(onEvent);
  const cursor = { i: 0 };
  let pollTimer: ReturnType<typeof setInterval> | undefined;

  try {
    if (signal?.aborted) {
      throw new Error("cancelled");
    }
    if (signal) signal.addEventListener("abort", onAbort, { once: true });

    emitAgentEvent(onEvent, { type: "status", status: "running" });

    const message = helpers.createUserMessage({
      content: [{ type: "text", text: goalText }],
      source: { kind: "plugin", plugin: "monkey-mini-app" },
    });
    handle.agent.followup(message);

    // Live projection: poll session.events growth (works without cordis ctx.on).
    // Always poll when maxIterations is set so turn ends are observed even without user onEvent.
    if (onEvent) {
      const pollMs = deps?.pollMs ?? 40;
      pollTimer = setInterval(() => {
        try {
          drainSessionEvents(handle.agent.session.events, cursor, projector);
        } catch {
          /* ignore transient read errors */
        }
      }, pollMs);
    }

    await handle.agent.whenIdle();

    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = undefined;
    }
    drainSessionEvents(handle.agent.session.events, cursor, projector);

    emitAgentEvent(onEvent, { type: "status", status: "idle" });

    if (signal?.aborted) {
      throw new Error("cancelled");
    }

    const events = handle.agent.session.events;
    const blocks = helpers.finalAssistantOutput(events);
    const text = contentBlocksToText(blocks) || heuristicFinalText(events);
    if (!text) {
      const diag = summarizeSessionEvents(events);
      const turnFailure = primaryTurnFailureMessage(events);
      if (turnFailure) {
        throw new Error(`${turnFailure}; ${diag}`);
      }
      throw new Error(
        hitIterationLimit
          ? `agent: empty result after maxIterations=${maxIterations}; ${diag}`
          : `agent: empty result (no assistant output); ${diag}`,
      );
    }
    const finalText = coerceSchemaJson(text, opts);
    emitAgentEvent(onEvent, { type: "done", text: finalText });
    return finalText;
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    emitAgentEvent(onEvent, { type: "error", message });
    throw cause;
  } finally {
    if (pollTimer) clearInterval(pollTimer);
    if (signal) signal.removeEventListener("abort", onAbort);
    try {
      await handle.dispose();
    } catch {
      /* dispose best-effort */
    }
    if (cleanupTemp) {
      try {
        await rm(cleanupTemp, { recursive: true, force: true });
      } catch {
        /* temp cleanup best-effort */
      }
    }
  }
}
