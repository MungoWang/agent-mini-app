import { RUNTIME_HREF, SDK_HREF } from "../compile/ui-compiler.ts";

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