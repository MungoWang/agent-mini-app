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

/** Legend for the compact snapshot keys, returned alongside the tree so it is self-describing. */
const OUTLINE_KEY_DOC =
  "t=tag i=id c=class r=role al=aria-label x=text ph=placeholder w/h=pixel size " +
  "s=applied styles {d:display c:color bg:background fz:font-size fw:font-weight fd:flex-direction gap:gap op:opacity} " +
  "k=children empty=leaf with no text/size (usually a class that did not apply)";

type OutlineNode = Record<string, unknown>;

function isOutlineNode(value: unknown): value is OutlineNode {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Re-trim an outline for the caller: depth is bounded again, and `textOnly` drops the
 * structural wrappers so an agent can read a page without paying for every div.
 */
function trimOutline(node: unknown, maxDepth: number, textOnly: boolean): unknown {
  if (!isOutlineNode(node)) return node;
  const out: OutlineNode = {};
  for (const [k, v] of Object.entries(node)) {
    if (k !== "k") out[k] = v;
  }
  const kids = Array.isArray(node.k) ? node.k : undefined;
  if (kids && maxDepth > 1) {
    const kept = kids
      .map((child) => trimOutline(child, maxDepth - 1, textOnly))
      .filter((child) => {
        if (!textOnly) return true;
        return isOutlineNode(child) && (child.x !== undefined || child.ph !== undefined || child.r !== undefined || child.k !== undefined);
      });
    if (kept.length) out.k = kept;
  } else if (kids && textOnly) {
    out.kidsDropped = kids.length;
  }
  return out;
}

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
          "Create a mini-app scaffold under runtime/apps/<appId>/. Prefer this for NEW apps (requires manifest.json). For edits to an existing app, use mini_app_read + mini_app_edit (or mini_app_write). files keys are relative paths (manifest.json, ui.tsx, main.api.ts, ui/..., api/..., shared/...). No .. or absolute paths.",
        inputSchema: {
          type: "object",
          properties: {
            appId: APP_ID_SCHEMA,
            files: {
              type: "object",
              // dsh-tools requires boolean additionalProperties (not a nested schema).
              additionalProperties: true,
              description:
                "Relative path → UTF-8 source text (string values). Example keys: manifest.json, ui.tsx, main.api.ts, ui/Card.tsx, api/parse.ts, shared/format.ts",
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
            path: { type: "string", description: "Relative path e.g. ui.tsx, main.api.ts, shared/format.ts" },
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
          "Open the mini-app in the 小程序 side panel and report whether a panel actually received it. `panel: \"no-panel-connected\"` means no browser is attached to /api/events — the app is fine, nobody is watching, so tell the user to open the panel.",
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
          "Smoke-test a mini-app api method. args is a plain object. For a set of calls, pass calls: [{ method, args }] instead of method — they run in order and every entry gets its own result, so one failure does not hide the others. Do not curl the host HTTP API.",
        inputSchema: {
          type: "object",
          properties: {
            appId: APP_ID_SCHEMA,
            method: { type: "string", description: "Single call (legacy shape)." },
            args: { type: "object" },
            calls: {
              type: "array",
              description: "Batch shape: up to 20 calls, run sequentially.",
              items: {
                type: "object",
                properties: { method: { type: "string" }, args: { type: "object" } },
                required: ["method"],
              },
            },
          },
          required: ["appId"],
        },
        execute: (args, signal) => this.invoke("mini_app_call", args, signal),
      },
      {
        name: "mini_app_errors",
        description:
          "Read runtime errors the app iframe reported to the host — the only way to see a UI that compiled fine and then crashed in the browser. Kinds: render (error boundary, has componentStack) / module (bundle failed to load) / uncaught / async. Runtime errors need a live iframe, so call mini_app_open first, then read again after the view has had a moment to render. Pass since (last returned lastSeq) to poll only for new ones, or clear:true to empty the ring.",
        inputSchema: {
          type: "object",
          properties: {
            appId: APP_ID_SCHEMA,
            since: { type: "number", description: "Return only errors after this sequence id." },
            clear: { type: "boolean", description: "Empty the ring before reading." },
          },
          required: ["appId"],
        },
        execute: (args, signal) => this.invoke("mini_app_errors", args, signal),
      },
      {
        name: "mini_app_dom_snapshot",
        description:
          "Read the last DOM outline the app iframe reported: tag / class / role / text / measured size, plus the styles that actually applied (color, background, font-size, display, gap, opacity) on text and interactive nodes. This is how you check whether a Tailwind class or theme token really took effect instead of guessing — it is **not** a screenshot, and it is only as fresh as the last render, so mini_app_open first. Nodes are keyed t/i/c/r/al/x/ph/w/h/s/k (see the skill).",
        inputSchema: {
          type: "object",
          properties: {
            appId: APP_ID_SCHEMA,
            depth: { type: "number", description: "Trim the outline to N levels (default 8)." },
            textOnly: { type: "boolean", description: "Keep only nodes carrying text or a control." },
          },
          required: ["appId"],
        },
        execute: (args, signal) => this.invoke("mini_app_dom_snapshot", args, signal),
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
      case "mini_app_errors":
        return this.handleErrors(args);
      case "mini_app_dom_snapshot":
        return this.handleDomSnapshot(args);
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
    return {
      ok: true,
      appId: app.id,
      title,
      // A delivery receipt beats telling the user "it should be open": the host knows
      // whether any browser is actually attached to /api/events.
      panel: this.events && this.events.listenerCount() > 0 ? "notified" : "no-panel-connected",
    };
  }

  private async handleCall(
    args: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const appId = requireString(args, "appId");

    // Batch shape: one round trip for a whole CRUD smoke test.
    if (args.calls !== undefined) {
      if (!Array.isArray(args.calls) || args.calls.length === 0) {
        throw new HostError("INVALID_TOOL_ARGS", "calls must be a non-empty array");
      }
      if (args.calls.length > 20) {
        throw new HostError("INVALID_TOOL_ARGS", "calls accepts at most 20 entries");
      }
      const results: unknown[] = [];
      for (const [i, raw] of args.calls.entries()) {
        if (!isRecord(raw) || typeof raw.method !== "string" || !raw.method) {
          throw new HostError("INVALID_TOOL_ARGS", `calls[${i}] requires a method string`);
        }
        const callArgs = isRecord(raw.args) ? raw.args : {};
        results.push({ method: raw.method, ...(await this.callOne(appId, raw.method, callArgs, signal)) });
        if (signal?.aborted) break;
      }
      const failed = results.filter((r) => (r as { ok?: boolean }).ok === false).length;
      return { ok: failed === 0, results, failed };
    }

    const method = requireString(args, "method");
    const callArgs = isRecord(args.args) ? args.args : args.args === undefined ? {} : args.args;
    return this.callOne(appId, method, callArgs, signal);
  }

  private async callOne(
    appId: string,
    method: string,
    callArgs: unknown,
    signal?: AbortSignal,
  ): Promise<Record<string, unknown>> {
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

  private handleErrors(args: Record<string, unknown>): unknown {
    const appId = requireString(args, "appId");
    if (!this.events) {
      return { ok: false, error: "this host has no event bus — runtime errors are unavailable" };
    }
    const sinceRaw = args.since;
    const since = typeof sinceRaw === "number" && Number.isFinite(sinceRaw) && sinceRaw > 0 ? sinceRaw : 0;
    if (args.clear === true) this.events.forgetErrors(appId);
    const { errors, lastSeq, dropped } = this.events.appErrorsFor(appId, args.clear === true ? 0 : since);
    return {
      ok: true,
      appId,
      errors,
      lastSeq,
      ...(dropped > 0 ? { dropped, note: `${dropped} older error(s) already evicted from the ring` } : {}),
      ...(errors.length === 0
        ? {
            emptyHint:
              "no errors reported yet — the iframe posts these only while it is open and rendering; if you just reloaded, call mini_app_open and read again",
          }
        : {}),
    };
  }

  private handleDomSnapshot(args: Record<string, unknown>): unknown {
    const appId = requireString(args, "appId");
    if (!this.events) {
      return { ok: false, error: "this host has no event bus — snapshots are unavailable" };
    }
    const snap = this.events.appSnapshot(appId);
    if (!snap) {
      return {
        ok: true,
        appId,
        snapshot: null,
        hint: "the app iframe has not reported a DOM outline yet — call mini_app_open and read again once it has rendered",
      };
    }
    const depthRaw = args.depth;
    const maxDepth = typeof depthRaw === "number" && Number.isFinite(depthRaw) && depthRaw > 0
      ? Math.min(Math.floor(depthRaw), 24)
      : 8;
    const dom = trimOutline(snap.dom, maxDepth, args.textOnly === true);
    return {
      ok: true,
      appId,
      at: snap.at,
      ageMs: Date.now() - snap.at,
      viewport: snap.viewport,
      truncated: snap.truncated === true,
      keys: OUTLINE_KEY_DOC,
      dom,
    };
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
