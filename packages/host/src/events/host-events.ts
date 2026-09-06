/** Host → browser events (SSE). Tools emit, HttpGateway fans out. */

export type HostEvent =
  | { type: "app:open"; appId: string; title?: string }
  /** Sources recompiled: an already-open iframe must refetch, not keep stale code. */
  | { type: "app:reload"; appId: string }
  /**
   * Run `code` inside a rendered app iframe and POST the answer back. Carried by the
   * browser's **existing** `/api/events` stream — the iframe opens no second one; the
   * shell that owns the frame forwards it across the origin boundary.
   */
  | {
      type: "app:eval";
      appId: string;
      /** Host-signed, bound to this appId, consumed on the first answer. */
      requestId: string;
      code: string;
      maxBytes: number;
    }
  | {
      type: "app:event";
      appId: string;
      /** Author channel name (`ctx.push(name, …)`). */
      name: string;
      data?: unknown;
      /** Per-app sequence; doubles as the SSE id for Last-Event-ID replay. */
      seq: number;
    };

export type HostEventListener = (event: HostEvent) => void;

/** How many app events to keep per app for reconnect replay. */
export const APP_EVENT_BUFFER = 200;

/** How many runtime errors to keep per app for `mini_app_errors`. */
export const APP_ERROR_BUFFER = 50;

/** How long the host waits for a rendered view to answer a query. */
export const VIEW_EVAL_TIMEOUT_MS = 1_500;

/** Longest a caller may wait for one query. Raised per call, never above this. */
export const VIEW_EVAL_TIMEOUT_MAX_MS = 8_000;

/** Floor: below this, a healthy view looks wedged just because the machine was busy. */
export const VIEW_EVAL_TIMEOUT_MIN_MS = 100;

/**
 * Budget for the zero-work probe that tells a slow query apart from a wedged view. It only runs
 * after a timeout, so it must be short enough to answer before the agent gives up on the tool.
 */
export const VIEW_EVAL_PROBE_TIMEOUT_MS = 400;

/**
 * A runtime failure reported by the app iframe. These never reach `mini_app_reload`
 * (compile is green by definition at that point), so without this ring the only
 * witness is a human reading the browser console.
 */
export type AppRuntimeError = {
  /** Monotonic id across all apps; the cursor `mini_app_errors` pages with. */
  seq: number;
  /** Host-side receive time (ms epoch). */
  at: number;
  /**
   * `render`  — caught by the app's error boundary (component tree available)
   * `module`  — the UI bundle failed to load/evaluate
   * `uncaught`— window error handler
   * `async`   — unhandled promise rejection
   */
  kind: "render" | "module" | "uncaught" | "async";
  message: string;
  file?: string;
  line?: number;
  column?: number;
  stack?: string;
  /** React component stack — names the offending component, which a stack alone does not. */
  componentStack?: string;
};

/**
 * What an iframe may report. Deliberately loose on `kind` — the host is receiving this
 * from a browser, so it normalises rather than rejects (`reportAppError` falls back to
 * `uncaught` for anything unknown).
 */
export type AppErrorInput = {
  kind?: string;
  message?: string;
  file?: string;
  line?: number;
  column?: number;
  stack?: string;
  componentStack?: string;
};

/**
 * What a rendered view reports back for one query. The view is a browser, so `hostViewEval`
 * validates and normalizes rather than trusting any of it — including the byte size.
 */
export type ViewEvalInput = {
  requestId?: unknown;
  /** The shell sets this to `"not-open"` when it holds no frame for the app. */
  view?: unknown;
  ok?: unknown;
  result?: unknown;
  bytes?: unknown;
  truncated?: unknown;
  stoppedBy?: unknown;
  visited?: unknown;
  matched?: unknown;
  dropped?: unknown;
  tookMs?: unknown;
  error?: unknown;
};

/**
 * Whether a query could reach a view at all. Four states because the four need different
 * next steps, and "it returned nothing" would cover all of them while meaning none.
 *
 * - `live` — the view answered (the answer itself may still be an error in the agent's JS)
 * - `not-open` — no frame for this app: nobody is rendering it, so nothing can answer
 * - `runner-not-booted` — a frame exists but its script never checked in (a dead bundle)
 * - `pending` — the runner checked in, the query is still running (a long `await`), and the view
 *   answers a trivial probe — the page is healthy, the caller just needs a bigger `timeoutMs` or
 *   a query that returns instead of waiting. Nothing for the user to do.
 * - `stuck` — the runner checked in and then did not answer (blocked main thread, e.g. a
 *   synchronous loop; only an iframe reload escapes that)
 */
export type ViewState = "live" | "not-open" | "runner-not-booted" | "pending" | "stuck";

/** One query's outcome as the tool sees it: a view state plus whatever the view sent. */
export type ViewEvalReply = {
  view: ViewState;
  /** True only when the view answered *and* the code returned a value. */
  ok: boolean;
  tookMs: number;
  /** The budget this query was given, so a near-miss is visible instead of mysterious. */
  budgetMs?: number;
  result?: string;
  bytes?: number;
  truncated?: boolean;
  stoppedBy?: string;
  visited?: number;
  matched?: number;
  dropped?: number;
  error?: Record<string, unknown>;
  /** Set when the host could not even ask: no browser is attached to `/api/events`. */
  hint?: string;
};

/** Max accepted sizes, so a chatty app cannot grow an unbounded ring. */
export const APP_ERROR_TEXT_LIMIT = 4000;

/**
 * Keep a caller's timeout inside the range the SSE round trip is designed for: never a busy-wait
 * floor of a few ms, never a tool call that outlives the agent's own patience.
 */
export function clampViewEvalTimeout(ms?: number): number {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms <= 0) return VIEW_EVAL_TIMEOUT_MS;
  return Math.max(VIEW_EVAL_TIMEOUT_MIN_MS, Math.min(Math.floor(ms), VIEW_EVAL_TIMEOUT_MAX_MS));
}

export class HostEventBus {
  private readonly listeners = new Set<HostEventListener>();
  private seq = 0;
  private readonly appSeq = new Map<string, number>();
  private readonly appLog = new Map<string, HostEvent[]>();
  private readonly appErrors = new Map<string, AppRuntimeError[]>();
  /** Last time each app's runner script proved it executes (`POST …/alive`). */
  private readonly viewAliveAt = new Map<string, number>();
  /** In-flight view queries, keyed by the host-signed requestId. */
  private readonly viewPending = new Map<
    string,
    { appId: string; startedAt: number; resolve: (reply: ViewEvalReply) => void; timer: ReturnType<typeof setTimeout> }
  >();
  private evalSeq = 0;
  /** Monotonic, so `since` can page through errors without clock skew. */
  private errorSeq = 0;
  /**
   * Total errors ever reported **per app**. `dropped` must be measured against this,
   * not against the global `errorSeq` — otherwise one app's cursor would count another
   * app's reports as evicted.
   */
  private readonly appErrorTotal = new Map<string, number>();

  subscribe(listener: HostEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Live browser subscribers. `mini_app_open` uses this to say honestly whether anyone
   * received the event instead of assuming a panel is open.
   */
  listenerCount(): number {
    return this.listeners.size;
  }

  emit(event: HostEvent): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(event);
      } catch {
        /* drop broken listeners */
      }
    }
  }

  /**
   * Push one author event for `appId`. Fire-and-forget: returns false when `data`
   * cannot survive JSON (the call that pushed it must not fail over a UI event).
   */
  pushApp(appId: string, name: string, data?: unknown): boolean {
    let payload = data;
    if (payload !== undefined) {
      try {
        JSON.stringify(payload);
      } catch {
        console.warn(`[events] ctx.push("${name}") dropped: data is not JSON-serialisable`);
        return false;
      }
    }
    const seq = (this.appSeq.get(appId) ?? 0) + 1;
    this.appSeq.set(appId, seq);
    const event: HostEvent = { type: "app:event", appId, name, data: payload, seq };
    const log = this.appLog.get(appId) ?? [];
    log.push(event);
    if (log.length > APP_EVENT_BUFFER) {
      log.splice(0, log.length - APP_EVENT_BUFFER);
    }
    this.appLog.set(appId, log);
    this.emit(event);
    return true;
  }

  /** Next per-app sequence number (0 when the app has not pushed anything). */
  appLastSeq(appId: string): number {
    return this.appSeq.get(appId) ?? 0;
  }

  /**
   * Buffered events after `lastEventId`, for the replay an EventSource asks for
   * when it reconnects. Older events already evicted from the ring are reported
   * through `gap` so the caller can tell the UI to refetch a snapshot.
   */
  replay(appId: string, lastEventId: number): { events: HostEvent[]; gap: boolean } {
    const log = this.appLog.get(appId) ?? [];
    const events = log.filter((e) => e.type === "app:event" && e.seq > lastEventId);
    const oldest = log[0];
    const gap =
      lastEventId > 0 && oldest?.type === "app:event" ? oldest.seq > lastEventId + 1 : false;
    return { events, gap };
  }

  /** Drop buffered history (app reloaded / deleted). */
  forget(appId: string): void {
    this.appLog.delete(appId);
    this.appSeq.delete(appId);
    this.appErrors.delete(appId);
    this.appErrorTotal.delete(appId);
    this.viewAliveAt.delete(appId);
    // Anything still in flight can only be answered by a document that no longer exists.
    for (const [id, pending] of [...this.viewPending]) {
      if (pending.appId !== appId) continue;
      this.viewPending.delete(id);
      clearTimeout(pending.timer);
      pending.resolve({ view: "not-open", ok: false, tookMs: 0, hint: "the app was closed or reloaded mid-query" });
    }
  }

  /**
   * Record one runtime error reported by an app iframe. Returns its sequence id.
   * Reporting is fire-and-forget from the caller's point of view — a diagnostic
   * channel must never be able to fail an app.
   */
  reportAppError(appId: string, input: AppErrorInput): number {
    const message = clamp(input.message, APP_ERROR_TEXT_LIMIT) || "(no message)";
    const kind = KINDS.has(input.kind as AppRuntimeError["kind"]) ? (input.kind as AppRuntimeError["kind"]) : "uncaught";
    const seq = ++this.errorSeq;
    const err: AppRuntimeError = {
      seq,
      at: Date.now(),
      kind,
      message,
      ...(input.file ? { file: clamp(input.file, 400) } : {}),
      ...(Number.isFinite(input.line) ? { line: Number(input.line) } : {}),
      ...(Number.isFinite(input.column) ? { column: Number(input.column) } : {}),
      ...(input.stack ? { stack: clamp(input.stack, APP_ERROR_TEXT_LIMIT) } : {}),
      ...(input.componentStack
        ? { componentStack: clamp(input.componentStack, APP_ERROR_TEXT_LIMIT) }
        : {}),
    };
    this.appErrorTotal.set(appId, (this.appErrorTotal.get(appId) ?? 0) + 1);
    const log = this.appErrors.get(appId) ?? [];
    log.push(err);
    if (log.length > APP_ERROR_BUFFER) log.splice(0, log.length - APP_ERROR_BUFFER);
    this.appErrors.set(appId, log);
    return seq;
  }

  /**
   * Errors retained for `appId`, those with `seq > since`. `lastSeq` is the newest seq the
   * host has for this app (poll cursor); `dropped` counts the ones already evicted from
   * the ring, so a caller can tell a clean tail from a truncated one.
   */
  appErrorsFor(appId: string, since = 0): { errors: AppRuntimeError[]; lastSeq: number; dropped: number } {
    const log = this.appErrors.get(appId) ?? [];
    const total = this.appErrorTotal.get(appId) ?? 0;
    const lastSeq = log.length ? log[log.length - 1].seq : 0;
    return { errors: log.filter((e) => e.seq > since), lastSeq, dropped: Math.max(0, total - log.length) };
  }

  /**
   * Record that an app's runner script is executing. Called by the frame the moment it
   * boots; the presence of a timestamp is what separates `runner-not-booted` from `stuck`.
   */
  reportViewAlive(appId: string): void {
    this.viewAliveAt.set(appId, Date.now());
  }

  /** When this app's view last proved it runs (0 = never since it was last forgotten). */
  viewAlive(appId: string): number {
    return this.viewAliveAt.get(appId) ?? 0;
  }

  /**
   * Ask a rendered view to run `code` and wait for the answer.
   *
   * Never rejects: "nobody is there" is an ordinary, expected outcome of this call, not an
   * exception, and the caller has to distinguish four reasons for it anyway.
   */
  async requestViewEval(
    appId: string,
    code: string,
    maxBytes: number,
    timeoutMs = VIEW_EVAL_TIMEOUT_MS,
  ): Promise<ViewEvalReply> {
    if (this.listeners.size === 0) {
      // No browser is attached, so the query has nobody to carry it. Say so now instead of
      // spending the timeout pretending a view might answer.
      return Promise.resolve({
        view: "not-open",
        ok: false,
        tookMs: 0,
        hint: "no browser is attached to /api/events — call mini_app_open first",
      });
    }
    const budget = clampViewEvalTimeout(timeoutMs);
    const reply = { budgetMs: budget, ...(await this.askView(appId, code, maxBytes, budget)) };
    if (reply.view !== "stuck") return reply;

    // A clock overrun on a view that has checked in is two different facts wearing one label:
    // "still computing" and "never coming back". The first needs a bigger budget, the second
    // needs the user to reload the tab, so telling them apart is the whole point of asking.
    const probe = await this.askView(appId, "return 1;", 64, VIEW_EVAL_PROBE_TIMEOUT_MS);
    if (probe.view !== "live") return reply;
    return {
      ...reply,
      view: "pending",
      hint:
        "the view is healthy — your query is still running. It may still land its side effects; " +
        `raise timeoutMs (budget was ${budget}ms) or return instead of awaiting.`,
    };
  }

  /**
   * One round trip to a rendered view. (Kept private so the only way to wait on a view is
   * `requestViewEval`, which owns the probe.) Times out into `runner-not-booted` / `stuck` depending on
   * whether that app has ever checked in — see `requestViewEval` for the probe that follows.
   */
  private askView(
    appId: string,
    code: string,
    maxBytes: number,
    timeoutMs: number,
  ): Promise<ViewEvalReply> {
    const requestId = `v${++this.evalSeq}`;
    const started = Date.now();
    return new Promise<ViewEvalReply>((resolve) => {
      const timer = setTimeout(() => {
        this.viewPending.delete(requestId);
        // The frame exists (otherwise the shell would have answered `not-open`), so the
        // question is only whether its script ever ran.
        resolve({
          view: this.viewAliveAt.get(appId) ? "stuck" : "runner-not-booted",
          ok: false,
          tookMs: Date.now() - started,
          budgetMs: timeoutMs,
        });
      }, timeoutMs);
      this.viewPending.set(requestId, { appId, startedAt: started, resolve, timer });
      this.emit({ type: "app:eval", appId, requestId, code, maxBytes });
    });
  }

  /**
   * Take a view's answer. Returns false for anything not asked for — an unknown,
   * already-consumed or wrong-app requestId — so a stale or forged reply cannot resolve a
   * query that belongs to somebody else.
   */
  reportViewEval(appId: string, input: ViewEvalInput): boolean {
    const requestId = typeof input.requestId === "string" ? input.requestId : "";
    const pending = this.viewPending.get(requestId);
    if (!pending || pending.appId !== appId) return false;
    this.viewPending.delete(requestId);
    clearTimeout(pending.timer);
    const tookMs = Date.now() - pending.startedAt;
    // The shell answers on a frame's behalf when it holds no frame: an honest immediate
    // `not-open` beats waiting out the timeout and calling the page wedged.
    if (input.view === "not-open") {
      pending.resolve({
        view: "not-open",
        ok: false,
        tookMs,
        hint: "the panel is connected but this app is not open in it — call mini_app_open({ appId })",
      });
      return true;
    }
    if (input.ok === true) {
      pending.resolve({
        view: "live",
        ok: true,
        tookMs,
        result: typeof input.result === "string" ? input.result : "",
        bytes: numberOr(input.bytes, 0),
        truncated: input.truncated === true,
        stoppedBy: typeof input.stoppedBy === "string" ? input.stoppedBy : "",
        visited: numberOr(input.visited, 0),
        matched: numberOr(input.matched, 0),
        dropped: numberOr(input.dropped, 0),
      });
      return true;
    }
    pending.resolve({
      view: "live",
      ok: false,
      tookMs,
      // The agent's own JS failed: keep the shape (kind / line / caret) verbatim, that is
      // the difference between fixing code and guessing at it.
      error: isRecordLike(input.error) ? (input.error as Record<string, unknown>) : { kind: "runtime", message: "unknown error" },
    });
    return true;
  }

  /** In-flight query count (tests and `GET /api/app/:id/view` debugging). */
  viewPendingCount(): number {
    return this.viewPending.size;
  }

  /** Clear the error ring (used by `mini_app_reload` and `mini_app_errors` clear). */
  forgetErrors(appId: string): void {
    this.appErrors.delete(appId);
    this.appErrorTotal.delete(appId);
  }

  /**
   * Forget that this app's view ever reported in. A reload points the iframe at new bytes, so
   * the previous document's liveness must not vouch for the next one — otherwise a bundle that
   * stopped executing would still be reported as `stuck` instead of `runner-not-booted`.
   */
  forgetView(appId: string): void {
    this.viewAliveAt.delete(appId);
  }

  /** Monotonic id for SSE `id:` fields. */
  nextId(): number {
    this.seq += 1;
    return this.seq;
  }
}

/** SSE payload of an event: keys the browser side needs, nothing else. */
function sseData(event: HostEvent): string {
  if (event.type === "app:open") {
    return JSON.stringify({ appId: event.appId, title: event.title });
  }
  if (event.type === "app:reload") {
    return JSON.stringify({ appId: event.appId });
  }
  if (event.type === "app:eval") {
    return JSON.stringify({
      appId: event.appId,
      requestId: event.requestId,
      code: event.code,
      maxBytes: event.maxBytes,
    });
  }
  return JSON.stringify({ name: event.name, data: event.data, seq: event.seq });
}

const KINDS = new Set<AppRuntimeError["kind"]>(["render", "module", "uncaught", "async"]);

function clamp(s: string | undefined, max: number): string {
  if (typeof s !== "string") return "";
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function isRecordLike(value: unknown): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function formatSse(event: HostEvent, id: number): string {
  return `id: ${id}\nevent: ${event.type}\ndata: ${sseData(event)}\n\n`;
}
