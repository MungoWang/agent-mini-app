/** Host → browser events (SSE). Tools emit, HttpGateway fans out. */

export type HostEvent =
  | { type: "app:open"; appId: string; title?: string }
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

export class HostEventBus {
  private readonly listeners = new Set<HostEventListener>();
  private seq = 0;
  private readonly appSeq = new Map<string, number>();
  private readonly appLog = new Map<string, HostEvent[]>();

  subscribe(listener: HostEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
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
  return JSON.stringify({ name: event.name, data: event.data, seq: event.seq });
}

export function formatSse(event: HostEvent, id: number): string {
  return `id: ${id}\nevent: ${event.type}\ndata: ${sseData(event)}\n\n`;
}
