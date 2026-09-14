import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { connectAgentCapabilitiesAsync, createToolClient } from "@monkey-mini-app/host";
import { readCapsEndpoint, startShellHost } from "@monkey-mini-app/shell";

import { createEchoAiDriver } from "../src/ai-driver.ts";
import { createMemoryEnvDriver } from "../src/env-driver.ts";
import { startPiAgentClient } from "../src/start-client.ts";

describe("pi Agent Client ↔ Shell Host", () => {
  let stopPi: (() => Promise<void>) | undefined;
  let stopShell: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (stopShell) {
      await stopShell();
      stopShell = undefined;
    }
    if (stopPi) {
      await stopPi();
      stopPi = undefined;
    }
  });

  it("serves caps, Shell connects, tools bind over HTTP", async () => {
    const runtimeRoot = mkdtempSync(path.join(tmpdir(), "mma-pi-"));
    const registered = new Set<string>();

    const pi = await startPiAgentClient({
      runtimeRoot,
      registerTool: (def) => {
        registered.add(def.name);
        return () => {
          registered.delete(def.name);
        };
      },
      driver: createEchoAiDriver(),
      env: createMemoryEnvDriver({
        tools: { echo: async (args) => ({ echoed: args }) },
        mcp: { ping: async () => ({ ok: true }) },
      }),
    });
    stopPi = () => pi.stop();

    const endpoint = readCapsEndpoint(runtimeRoot);
    expect(endpoint.url).toMatch(/^http:\/\/127\.0\.0\.1:/);

    const shell = await startShellHost({
      runtimeRoot,
      capsEndpoint: endpoint,
      hostPort: 0,
    });
    stopShell = () => shell.stop();

    await pi.bindTools(shell.panelUrl);
    expect(registered.has("mini_app_list")).toBe(true);

    const client = createToolClient({ baseUrl: shell.panelUrl });
    const listed = await client.list();
    expect(listed.some((t) => t.name === "mini_app_list")).toBe(true);
    const result = (await client.invoke("mini_app_list", {})) as { apps: unknown };
    expect(result.apps).toBeDefined();

    const capsProxy = await connectAgentCapabilitiesAsync(endpoint);
    const ctx = { appId: "t", appDir: runtimeRoot } as never;
    expect(await capsProxy.llm!(ctx, "hello")).toBe("pi-llm:hello");
    expect(await capsProxy.tool!(ctx, "echo", { a: 1 })).toEqual({ echoed: { a: 1 } });
    expect(await capsProxy.mcp!(ctx, "ping", {})).toEqual({ ok: true });
    expect(capsProxy.listTools!(ctx)).toEqual([
      expect.objectContaining({ name: "echo" }),
    ]);
    expect(capsProxy.credentials!(ctx)).toEqual({});
  });
});
