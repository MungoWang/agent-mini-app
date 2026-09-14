/**
 * Cordis plugin entry for DeepSeek Harness.
 * Composition: createAgentClient + inproc serve/connect + createHost + bindToHost.
 */
import path from "node:path";

import {
  type AdapterHooks,
  createAgentClient,
  createHost,
  type HostServices,
  inprocAgentCapabilitiesTransport,
} from "@monkey-mini-app/host";

import { type DshPluginConfig, loadPluginHostConfig } from "./apply-config.ts";
import { DshCapabilities } from "./capabilities.ts";
import type { DshCtx } from "./ctx.ts";
import { DshSkillPort } from "./skill-port.ts";
import { getSkillDir, getSkillMarkdown } from "./skills.ts";
import { DshThemeResource } from "./theme-resource.ts";
import { DshToolRegistrar } from "./tool-registrar.ts";

export const packageName = "@monkey-mini-app/dsh-mini-app";
export const name = "monkey-mini-app";
export const inject = ["tools"];

export type { AgentOneShotDeps, DshAgentHelpers } from "./agent-one-shot.ts";
export { runDshAgentOneShot } from "./agent-one-shot.ts";
export type { DshPluginConfig } from "./apply-config.ts";
export { loadPluginHostConfig, resolveRuntimeRoot } from "./apply-config.ts";
export { DshCapabilities } from "./capabilities.ts";
export type { DshCtx } from "./ctx.ts";
export type { DshLifecycleOptions, RegisterableTool } from "./lifecycle.ts";
export {
  defaultSkillDest,
  DshLifecycle,
  installSkillDir,
  registerListCtxTools,
  registerTools,
} from "./lifecycle.ts";
export { DSH_LLM_FALLBACK, resolveLlmRoute } from "./llm-route.ts";
export { coerceSchemaJson, collectLlmStream, withJsonInstruction } from "./llm-stream.ts";
export { DshSkillPort } from "./skill-port.ts";
export { getSkeletonTemplateFiles, getSkillDir, getSkillMarkdown, getTemplateFiles } from "./skills.ts";
export { DshThemeResource } from "./theme-resource.ts";
export { DshToolRegistrar } from "./tool-registrar.ts";

export async function apply(ctx: DshCtx, config: DshPluginConfig = {}): Promise<() => void> {
  const hostConfig = loadPluginHostConfig(config);
  const themes = new DshThemeResource(hostConfig.runtimeRoot);
  const caps = new DshCapabilities(ctx);
  const registrar = new DshToolRegistrar(ctx);
  await registrar.prepare();
  const skillDest = config.skillDest ? path.resolve(config.skillDest) : undefined;
  const agent = createAgentClient({
    capabilities: caps,
    tools: registrar,
    skills: new DshSkillPort(skillDest),
    skillSourceDir: getSkillDir(),
  });

  const transport = inprocAgentCapabilitiesTransport;
  const endpoint = await Promise.resolve(transport.serve(agent.capabilities));
  const connected = transport.connect(endpoint);

  const hooks: AdapterHooks = {
    async attach(_attachCtx: unknown, services: HostServices) {
      await agent.start();
      agent.bindToHost({ mode: "inproc", port: services.tools });
      const extra = registrar.registerListCtxTools();
      if (extra) {
        const prev = agent.dispose.bind(agent);
        agent.dispose = () => {
          try {
            extra();
          } catch {
            /* ignore */
          }
          prev();
        };
      }
      if (typeof ctx.provide === "function") {
        ctx.provide("monkeyMiniApp", {
          tools: services.tools,
          paths: services.paths,
          config: services.config,
          runtimeRoot: services.paths.root,
          skillDir: getSkillDir(),
          skillMarkdown: getSkillMarkdown(),
        });
      }
    },
    async detach() {
      agent.dispose();
    },
    onHostPortChanged(_port: number) {
      // client reads /api/host-config
    },
    log(level: "debug" | "info" | "warn" | "error", message: string, meta?: unknown) {
      const line = `[monkey-mini-app] ${message}`;
      if (level === "error") console.error(line, meta ?? "");
      else if (level === "warn") console.warn(line, meta ?? "");
      else console.log(line, meta ?? "");
    },
  };

  const host = createHost(connected, hooks, {
    config: hostConfig,
    themes,
    about: {
      adapter: "dsh",
      packageName,
      env: process.env.NODE_ENV ?? "production",
    },
  });

  let port: number;
  try {
    ({ port } = await host.apply(ctx));
  } catch (cause) {
    const msg = cause instanceof Error ? cause.message : String(cause);
    console.error(
      `[monkey-mini-app] apps host failed to start on ${hostConfig.hostPort}: ${msg}\n` +
        `  Free the port, or edit ${hostConfig.runtimeRoot}/host.json (hostPort) and restart.`,
    );
    await host.stop().catch(() => {});
    agent.dispose();
    return () => {};
  }
  console.log(`[monkey-mini-app] apps host http://127.0.0.1:${port}`);
  console.log(`[monkey-mini-app] loaded · runtimeRoot=${hostConfig.runtimeRoot} · skill=${getSkillDir()}`);
  return () => {
    agent.dispose();
    void host.stop();
  };
}
