import { createHostShell } from "@monkey-mini-app/panel";
import "@monkey-mini-app/ui/globals.css";

// `hostUrl` points at a running `packages/host` Hono server (see scripts/demo-templates.mts,
// default port 17900). Override with VITE_HOST_URL, or with ?host=… in the URL.
const hostUrl =
  new URLSearchParams(location.search).get("host") ||
  (import.meta.env.VITE_HOST_URL as string | undefined) ||
  "http://127.0.0.1:17900";

const shell = createHostShell({
  hostUrl,
  storage: window.localStorage,
  cardStyle: "stamp",
  locale: "zh-CN",
  emptyText: "还没有小程序。\n用 monkey-mini-app skill 生成，或把示例放到 runtime/apps/",
  onHostChange: (next) => console.log("[react-host] host →", next),
});

// The shell creates a fixed #mma-host dock and mounts MiniAppPanel (with theme + frames).
shell.mount(document.getElementById("root")!);

// 调试入口。
(window as unknown as { __reactHostShell: typeof shell }).__reactHostShell = shell;
