import type { AppsManager } from "./apps/apps-manager.ts";
import type { HostEventBus } from "./events/host-events.ts";
import type { GitHistory } from "./git/git-history.ts";
import type { WorkspacePaths } from "./paths/workspace-paths.ts";
import type { ToolPort } from "./tools/tool-port.ts";
import type { HostConfig } from "./types.ts";

export type LogLevel = "debug" | "info" | "warn" | "error";

/** Domain managers passed to `attach`. HTTP and tools both call these. */
export type HostServices = {
  apps: AppsManager;
  git: GitHistory;
  /** ToolPort handle (`mini_app_*`). Kernel-owned semantics; adapters register/transport only. */
  tools: ToolPort;
  paths: WorkspacePaths;
  config: HostConfig;
  /** Host → browser SSE bus (`ctx.push` lands here). */
  events: HostEventBus;
};

/**
 * Hooks the host calls so an adapter can attach to the outside world
 * (register tools, install skills, log). Not every adapter is an agent plugin —
 * demo/daemon may no-op `attach`.
 *
 * Prefer {@link AdapterHooks} in new code. `HostLifecycle` remains as a compatibility alias.
 *
 * Every hook is invoked **on this object** (`lifecycle.detach()`), never pulled out and
 * called bare — so a class may implement them as methods and rely on `this`.
 */
export interface HostLifecycle {
  attach(ctx: unknown, services: HostServices): void | Promise<void>;
  /** Teardown. Called with the lifecycle as receiver; may use `this`. */
  detach?(): void | Promise<void>;
  onHostPortChanged?(port: number): void;
  log?(level: LogLevel, message: string, meta?: unknown): void;
}

/** Preferred name for {@link HostLifecycle}. */
export type AdapterHooks = HostLifecycle;
