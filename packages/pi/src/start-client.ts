/**
 * Start the pi Agent Client: createAgentClient + serve AgentCapabilities (process-level).
 * Does NOT createHost — Shell owns the Host.
 *
 * Default AI/env drivers use the official pi SDK (ephemeral in-memory sessions).
 * Tests may inject echo/memory drivers explicitly.
 */
import {
  type AgentClient,
  createAgentClient,
  createToolClient,
  serveAgentCapabilities,
  type ServedAgentCapabilities,
} from "@monkey-mini-app/host";
import { writeCapsEndpoint } from "@monkey-mini-app/shell";

import { PiAgentCapabilities } from "./agent-capabilities.ts";
import type { PiAiDriver } from "./ai-driver.ts";
import type { PiEnvDriver } from "./env-driver.ts";
import { createPiSdkAiDriver } from "./sdk-ai-driver.ts";
import { createPiSdkEnvDriver } from "./sdk-env-driver.ts";
import { type PiRegisterTool, PiToolRegistrar } from "./tool-registrar.ts";

export type StartPiAgentClientOptions = {
  runtimeRoot: string;
  registerTool: PiRegisterTool;
  /** Override AI driver (default: pi SDK ephemeral sessions) */
  driver?: PiAiDriver;
  /** Override env driver (default: pi SDK tool session) */
  env?: PiEnvDriver;
  cwd?: string;
  hostUrl?: string;
  /** When true, bind tools to Host ToolClient immediately (tests / no session). */
  bindToolsNow?: boolean;
};

export type PiAgentClientHandle = {
  agent: AgentClient;
  capsServe: ServedAgentCapabilities;
  readonly hostUrl: string;
  bindTools(overrideHostUrl?: string): Promise<void>;
  stop(): Promise<void>;
};

async function resolveDrivers(options: StartPiAgentClientOptions): Promise<{
  driver: PiAiDriver;
  env: PiEnvDriver;
  disposeDrivers: () => void;
}> {
  const cwd = options.cwd ?? process.cwd();
  const disposers: Array<() => void> = [];

  let driver: PiAiDriver;
  if (options.driver) {
    driver = options.driver;
  } else {
    const sdkAi = await createPiSdkAiDriver({ cwd });
    disposers.push(() => sdkAi.dispose());
    driver = sdkAi;
  }

  let env: PiEnvDriver;
  if (options.env) {
    env = options.env;
  } else {
    const sdkEnv = await createPiSdkEnvDriver({ cwd });
    disposers.push(() => sdkEnv.dispose());
    env = sdkEnv;
  }

  return {
    driver,
    env,
    disposeDrivers: () => {
      for (const d of disposers) {
        try {
          d();
        } catch {
          /* ignore */
        }
      }
    },
  };
}

export async function startPiAgentClient(
  options: StartPiAgentClientOptions,
): Promise<PiAgentClientHandle> {
  const { driver, env, disposeDrivers } = await resolveDrivers(options);
  const caps = new PiAgentCapabilities(driver, env);
  const registrar = new PiToolRegistrar(options.registerTool);
  const agent = createAgentClient({
    capabilities: caps,
    tools: registrar,
  });
  await agent.start();

  const capsServe = await serveAgentCapabilities(caps);
  writeCapsEndpoint(options.runtimeRoot, { url: capsServe.url, token: capsServe.token });

  let hostUrl = options.hostUrl ?? process.env.MMA_HOST_URL ?? "http://127.0.0.1:17880";

  const bindTools = async (overrideHostUrl?: string) => {
    if (overrideHostUrl) hostUrl = overrideHostUrl;
    const client = createToolClient({ baseUrl: hostUrl });
    await agent.bindToHostAsync({ mode: "http", client });
  };

  if (options.bindToolsNow) {
    await bindTools();
  }

  return {
    agent,
    capsServe,
    get hostUrl() {
      return hostUrl;
    },
    bindTools,
    async stop() {
      agent.dispose();
      disposeDrivers();
      await capsServe.close();
    },
  };
}
