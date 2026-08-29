/** dsh-plugin server：runner HTML（app iframe 入口页，加载 per-app UI bundle）。 */
import { runnerThemeCss } from "@monkey-mini-app/panel-core";
import { customPaletteCss } from "./app-meta.js";

export function appRunnerHtml(appId: string, runtimeRoot: string): string {
  const safe = JSON.stringify(appId);
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${appId}</title>
<style>
  ${runnerThemeCss() + customPaletteCss(runtimeRoot || "")}
  html,body,#root{margin:0;height:100%;background:var(--background);color:var(--foreground);font-family:var(--font-sans);}
  .err{padding:24px;color:#b91c1c;white-space:pre-wrap;}
  #root.boot{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;}
  #root.boot .art{position:relative;width:88px;height:72px;color:var(--foreground);}
  #root.boot .art svg{display:block;width:88px;height:64px;}
  #root.boot .dots{display:flex;gap:5px;justify-content:center;margin-top:2px;}
  #root.boot .dots i{width:6px;height:6px;border-radius:50%;background:var(--primary);opacity:.35;animation:mma-dot 1s ease-in-out infinite;}
  #root.boot .dots i:nth-child(2){animation-delay:.15s;}
  #root.boot .dots i:nth-child(3){animation-delay:.3s;}
  @keyframes mma-dot{0%,80%,100%{transform:translateY(0);opacity:.3}40%{transform:translateY(-5px);opacity:1}}
</style>
</head>
<body>
<div id="root" class="boot" role="status" aria-label="加载中">
  <div class="art" aria-hidden="true">
    <svg viewBox="0 0 88 64" fill="none">
      <rect x="10" y="8" width="68" height="48" rx="10" stroke="currentColor" stroke-width="1.6" opacity=".35"/>
      <rect x="10" y="8" width="68" height="12" rx="10" fill="currentColor" opacity=".08"/>
      <circle cx="20" cy="14" r="2.2" fill="currentColor" opacity=".35"/>
      <rect x="26" y="12.2" width="18" height="3.6" rx="1.8" fill="currentColor" opacity=".22"/>
      <rect x="20" y="28" width="28" height="4" rx="2" fill="currentColor" opacity=".16"/>
      <rect x="20" y="36" width="40" height="4" rx="2" fill="currentColor" opacity=".1"/>
      <rect x="20" y="44" width="22" height="4" rx="2" fill="currentColor" opacity=".08"/>
      <path d="M62 40c6 0 10 5 10 10" stroke="var(--primary)" stroke-width="1.8" stroke-linecap="round" opacity=".85"/>
      <circle cx="72" cy="50" r="3.2" fill="var(--primary)" opacity=".9"/>
    </svg>
    <div class="dots"><i></i><i></i><i></i></div>
  </div>
</div>
<script type="module">
const APP_ID = ${safe};
(() => {
  const q = new URLSearchParams(location.search);
  const th = q.get("theme") || "light";
  const pal = q.get("palette") || "default";
  const dock = q.get("dock") || "fill";
  document.documentElement.setAttribute("data-theme", th);
  document.documentElement.classList.toggle("dark", th === "dark");
  document.documentElement.setAttribute("data-palette", pal);
  document.documentElement.setAttribute("data-dock", dock);
  window.addEventListener("message", (ev) => {
    const d = ev.data;
    if (!d || d.type !== "mma-set-env") return;
    if (d.theme) {
      document.documentElement.setAttribute("data-theme", d.theme);
      document.documentElement.classList.toggle("dark", d.theme === "dark");
    }
    if (d.palette) document.documentElement.setAttribute("data-palette", d.palette);
    if (d.dock) document.documentElement.setAttribute("data-dock", d.dock);
  });
})();
const cssLink = document.createElement("link");
cssLink.rel = "stylesheet";
cssLink.href = "/ui.css";
document.head.appendChild(cssLink);

// 编译后的 app bundle 完全自包含（react + 组件 + useDashboardApi 都在里面），
// 这里只需要按 id 加载。失败时展示可读错误。
try {
  await import("/api/app/" + encodeURIComponent(APP_ID) + "/ui/entry.js");
} catch (e) {
  const rootEl = document.getElementById("root");
  if (rootEl) {
    rootEl.className = "err";
    rootEl.textContent = String((e && (e.stack || e.message)) || e);
  }
}
</script>
</body>
</html>`;
}


/**
 * Cordis apply entry. Registrations should be reversible via returned disposers / ctx.effect.
 */