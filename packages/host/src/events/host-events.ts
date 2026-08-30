/** Host → browser events (SSE). Agent-agnostic; tools emit, HttpGateway fans out. */

export type HostEvent = {
  type: "app:open";
  appId: string;
  title?: string;
};

export type HostEventListener = (event: HostEvent) => void;

export class HostEventBus {
  private readonly listeners = new Set<HostEventListener>();
  private seq = 0;

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

  /** Monotonic id for SSE `id:` fields. */
  nextId(): number {
    this.seq += 1;
    return this.seq;
  }
}

export function formatSse(event: HostEvent, id: number): string {
  return `id: ${id}\nevent: ${event.type}\ndata: ${JSON.stringify({
    appId: event.appId,
    title: event.title,
  })}\n\n`;
}
