import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { AgentCapabilities } from "@monkey-mini-app/host";
import { serveAgentCapabilities } from "@monkey-mini-app/host";

import { startShellHost, writeCapsEndpoint } from "../src/index.ts";

describe("startShellHost", () => {
  let closeCaps: (() => Promise<void>) | undefined;
  let stopHost: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (stopHost) {
      await stopHost();
      stopHost = undefined;
    }
    if (closeCaps) {
      await closeCaps();
      closeCaps = undefined;
    }
  });

  it("connects http AgentCapabilities and serves /api/tools", async () => {
    const runtimeRoot = mkdtempSync(path.join(tmpdir(), "mma-shell-"));
    const caps: AgentCapabilities = {
      llm: async (_ctx, prompt) => `shell:${prompt}`,
    };
    const served = await serveAgentCapabilities(caps);
    closeCaps = () => served.close();
    writeCapsEndpoint(runtimeRoot, { url: served.url, token: served.token });

    const handle = await startShellHost({ runtimeRoot, hostPort: 0 });
    stopHost = () => handle.stop();

    const tools = await fetch(`${handle.panelUrl}/api/tools`);
    expect(tools.status).toBe(200);
    const body = (await tools.json()) as { tools: Array<{ name: string }> };
    expect(body.tools.some((t) => t.name === "mini_app_list")).toBe(true);

    // Caps are wired: host exists; llm is exercised via connect in createHost path
    // (AppsManager bind). Smoke: health
    const health = await fetch(`${handle.panelUrl}/health`);
    expect(health.status).toBe(200);
  });
});
