import {
  createElement,
  type ReactNode,
  useCallback,
  useContext,
} from "react";

import { AppIdContext } from "./app-id";

export function AppRuntime(props: { appId: string; children: ReactNode }) {
  return createElement(AppIdContext.Provider, { value: props.appId }, props.children);
}

/** One `ctx.push(name, data)` from the app's backend. */
export type AppEvent = { name: string; data: unknown };

type Sub = (event: AppEvent) => void;

const subsByApp = new Map<string, Set<Sub>>();
const sourcesByApp = new Map<string, EventSource>();

function endpoint(appId: string): string {
  return `/api/app/${encodeURIComponent(appId)}/events`;
}

function dispatch(appId: string, event: AppEvent): void {
  for (const sub of subsByApp.get(appId) ?? []) {
    try {
      sub(event);
    } catch {
      /* one bad listener must not break the others */
    }
  }
}

/**
 * One EventSource per app, shared by every subscriber and closed when the last
 * one leaves. Reconnect (and the `Last-Event-ID` replay the host supports) is the
 * browser's own job. No EventSource (jsdom, ancient engine) → silent no-op, so a
 * UI still renders without a live stream.
 */
function ensureSource(appId: string): void {
  if (sourcesByApp.has(appId) || typeof EventSource === "undefined") return;
  const es = new EventSource(endpoint(appId));
  es.addEventListener("app:event", (raw: MessageEvent<string>) => {
    let payload: { name?: unknown; data?: unknown };
    try {
      payload = JSON.parse(raw.data) as typeof payload;
    } catch {
      return;
    }
    if (typeof payload?.name !== "string") return;
    dispatch(appId, { name: payload.name, data: payload.data });
  });
  // Events dropped from the host ring buffer while we were disconnected: the UI
  // should refetch a snapshot instead of trusting a partial tail.
  es.addEventListener("app:gap", () => {
    dispatch(appId, { name: "*", data: { gap: true } });
  });
  sourcesByApp.set(appId, es);
}

function addSub(appId: string, sub: Sub): () => void {
  if (!appId) return () => {};
  let set = subsByApp.get(appId);
  if (!set) {
    set = new Set();
    subsByApp.set(appId, set);
  }
  set.add(sub);
  ensureSource(appId);
  return () => {
    const live = subsByApp.get(appId);
    if (!live) return;
    live.delete(sub);
    if (live.size === 0) {
      subsByApp.delete(appId);
      sourcesByApp.get(appId)?.close();
      sourcesByApp.delete(appId);
    }
  };
}

/**
 * Mini-app UI → host backend. `method` must be a key of `defineApp({ api })`.
 * Host wraps the tree in `<AppRuntime appId>`; do not construct this yourself.
 *
 * `on` / `onAny` receive what the backend sent with `ctx.push(name, data)` over
 * the per-app SSE stream — no polling. `on` accepts `"*"` for every event.
 */
export function useApp() {
  const appId = useContext(AppIdContext);

  const call = useCallback(
    async (method: string, args?: Record<string, unknown>) => {
      if (!appId) {
        throw new Error("useApp() must run inside the host AppRuntime wrapper");
      }
      const j = (await fetch("/api/call", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ appId, method, args: args || {} }),
      }).then((r) => r.json())) as { ok?: boolean; value?: unknown; error?: string };
      if (!j.ok) throw new Error(j.error || "call failed");
      return j.value;
    },
    [appId],
  );

  /** Subscribe to one `ctx.push(name, …)` channel; `"*" matches every channel. */
  const on = useCallback(
    (name: string, cb: (data: unknown) => void) =>
      addSub(appId, (event) => {
        if (event.name === name || name === "*") cb(event.data);
      }),
    [appId],
  );

  /** Subscribe to every event of this app, as `{ name, data }`. */
  const onAny = useCallback(
    (cb: (event: AppEvent) => void) => addSub(appId, (event) => cb(event)),
    [appId],
  );

  return { call, on, onAny };
}
