/**
 * Shell owns Host: connect(AgentCapabilities) → createHost → listen.
 */
import {
  type AdapterHooks,
  type AgentCapabilitiesHttpEndpoint,
  bootstrapHostConfig,
  connectAgentCapabilitiesAsync,
  createHost,
  type Host,
  type HostConfig,
} from "@monkey-mini-app/host";

import { readCapsEndpoint } from "./discovery.ts";

export type StartShellHostOptions = {
  runtimeRoot: string;
  /** Explicit caps endpoint; default read from runtimeRoot/agent-capabilities.json */
  capsEndpoint?: AgentCapabilitiesHttpEndpoint;
  hostPort?: number;
  aboutAdapter?: string;
  hooks?: AdapterHooks;
};

export type ShellHostHandle = {
  host: Host;
  port: number;
  panelUrl: string;
  stop(): Promise<void>;
};

export async function startShellHost(options: StartShellHostOptions): Promise<ShellHostHandle> {
  const capsEndpoint = options.capsEndpoint ?? readCapsEndpoint(options.runtimeRoot);
  // One AgentCapabilities object (http proxy). listTools hydrated from the same caps serve.
  const caps = await connectAgentCapabilitiesAsync(capsEndpoint);
  const config: HostConfig = bootstrapHostConfig({
    runtimeRoot: options.runtimeRoot,
    hostPort: options.hostPort ?? 0,
  });
  const hooks: AdapterHooks = options.hooks ?? {
    attach() {
      /* tools exposed via HTTP; no local agent registry */
    },
  };
  const host = createHost(caps, hooks, {
    config,
    about: { adapter: options.aboutAdapter ?? "shell", env: process.env.NODE_ENV ?? "production" },
  });
  const { port } = await host.apply();
  return {
    host,
    port,
    panelUrl: `http://127.0.0.1:${port}`,
    stop: () => host.stop(),
  };
}
