#!/usr/bin/env node
/**
 * CLI: mma-shell-host — start Host connected to a served AgentCapabilities endpoint.
 *
 * Usage:
 *   mma-shell-host --runtime-root ~/.monkey-mini-app [--port 17880]
 *   mma-shell-host --runtime-root … --demo   # serve echo caps then connect (no pi)
 */
import type { AgentCapabilities } from "@monkey-mini-app/host";
import { serveAgentCapabilities } from "@monkey-mini-app/host";

import { writeCapsEndpoint } from "./discovery.ts";
import { startShellHost } from "./start-host.ts";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i < 0) return undefined;
  return process.argv[i + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

async function main(): Promise<void> {
  const runtimeRoot = arg("--runtime-root") ?? process.env.MMA_RUNTIME_ROOT;
  if (!runtimeRoot) {
    console.error("mma-shell-host: --runtime-root or MMA_RUNTIME_ROOT required");
    process.exit(1);
  }
  const portRaw = arg("--port") ?? process.env.MMA_HOST_PORT;
  const hostPort = portRaw ? Number(portRaw) : 0;

  let closeCaps: (() => Promise<void>) | undefined;
  if (hasFlag("--demo")) {
    const caps: AgentCapabilities = {
      llm: async (_ctx, prompt) => `demo-llm:${prompt}`,
      agent: async (_ctx, goal, opts) => {
        opts?.onEvent?.({ type: "text-delta", text: goal });
        return `demo-agent:${goal}`;
      },
      bash: async (_ctx, command) => {
        const { execFile } = await import("node:child_process");
        const { promisify } = await import("node:util");
        const execFileAsync = promisify(execFile);
        try {
          const { stdout, stderr } = await execFileAsync("bash", ["-lc", command], {
            maxBuffer: 2 * 1024 * 1024,
          });
          return { stdout: String(stdout), stderr: String(stderr), exitCode: 0 };
        } catch (err) {
          const e = err as { stdout?: string; stderr?: string; code?: number };
          return {
            stdout: String(e.stdout ?? ""),
            stderr: String(e.stderr ?? ""),
            exitCode: typeof e.code === "number" ? e.code : 1,
          };
        }
      },
    };
    const served = await serveAgentCapabilities(caps);
    writeCapsEndpoint(runtimeRoot, { url: served.url, token: served.token });
    closeCaps = () => served.close();
    console.log(`[mma-shell] demo AgentCapabilities at ${served.url}`);
  }

  const handle = await startShellHost({
    runtimeRoot,
    hostPort: Number.isFinite(hostPort) ? hostPort : 0,
  });
  console.log(`[mma-shell] host ${handle.panelUrl}`);
  // Machine-readable line for Tauri sidecar parsers
  console.log(`MMA_HOST_URL=${handle.panelUrl}`);

  const stop = async () => {
    await handle.stop();
    if (closeCaps) await closeCaps();
    process.exit(0);
  };
  process.on("SIGINT", () => void stop());
  process.on("SIGTERM", () => void stop());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
