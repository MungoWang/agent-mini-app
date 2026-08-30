/**
 * Project dsh session log events → MMA AgentEvent.
 * Used while polling session.events during one-shot runs.
 */
import type { AgentEvent, AgentEventHandler, AgentTurnEndReason } from "@monkey-mini-app/host";

import { isRecord } from "./ctx.ts";

export type SessionEventProjector = {
  /** Push newly appended session events (by index growth). */
  push(raw: unknown): void;
};

/** Normalize dsh `turn/end.reason` (object or legacy string) for AgentEvent. */
export function projectTurnEndReason(raw: unknown): AgentTurnEndReason | undefined {
  if (typeof raw === "string" && raw.trim()) {
    return { kind: raw.trim() };
  }
  if (!isRecord(raw)) return undefined;
  const kind = typeof raw.kind === "string" ? raw.kind : "";
  if (!kind) return undefined;
  const out: AgentTurnEndReason = { kind };
  if (raw.error !== undefined) out.error = raw.error;
  if (raw.reason !== undefined) out.reason = raw.reason;
  return out;
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

function parseToolArgs(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function emitSafe(onEvent: AgentEventHandler | undefined, event: AgentEvent): void {
  if (!onEvent) return;
  try {
    onEvent(event);
  } catch {
    /* listener errors must not break the run */
  }
}

/**
 * Create a projector that maps incremental session.events entries to AgentEvent.
 */
export function createSessionEventProjector(onEvent?: AgentEventHandler): SessionEventProjector {
  const callNames = new Map<string, string>();

  return {
    push(raw: unknown) {
      if (!onEvent || !isRecord(raw)) return;
      const type = typeof raw.type === "string" ? raw.type : "";
      const data = isRecord(raw.data) ? raw.data : raw;

      if (type === "turn/start" && typeof data.turn === "number") {
        emitSafe(onEvent, { type: "turn", phase: "start", turn: data.turn });
        return;
      }
      if (type === "turn/end" && typeof data.turn === "number") {
        const reason = projectTurnEndReason(data.reason);
        emitSafe(onEvent, {
          type: "turn",
          phase: "end",
          turn: data.turn,
          ...(reason ? { reason } : {}),
        });
        return;
      }

      if (type === "assistant/chunk") {
        const chunk = isRecord(data.chunk) ? data.chunk : null;
        if (chunk && chunk.type === "text-delta" && typeof chunk.text === "string" && chunk.text) {
          emitSafe(onEvent, { type: "text-delta", text: chunk.text });
        }
        return;
      }

      if (type === "tool/call") {
        const name = typeof data.name === "string" ? data.name : "";
        const callId = data.callId != null ? String(data.callId) : "";
        if (callId && name) callNames.set(callId, name);
        emitSafe(onEvent, {
          type: "tool",
          phase: "start",
          name,
          args: parseToolArgs(data.arguments),
        });
        return;
      }

      if (type === "tool/result") {
        const message = isRecord(data.message) ? data.message : null;
        const callId =
          message && Array.isArray(message.content) && isRecord(message.content[0])
            ? String(message.content[0].callId ?? "")
            : "";
        const name = (callId && callNames.get(callId)) || "";
        if (callId) callNames.delete(callId);
        const resultText = message ? contentBlocksToText(message.content) : "";
        emitSafe(onEvent, {
          type: "tool",
          phase: "end",
          name,
          result: resultText || data.error || undefined,
        });
      }
    },
  };
}

export function emitAgentEvent(onEvent: AgentEventHandler | undefined, event: AgentEvent): void {
  emitSafe(onEvent, event);
}
