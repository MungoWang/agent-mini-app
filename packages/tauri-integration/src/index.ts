/**
 * Tauri integration helpers for monkey-mini-app.
 *
 * Runtime still runs in a Node/sidecar or in the WebView via a thin IPC layer.
 * Recommended production shape:
 *   1. Rust side resolves app data dir → pass as runtimeRoot
 *   2. Node sidecar (or Tauri 2 + node plugin) calls createMonkeyRuntime
 *   3. Frontend invokes commands that map to RuntimePort
 *
 * For pure WebView-only hosts without Node, ship a prebuilt worker or use
 * adapter-node only in CI/desktop sidecar.
 */

import path from "node:path";
import {
  createRuntime,
  type CreateRuntimeOptions,
  type Runtime,
} from "@monkey-mini-app/runtime-core";
import {
  createNodeHostPort,
  expandHome,
  resolvePaths,
} from "@monkey-mini-app/adapter-node";
import { createGitHistoryAdapter } from "@monkey-mini-app/app-history-git";
import { createHistory } from "@monkey-mini-app/app-history";
import type { HostPort } from "@monkey-mini-app/host-port";

export type TauriRuntimeOptions = {
  /** Absolute path from Tauri path API, e.g. appDataDir/monkey-mini-app/runtime */
  runtimeRoot?: string;
  sharedRoot?: string;
  hostHandlers?: Record<
    string,
    (payload: unknown) => Promise<unknown> | unknown
  >;
  themeId?: string;
};

export async function createMonkeyRuntime(
  options: TauriRuntimeOptions = {}
): Promise<Runtime> {
  const paths = resolvePaths({
    runtimeRoot: options.runtimeRoot,
    sharedRoot: options.sharedRoot,
  });
  const host: HostPort = createNodeHostPort({
    runtimeRoot: paths.runtimeRoot,
    hostHandlers: options.hostHandlers,
  });
  const history = createHistory(createGitHistoryAdapter());
  const opts: CreateRuntimeOptions = {
    host,
    history,
    themeId: options.themeId ?? "light",
  };
  return createRuntime(opts);
}

/**
 * Suggested Tauri command surface (implement in Rust invoke_handler or
 * JS plugin that calls this runtime instance).
 */
export type TauriCommandMap = {
  "mma.list_apps": () => ReturnType<Runtime["listApps"]>;
  "mma.get_app": (args: { id: string }) => ReturnType<Runtime["getApp"]>;
  "mma.set_theme": (args: { themeId: string }) => ReturnType<Runtime["setTheme"]>;
  "mma.get_theme": () => ReturnType<Runtime["getTheme"]>;
  "mma.register_app": (args: {
    appId: string;
    files: Record<string, string>;
  }) => ReturnType<Runtime["registerAppFromFiles"]>;
  "mma.history_commit": (args: {
    appId: string;
    message: string;
  }) => ReturnType<Runtime["historyCommit"]>;
  "mma.history_list": (args: {
    appId: string;
    limit?: number;
  }) => ReturnType<Runtime["historyList"]>;
  "mma.history_reset_to": (args: {
    appId: string;
    commitId: string;
  }) => ReturnType<Runtime["historyResetTo"]>;
  "mma.history_revert": (args: {
    appId: string;
    commitId: string;
  }) => ReturnType<Runtime["historyRevert"]>;
  "mma.apply_theme_tokens": () => Record<string, string>;
};

export function bindTauriCommands(rt: Runtime): TauriCommandMap {
  return {
    "mma.list_apps": () => rt.listApps(),
    "mma.get_app": ({ id }) => rt.getApp(id),
    "mma.set_theme": ({ themeId }) => rt.setTheme(themeId),
    "mma.get_theme": () => rt.getTheme(),
    "mma.register_app": ({ appId, files }) =>
      rt.registerAppFromFiles(appId, files),
    "mma.history_commit": ({ appId, message }) =>
      rt.historyCommit(appId, message),
    "mma.history_list": ({ appId, limit }) =>
      rt.historyList(appId, { limit }),
    "mma.history_reset_to": ({ appId, commitId }) =>
      rt.historyResetTo(appId, commitId),
    "mma.history_revert": ({ appId, commitId }) =>
      rt.historyRevert(appId, commitId),
    "mma.apply_theme_tokens": () => rt.applyThemeTokens(),
  };
}

export function defaultTauriRuntimeRoot(appDataDir: string): string {
  return path.join(appDataDir, "monkey-mini-app", "runtime");
}

export { expandHome, resolvePaths };
