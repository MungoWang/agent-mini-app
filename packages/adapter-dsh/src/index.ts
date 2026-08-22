/**
 * DeepSeek Harness (dsh) adapter — framework-agnostic core wired for Cordis-style hosts.
 *
 * Real Cordis `apply(ctx)` registration depends on the installed dsh version surfaces
 * (`ctx.tools`, skill providers, slots). This module exports the portable wiring so a
 * dsh plugin entry can register tools/skills without reimplementing semantics.
 */
import path from "node:path";
import { createRuntime, type Runtime } from "@monkey-mini-app/runtime-core";
import { createNodeHostPort } from "@monkey-mini-app/adapter-node";
import { createHistory } from "@monkey-mini-app/app-history";
import { createGitHistoryAdapter } from "@monkey-mini-app/app-history-git";
import {
  createAgentHandlers,
  listAgentTools,
  invokeAgentTool,
  defaultResolveAppDir,
  type AgentHandlers,
} from "@monkey-mini-app/agent-core";
import { createUiCore, type UiCore } from "@monkey-mini-app/ui-core";
import { getSkillMarkdown, getSkillDir } from "@monkey-mini-app/agent-skills";

export type DshAdapterOptions = {
  runtimeRoot: string;
  themeId?: string;
  hostHandlers?: Record<string, (payload: unknown) => Promise<unknown>>;
};

export type DshAdapter = {
  runtime: Runtime;
  handlers: AgentHandlers;
  ui: UiCore;
  tools: ReturnType<typeof listAgentTools>;
  invoke: (name: string, input?: Record<string, unknown>) => Promise<unknown>;
  skillMarkdown: string;
  skillDir: string;
};

export async function createDshAdapter(
  opts: DshAdapterOptions
): Promise<DshAdapter> {
  const host = createNodeHostPort({
    runtimeRoot: opts.runtimeRoot,
    hostHandlers: opts.hostHandlers ?? {},
  });
  const history = createHistory(createGitHistoryAdapter());
  const runtime = await createRuntime({
    host,
    history,
    themeId: opts.themeId ?? "light",
  });
  const handlers = createAgentHandlers({
    runtime,
    runtimeRoot: opts.runtimeRoot,
    resolveAppDir: (id) => defaultResolveAppDir(opts.runtimeRoot, id),
  });
  const ui = createUiCore(runtime);
  await ui.refresh();

  return {
    runtime,
    handlers,
    ui,
    tools: listAgentTools(),
    invoke: (name, input) => invokeAgentTool(handlers, name, input ?? {}),
    skillMarkdown: getSkillMarkdown(),
    skillDir: getSkillDir(),
  };
}

/**
 * Example Cordis-style registration sketch (not executed inside dsh unless imported by a real plugin):
 *
 * export const inject = ['tools']
 * export async function apply(ctx) {
 *   const adapter = await createDshAdapter({ runtimeRoot: ... })
 *   for (const t of adapter.tools) {
 *     ctx.tools.register({ name: t.name, description: t.description, ... })
 *   }
 * }
 */
export function describeDshMount(): string {
  return [
    "1. createDshAdapter({ runtimeRoot })",
    "2. register adapter.tools on ctx.tools",
    "3. expose adapter.skillMarkdown via skill provider / ~/.dsh/skills",
    "4. mount ui-core state in web slots (TabBar via renderTabBarText or ui-react)",
  ].join("\n");
}

export { listAgentTools, getSkillMarkdown, path };
