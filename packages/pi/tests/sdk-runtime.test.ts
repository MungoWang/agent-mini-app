import { describe, expect, it } from "vitest";

import { mapPiSessionEvent, textFromAssistantContent } from "../src/sdk-runtime.ts";

describe("pi sdk runtime helpers", () => {
  it("textFromAssistantContent joins text blocks", () => {
    expect(
      textFromAssistantContent([
        { type: "text", text: "a" },
        { type: "thinking", text: "nope" },
        { type: "text", text: "b" },
      ]),
    ).toBe("ab");
  });

  it("mapPiSessionEvent maps text deltas and tool phases", () => {
    expect(
      mapPiSessionEvent({
        type: "message_update",
        assistantMessageEvent: { type: "text_delta", delta: "hi" },
      }),
    ).toEqual({ type: "text-delta", text: "hi" });
    expect(mapPiSessionEvent({ type: "tool_execution_start", toolName: "bash" })).toEqual({
      type: "tool",
      phase: "start",
      name: "bash",
    });
    expect(mapPiSessionEvent({ type: "agent_start" })).toEqual({
      type: "status",
      status: "running",
    });
  });
});
