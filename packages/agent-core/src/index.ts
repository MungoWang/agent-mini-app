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
  mini_app_open: (input: { appId: string; title?: string }) => Promise<unknown>;
  mini_app_close_tab: (input: { tabId: string }) => Promise<unknown>;
  mini_app_list_tabs: () => Promise<unknown>;
  mini_app_call: (input: {
    appId: string;
    method: string;
    args?: Record<string, unknown>;
  }) => Promise<unknown>;
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
        "Create or overwrite a mini-app. Pass { appId, files } where files keys are relative paths (manifest.json, ui.tsx, main.api.ts, lib/...). Do NOT Write into ~/.monkey-mini-app/runtime — the sandbox will deny it. This tool writes the files.",
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
      description:
        "Open the mini-app in the dsh 小程序 side panel. The web Host will pop open and focus this app.",
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
      name: "mini_app_call",
      description:
        "Call a mini-app api method for smoke tests. Use this instead of curl / bash against :17880. args is a plain object.",
      inputSchema: {
        type: "object",
        properties: {
          appId: { type: "string" },
          method: { type: "string" },
          args: { type: "object" },
        },
        required: ["appId", "method"],
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
      if (!app) errors.push("app not registered; call mini_app_register({ appId, files })");
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
      const tab = await runtime.openTab(appId, { title });
      return { ok: true, tab };
    },

    async mini_app_close_tab({ tabId }) {
      await runtime.closeTab(tabId);
      return { ok: true };
    },

    async mini_app_list_tabs() {
      const tabs = await runtime.listTabs();
      return { tabs };
    },

    async mini_app_call() {
      throw new Error("mini_app_call is provided by the dsh plugin host");
    },

    async mini_app_focus({ tabId }) {
      await runtime.focusTab(tabId);
      return { ok: true, active: await runtime.getActiveTab() };
    },

    async mini_app_history_commit({ appId, message }) {
      return runtime.historyCommit(appId, message);
    },

    async mini_app_history_list({ appId, limit }) {
      const tree = await runtime.historyList(appId, { limit });
      if (tree && typeof tree === "object" && !Array.isArray(tree)) return tree;
      return { commits: tree };
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
  input: Record<string, unknown> = {},
  signal?: AbortSignal
): Promise<unknown> {
  const map = handlers as unknown as Record<
    string,
    (i: Record<string, unknown>, signal?: AbortSignal) => Promise<unknown>
  >;
  const fn = map[name];
  if (!fn) throw new Error(`UNKNOWN_TOOL: ${name}`);
  return fn(input, signal);
}

export function defaultResolveAppDir(runtimeRoot: string, appId: string): string {
  return path.join(runtimeRoot, "apps", appId);
}
