import { createHostShell } from "@monkey-mini-app/panel";
import "@monkey-mini-app/ui/globals.css";

/**
 * Tauri Shell UI — Panel only. Host is owned by the Node sidecar (`mma-shell-host`).
 * Host URL from: query ?host=, localStorage, VITE_HOST_URL, or Tauri invoke get_host_url.
 */

async function resolveHostUrl(): Promise<string> {
  const fromQuery = new URLSearchParams(location.search).get("host");
  if (fromQuery) return fromQuery;
  try {
    const stored = window.localStorage.getItem("mma-host-url");
    if (stored) return stored;
  } catch {
    /* ignore */
  }
  if (import.meta.env.VITE_HOST_URL) return String(import.meta.env.VITE_HOST_URL);
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const url = await invoke<string>("get_host_url");
    if (url) return url;
  } catch {
    /* not in tauri or host not ready */
  }
  return "http://127.0.0.1:17880";
}

async function main(): Promise<void> {
  const hostUrl = await resolveHostUrl();
  const shell = createHostShell({
    hostUrl,
    storage: window.localStorage,
    cardStyle: "stamp",
    locale: "zh-CN",
    emptyText: "还没有小程序。\n用 monkey-mini-app skill 生成，或把示例放到 runtime/apps/",
    onHostChange: (next) => {
      try {
        window.localStorage.setItem("mma-host-url", next);
      } catch {
        /* ignore */
      }
    },
  });
  shell.mount(document.getElementById("root")!);
  (window as unknown as { __mmaShell: typeof shell }).__mmaShell = shell;
}

void main();
