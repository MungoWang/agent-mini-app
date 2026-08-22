import { describe, it, expect } from "vitest";
import { createMiniClient, createLoopbackPair } from "./index.js";
import {
  decodeMessage,
  encodeMessage,
  createResult,
} from "@monkey-mini-app/bridge-protocol";

describe("api-client", () => {
  it("call resolves when host answers", async () => {
    const { miniTransport, hostTransport } = createLoopbackPair();
    hostTransport.onMessage((raw) => {
      const msg = decodeMessage(raw);
      if (msg.type === "bridge.call") {
        hostTransport.send(
          encodeMessage(createResult(msg.id, true, { value: 42 }))
        );
      }
    });
    const mini = createMiniClient(miniTransport);
    const r = (await mini.call("storage.get", { key: "x" })) as {
      value: number;
    };
    expect(r.value).toBe(42);
  });
});
