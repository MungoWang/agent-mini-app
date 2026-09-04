import { RUNTIME_HREF, SDK_HREF } from "../compile/ui-compiler.ts";
import { viewEvalRuntime } from "./app-view-eval.ts";

/**
 * Iframe entry HTML for a compiled mini-app UI bundle.
 *
 * Beyond bootstrapping the app, this document owns the channels that did not exist
 * before: the panel embedding the iframe is **cross-origin**, so neither the panel nor the
 * host agent can see inside a running app. Everything the agent needs therefore has to
 * leave the iframe on its own initiative, to its own same-origin host:
 *
 *   POST /api/app/:id/errors     — render / module-load / uncaught / async failures.
 *                                  Stays push: a crash cannot be polled after the fact.
 *   POST /api/app/:id/alive      — "this document's script really executed"
 *   …/view/eval                  — the answer to a query the agent asked; see
 *                                  `app-view-eval.ts`, injected right below this script.
 *
 * The diagnostics script is plain JS on purpose: it has to work when the SDK itself
 * failed to load, which is one of the cases it reports.
 */

/** Shared visual for a crashed app, used by the module-load path (React is unavailable there). */
const CRASH_CSS = `.mma-crash{box-sizing:border-box;margin:24px;padding:16px 18px;border-radius:12px;border:1px solid var(--destructive,#dc2626);background:var(--card,#fff);color:var(--foreground,#111);font:13px/1.6 var(--font-sans,ui-sans-serif,system-ui,sans-serif);max-width:720px}
.mma-crash .hd{display:flex;align-items:center;gap:8px;margin-bottom:6px}
.mma-crash .dot{width:8px;height:8px;border-radius:50%;background:var(--destructive,#dc2626);flex:0 0 auto}
.mma-crash .hd b{font-size:14px}
.mma-crash .id{margin-left:auto;padding:1px 6px;border-radius:6px;background:var(--muted,#f3f4f6);color:var(--muted-foreground,#6b7280);font-size:11px}
.mma-crash p{margin:0 0 8px;color:var(--muted-foreground,#6b7280)}
.mma-crash pre{margin:0;padding:10px 12px;border-radius:8px;background:var(--muted,#f3f4f6);white-space:pre-wrap;word-break:break-word;font-family:var(--font-mono,ui-monospace,SFMono-Regular,monospace);font-size:12px;max-height:260px;overflow:auto}
.mma-crash .ft{display:flex;gap:8px;align-items:center;margin-top:12px;font-size:11px;color:var(--muted-foreground,#6b7280)}`;

/** Error reporting. Injected as a classic script before the app module, so it survives a
 *  bundle that never evaluated. */
const DIAGNOSTICS = `(function () {
  var APP_ID = __APP_ID__;
  var base = "/api/app/" + encodeURIComponent(APP_ID);
  var seq = 0;
  // The first uncaught error is the interesting one; a crashed tree sprouts dozens.
  var reported = 0;

  function post(path, payload) {
    try {
      var body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        if (navigator.sendBeacon(base + path, new Blob([body], { type: "application/json" }))) return;
      }
      fetch(base + path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: body,
        keepalive: true,
      }).catch(function () {});
    } catch (e) {
      /* a diagnostic channel must never throw into the app */
    }
  }

  function report(kind, msg, extra) {
    if (reported++ >= 20) return;
    var p = { kind: kind, message: String(msg || "(no message)").slice(0, 4000), seq: ++seq };
    if (extra) {
      if (extra.file) p.file = String(extra.file).slice(0, 400);
      if (typeof extra.line === "number") p.line = extra.line;
      if (typeof extra.column === "number") p.column = extra.column;
      if (extra.stack) p.stack = String(extra.stack).slice(0, 4000);
    }
    post("/errors", p);
  }

  window.addEventListener("error", function (ev) {
    // Resource load failures bubble here with no message — they are noise for us.
    if (!ev || ev.target !== window) return;
    var e = ev.error;
    report("uncaught", (e && e.message) || ev.message, {
      file: ev.filename,
      line: ev.lineno,
      column: ev.colno,
      stack: e && e.stack,
    });
  }, true);

  window.addEventListener("unhandledrejection", function (ev) {
    var r = ev && ev.reason;
    report("async", (r && (r.message || String(r))) || "unhandled rejection", {
      stack: r && r.stack,
    });
  });

  // The module script needs this: an import failure never reaches window.onerror.
  window.__mmaReport = function (kind, message, stack) { report(kind, message, { stack: stack }); };
})();`;

function diagnosticsScript(appId: string): string {
  // The placeholder is bare (not quoted) because JSON.stringify supplies the quotes.
  return DIAGNOSTICS.replace("__APP_ID__", () => JSON.stringify(appId));
}

/** Iframe entry HTML for a compiled mini-app UI bundle. */
export function appRunnerHtml(appId: string, themeCss = ""): string {
  const safe = JSON.stringify(appId);
  const title = appId.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
  const themeBlock = themeCss.trim() ? `${themeCss.trim()}\n  ` : "";
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title}</title>
<script type="importmap">${JSON.stringify({
    imports: {
      react: RUNTIME_HREF,
      "react/jsx-runtime": RUNTIME_HREF,
      "react/jsx-dev-runtime": RUNTIME_HREF,
      "react-dom": RUNTIME_HREF,
      "react-dom/client": RUNTIME_HREF,
    },
  })}</script>
<script>
(function () {
  function apply(mode, pal, dock, vars) {
    var el = document.documentElement;
    if (mode) el.classList.toggle("dark", mode === "dark");
    if (pal) {
      el.setAttribute("data-palette", pal);
      if (pal === "default") el.removeAttribute("data-theme");
      else el.setAttribute("data-theme", pal);
    }
    if (dock) el.setAttribute("data-dock", dock);
    if (vars && typeof vars === "object") {
      for (var k in vars) {
        if (Object.prototype.hasOwnProperty.call(vars, k) && typeof vars[k] === "string") {
          el.style.setProperty(k, vars[k]);
        }
      }
    }
  }
  // "system" is a storable preference; an iframe can only render light or dark.
  function concrete(mode) {
    if (mode !== "system") return mode;
    try {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } catch (e) {
      return "light";
    }
  }
  var q = new URLSearchParams(location.search);
  apply(concrete(q.get("theme") || "light"), q.get("palette") || "default", q.get("dock") || "fill");
  window.addEventListener("message", function (ev) {
    var d = ev.data;
    if (!d || d.type !== "mma-set-env") return;
    apply(concrete(d.theme), d.palette, d.dock, d.vars);
  });
})();
</script>
<style>
  ${themeBlock}html,body,#root{margin:0;height:100%;background:var(--background,#fff);color:var(--foreground,#111);font-family:var(--font-sans,ui-sans-serif,system-ui,sans-serif);}
  .err{padding:24px;color:#b91c1c;white-space:pre-wrap;}
  ${CRASH_CSS}
  #root.boot{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;}
  #root.boot .art{position:relative;width:88px;height:72px;color:var(--foreground,#111);}
  #root.boot .art svg{display:block;width:88px;height:64px;}
  #root.boot .dots{display:flex;gap:5px;justify-content:center;margin-top:2px;}
  #root.boot .dots i{width:6px;height:6px;border-radius:50%;background:var(--primary,#2563eb);opacity:.35;animation:mma-dot 1s ease-in-out infinite;}
  #root.boot .dots i:nth-child(2){animation-delay:.15s;}
  #root.boot .dots i:nth-child(3){animation-delay:.3s;}
  @keyframes mma-dot{0%,80%,100%{transform:translateY(0);opacity:.3}40%{transform:translateY(-5px);opacity:1}}
</style>
</head>
<body>
<div id="root" class="boot" role="status" aria-label="loading">
  <div class="art" aria-hidden="true">
    <svg viewBox="0 0 88 64" fill="none">
      <rect x="10" y="8" width="68" height="48" rx="10" stroke="currentColor" stroke-width="1.6" opacity=".35"/>
      <rect x="10" y="8" width="68" height="12" rx="10" fill="currentColor" opacity=".08"/>
      <circle cx="20" cy="14" r="2.2" fill="currentColor" opacity=".35"/>
      <rect x="26" y="12.2" width="18" height="3.6" rx="1.8" fill="currentColor" opacity=".22"/>
      <rect x="20" y="28" width="28" height="4" rx="2" fill="currentColor" opacity=".16"/>
      <rect x="20" y="36" width="40" height="4" rx="2" fill="currentColor" opacity=".1"/>
      <rect x="20" y="44" width="22" height="4" rx="2" fill="currentColor" opacity=".08"/>
      <path d="M62 40c6 0 10 5 10 10" stroke="var(--primary,#2563eb)" stroke-width="1.8" stroke-linecap="round" opacity=".85"/>
      <circle cx="72" cy="50" r="3.2" fill="var(--primary,#2563eb)" opacity=".9"/>
    </svg>
    <div class="dots"><i></i><i></i><i></i></div>
  </div>
</div>
<script>${diagnosticsScript(appId)}</script>
<script>${viewEvalRuntime(appId)}</script>
<script type="module">
const APP_ID = ${safe};
// App utilities first, then shared /ui.css. Both sheets use @layer theme/base/utilities;
// same-layer rules in the later sheet win — /ui.css must come last so Geist/--border
// override Tailwind's default theme that the per-app sheet also emits.
for (const href of [${JSON.stringify(RUNTIME_HREF)}, ${JSON.stringify(SDK_HREF)}]) {
  const preload = document.createElement("link");
  preload.rel = "modulepreload";
  preload.href = href;
  document.head.appendChild(preload);
}
const cssLink = document.createElement("link");
cssLink.rel = "stylesheet";
cssLink.href = "/api/app/" + encodeURIComponent(APP_ID) + "/ui.css";
document.head.appendChild(cssLink);
const baseCss = document.createElement("link");
baseCss.rel = "stylesheet";
baseCss.href = "/ui.css";
document.head.appendChild(baseCss);

function crash(message, detail) {
  const rootEl = document.getElementById("root");
  if (!rootEl) return;
  rootEl.className = "";
  rootEl.removeAttribute("role");
  rootEl.removeAttribute("aria-label");
  const zh = (navigator.language || "en").toLowerCase().startsWith("zh");
  // Named per layer so the reader knows which stage broke: this used to be a bare stack.
  const titles = zh
    ? { module: "小程序界面没有加载起来", runtime: "小程序运行时报错" }
    : { module: "The mini-app UI failed to load", runtime: "The mini-app hit a runtime error" };
  const hints = zh
    ? {
        module: "编译产物加载失败（依赖、入口或 SDK 问题）。让 AI 执行 mini_app_reload 重新编译，再用 mini_app_errors 查看原因。",
        runtime: "界面在渲染过程中出错。让 AI 调用 mini_app_errors 就能看到具体组件和原因。",
      }
    : {
        module: "The compiled bundle did not load (import, entry or SDK problem). Ask the AI to run mini_app_reload, then mini_app_errors.",
        runtime: "The view failed while rendering. Ask the AI to call mini_app_errors for the component and reason.",
      };
  const box = document.createElement("div");
  box.className = "mma-crash";
  box.setAttribute("role", "alert");
  const head = document.createElement("div");
  head.className = "hd";
  const dot = document.createElement("span");
  dot.className = "dot";
  const b = document.createElement("b");
  b.textContent = titles[detail.kind === "module" ? "module" : "runtime"];
  const id = document.createElement("code");
  id.className = "id";
  id.textContent = APP_ID;
  head.append(dot, b, id);
  const p = document.createElement("p");
  p.textContent = hints[detail.kind === "module" ? "module" : "runtime"];
  const pre = document.createElement("pre");
  pre.textContent = message;
  const ft = document.createElement("div");
  ft.className = "ft";
  ft.textContent = zh ? "已上报宿主，可用 mini_app_errors 读取" : "Reported — readable via mini_app_errors";
  box.append(head, p, pre, ft);
  rootEl.replaceChildren(box);
}

try {
  await import("/api/app/" + encodeURIComponent(APP_ID) + "/ui/entry.js");
} catch (e) {
  const message = String((e && (e.stack || e.message)) || e);
  crash(message, { kind: "module" });
  // An import/module-eval failure never surfaces through window.onerror, so report it here.
  try {
    if (window.__mmaReport) window.__mmaReport("module", (e && e.message) || message, e && e.stack);
  } catch (_) {
    /* diagnostics must not mask the original error */
  }
}
</script>
</body>
</html>`;
}
