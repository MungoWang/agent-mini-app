/**
 * pi ExtensionAPI wiring. Loaded via packages/pi/extensions/index.ts.
 *
 * Caps AI/env use the official SDK with **ephemeral in-memory sessions** so
 * mini-app ctx.llm / ctx.agent / ctx.tool never mutate the user's chat JSONL.
 */
import { homedir } from "node:os";

import { DEFAULT_HOST_CONFIG_SEED } from "@monkey-mini-app/host";

import { createPiSdkAiDriver } from "./sdk-ai-driver.ts";
import { createPiExtensionEnvDriver } from "./sdk-env-driver.ts";
import { type PiAgentClientHandle, startPiAgentClient } from "./start-client.ts";

/** Structural ExtensionAPI — enough for register + tool listing. */
export type PiExtensionAPI = {
  registerTool: (def: {
    name: string;
    description: string;
    parameters?: unknown;
    execute: (
      toolCallId: string,
      params: Record<string, unknown>,
      signal?: AbortSignal,
    ) => Promise<{ content: Array<{ type: string; text: string }>; details?: unknown }>;
  }) => (() => void) | void;
  registerCommand?: (
    name: string,
    opts: { description: string; handler: (args: { args: string }) => void | Promise<void> },
  ) => void;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  getAllTools?: () => Array<{
    name: string;
    description?: string;
    parameters?: unknown;
    sourceInfo?: { source?: string };
  }>;
  getActiveTools?: () => string[];
};

let handle: PiAgentClientHandle | undefined;

function defaultRuntimeRoot(): string {
  if (process.env.MMA_RUNTIME_ROOT) return process.env.MMA_RUNTIME_ROOT;
  const seed = DEFAULT_HOST_CONFIG_SEED.runtimeRoot;
  return seed.startsWith("~/") ? `${homedir()}/${seed.slice(2)}` : seed;
}

/**
 * Default export factory for pi packages: `export default function (pi) { … }`.
 */
export default function registerMonkeyMiniApp(pi: PiExtensionAPI): void {
  const runtimeRoot = defaultRuntimeRoot();
  const cwd = process.cwd();

  void (async () => {
    const driver = await createPiSdkAiDriver({ cwd });
    const env =
      pi.getAllTools && pi.getActiveTools
        ? await createPiExtensionEnvDriver(
            { getAllTools: () => pi.getAllTools!(), getActiveTools: () => pi.getActiveTools!() },
            { cwd },
          )
        : undefined;

    handle = await startPiAgentClient({
      runtimeRoot,
      cwd,
      registerTool: (def) => pi.registerTool(def),
      driver,
      env,
      hostUrl: process.env.MMA_HOST_URL,
    });
    console.log(`[monkey-mini-app/pi] AgentCapabilities served at ${handle.capsServe.url}`);
    console.log(
      "[monkey-mini-app/pi] AI/env use pi SDK ephemeral sessions (isolated from chat JSONL)",
    );
  })().catch((err) => {
    console.error("[monkey-mini-app/pi] failed to start Agent Client", err);
  });

  pi.on?.("session_start", () => {
    void handle?.bindTools().catch((err) => {
      console.warn("[monkey-mini-app/pi] bindTools failed (is Shell Host up?)", err);
    });
  });

  pi.on?.("session_shutdown", () => {
    void handle?.stop();
    handle = undefined;
  });

  pi.registerCommand?.("mini-app", {
    description: "Show monkey-mini-app Shell / Host panel URL",
    handler: async () => {
      const url = handle?.hostUrl ?? process.env.MMA_HOST_URL ?? "http://127.0.0.1:17880";
      console.log(`[monkey-mini-app/pi] open panel: ${url}`);
    },
  });
}

export function __resetPiExtensionForTests(): void {
  void handle?.stop();
  handle = undefined;
}
