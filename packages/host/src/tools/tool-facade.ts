import type { AppsManager } from "../apps/apps-manager.ts";
import { HostError } from "../errors.ts";
import type { HostEventBus } from "../events/host-events.ts";
import type { GitHistory } from "../git/git-history.ts";
import type { WorkspacePaths } from "../paths/workspace-paths.ts";

export type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (args: Record<string, unknown>, signal?: AbortSignal) => Promise<unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new HostError("INVALID_TOOL_ARGS", `missing ${key}`);
  }
  return value;
}

function asFiles(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    throw new HostError("INVALID_TOOL_ARGS", "files must be an object of strings");
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value)) {
    if (typeof v !== "string") {
      throw new HostError("INVALID_TOOL_ARGS", `files.${k} must be a string`);
    }
    out[k] = v;
  }
  return out;
}

function asEdits(value: unknown): { oldText: string; newText: string }[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new HostError("INVALID_TOOL_ARGS", "edits must be a non-empty array");
  }
  return value.map((item, i) => {
    if (!isRecord(item)) {
      throw new HostError("INVALID_TOOL_ARGS", `edits[${i}] must be an object`);
    }
    if (typeof item.oldText !== "string" || typeof item.newText !== "string") {
      throw new HostError("INVALID_TOOL_ARGS", `edits[${i}] requires oldText and newText strings`);
    }
    return { oldText: item.oldText, newText: item.newText };
  });
}

function optionalPositiveInt(value: unknown, key: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new HostError("INVALID_TOOL_ARGS", `${key} must be an integer`);
  }
  return value;
}

/** Normalize startLine/endLine plus Pi-style offset/limit aliases. */
function parseReadRange(args: Record<string, unknown>): {
  startLine?: number;
  endLine?: number;
  numbered?: boolean;
} {
  const startLine = optionalPositiveInt(args.startLine, "startLine");
  const endLine = optionalPositiveInt(args.endLine, "endLine");
  const offset = optionalPositiveInt(args.offset, "offset");
  const limit = optionalPositiveInt(args.limit, "limit");
  const numbered = args.numbered === true ? true : undefined;

  const start = startLine ?? offset;
  let end = endLine;
  if (end === undefined && start !== undefined && limit !== undefined) {
    if (limit < 1) {
      throw new HostError("INVALID_TOOL_ARGS", "limit must be >= 1");
    }
    end = start + limit - 1;
  } else if (end === undefined && start === undefined && limit !== undefined) {
    // limit alone → first N lines (offset defaults to 1)
    if (limit < 1) {
      throw new HostError("INVALID_TOOL_ARGS", "limit must be >= 1");
    }
    return { startLine: 1, endLine: limit, numbered };
  }

  if (start === undefined && end === undefined && numbered === undefined) {
    return {};
  }
  return { startLine: start, endLine: end, numbered };
}

const APP_ID_SCHEMA = { type: "string" } as const;

/** Host chat tools: `mini_app_list`, `mini_app_read`, … and `mini_app_list_ctx_tools`. */
export function isMiniAppToolName(name: string): boolean {
  return name.startsWith("mini_app_");
}

/** Agent-facing mini_app_* tools. Execute calls AppsManager / GitHistory — never HTTP. */
export class ToolFacade {
  constructor(
    private readonly apps: AppsManager,
    private readonly git: GitHistory,
    private readonly paths: WorkspacePaths,
    private readonly events?: HostEventBus,
  ) {}

  definitions(): ToolDefinition[] {
    return [
      {
        name: "mini_app_list",
        description: "List registered monkey-mini-app applications",
        inputSchema: { type: "object", properties: {} },
        execute: (args, signal) => this.invoke("mini_app_list", args, signal),
      },
      {
        name: "mini_app_get",
        description: "Get app manifest summary and absolute directory path",
        inputSchema: {
          type: "object",
          properties: { appId: APP_ID_SCHEMA },
          required: ["appId"],
        },
        execute: (args, signal) => this.invoke("mini_app_get", args, signal),
      },
      {
        name: "mini_app_reload",
        description:
          "Validate + sync-compile main.api and ui for an app (replaces mini_app_validate). Returns compile errors if any. On success, auto-commits if the worktree is dirty. Call after a round of edits to verify and warm the UI cache.",
        inputSchema: {
          type: "object",
          properties: { appId: APP_ID_SCHEMA },
          required: ["appId"],
        },
        execute: (args, signal) => this.invoke("mini_app_reload", args, signal),
      },
      {
        name: "mini_app_register",
        description:
          "Create a mini-app scaffold under runtime/apps/<appId>/. Prefer this for NEW apps (requires manifest.json). For edits to an existing app, use mini_app_read + mini_app_edit (or mini_app_write). files keys are relative paths (manifest.json, ui.tsx, main.api.ts, lib/..., components/...). No .. or absolute paths.",
        inputSchema: {
          type: "object",
          properties: {
            appId: APP_ID_SCHEMA,
            files: {
              type: "object",
              // dsh-tools requires boolean additionalProperties (not a nested schema).
              additionalProperties: true,
              description:
                "Relative path → UTF-8 source text (string values). Example keys: manifest.json, ui.tsx, main.api.ts, lib/parse.ts, components/Card.tsx",
            },
          },
          required: ["appId", "files"],
        },
        execute: (args, signal) => this.invoke("mini_app_register", args, signal),
      },
      {
        name: "mini_app_list_files",
        description: "List source files in a mini-app (relative paths + sizes). Skips .git/storage/node_modules.",
        inputSchema: {
          type: "object",
          properties: { appId: APP_ID_SCHEMA },
          required: ["appId"],
        },
        execute: (args, signal) => this.invoke("mini_app_list_files", args, signal),
      },
      {
        name: "mini_app_read",
        description:
          "Read one mini-app source file. Optional 1-indexed inclusive line window: startLine/endLine (omit both = whole file; only startLine = to EOF; only endLine = from line 1). Aliases: offset≡startLine, limit≡line count. Returns { path, content, bytes, totalLines, startLine, endLine, truncated? }. Set numbered:true to prefix lines as N|text (default raw — better for mini_app_edit).",
        inputSchema: {
          type: "object",
          properties: {
            appId: APP_ID_SCHEMA,
            path: { type: "string", description: "Relative path e.g. ui.tsx, main.api.ts, lib/x.ts" },
            startLine: {
              type: "number",
              description: "1-indexed start line (inclusive). Omit with endLine for full file.",
            },
            endLine: {
              type: "number",
              description: "1-indexed end line (inclusive). Omit to read through EOF.",
            },
            offset: {
              type: "number",
              description: "Alias of startLine (Pi/Claude style).",
            },
            limit: {
              type: "number",
              description: "Max lines to read from startLine/offset (alternative to endLine).",
            },
            numbered: {
              type: "boolean",
              description: "If true, content lines are prefixed with N| (absolute line numbers).",
            },
          },
          required: ["appId", "path"],
        },
        execute: (args, signal) => this.invoke("mini_app_read", args, signal),
      },
      {
        name: "mini_app_edit",
        description:
          "Surgically edit an existing mini-app file with exact text replacement (Pi-style). Pass edits: [{ oldText, newText }, ...]. Each oldText must match uniquely. Prefer this over mini_app_write for small changes. Default auto-commits; set commit:false to batch then mini_app_reload.",
        inputSchema: {
          type: "object",
          properties: {
            appId: APP_ID_SCHEMA,
            path: { type: "string" },
            edits: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  oldText: { type: "string" },
                  newText: { type: "string" },
                },
                required: ["oldText", "newText"],
              },
              description: "One or more unique replacements matched against the original file",
            },
            commit: {
              type: "boolean",
              description: "Auto-commit after edit (default true). Set false to batch changes.",
            },
          },
          required: ["appId", "path", "edits"],
        },
        execute: (args, signal) => this.invoke("mini_app_edit", args, signal),
      },
      {
        name: "mini_app_write",
        description:
          "Create or overwrite one mini-app file with full contents. Use for new files or large rewrites; prefer mini_app_edit for small surgical changes. Default auto-commits; set commit:false to batch.",
        inputSchema: {
          type: "object",
          properties: {
            appId: APP_ID_SCHEMA,
            path: { type: "string" },
            content: { type: "string" },
            commit: { type: "boolean" },
          },
          required: ["appId", "path", "content"],
        },
        execute: (args, signal) => this.invoke("mini_app_write", args, signal),
      },
      {
        name: "mini_app_delete",
        description:
          "Delete one mini-app source file (cannot delete manifest.json). Default auto-commits; set commit:false to batch.",
        inputSchema: {
          type: "object",
          properties: {
            appId: APP_ID_SCHEMA,
            path: { type: "string" },
            commit: { type: "boolean" },
          },
          required: ["appId", "path"],
        },
        execute: (args, signal) => this.invoke("mini_app_delete", args, signal),
      },
      {
        name: "mini_app_open",
        description:
          "Open the mini-app in the dsh 小程序 side panel. The web Host will pop open and focus this app.",
        inputSchema: {
          type: "object",
          properties: {
            appId: APP_ID_SCHEMA,
            title: { type: "string" },
          },
          required: ["appId"],
        },
        execute: (args, signal) => this.invoke("mini_app_open", args, signal),
      },
      {
        name: "mini_app_call",
        description:
          "Call a mini-app api method. args is a plain object. Do not curl the host HTTP API.",
        inputSchema: {
          type: "object",
          properties: {
            appId: APP_ID_SCHEMA,
            method: { type: "string" },
            args: { type: "object" },
          },
          required: ["appId", "method"],
        },
        execute: (args, signal) => this.invoke("mini_app_call", args, signal),
      },
      {
        name: "mini_app_history_commit",
        description: "Commit current app working tree (single-branch main)",
        inputSchema: {
          type: "object",
          properties: {
            appId: APP_ID_SCHEMA,
            message: { type: "string" },
          },
          required: ["appId", "message"],
        },
        execute: (args, signal) => this.invoke("mini_app_history_commit", args, signal),
      },
      {
        name: "mini_app_history_list",
        description: "List commit tree (nodes + parentIds, includes backup tips after reset)",
        inputSchema: {
          type: "object",
          properties: {
            appId: APP_ID_SCHEMA,
            limit: { type: "number" },
          },
          required: ["appId"],
        },
        execute: (args, signal) => this.invoke("mini_app_history_list", args, signal),
      },
      {
        name: "mini_app_history_reset",
        description: "Reset main to commitId; creates backup ref; does not delete commits",
        inputSchema: {
          type: "object",
          properties: {
            appId: APP_ID_SCHEMA,
            commitId: { type: "string" },
          },
          required: ["appId", "commitId"],
        },
        execute: (args, signal) => this.invoke("mini_app_history_reset", args, signal),
      },
      {
        name: "mini_app_history_revert",
        description: "Forward-commit that undoes a past commit (git revert semantics)",
        inputSchema: {
          type: "object",
          properties: {
            appId: APP_ID_SCHEMA,
            commitId: { type: "string" },
          },
          required: ["appId", "commitId"],
        },
        execute: (args, signal) => this.invoke("mini_app_history_revert", args, signal),
      },
    ];
  }

  async invoke(
    name: string,
    args: Record<string, unknown> = {},
    signal?: AbortSignal,
  ): Promise<unknown> {
    switch (name) {
      case "mini_app_list":
        return { apps: await this.apps.list(), runtimeRoot: this.paths.root };
      case "mini_app_get":
        return this.handleGet(args);
      case "mini_app_reload":
        return this.handleReload(args);
      case "mini_app_register":
        return this.handleRegister(args);
      case "mini_app_list_files":
        return this.handleListFiles(args);
      case "mini_app_read":
        return this.handleRead(args);
      case "mini_app_edit":
        return this.handleEdit(args);
      case "mini_app_write":
        return this.handleWrite(args);
      case "mini_app_delete":
        return this.handleDelete(args);
      case "mini_app_open":
        return this.handleOpen(args);
      case "mini_app_call":
        return this.handleCall(args, signal);
      case "mini_app_history_commit":
        return this.handleHistoryCommit(args);
      case "mini_app_history_list":
        return this.handleHistoryList(args);
      case "mini_app_history_reset":
        return this.handleHistoryReset(args);
      case "mini_app_history_revert":
        return this.handleHistoryRevert(args);
      default:
        throw new HostError("UNKNOWN_TOOL", `UNKNOWN_TOOL: ${name}`);
    }
  }

  private async handleGet(args: Record<string, unknown>): Promise<unknown> {
    const appId = requireString(args, "appId");
    const app = await this.apps.get(appId);
    if (!app) {
      return { ok: false, error: "NOT_FOUND" };
    }
    return { ok: true, app, path: this.apps.dirOf(appId) };
  }

  private async handleReload(args: Record<string, unknown>): Promise<unknown> {
    const appId = requireString(args, "appId");
    return this.apps.reload(appId);
  }

  private async handleRegister(args: Record<string, unknown>): Promise<unknown> {
    const appId = requireString(args, "appId");
    const files = asFiles(args.files);
    const app = await this.apps.register(appId, files);
    return { ok: true, path: this.apps.dirOf(appId), app };
  }

  private async handleListFiles(args: Record<string, unknown>): Promise<unknown> {
    const appId = requireString(args, "appId");
    const files = await this.apps.listFiles(appId);
    return { ok: true, appId, files };
  }

  private async handleRead(args: Record<string, unknown>): Promise<unknown> {
    const appId = requireString(args, "appId");
    const path = requireString(args, "path");
    const range = parseReadRange(args);
    try {
      const file = await this.apps.readFile(appId, path, range);
      return { ok: true, ...file };
    } catch (cause) {
      if (cause instanceof HostError && cause.code === "INVALID_RANGE") {
        return { ok: false, error: cause.message, code: cause.code };
      }
      throw cause;
    }
  }

  private async handleEdit(args: Record<string, unknown>): Promise<unknown> {
    const appId = requireString(args, "appId");
    const path = requireString(args, "path");
    const edits = asEdits(args.edits);
    const commit = args.commit === false ? false : undefined;
    try {
      const result = await this.apps.editFile(appId, path, edits, { commit });
      return { ok: true, ...result };
    } catch (cause) {
      if (cause instanceof HostError && cause.code === "EDIT_FAILED") {
        return { ok: false, error: cause.message, code: cause.code };
      }
      throw cause;
    }
  }

  private async handleWrite(args: Record<string, unknown>): Promise<unknown> {
    const appId = requireString(args, "appId");
    const path = requireString(args, "path");
    const content = requireString(args, "content");
    const commit = args.commit === false ? false : undefined;
    const result = await this.apps.writeFile(appId, path, content, { commit });
    return { ok: true, ...result };
  }

  private async handleDelete(args: Record<string, unknown>): Promise<unknown> {
    const appId = requireString(args, "appId");
    const path = requireString(args, "path");
    const commit = args.commit === false ? false : undefined;
    const result = await this.apps.deleteFile(appId, path, { commit });
    return { ok: true, ...result };
  }

  private async handleOpen(args: Record<string, unknown>): Promise<unknown> {
    const appId = requireString(args, "appId");
    const app = await this.apps.get(appId);
    if (!app) {
      return { ok: false, error: "NOT_FOUND" };
    }
    const title = typeof args.title === "string" && args.title ? args.title : app.name;
    this.events?.emit({ type: "app:open", appId: app.id, title });
    return { ok: true, appId: app.id, title };
  }

  private async handleCall(
    args: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const appId = requireString(args, "appId");
    const method = requireString(args, "method");
    const callArgs = isRecord(args.args) ? args.args : args.args === undefined ? {} : args.args;
    try {
      const value = await this.apps.call(appId, method, callArgs, signal);
      return { ok: true, value };
    } catch (cause) {
      if (signal?.aborted) {
        return { ok: false, error: "cancelled", cancelled: true };
      }
      const message = cause instanceof Error ? cause.message : String(cause);
      return { ok: false, error: message };
    }
  }

  private async handleHistoryCommit(args: Record<string, unknown>): Promise<unknown> {
    const appId = requireString(args, "appId");
    const message = requireString(args, "message");
    const dir = this.apps.dirOf(appId);
    await this.git.init(dir);
    return this.git.commit(dir, message);
  }

  private async handleHistoryList(args: Record<string, unknown>): Promise<unknown> {
    const appId = requireString(args, "appId");
    const limit = typeof args.limit === "number" ? args.limit : undefined;
    const dir = this.apps.dirOf(appId);
    await this.git.init(dir);
    return this.git.listCommits(dir, { limit });
  }

  private async handleHistoryReset(args: Record<string, unknown>): Promise<unknown> {
    const appId = requireString(args, "appId");
    const commitId = requireString(args, "commitId");
    const dir = this.apps.dirOf(appId);
    await this.git.init(dir);
    return this.git.resetTo(dir, commitId);
  }

  private async handleHistoryRevert(args: Record<string, unknown>): Promise<unknown> {
    const appId = requireString(args, "appId");
    const commitId = requireString(args, "commitId");
    const dir = this.apps.dirOf(appId);
    await this.git.init(dir);
    return this.git.revert(dir, commitId);
  }
}
