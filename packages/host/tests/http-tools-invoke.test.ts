import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { Host, HostCapabilities, HostLifecycle } from "@monkey-mini-app/host";
import { bootstrapHostConfig, createHost, createToolClient } from "@monkey-mini-app/host";

function fakeCapabilities(): HostCapabilities {
  return {
    bash: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
    listTools: () => [],
  };
}

describe("HTTP ToolPort", () => {
  let host: Host | undefined;

  afterEach(async () => {
    await host?.stop();
    host = undefined;
  });

  async function boot() {
    const dir = mkdtempSync(path.join(tmpdir(), "mma-tools-"));
    const lifecycle: HostLifecycle = { attach() {} };
    host = createHost(fakeCapabilities(), lifecycle, {
      config: bootstrapHostConfig({ runtimeRoot: dir, hostPort: 0 }),
    });
    await host.apply();
  }

  it("GET /api/tools lists mini_app_* names", async () => {
    await boot();
    const res = await fetch(`http://127.0.0.1:${host!.port}/api/tools`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tools: Array<{ name: string }> };
    expect(body.tools.some((t) => t.name === "mini_app_list")).toBe(true);
  });

  it("POST /api/tools/invoke runs mini_app_list", async () => {
    await boot();
    const res = await fetch(`http://127.0.0.1:${host!.port}/api/tools/invoke`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "mini_app_list", args: {} }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { apps: unknown; runtimeRoot: string };
    expect(body.apps).toBeDefined();
    expect(body.runtimeRoot).toBeDefined();
  });

  it("POST /api/tools/invoke rejects non-mini_app names", async () => {
    await boot();
    const res = await fetch(`http://127.0.0.1:${host!.port}/api/tools/invoke`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "bash", args: {} }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("createToolClient lists and invokes", async () => {
    await boot();
    const client = createToolClient({ baseUrl: `http://127.0.0.1:${host!.port}` });
    const tools = await client.list();
    expect(tools.some((t) => t.name === "mini_app_list")).toBe(true);
    const result = (await client.invoke("mini_app_list", {})) as { apps: unknown };
    expect(result.apps).toBeDefined();
  });
});
