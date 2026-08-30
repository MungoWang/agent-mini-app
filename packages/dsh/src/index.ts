/**
 * Cordis plugin entry for DeepSeek Harness.
 * Assembles createHost(DshCapabilities, DshLifecycle, { config }).
 * Runtime does not invent host.json defaults — run the install script first.
 */
import { createHost } from "@monkey-mini-app/host";

import { type DshPluginConfig,loadPluginHostConfig } from "./apply-config.ts";
import { DshCapabilities } from "./capabilities.ts";
import type { DshCtx } from "./ctx.ts";
import { DshLifecycle } from "./lifecycle.ts";
import { getSkillDir } from "./skills.ts";
import { DshThemeResource } from "./theme-resource.ts";

export const packageName = "@monkey-mini-app/dsh-mini-app";
export const name = "monkey-mini-app";
export const inject = ["tools"];

export type { AgentOneShotDeps, DshAgentHelpers } from "./agent-one-shot.ts";
export { runDshAgentOneShot } from "./agent-one-shot.ts";
export type { DshPluginConfig } from "./apply-config.ts";
export { loadPluginHostConfig, resolveRuntimeRoot } from "./apply-config.ts";
export { DshCapabilities } from "./capabilities.ts";
export type { DshCtx } from "./ctx.ts";
export { DshLifecycle } from "./lifecycle.ts";
export { DSH_LLM_FALLBACK,resolveLlmRoute } from "./llm-route.ts";
export { coerceSchemaJson, collectLlmStream,withJsonInstruction } from "./llm-stream.ts";
export { getSkeletonTemplateFiles, getSkillDir, getSkillMarkdown, getTemplateFiles } from "./skills.ts";
export { DshThemeResource } from "./theme-resource.ts";

export async function apply(ctx: DshCtx, config: DshPluginConfig = {}): Promise<() => void> {
  const hostConfig = loadPluginHostConfig(config);
  const themes = new DshThemeResource(hostConfig.runtimeRoot);
  const host = createHost(new DshCapabilities(ctx), new DshLifecycle(ctx), {
    config: hostConfig,
    themes,
  });
  const { port } = await host.apply(ctx);
  console.log(`[monkey-mini-app] apps host http://127.0.0.1:${port}`);
  console.log(`[monkey-mini-app] loaded · runtimeRoot=${hostConfig.runtimeRoot} · skill=${getSkillDir()}`);
  return () => {
    void host.stop();
  };
}
