/**
 * Backend authoring contract for mini-apps (`main.api.ts`).
 *
 * The host does **not** load this package into the backend process — when it
 * loads `main.api.ts` it injects `defineApp`. Import from `@monkey-mini-app/api`
 * for editor help and type-checking; the object you get at runtime comes from
 * the host (it validates `name` / `description` / `api`).
 *
 * Human-readable contract: skill `references/ctx.md`.
 */

/** File-backed key/value store scoped to one mini-app (`storage/*.json`). */
export type AppStorage = {
  /** Stored JSON — shape is yours; the host hands back whatever was written. */
  get(key: string): Promise<any>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  /** Bytes this table occupies on disk. Cheap, and meant for "is my data getting big" checks. */
  bytes(): number;
  /**
   * A second, independent table in the same app (`storage/<name>.storage.json`). Keys do not
   * overlap between tables, and neither layout choice here is yours to make: the host moves a
   * table to one file per key once it stops fitting a single rewrite, which is invisible from
   * this API — `get` / `set` / `delete` / `clear` mean the same thing either way.
   */
  table(name: string): AppStorage;
};

/** `ctx.http` request shape (either positional fields or `url` + opts). */
export type AppHttpRequest = {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  timeout?: number;
  signal?: AbortSignal;
};

/** `ctx.http` result — always this shape, never a platform `Response`. */
export type AppHttpResponse = {
  ok: boolean;
  status: number;
  headers: Record<string, string>;
  text: string;
  /** Parsed body when the response was JSON, else `null`. */
  json: any;
};

/** Options shared by `ctx.llm` and `ctx.agent`. */
export type AppModelOptions = {
  provider?: string;
  model?: string;
  system?: string;
  schema?: unknown;
  maxTokens?: number;
  /** Attempts in total, including the first. Default 3 (`llm`); `agent` defaults to 1. */
  retryTimes?: number;
  signal?: AbortSignal;
};

/** Why a turn ended — kept loose so hosts can add kinds without breaking apps. */
export type AppAgentTurnEndReason = {
  kind: string;
  error?: unknown;
  reason?: unknown;
};

/** One `ctx.agent` progress event (observation only — the return stays a string). */
export type AppAgentEvent =
  | { type: "status"; status: "running" | "idle" }
  | { type: "text-delta"; text: string }
  | { type: "tool"; phase: "start" | "end"; name: string; args?: unknown; result?: unknown }
  | { type: "turn"; phase: "start"; turn: number }
  | { type: "turn"; phase: "end"; turn: number; reason?: AppAgentTurnEndReason }
  | { type: "error"; message: string }
  | { type: "done"; text: string };

/** `ctx.agent` options (adds the multi-step knobs on top of the shared ones). */
export type AppAgentOptions = AppModelOptions & {
  maxIterations?: number;
  onEvent?: (event: AppAgentEvent) => void;
  /**
   * Mirror every progress event to the UI as `ctx.push(streamTo, event)` — so a
   * run started before the panel opened still streams (the host replays it).
   */
  streamTo?: string;
  cwdType?: "app" | "process" | "temp" | "custom";
  cwd?: string;
};

/** First argument of every `api` method. */
export type AppCtx = {
  /** Reverse-DNS id of the running mini-app. */
  appId: string;
  /** Absolute `runtime/apps/<appId>` directory. */
  appDir: string;
  storage: AppStorage;
  state: Record<string, unknown>;
  credentials: Record<string, string>;
  log(...args: unknown[]): void;
  /**
   * Push one event to this app's open views; the UI reads it with
   * `useApp().on(name, cb)`. Fire-and-forget: never throws, and `params` must be
   * JSON-serialisable (unsuitable payloads are dropped with a host warning).
   * Buffered per app (last 200) so a reconnecting or late-opening UI replays.
   */
  push(name: string, params?: unknown): void;
  mcp(name: string, args?: Record<string, unknown>): Promise<any>;
  /** Tool result as a **string** (the host serialises tool output). */
  tool(name: string, args?: Record<string, unknown>): Promise<any>;
  listTools(): unknown[];
  /** Model completion as a **string**. */
  llm(prompt: string, opts?: AppModelOptions): Promise<string>;
  /** Multi-step agent run as a **string**. */
  agent(goal: string, opts?: AppAgentOptions): Promise<string>;
  bash(command: string): Promise<{ stdout: string; stderr: string; exitCode: number }>;
  http(url: string | AppHttpRequest, opts?: Omit<AppHttpRequest, "url">): Promise<AppHttpResponse>;
  system: { metrics(): Promise<any> };
  config: Record<string, unknown>;
  /** Cancel signal for the current call — long jobs must honour it. */
  signal?: AbortSignal;
};

/**
 * One backend method. `args` is whatever `call(method, args)` sent from the UI
 * (a plain object) — validate it, it is untrusted input.
 */
export type AppApiMethod = (ctx: AppCtx, args: any) => unknown | Promise<unknown>;

/** What `defineApp` takes — the whole `main.api.ts` contract. */
export type AppDefinition = {
  name: string;
  description: string;
  api: Record<string, AppApiMethod>;
  state?: Record<string, unknown>;
};

/**
 * Declare the mini-app backend. Keys of `api` are exactly the `method` strings
 * the UI may `call()`.
 *
 * ```ts
 * import { defineApp } from "@monkey-mini-app/api";
 *
 * export default defineApp({
 *   name: "名称",
 *   description: "一句话",
 *   api: {
 *     async list(ctx) {
 *       return (await ctx.storage.get("items")) ?? [];
 *     },
 *   },
 * });
 * ```
 */
export function defineApp<T extends AppDefinition>(def: T): T {
  return def;
}
