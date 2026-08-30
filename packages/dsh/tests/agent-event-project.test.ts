import { describe, expect, it, vi } from "vitest";

import type { AgentEvent } from "@monkey-mini-app/host";

import { createSessionEventProjector } from "../src/agent-event-project.ts";

describe("createSessionEventProjector", () => {
  it("maps turn / text-delta / tool call-result", () => {
    const seen: AgentEvent[] = [];
    const projector = createSessionEventProjector((e) => seen.push(e));

    projector.push({ type: "turn/start", data: { turn: 1 } });
    projector.push({
      type: "assistant/chunk",
      data: { turn: 1, step: 0, chunk: { type: "text-delta", text: "hel" } },
    });
    projector.push({
      type: "assistant/chunk",
      data: { turn: 1, step: 0, chunk: { type: "text-delta", text: "lo" } },
    });
    projector.push({
      type: "tool/call",
      data: { turn: 1, step: 0, callId: "c1", name: "bash", arguments: '{"command":"uname"}' },
    });
    projector.push({
      type: "tool/result",
      data: {
        turn: 1,
        step: 0,
        message: {
          role: "user",
          content: [{ type: "text", text: "Darwin", callId: "c1" }],
        },
      },
    });
    projector.push({ type: "turn/end", data: { turn: 1, reason: { kind: "completed" } } });

    expect(seen).toEqual([
      { type: "turn", phase: "start", turn: 1 },
      { type: "text-delta", text: "hel" },
      { type: "text-delta", text: "lo" },
      { type: "tool", phase: "start", name: "bash", args: { command: "uname" } },
      { type: "tool", phase: "end", name: "bash", result: "Darwin" },
      { type: "turn", phase: "end", turn: 1, reason: { kind: "completed" } },
    ]);
  });

  it("projects turn/end reason kinds including error details", () => {
    const seen: AgentEvent[] = [];
    const projector = createSessionEventProjector((e) => seen.push(e));
    projector.push({
      type: "turn/end",
      data: {
        turn: 2,
        reason: { kind: "error", error: { code: "EMPTY_RESPONSE", message: "no tokens" } },
      },
    });
    projector.push({ type: "turn/end", data: { turn: 3, reason: "blocked" } });
    expect(seen).toEqual([
      {
        type: "turn",
        phase: "end",
        turn: 2,
        reason: { kind: "error", error: { code: "EMPTY_RESPONSE", message: "no tokens" } },
      },
      { type: "turn", phase: "end", turn: 3, reason: { kind: "blocked" } },
    ]);
  });

  it("swallows listener errors", () => {
    const onEvent = vi.fn(() => {
      throw new Error("listener boom");
    });
    const projector = createSessionEventProjector(onEvent);
    expect(() => projector.push({ type: "turn/start", data: { turn: 2 } })).not.toThrow();
    expect(onEvent).toHaveBeenCalled();
  });
});
