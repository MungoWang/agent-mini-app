/** Host → browser events (SSE). Tools emit, HttpGateway fans out. */

export type HostEvent =
  | { type: "app:open"; appId: string; title?: string }
  /** Sources recompiled: an already-open iframe must refetch, not keep stale code. */
  | { type: "app:reload"; appId: string }
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

/** How many DOM snapshots to keep per app (the newest is what agents read). */
export const APP_SNAPSHOT_BUFFER = 3;

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

/** DOM outline reported by the app iframe for `mini_app_dom_snapshot`. */
export type AppDomSnapshot = {
  at: number;
  /** Serialized outline (see the runner's collector for the shape). */
  dom: unknown;
  /** Viewport the outline was taken at, so the agent knows what it is looking at. */
  viewport?: { width: number; height: number };
  truncated?: boolean;
};

/** Max accepted sizes, so a chatty app cannot grow an unbounded ring. */
export const APP_ERROR_TEXT_LIMIT = 4000;
export const APP_SNAPSHOT_BYTES = 60_000;

export class HostEventBus {
  private readonly listeners = new Set<HostEventListener>();
  private seq = 0;
  private readonly appSeq = new Map<string, number>();
  private readonly appLog = new Map<string, HostEvent[]>();
  private readonly appErrors = new Map<string, AppRuntimeError[]>();
  private readonly appSnapshots = new Map<string, AppDomSnapshot[]>();
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
    this.appSnapshots.delete(appId);
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

  /** Latest DOM snapshot for `appId`, or null when the app has never reported one. */
  appSnapshot(appId: string): AppDomSnapshot | null {
    const log = this.appSnapshots.get(appId);
    return log && log.length ? log[log.length - 1] : null;
  }

  reportAppSnapshot(appId: string, snap: Omit<AppDomSnapshot, "at">): void {
    const log = this.appSnapshots.get(appId) ?? [];
    log.push({ at: Date.now(), ...snap });
    if (log.length > APP_SNAPSHOT_BUFFER) log.splice(0, log.length - APP_SNAPSHOT_BUFFER);
    this.appSnapshots.set(appId, log);
  }

  /** Clear the error ring (used by `mini_app_reload` and `mini_app_errors` clear). */
  forgetErrors(appId: string): void {
    this.appErrors.delete(appId);
    this.appErrorTotal.delete(appId);
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
  return JSON.stringify({ name: event.name, data: event.data, seq: event.seq });
}

const KINDS = new Set<AppRuntimeError["kind"]>(["render", "module", "uncaught", "async"]);

function clamp(s: string | undefined, max: number): string {
  if (typeof s !== "string") return "";
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export function formatSse(event: HostEvent, id: number): string {
  return `id: ${id}\nevent: ${event.type}\ndata: ${sseData(event)}\n\n`;
}
