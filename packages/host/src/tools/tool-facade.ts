import type { AppsManager } from "../apps/apps-manager.ts";
import { HostError } from "../errors.ts";
import type { HostEventBus } from "../events/host-events.ts";
import type { GitHistory } from "../git/git-history.ts";
import { VIEW_EVAL_BYTE_CAP } from "../http/app-view-eval.ts";
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

/**
 * What each unreachable view means and what to do about it. Kept next to the tool because
 * four failure states without four next steps would just move the guessing to the reader.
 */
const VIEW_HINTS: Record<string, string> = {
  "not-open":
    "nothing is rendering this app — call mini_app_open({ appId }), wait a moment, then retry",
  "runner-not-booted":
    "the iframe is open but its script never ran, so the bundle or the host page is broken — read mini_app_errors, then mini_app_open again",
  // Nothing host-side recovers this: the blocked iframe takes the panel page with it
  // (measured in Chrome — the tab stops answering CDP entirely), so the fix is a human one.
  stuck:
    "the view stopped answering and nothing can interrupt it — a synchronous loop (in this query, or in the app) also freezes the panel page around it, so ask the user to reload the browser tab, then mini_app_open",
  live: "the view answered with an error: fix the JS in `code` and retry",
};

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
          "Validate + sync-compile main.api and ui for an app (replaces mini_app_validate). Returns compile errors if any. On success, auto-commits if the worktree is dirty. Call after a round of edits to verify and warm the UI cache. " +
          "Always drops every in-memory build (api module, UI bundle, **app CSS**) and tells open panels to re-fetch — the `caches` block states what was dropped. " +
          "By default also purges on-disk build output (`.autogen/` + cached bundles) so you never inherit a stale Tailwind/esbuild artifact; pass `cleanCaches: false` only when you deliberately want to keep those files (faster, but you must trust the disk cache).",
        inputSchema: {
          type: "object",
          properties: {
            appId: APP_ID_SCHEMA,
            cleanCaches: {
              type: "boolean",
              description:
                "Purge on-disk build output (`.autogen/`, cached bundles) before rebuilding. Default true — pass false only to keep disk artifacts.",
            },
          },
          required: ["appId"],
        },
        execute: (args, signal) => this.invoke("mini_app_reload", args, signal),
      },
      {
        name: "mini_app_install",
        description:
          "Add or remove npm packages for ONE mini-app backend (installed into that app's directory with --ignore-scripts). Use only when main.api.ts must import a Node library the platform does not ship — a real file format, a binary protocol, a vendor SDK. Do NOT use it for lodash (already a platform module), for HTTP (use ctx.http), for shell (use ctx.bash), or for anything the host's ctx.tool / ctx.mcp already covers. A UI file (ui.tsx) can never import these packages; call() the backend instead. Empty request = read the app's current dependencies.",
        inputSchema: {
          type: "object",
          properties: {
            appId: APP_ID_SCHEMA,
            packages: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: true,
                properties: {
                  name: { type: "string", description: "npm package name, e.g. exceljs" },
                  version: { type: "string", description: "Optional range; omit for latest" },
                },
                required: ["name"],
              },
              description: "Dependencies to add",
            },
            remove: {
              type: "array",
              items: { type: "string" },
              description: "Package names to uninstall",
            },
            commit: { type: "boolean" },
          },
          required: ["appId"],
        },
        execute: (args, signal) => this.invoke("mini_app_install", args, signal),
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
        description: "List source files in a mini-app (relative paths + sizes). Skips .git/storage/node_modules.",        inputSchema: {
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
        name: "mini_app_view_eval",
        description:
          "Run JS against the app's rendered view and get the answer back — how you check what actually rendered. " +
          "`code` is an async function body, so it must `return`; no `code` returns the `#root` subtree. " +
          "Injected: mma.$(sel, root?) → Element|null · mma.$$(sel, root?) → Array<Element> (a real array, not jQuery) · mma.selector(el) → a CSS selector to pass back to mma.$(). " +
          "Everything else is standard DOM; host-side data is one same-origin fetch('/api/app/<appId>/errors') away. " +
          "Reply is capped at min(maxBytes, 6144) and says when it stopped (`truncated` + `stoppedBy` = bytes|nodes|depth|timeout) — never silently. " +
          "Needs an open iframe (mini_app_open first). `timeoutMs` (default 1500, max 8000) is the budget for one query; the reply echoes it as `budgetMs`. " +
          "When a query does not answer, `view` says which kind of failure it was: not-open / runner-not-booted / pending / stuck. `pending` means the view is HEALTHY and your expression is still running (a long await) — raise `timeoutMs` or split the query, and do not tell the user anything is broken. Only `stuck` means the main thread is genuinely blocked, which no tool recovers: a synchronous infinite loop wedges the view and the page around it, so the user must reload.",
        inputSchema: {
          type: "object",
          properties: {
            appId: APP_ID_SCHEMA,
            code: {
              type: "string",
              description: "Async function body. Must `return`. `mma` is in scope.",
            },
            maxBytes: { type: "number", description: "Reply budget (hard ceiling 6144)." },
            timeoutMs: {
              type: "number",
              description: "How long to wait for this query (default 1500, max 8000).",
            },
          },
          required: ["appId"],
        },
        execute: (args, signal) => this.invoke("mini_app_view_eval", args, signal),
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
      case "mini_app_install":
        return this.handleInstall(args);
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
      case "mini_app_view_eval":
        return this.handleViewEval(args);
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
    // Tool default is true so agents stop second-guessing stale Tailwind/esbuild artifacts.
    // AppsManager.reload itself still defaults to false when opts are omitted — only this
    // tool flips the default. Explicit `false` still opts out.
    const cleanCaches = args.cleanCaches !== false;
    return this.apps.reload(appId, { cleanCaches });
  }

  private async handleInstall(args: Record<string, unknown>): Promise<unknown> {
    const appId = requireString(args, "appId");
    return this.apps.installPackages(appId, {
      packages: args.packages,
      remove: args.remove,
      commit: typeof args.commit === "boolean" ? args.commit : undefined,
    });
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

  /**
   * Ask the rendered view a question by running the agent's own JS in it.
   *
   * Deliberately not `mini_app_errors`-shaped: that ring is a push buffer a crash writes to,
   * while this is a live request that can fail for four different reasons, each needing a
   * different next step. `view` says which one it was.
   */
  private async handleViewEval(args: Record<string, unknown>): Promise<unknown> {
    const appId = requireString(args, "appId");
    if (!this.events) {
      return { ok: false, view: "not-open", error: "this host has no event bus — the view is unreachable" };
    }
    const code = typeof args.code === "string" ? args.code : "";
    const maxBytesRaw = args.maxBytes;
    const maxBytes =
      typeof maxBytesRaw === "number" && Number.isFinite(maxBytesRaw) && maxBytesRaw > 0
        ? Math.min(Math.floor(maxBytesRaw), VIEW_EVAL_BYTE_CAP)
        : VIEW_EVAL_BYTE_CAP;
    const timeoutRaw = args.timeoutMs;
    const timeoutMs =
      typeof timeoutRaw === "number" && Number.isFinite(timeoutRaw) && timeoutRaw > 0
        ? Math.floor(timeoutRaw)
        : undefined;
    const reply = await this.events.requestViewEval(appId, code, maxBytes, timeoutMs);
    const base: Record<string, unknown> = {
      view: reply.view,
      tookMs: reply.tookMs,
      budgetMs: reply.budgetMs,
    };
    if (reply.ok) {
      return {
        ...base,
        ok: true,
        result: reply.result ?? "",
        bytes: reply.bytes ?? 0,
        truncated: reply.truncated === true,
        stoppedBy: reply.stoppedBy || "",
        visited: reply.visited ?? 0,
        matched: reply.matched ?? 0,
        ...(reply.dropped ? { dropped: reply.dropped } : {}),
      };
    }
    return {
      ...base,
      ok: false,
      ...(reply.error ? { error: reply.error } : {}),
      hint: reply.hint ?? VIEW_HINTS[reply.view],
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
