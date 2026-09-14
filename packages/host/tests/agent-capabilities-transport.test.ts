import { afterEach, describe, expect, it } from "vitest";

import type { AgentCapabilities } from "@monkey-mini-app/host";
import {
  connectAgentCapabilities,
  inprocAgentCapabilitiesTransport,
  serveAgentCapabilities,
} from "@monkey-mini-app/host";

describe("AgentCapabilities transport", () => {
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (close) {
      await close();
      close = undefined;
    }
  });

  it("inproc serve/connect are identity", async () => {
    const caps: AgentCapabilities = {
      llm: async () => "ok",
    };
    const endpoint = await Promise.resolve(inprocAgentCapabilitiesTransport.serve(caps));
    expect(endpoint).toBe(caps);
    expect(inprocAgentCapabilitiesTransport.connect(endpoint)).toBe(caps);
  });

  it("http serve/connect round-trips llm/agent/tool/mcp (same AgentCapabilities)", async () => {
    const caps: AgentCapabilities = {
      llm: async (_ctx, prompt) => `echo:${prompt}`,
      agent: async (_ctx, goal, opts) => {
        opts?.onEvent?.({ type: "text-delta", text: "hi" });
        return `done:${goal}`;
      },
      tool: async (_ctx, name, args) => ({ tool: name, args }),
      mcp: async (_ctx, name, args) => ({ mcp: name, args }),
      listTools: () => [{ name: "demo_tool" }],
      credentials: () => ({}),
    };
    const served = await serveAgentCapabilities(caps);
    close = () => served.close();
    const { connectAgentCapabilitiesAsync } = await import("@monkey-mini-app/host");
    const remote = await connectAgentCapabilitiesAsync({
      url: served.url,
      token: served.token,
    });
    const ctx = { appId: "a" as never, appDir: "/tmp", signal: undefined } as never;
    expect(await remote.llm!(ctx, "ping")).toBe("echo:ping");
    expect(await remote.tool!(ctx, "demo_tool", { x: 1 })).toEqual({
      tool: "demo_tool",
      args: { x: 1 },
    });
    expect(await remote.mcp!(ctx, "demo_mcp", { y: 2 })).toEqual({
      mcp: "demo_mcp",
      args: { y: 2 },
    });
    expect(remote.listTools!(ctx)).toEqual([{ name: "demo_tool" }]);
    expect(remote.credentials!(ctx)).toEqual({});
  });
});
