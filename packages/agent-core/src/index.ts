import type { RuntimePort, AppTab, CommitTree } from "@monkey-mini-app/host-port";
import path from "node:path";

export type AgentToolDef = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export type AgentCoreContext = {
  runtime: RuntimePort;
  /** Absolute path to apps/<id> */
  resolveAppDir: (appId: string) => string;
  runtimeRoot: string;
};

export type AgentHandlers = {
  mini_app_list: () => Promise<unknown>;
  mini_app_get: (input: { appId: string }) => Promise<unknown>;
  mini_app_validate: (input: { appId: string }) => Promise<unknown>;
  mini_app_register: (input: {
    appId: string;
    files: Record<string, string>;
  }) => Promise<unknown>;
  mini_app_open: (input: { appId: string; title?: string }) => Promise<AppTab>;
  mini_app_close_tab: (input: { tabId: string }) => Promise<unknown>;
  mini_app_list_tabs: () => Promise<AppTab[]>;
  mini_app_focus: (input: { tabId: string }) => Promise<unknown>;
  mini_app_history_commit: (input: {
    appId: string;
    message: string;
  }) => Promise<unknown>;
  mini_app_history_list: (input: {
    appId: string;
    limit?: number;
  }) => Promise<CommitTree>;
  mini_app_history_reset: (input: {
    appId: string;
    commitId: string;
  }) => Promise<unknown>;
  mini_app_history_revert: (input: {
    appId: string;
    commitId: string;
  }) => Promise<unknown>;
  mini_app_set_theme: (input: { themeId: string }) => Promise<unknown>;
};

const APP_ID_RE = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/;

export function listAgentTools(): AgentToolDef[] {
  return [
    {
      name: "mini_app_list",
      description: "List registered monkey-mini-app applications",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "mini_app_get",
      description: "Get app manifest summary and absolute directory path",
      inputSchema: {
        type: "object",
        properties: { appId: { type: "string" } },
        required: ["appId"],
      },
    },
    {
      name: "mini_app_validate",
      description: "Validate app id format and that app is registered (or path ready)",
      inputSchema: {
        type: "object",
        properties: { appId: { type: "string" } },
        required: ["appId"],
      },
    },
    {
      name: "mini_app_register",
      description:
        "Register app from in-memory file map (manifest + sources). Prefer writing files via host fs tools then register.",
      inputSchema: {
        type: "object",
        properties: {
          appId: { type: "string" },
          files: { type: "object", additionalProperties: { type: "string" } },
        },
        required: ["appId", "files"],
      },
    },
    {
      name: "mini_app_open",
      description: "Open app in a new host tab (multi-tab; does not close others)",
      inputSchema: {
        type: "object",
        properties: {
          appId: { type: "string" },
          title: { type: "string" },
        },
        required: ["appId"],
      },
    },
    {
      name: "mini_app_close_tab",
      description: "Close a host tab by tabId",
      inputSchema: {
        type: "object",
        properties: { tabId: { type: "string" } },
        required: ["tabId"],
      },
    },
    {
      name: "mini_app_list_tabs",
      description: "List open host tabs",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "mini_app_focus",
      description: "Focus an open tab",
      inputSchema: {
        type: "object",
        properties: { tabId: { type: "string" } },
        required: ["tabId"],
      },
    },
    {
      name: "mini_app_history_commit",
      description: "Commit current app working tree (single-branch main)",
      inputSchema: {
        type: "object",
        properties: {
          appId: { type: "string" },
          message: { type: "string" },
        },
        required: ["appId", "message"],
      },
    },
    {
      name: "mini_app_history_list",
      description: "List commit tree (nodes + parentIds, includes backup tips after reset)",
      inputSchema: {
        type: "object",
        properties: {
          appId: { type: "string" },
          limit: { type: "number" },
        },
        required: ["appId"],
      },
    },
    {
      name: "mini_app_history_reset",
      description: "Reset main to commitId; creates backup ref; does not delete commits",
      inputSchema: {
        type: "object",
        properties: {
          appId: { type: "string" },
          commitId: { type: "string" },
        },
        required: ["appId", "commitId"],
      },
    },
    {
      name: "mini_app_history_revert",
      description: "Forward-commit that undoes a past commit (git revert semantics)",
      inputSchema: {
        type: "object",
        properties: {
          appId: { type: "string" },
          commitId: { type: "string" },
        },
        required: ["appId", "commitId"],
      },
    },
    {
      name: "mini_app_set_theme",
      description: "Set host theme id (e.g. light|dark)",
      inputSchema: {
        type: "object",
        properties: { themeId: { type: "string" } },
        required: ["themeId"],
      },
    },
  ];
}

export function createAgentHandlers(ctx: AgentCoreContext): AgentHandlers {
  const { runtime, resolveAppDir, runtimeRoot } = ctx;

  return {
    async mini_app_list() {
      const apps = await runtime.listApps();
      return { apps, runtimeRoot };
    },

    async mini_app_get({ appId }) {
      const app = await runtime.getApp(appId);
      if (!app) return { ok: false, error: "NOT_FOUND" };
      return {
        ok: true,
        app,
        path: resolveAppDir(appId),
      };
    },

    async mini_app_validate({ appId }) {
      const errors: string[] = [];
      if (!APP_ID_RE.test(appId)) {
        errors.push("appId must be reverse-DNS (e.g. com.example.todo)");
      }
      const app = await runtime.getApp(appId);
      if (!app) errors.push("app not registered; write files then mini_app_register");
      return { ok: errors.length === 0, errors, path: resolveAppDir(appId) };
    },

    async mini_app_register({ appId, files }) {
      if (!APP_ID_RE.test(appId)) throw new Error("INVALID_APP_ID");
      if (!files["manifest.json"]) throw new Error("MISSING_MANIFEST");
      await runtime.registerAppFromFiles(appId, files);
      return {
        ok: true,
        path: resolveAppDir(appId),
        app: await runtime.getApp(appId),
      };
    },

    async mini_app_open({ appId, title }) {
      return runtime.openTab(appId, { title });
    },

    async mini_app_close_tab({ tabId }) {
      await runtime.closeTab(tabId);
      return { ok: true };
    },

    async mini_app_list_tabs() {
      return runtime.listTabs();
    },

    async mini_app_focus({ tabId }) {
      await runtime.focusTab(tabId);
      return { ok: true, active: await runtime.getActiveTab() };
    },

    async mini_app_history_commit({ appId, message }) {
      return runtime.historyCommit(appId, message);
    },

    async mini_app_history_list({ appId, limit }) {
      return runtime.historyList(appId, { limit });
    },

    async mini_app_history_reset({ appId, commitId }) {
      return runtime.historyResetTo(appId, commitId);
    },

    async mini_app_history_revert({ appId, commitId }) {
      return runtime.historyRevert(appId, commitId);
    },

    async mini_app_set_theme({ themeId }) {
      await runtime.setTheme(themeId);
      return { ok: true, themeId: await runtime.getTheme() };
    },
  };
}

/** Dispatch by tool name for harness adapters */
export async function invokeAgentTool(
  handlers: AgentHandlers,
  name: string,
  input: Record<string, unknown> = {}
): Promise<unknown> {
  const map = handlers as unknown as Record<
    string,
    (i: Record<string, unknown>) => Promise<unknown>
  >;
  const fn = map[name];
  if (!fn) throw new Error(`UNKNOWN_TOOL: ${name}`);
  return fn(input);
}

export function defaultResolveAppDir(runtimeRoot: string, appId: string): string {
  return path.join(runtimeRoot, "apps", appId);
}
