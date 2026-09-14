import { describe, expect, it, vi } from "vitest";

import type { ToolDefinition } from "@monkey-mini-app/host";
import { createAgentClient } from "@monkey-mini-app/host";

describe("createAgentClient", () => {
  it("bindToHost inproc registers definitions via ToolRegistrarPort", () => {
    const registered: string[] = [];
    const dispose = vi.fn();
    const defs: ToolDefinition[] = [
      {
        name: "mini_app_list",
        description: "list",
        inputSchema: { type: "object" },
        execute: async () => ({ ok: true }),
      },
    ];
    const client = createAgentClient({
      capabilities: { llm: async () => "x" },
      tools: {
        register(list) {
          registered.push(...list.map((d) => d.name));
          return dispose;
        },
      },
    });
    client.bindToHost({
      mode: "inproc",
      port: {
        definitions: () => defs,
        invoke: async () => ({}),
      } as never,
    });
    expect(registered).toEqual(["mini_app_list"]);
    client.dispose();
    expect(dispose).toHaveBeenCalled();
  });

  it("start installs skills when configured", async () => {
    const install = vi.fn();
    const client = createAgentClient({
      capabilities: {},
      tools: { register: () => () => {} },
      skills: { install },
      skillSourceDir: "/tmp/skill-src",
    });
    await client.start();
    expect(install).toHaveBeenCalledWith("/tmp/skill-src");
  });
});
