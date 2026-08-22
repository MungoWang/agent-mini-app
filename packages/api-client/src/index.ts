import {
  type Transport,
  type BridgeResultMessage,
  type BridgeEventMessage,
  createCall,
  encodeMessage,
  decodeMessage,
} from "@monkey-mini-app/bridge-protocol";

export type MiniClient = {
  call(api: string, payload?: unknown): Promise<unknown>;
  storage: {
    get(
      key: string,
      opts?: { file?: string }
    ): Promise<{ value: unknown | null }>;
    set(
      key: string,
      value: unknown,
      opts?: { file?: string }
    ): Promise<{ ok: true }>;
    delete(key: string, opts?: { file?: string }): Promise<{ ok: true }>;
    keys(opts?: { file?: string }): Promise<{ keys: string[] }>;
    clear(opts?: { file?: string }): Promise<{ ok: true }>;
    listFiles(): Promise<{ files: string[] }>;
  };
  host: {
    invoke(name: string, payload?: unknown): Promise<unknown>;
  };
  on(event: string, handler: (payload: unknown) => void): () => void;
};

export function createMiniClient(transport: Transport): MiniClient {
  let seq = 0;
  const pending = new Map<
    string,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >();
  const eventHandlers = new Map<string, Set<(payload: unknown) => void>>();

  const unsub = transport.onMessage((raw) => {
    let msg;
    try {
      msg = decodeMessage(raw);
    } catch {
      return;
    }
    if (msg.type === "bridge.result") {
      const p = pending.get(msg.id);
      if (!p) return;
      pending.delete(msg.id);
      const r = msg as BridgeResultMessage;
      if (r.ok) p.resolve(r.result);
      else
        p.reject(
          new Error(r.error?.message ?? r.error?.code ?? "BRIDGE_ERROR")
        );
    } else if (msg.type === "host.event") {
      const e = msg as BridgeEventMessage;
      const set = eventHandlers.get(e.event);
      if (set) for (const h of set) h(e.payload);
    }
  });

  // keep unsub reachable for potential dispose
  void unsub;

  async function call(api: string, payload: unknown = {}): Promise<unknown> {
    const id = `c-${++seq}`;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      transport.send(encodeMessage(createCall(id, api, payload)));
    });
  }

  return {
    call,
    storage: {
      get: (key, opts) =>
        call("storage.get", { key, file: opts?.file }) as Promise<{
          value: unknown | null;
        }>,
      set: (key, value, opts) =>
        call("storage.set", {
          key,
          value,
          file: opts?.file,
        }) as Promise<{ ok: true }>,
      delete: (key, opts) =>
        call("storage.delete", { key, file: opts?.file }) as Promise<{
          ok: true;
        }>,
      keys: (opts) =>
        call("storage.keys", { file: opts?.file }) as Promise<{
          keys: string[];
        }>,
      clear: (opts) =>
        call("storage.clear", { file: opts?.file }) as Promise<{ ok: true }>,
      listFiles: () =>
        call("storage.listFiles", {}) as Promise<{ files: string[] }>,
    },
    host: {
      invoke: (name, payload = {}) => call(`host.${name}`, payload),
    },
    on(event, handler) {
      let set = eventHandlers.get(event);
      if (!set) {
        set = new Set();
        eventHandlers.set(event, set);
      }
      set.add(handler);
      return () => set!.delete(handler);
    },
  };
}

/** In-process loopback transport for tests and same-realm mounts. */
export function createLoopbackPair(): {
  miniTransport: Transport;
  hostTransport: Transport;
} {
  const miniHandlers: Array<(m: string) => void> = [];
  const hostHandlers: Array<(m: string) => void> = [];

  const miniTransport: Transport = {
    send(message) {
      queueMicrotask(() => {
        for (const h of hostHandlers) h(message);
      });
    },
    onMessage(handler) {
      miniHandlers.push(handler);
      return () => {
        const i = miniHandlers.indexOf(handler);
        if (i >= 0) miniHandlers.splice(i, 1);
      };
    },
  };

  const hostTransport: Transport = {
    send(message) {
      queueMicrotask(() => {
        for (const h of miniHandlers) h(message);
      });
    },
    onMessage(handler) {
      hostHandlers.push(handler);
      return () => {
        const i = hostHandlers.indexOf(handler);
        if (i >= 0) hostHandlers.splice(i, 1);
      };
    },
  };

  return { miniTransport, hostTransport };
}
