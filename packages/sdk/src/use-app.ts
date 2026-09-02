import {
  createContext,
  createElement,
  type ReactNode,
  useCallback,
  useContext,
} from "react";

const AppIdContext = createContext("");

export function AppRuntime(props: { appId: string; children: ReactNode }) {
  return createElement(AppIdContext.Provider, { value: props.appId }, props.children);
}

/**
 * Mini-app UI → host backend. `method` must be a key of `defineApp({ api })`.
 * Host wraps the tree in `<AppRuntime appId>`; do not construct this yourself.
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
  return { call };
}

