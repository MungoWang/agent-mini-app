/**
 * Cordis plugin entry for DeepSeek Harness — 适配层（组装）。
 *  能力/工具/HTTP 全部来自 host-core；本文件只做：createHost 组装 + HostAdapter 注入。
 * @see https://deepseek-harness.github.io/deepseek-harness/en/develop/basic/publish
 */
import * as path from "node:path";
import * as os from "node:os";
import { fileURLToPath } from "node:url";
import { readHostConfig, createHost, setHostRuntimeRoot, clampPort } from "@monkey-mini-app/host-core";
import { getSkillDir } from "./skills.js";
import { buildDshAdapter } from "./dsh-adapter.js";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));

type LooseCtx = {
  tools?: {
    register: (tool: unknown) => void | (() => void);
  };
  get?: (name: string) => unknown;
  effect?: (fn: () => void | (() => void)) => void;
  provide?: (key: string, value: unknown) => void;
  inject?: (deps: string[], fn: (scope: LooseCtx) => void) => void;
  [key: string]: unknown;
};

type Config = {
  hostPort?: number;
  runtimeRoot?: string;
  themeId?: string;
  demoDir?: string;
};

function expandHome(p: string): string {
  if (!p.startsWith("~")) return p;
  return path.join(os.homedir(), p.slice(1));
}

function resolveRuntimeRoot(cfg: Config): string {
  if (cfg.runtimeRoot) return expandHome(cfg.runtimeRoot);
  if (process.env.MONKEY_MINI_APP_RUNTIME) return expandHome(process.env.MONKEY_MINI_APP_RUNTIME);
  return path.join(os.homedir(), ".monkey-mini-app", "runtime");
}

export const name = "monkey-mini-app";
export const inject = ["tools"];

export async function apply(ctx: LooseCtx, config: Config = {}) {
  const runtimeRoot = resolveRuntimeRoot(config);
  setHostRuntimeRoot(runtimeRoot);
  const saved = readHostConfig(runtimeRoot);
  let hostPort = saved.hostPort;
  if (config.hostPort != null) {
    try {
      hostPort = clampPort(config.hostPort);
    } catch {
      /* keep saved */
    }
  }

  // 组合根：createHost(adapter, options) —— 能力/工具/HTTP 全在 host-core
  const adapter = buildDshAdapter(ctx, { runtimeRoot });
  const host = createHost(adapter, {
    runtimeRoot,
    hostPort,
    themeId: config.themeId ?? saved.theme,
    demoDir:
      config.demoDir ||
      process.env.MONKEY_MINI_APP_DEMO_DIR ||
      path.join(MODULE_DIR, "..", "..", "..", "apps", "demo-host", "dist"),
  });

  const { port } = await host.apply(ctx); // attach（注册工具/skill/服务）+ 起 HTTP
  console.log(`[monkey-mini-app] apps host http://127.0.0.1:${port}`);
  console.log(`[monkey-mini-app] loaded · runtimeRoot=${runtimeRoot} · skill=${getSkillDir()}`);

  // Reversible cleanup
  return () => {
    void host.stop();
  };
}

export default { name, inject, apply };
