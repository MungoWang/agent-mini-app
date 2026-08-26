/**
 * dsh web client: sidebar footer + Host dashboard chrome.
 * tsup wraps this in window.__ModuleLoader__ for dsh client-modules.
 */
// @ts-nocheck
import { PALETTES, clampPalette, tokensOf } from "./themes.js";

export const name = "monkey-mini-app-client";
export const inject = ["slots"] as const;

var APPS_HOST = (function () {
  try {
    return localStorage.getItem("mma-apps-host") || "http://127.0.0.1:17880";
  } catch (_) {
    return "http://127.0.0.1:17880";
  }
})();
function setAppsHost(url) {
  APPS_HOST = String(url || APPS_HOST);
  try {
    localStorage.setItem("mma-apps-host", APPS_HOST);
  } catch (_) {}
}
var EASE = "cubic-bezier(.22,.8,.24,1)";
var ANIM_MS = 320;
var BLURB = {
  "com.example.todo": "本地待办，存在这台机器上",
  "com.example.hello": "检查小程序和 Host 是否连通",
  "com.example.sysmon": "CPU、内存、磁盘和进程",
  "com.deepseek.aiagentnews": "AI Agent 头条与摘要",
};

/* 卡片方案 monogram：host 端已算好 acronym（manifest 优先，否则按中文名拼音声母）。 */
function clampCardStyle(v) {
  return v === "hero" || v === "etch" ? v : "stamp";
}
function monoOf(a) {
  return (a && a.acronym) || "AP";
}

var state = {
  tabs: [{ id: "all", title: "全部", kind: "all" }],
  active: "all",
  apps: [],
  error: null,
  loading: false,
  query: "",
  dock: (function () {
    try {
      return localStorage.getItem("mma-dock") || "fill";
    } catch (_) {
      return "fill";
    }
  })(),
  theme: "light",
  palette: "default",
  themeScope: (function () {
    try {
      return localStorage.getItem("mma-theme-scope") === "app" ? "app" : "global";
    } catch (_) {
      return "global";
    }
  })(),
  customPalettes: {},
  cardStyle: (function () {
    try {
      return clampCardStyle(localStorage.getItem("mma-card-style"));
    } catch (_) {
      return "stamp";
    }
  })(),
  visible: false,
  pendingDelete: null,
};

var frameMap = {};
var _animTimer = 0;
var _visTimer = 0;
var _closing = false;
var _layoutLockUntil = 0;
var _bound = false;

/* 浏览面板：commits / storage（每面板独立加载，detail 为当前展开项） */
var browseState = {
  open: false,
  kind: "history",
  appId: null,
  appName: "",
  loading: false,
  error: null,
  list: [],
  detail: null, // commit 详情
  table: null, // storage table 名
  tableValue: null,
  openFile: null, // 当前展开 preview 的文件路径
};

function css(el, obj) {
  Object.keys(obj).forEach(function (k) {
    el.style[k] = obj[k];
  });
}

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function luminanceOf(color) {
  var m = String(color || "").match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!m) return null;
  var a = m[4] == null ? 1 : Number(m[4]);
  if (a < 0.5) return null;
  return (Number(m[1]) * 0.2126 + Number(m[2]) * 0.7152 + Number(m[3]) * 0.0722) / 255;
}

function dshIsDark() {
  try {
    var probes = [];
    var side = document.querySelector("aside, nav, [class*='sidebar'], [class*='Sidebar']");
    if (side) probes.push(side);
    var ns = document.querySelector("button");
    if (ns) probes.push(ns);
    probes.push(document.body, document.documentElement);
    for (var i = 0; i < probes.length; i++) {
      var l = luminanceOf(getComputedStyle(probes[i]).backgroundColor);
      if (l != null) return l < 0.45;
    }
    var cs = getComputedStyle(document.documentElement);
    var token = cs.getPropertyValue("--dsw-alias-bg-layer-1") || cs.getPropertyValue("--dsw-alias-bg");
    var tl = luminanceOf(token);
    if (tl != null) return tl < 0.45;
  } catch (_) {}
  return false;
}

function storedMode() {
  try {
    var m = localStorage.getItem("mma-theme-mode");
    if (m === "light" || m === "dark") return m;
  } catch (_) {}
  return null;
}

function initAppearance() {
  state.theme = storedMode() || (dshIsDark() ? "dark" : "light");
  try {
    var raw = localStorage.getItem("mma-palette");
    state.palette = typeof raw === "string" && raw ? raw : "default";
  } catch (_) {
    state.palette = "default";
  }
}

function normalizePalette(v) {
  if (v && state.customPalettes[v]) return v;
  return clampPalette(v);
}
function loadCustomPalettes() {
  fetch(APPS_HOST + "/api/palettes")
    .then(function (r) {
      return r.json();
    })
    .then(function (j) {
      if (!j || !j.ok || !Array.isArray(j.palettes)) return;
      state.customPalettes = {};
      j.palettes.forEach(function (p) {
        if (p.custom) {
          state.customPalettes[p.id] = { label: p.label, swatch: p.swatch, tokens: p.tokens };
        }
      });
      paintThemePop();
      applyTheme();
    })
    .catch(function () {});
}
function paletteTokens(pal, mode) {
  var c = state.customPalettes[pal];
  if (c && c.tokens && c.tokens[mode]) return c.tokens[mode];
  return tokensOf(pal, mode);
}

function applyTheme(root) {
  var el = root || document.getElementById("mma-host");
  if (!el) return;
  var mode = state.theme === "dark" ? "dark" : "light";
  var pal = state.customPalettes[state.palette] ? state.palette : clampPalette(state.palette);
  var t = paletteTokens(pal, mode);
  el.setAttribute("data-theme", mode);
  el.setAttribute("data-palette", pal);
  var vars = {
    "--dsw-alias-bg": t.bg,
    "--dsw-alias-fg": t.fg,
    "--dsw-alias-surface": t.surface,
    "--dsw-alias-border": t.border,
    "--dsw-alias-muted": t.muted,
    "--dsw-alias-primary": t.primary,
    "--dsw-alias-primary-fg": t.primaryFg,
    "--dsw-alias-accent": t.accent,
    "--dsw-alias-shadow": t.shadow,
    "--background": t.bg,
    "--foreground": t.fg,
    "--card": t.surface,
    "--card-foreground": t.surfaceFg,
    "--primary": t.primary,
    "--primary-foreground": t.primaryFg,
    "--secondary": t.secondary,
    "--secondary-foreground": t.secondaryFg,
    "--muted": t.muted,
    "--muted-foreground": t.mutedFg,
    "--accent": t.accent,
    "--accent-foreground": t.accentFg,
    "--border": t.border,
    "--input": t.input,
    "--ring": t.ring,
    "--destructive": t.destructive,
    "--destructive-foreground": t.destructiveFg,
    "--radius": t.radius,
    "--shadow": t.shadow,
  };
  Object.keys(vars).forEach(function (k) {
    el.style.setProperty(k, vars[k]);
  });
  el.style.background = t.bg;
  el.style.color = t.fg;
  paintThemePop();
}

function persistAppearance() {
  try {
    localStorage.setItem("mma-theme-mode", state.theme);
    localStorage.setItem("mma-palette", state.palette);
  } catch (_) {}
  fetch(APPS_HOST + "/api/host-config", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ theme: state.theme, palette: state.palette }),
  }).catch(function () {});
}

function setAppearance(next, scope) {
  if (next.theme === "light" || next.theme === "dark") state.theme = next.theme;
  if (next.palette) state.palette = normalizePalette(next.palette);
  if (scope === "app") {
    // per-app：保存到该 app 的 theme.json，只更新该 app 的 iframe，全局不动
    var app = activeApp();
    if (app) {
      var env = envForApp(app.id);
      var body = {
        theme: next.theme || env.theme,
        palette: normalizePalette(next.palette || env.palette),
      };
      fetch(APPS_HOST + "/api/apps/" + encodeURIComponent(app.id) + "/theme", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
        .then(function (r) {
          return r.json();
        })
        .then(function (j) {
          if (j && j.theme) {
            var a = state.apps.find(function (x) {
              return x.id === app.id;
            });
            if (a) a.theme = j.theme;
            postEnvToFrameByApp(app.id);
          }
        })
        .catch(function () {});
      return;
    }
  }
  applyTheme();
  postEnvToFrames();
  persistAppearance();
  var themeSel = document.getElementById("mma-cfg-theme");
  var palSel = document.getElementById("mma-cfg-palette");
  if (themeSel) themeSel.value = state.theme;
  if (palSel) palSel.value = state.palette;
}

function syncThemeFromDsh() {
  if (storedMode()) return;
  var next = dshIsDark() ? "dark" : "light";
  if (next === state.theme) return;
  state.theme = next;
  applyTheme();
  postEnvToFrames();
}

function postEnvToFrame(id) {
  var rec = frameMap[id];
  if (!rec || !rec.iframe || !rec.iframe.contentWindow) return;
  var appId = rec.wrap ? rec.wrap.getAttribute("data-app") : null;
  var env = appId ? envForApp(appId) : { theme: state.theme, palette: state.palette };
  try {
    rec.iframe.contentWindow.postMessage(
      { type: "mma-set-env", theme: env.theme, palette: env.palette, dock: state.dock },
      "*"
    );
  } catch (_) {}
}
function postEnvToFrames() {
  Object.keys(frameMap).forEach(postEnvToFrame);
}
function postEnvToFrameByApp(appId) {
  Object.keys(frameMap).forEach(function (id) {
    var rec = frameMap[id];
    if (rec && rec.wrap && rec.wrap.getAttribute("data-app") === appId) postEnvToFrame(id);
  });
}
function envForApp(appId) {
  var t = appThemeOf(appId);
  return {
    theme: t && t.theme ? t.theme : state.theme,
    palette: t && t.palette ? normalizePalette(t.palette) : state.palette,
  };
}
function appThemeOf(appId) {
  var a = state.apps.find(function (x) {
    return x.id === appId;
  });
  return (a && a.theme) || null;
}
function clearAppTheme() {
  var app = activeApp();
  if (!app) return;
  fetch(APPS_HOST + "/api/apps/" + encodeURIComponent(app.id) + "/theme", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ reset: true }),
  })
    .then(function (r) {
      return r.json();
    })
    .then(function () {
      var a = state.apps.find(function (x) {
        return x.id === app.id;
      });
      if (a) a.theme = null;
      postEnvToFrameByApp(app.id);
      paintThemePop();
    })
    .catch(function () {});
}

function hideThemePop() {
  var pop = document.getElementById("mma-theme-pop");
  if (!pop || pop.getAttribute("data-open") !== "1") return false;
  pop.removeAttribute("data-open");
  return true;
}

function toggleThemePop() {
  var pop = document.getElementById("mma-theme-pop");
  if (!pop) return;
  if (pop.getAttribute("data-open") === "1") pop.removeAttribute("data-open");
  else {
    paintThemePop();
    pop.setAttribute("data-open", "1");
  }
}

function paintThemePop() {
  var pop = document.getElementById("mma-theme-pop");
  if (!pop) return;
  // 重建列表（含异步加载的自定义主题），再同步选中态
  var list = pop.querySelector(".mma-pop-list");
  if (list) list.innerHTML = paletteMenuHtml();
  var modes = pop.querySelectorAll("[data-mode]");
  for (var i = 0; i < modes.length; i++) {
    modes[i].setAttribute("data-on", modes[i].getAttribute("data-mode") === state.theme ? "1" : "0");
  }
  var swatches = pop.querySelectorAll("[data-palette]");
  for (var j = 0; j < swatches.length; j++) {
    swatches[j].setAttribute("data-on", swatches[j].getAttribute("data-palette") === state.palette ? "1" : "0");
  }
  var scopeBtns = pop.querySelectorAll("[data-scope]");
  for (var k = 0; k < scopeBtns.length; k++) {
    scopeBtns[k].setAttribute("data-on", scopeBtns[k].getAttribute("data-scope") === state.themeScope ? "1" : "0");
  }
  var appBtn = pop.querySelector("#mma-scope-app");
  if (appBtn) {
    var app = activeApp();
    appBtn.disabled = !app;
    appBtn.title = app ? "保存到「" + app.name + "」" : "打开小程序后可用";
    appBtn.textContent = app ? app.name : "当前应用";
  }
  var clearBtn = pop.querySelector("#mma-clear-app-theme");
  if (clearBtn) {
    clearBtn.hidden = !(state.themeScope === "app" && app && appThemeOf(app.id));
  }
}

function paletteMenuHtml() {
  var items = PALETTES.map(function (p) {
    return (
      '<button type="button" class="mma-swatch" data-palette="' +
      p.id +
      '" role="menuitem">' +
      '<i class="mma-dot" style="background:' +
      p.swatch +
      '"></i><span>' +
      p.label +
      "</span></button>"
    );
  });
  Object.keys(state.customPalettes).forEach(function (id) {
    var c = state.customPalettes[id];
    items.push(
      '<button type="button" class="mma-swatch" data-palette="' +
        id +
        '" role="menuitem">' +
        '<i class="mma-dot" style="background:' +
        c.swatch +
        '"></i><span>' +
        c.label +
        '</span><i class="mma-custom-badge">自定义</i></button>'
    );
  });
  return items.join("");
}

function paletteOptionsHtml() {
  return PALETTES.map(function (p) {
    return '<option value="' + p.id + '">' + p.label + "</option>";
  }).join("");
}

function installFootCss() {
  if (document.getElementById("mma-foot-css")) return;
  var s = document.createElement("style");
  s.id = "mma-foot-css";
  s.textContent = [
    "html.mma-anim-dock{transition:padding-right " + ANIM_MS + "ms " + EASE + ";}",
    "html.mma-dock-side{padding-right:var(--mma-side-w,440px);box-sizing:border-box;}",
    "#mma-host{color:var(--dsw-alias-fg,#111);background:var(--dsw-alias-bg,#f7f7f8);overflow:hidden;transition:background-color .22s ease,color .22s ease,border-color .22s ease;}",
    "#mma-host.mma-anim-dock{transition:left " + ANIM_MS + "ms " + EASE + ",width " + ANIM_MS + "ms " + EASE + ",opacity " + ANIM_MS + "ms " + EASE + ",transform " + ANIM_MS + "ms " + EASE + ",box-shadow " + ANIM_MS + "ms ease,border-color " + ANIM_MS + "ms ease,background-color .22s ease,color .22s ease;}",
    "#mma-host button,#mma-host input,#mma-host select{color:inherit;font:inherit;}",
    "#mma-host .mma-chrome{display:flex;align-items:center;gap:8px;height:44px;padding:0 10px;border-bottom:1px solid var(--dsw-alias-border,#e5e7eb);background:var(--dsw-alias-surface,#fff);flex:0 0 auto;transition:background-color .22s ease,border-color .22s ease;}",
    "#mma-host .mma-tabs{display:flex;align-items:center;gap:2px;flex:1;min-width:0;overflow-x:auto;overflow-y:hidden;flex-wrap:nowrap;scrollbar-width:thin;}",
    "#mma-host .mma-tab{display:inline-flex;align-items:center;flex:0 0 auto;max-width:140px;height:32px;padding:0 10px;border:0;border-bottom:2px solid transparent;background:transparent;cursor:pointer;font-size:13px;font-weight:500;color:inherit;opacity:.7;white-space:nowrap;border-radius:8px 8px 0 0;}",
    "#mma-host .mma-tab[data-active='1']{font-weight:600;opacity:1;border-bottom-color:var(--dsw-alias-primary,#3b82f6);color:var(--dsw-alias-primary,#3b82f6);}",
    "#mma-host .mma-tab>span{display:inline-flex;align-items:center;gap:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
    "#mma-host .mma-tab-x{margin-left:6px;border:0;background:transparent;cursor:pointer;opacity:.55;color:inherit;padding:0 2px;line-height:1;font-size:14px;flex:0 0 auto;}",
    "#mma-host [hidden]{display:none !important;}",
    "#mma-host .mma-iconbtn{width:32px;height:32px;border:0;border-radius:8px;background:transparent;cursor:pointer;color:inherit;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;}",
    "#mma-host .mma-iconbtn:hover{background:var(--dsw-alias-muted,#f3f4f6);}",
    "#mma-host .mma-theme-wrap{position:relative;flex:0 0 auto;}",
    "#mma-host .mma-pop{display:none;position:absolute;right:0;top:38px;z-index:8;width:220px;padding:10px;border-radius:12px;border:1px solid var(--dsw-alias-border,#e5e7eb);background:var(--dsw-alias-surface,#fff);box-shadow:0 12px 32px var(--dsw-alias-shadow,rgba(0,0,0,.14));}",
    "#mma-host .mma-pop[data-open='1']{display:block;}",
    "#mma-host .mma-pop-seg{display:flex;gap:4px;margin:0 0 8px;padding:3px;border-radius:9px;background:var(--dsw-alias-muted,#f3f4f6);}",
    "#mma-host .mma-pop-seg button{flex:1;height:28px;border:0;border-radius:7px;background:transparent;cursor:pointer;font-size:12px;color:inherit;}",
    "#mma-host .mma-pop-seg button[data-on='1']{background:var(--dsw-alias-surface,#fff);font-weight:600;box-shadow:0 1px 2px var(--dsw-alias-shadow,rgba(0,0,0,.06));color:var(--dsw-alias-primary,#2563eb);}",
    "#mma-host .mma-scope-seg{margin-top:8px;border-top:1px solid var(--dsw-alias-border,#e5e7eb);padding-top:8px;}",
    "#mma-host .mma-scope-seg button:disabled{opacity:.45;cursor:not-allowed;}",
    "#mma-host .mma-swatch{display:flex;align-items:center;gap:10px;width:100%;height:36px;padding:0 8px;border:0;border-radius:8px;background:transparent;cursor:pointer;color:inherit;font-size:13px;text-align:left;}",
    "#mma-host .mma-swatch:hover{background:var(--dsw-alias-accent,var(--dsw-alias-muted,#f3f4f6));}",
    "#mma-host .mma-swatch[data-on='1']{background:var(--dsw-alias-accent,var(--dsw-alias-muted,#f3f4f6));font-weight:600;}",
    "#mma-host .mma-dot{width:14px;height:14px;border-radius:99px;border:1px solid var(--dsw-alias-border,#e5e7eb);flex:0 0 14px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.25);}",
    "#mma-host .mma-textbtn{height:28px;padding:0 8px;border:0;border-radius:6px;background:transparent;cursor:pointer;color:inherit;opacity:.7;font-size:12px;}",
    "#mma-host .mma-textbtn:hover{opacity:1;background:var(--dsw-alias-muted,#f3f4f6);}",
    "#mma-host .mma-textbtn.danger:hover{color:#dc2626;}",
    "#mma-host .mma-stage{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden;position:relative;}",
    "#mma-host .mma-list,#mma-host .mma-frames{flex:1;min-height:0;overflow:auto;}",
    "#mma-host .mma-frames{display:none;position:relative;}",
    "#mma-host .mma-frame{position:absolute;inset:0;display:none;flex-direction:column;}",
    "#mma-host .mma-frame>iframe{flex:1;height:100%;min-height:0;width:100%;border:0;background:transparent;display:block;}",
    "#mma-host .mma-list-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:18px 18px 8px;}",
    "#mma-host .mma-list-head h2{margin:0;font-size:16px;font-weight:650;}",
    "#mma-host .mma-list-head span{font-size:12px;opacity:.5;}",
    "#mma-host .mma-search{margin:0 18px 12px;position:relative;}",
    "#mma-host .mma-search input{width:100%;height:34px;box-sizing:border-box;padding:0 12px 0 32px;border:1px solid var(--dsw-alias-border,#e5e7eb);border-radius:8px;background:var(--dsw-alias-surface,#fff);color:inherit;font-size:13px;outline:none;}",
    "#mma-host .mma-search input:focus{border-color:var(--dsw-alias-primary,#3b82f6);}",
    "#mma-host .mma-search svg{position:absolute;left:10px;top:9px;opacity:.45;pointer-events:none;}",
    "#mma-host .mma-grid{padding:8px 16px 20px;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;}",
    "#mma-host[data-dock='side'] .mma-grid{grid-template-columns:minmax(0,1fr);}",
    "#mma-host .mma-card,#mma-host .mma-row{text-align:left;border-radius:13px;border:1px solid var(--dsw-alias-border,#e5e7eb);background:var(--dsw-alias-surface,#fff);color:var(--dsw-alias-fg,#111);cursor:pointer;transition:border-color .16s ease,box-shadow .16s ease,transform .16s ease,background-color .22s ease;}",
    "#mma-host .mma-card{display:flex;flex-direction:column;align-items:flex-start;gap:0;padding:16px 15px 13px;position:relative;overflow:hidden;}",
    "#mma-host .mma-row{display:flex;align-items:center;gap:12px;padding:10px 12px;position:relative;overflow:hidden;width:100%;}",
    "#mma-host .mma-card h3,#mma-host .mma-row .mma-t{font-size:14px;font-weight:650;margin:0;letter-spacing:.1px;position:relative;z-index:1;}",
    "#mma-host .mma-card p,#mma-host .mma-row small{font-size:12px;color:var(--muted-foreground,inherit);opacity:.85;line-height:1.45;}",
    "#mma-host .mma-card p{margin:0;position:relative;z-index:1;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}",
    "#mma-host .mma-row .mma-twrap{flex:1;min-width:0;position:relative;z-index:1;}",
    "#mma-host .mma-row small{display:block;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
    "#mma-host .mma-row .mma-right{margin-left:auto;display:flex;align-items:center;gap:7px;flex:0 0 auto;position:relative;z-index:1;}",
    "#mma-host .mma-chev{color:var(--muted-foreground,inherit);opacity:.5;width:14px;height:14px;}",
    "#mma-host .mma-meta{display:flex;align-items:center;gap:10px;margin-top:9px;position:relative;z-index:1;}",
    "#mma-host .mma-ver{font-size:10.5px;color:var(--muted-foreground,inherit);opacity:.8;letter-spacing:.2px;white-space:nowrap;}",
    "#mma-host .mma-open{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:var(--dsw-alias-primary,#3b82f6);white-space:nowrap;}",
    "#mma-host .mma-open i{width:6px;height:6px;border-radius:99px;background:var(--dsw-alias-primary,#3b82f6);}",
    // ① Hero 海报：渐变文字 monogram + 右上光晕（grid 竖排卡 / side 微缩行同元素）
    "#mma-host[data-cardstyle='hero'] .mma-card::before,#mma-host[data-cardstyle='hero'] .mma-row::before{content:'';position:absolute;top:-28px;right:-20px;width:140px;height:120px;background:radial-gradient(62% 62% at 62% 40%,hsl(var(--h,215) 80% 60% / .20),transparent 72%);transition:opacity .16s ease;pointer-events:none;}",
    "#mma-host[data-cardstyle='hero'] .mma-card:hover::before,#mma-host[data-cardstyle='hero'] .mma-row:hover::before{opacity:1.3;}",
    "#mma-host[data-cardstyle='hero'] .mma-card:hover,#mma-host[data-cardstyle='hero'] .mma-row:hover{border-color:hsl(var(--h,215) 70% 60% / .45);box-shadow:0 8px 22px var(--dsw-alias-shadow,rgba(0,0,0,.08));transform:translateY(-1px);}",
    "#mma-host[data-cardstyle='hero'] .mma-mono{font-size:52px;font-weight:800;letter-spacing:2px;line-height:1.05;position:relative;z-index:1;margin-bottom:11px;color:hsl(var(--h,215) 60% 40%);}",
    "@supports (-webkit-background-clip:text){#mma-host[data-cardstyle='hero'] .mma-mono{background:linear-gradient(135deg,hsl(var(--h,215) 72% 42%),hsl(var(--h,215) 72% 62%));-webkit-background-clip:text;background-clip:text;color:transparent;}}",
    "@supports (-webkit-background-clip:text){#mma-host[data-theme='dark'][data-cardstyle='hero'] .mma-mono{background:linear-gradient(135deg,hsl(var(--h,215) 85% 70%),hsl(var(--h,215) 85% 84%));-webkit-background-clip:text;background-clip:text;color:transparent;}}",
    "#mma-host[data-cardstyle='hero'] .mma-row .mma-mono{font-size:27px;width:34px;height:34px;display:flex;align-items:center;justify-content:center;margin:0;flex:0 0 34px;}",
    // ② 蚀刻空心：大号描边字，hover 填充实心
    "#mma-host[data-cardstyle='etch'] .mma-etch{font-size:46px;font-weight:800;letter-spacing:2px;line-height:1.02;color:transparent;-webkit-text-stroke:1.5px hsl(var(--h,215) 65% 45%);margin-bottom:10px;transition:color .2s ease;position:relative;z-index:1;}",
    "#mma-host[data-theme='dark'][data-cardstyle='etch'] .mma-etch{-webkit-text-stroke:1.5px hsl(var(--h,215) 85% 72%);}",
    "#mma-host[data-cardstyle='etch'] .mma-card:hover,#mma-host[data-cardstyle='etch'] .mma-row:hover{border-color:hsl(var(--h,215) 65% 50% / .5);box-shadow:0 8px 22px var(--dsw-alias-shadow,rgba(0,0,0,.08));transform:translateY(-1px);}",
    "#mma-host[data-cardstyle='etch'] .mma-card:hover .mma-etch,#mma-host[data-cardstyle='etch'] .mma-row:hover .mma-etch{color:hsl(var(--h,215) 65% 45%);}",
    "#mma-host[data-theme='dark'][data-cardstyle='etch'] .mma-card:hover .mma-etch,#mma-host[data-theme='dark'][data-cardstyle='etch'] .mma-row:hover .mma-etch{color:hsl(var(--h,215) 85% 72%);}",
    "#mma-host[data-cardstyle='etch'] .mma-row .mma-etch{flex:0 0 30px;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:25px;letter-spacing:1px;margin:0;-webkit-text-stroke-width:1.2px;}",
    // ③ 印章印刷：右上线框邮戳，hover 黑白反转
    "#mma-host[data-cardstyle='stamp'] .mma-stamp{position:absolute;top:13px;right:13px;width:44px;height:44px;border:1.5px solid var(--dsw-alias-fg,#111);border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;letter-spacing:1px;color:var(--dsw-alias-fg,#111);background:transparent;transition:background-color .18s ease,color .18s ease,transform .18s ease;}",
    "#mma-host[data-cardstyle='stamp'] .mma-card:hover .mma-stamp,#mma-host[data-cardstyle='stamp'] .mma-row:hover .mma-stamp{background:var(--dsw-alias-fg,#111);color:var(--dsw-alias-surface,#fff);transform:scale(1.05);}",
    "#mma-host[data-cardstyle='stamp'] .mma-card:hover,#mma-host[data-cardstyle='stamp'] .mma-row:hover{border-color:var(--dsw-alias-fg,#111);box-shadow:0 8px 22px var(--dsw-alias-shadow,rgba(0,0,0,.08));transform:translateY(-1px);}",
    "#mma-host[data-cardstyle='stamp'] .mma-card h3,#mma-host[data-cardstyle='stamp'] .mma-card p{padding-right:52px;}",
    "#mma-host[data-cardstyle='stamp'] .mma-row .mma-stamp{position:static;width:36px;height:36px;font-size:12px;border-radius:8px;flex:0 0 36px;}",
    "#mma-host .mma-open-dot{width:7px;height:7px;border-radius:99px;background:var(--dsw-alias-primary,#3b82f6);display:inline-block;}",
    "#mma-host .mma-empty{padding:24px;opacity:.75;line-height:1.6;}",
    "#mma-host .mma-error{padding:24px;color:#b91c1c;}",
    ".mma-load{flex:1;min-height:180px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:var(--dsw-alias-fg,#111);}",
    ".mma-load-art{position:relative;width:88px;height:72px;}",
    ".mma-load-art svg{display:block;width:88px;height:64px;}",
    ".mma-load-dots{display:flex;gap:5px;justify-content:center;margin-top:2px;}",
    ".mma-load-dots i{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-primary,#3b82f6);opacity:.35;animation:mma-dot 1s ease-in-out infinite;}",
    ".mma-load-dots i:nth-child(2){animation-delay:.15s;}",
    ".mma-load-dots i:nth-child(3){animation-delay:.3s;}",
    "@keyframes mma-dot{0%,80%,100%{transform:translateY(0);opacity:.3}40%{transform:translateY(-5px);opacity:1}}",
    ".mma-iframe-wrap{position:relative;flex:1 1 auto;min-height:0;height:100%;display:flex;flex-direction:column;}",
    ".mma-iframe-wrap .mma-load,#mma-host .mma-frame .mma-load{position:absolute;inset:0;background:var(--dsw-alias-bg,#f7f7f8);z-index:1;}",
    "#mma-host .mma-modal{position:absolute;inset:0;background:rgba(0,0,0,.35);z-index:5;display:flex;align-items:center;justify-content:center;padding:24px;}",
    "#mma-host .mma-modal[hidden]{display:none;}",
    "#mma-host .mma-dialog{width:min(360px,100%);background:var(--dsw-alias-surface,#fff);color:var(--dsw-alias-fg,#111);border:1px solid var(--dsw-alias-border,#e5e7eb);border-radius:var(--radius,12px);padding:18px;box-shadow:0 12px 40px var(--dsw-alias-shadow,rgba(0,0,0,.18));}",
    "#mma-host .mma-dialog h3{margin:0 0 8px;font-size:15px;}",
    "#mma-host .mma-dialog p{margin:0 0 16px;font-size:13px;opacity:.75;line-height:1.5;}",
    "#mma-host .mma-dialog-actions{display:flex;justify-content:flex-end;gap:8px;}",
    "#mma-host .mma-dialog-actions button{height:32px;padding:0 12px;border-radius:8px;border:1px solid var(--dsw-alias-border,#e5e7eb);background:var(--dsw-alias-surface,#fff);cursor:pointer;}",
    "#mma-host .mma-dialog-actions .go{background:#dc2626;color:#fff;border-color:#dc2626;}",
    "#mma-host .mma-settings{position:absolute;inset:0;background:var(--dsw-alias-bg,#f7f7f8);z-index:4;overflow:auto;padding:20px 22px 32px;display:none;}",
    "#mma-host .mma-settings[data-open='1']{display:block;}",
    "#mma-host .mma-settings h3{margin:0 0 6px;font-size:16px;}",
    "#mma-host .mma-settings p.lead{margin:0 0 16px;font-size:12px;opacity:.6;line-height:1.45;}",
    "#mma-host .mma-field{display:flex;flex-direction:column;gap:6px;margin:0 0 14px;}",
    "#mma-host .mma-field label{font-size:12px;font-weight:600;}",
    "#mma-host .mma-field input,#mma-host .mma-field select{height:34px;padding:0 10px;border:1px solid var(--dsw-alias-border,#e5e7eb);border-radius:8px;background:var(--dsw-alias-surface,#fff);color:inherit;font:inherit;}",
    "#mma-host .mma-settings-actions{display:flex;gap:8px;align-items:center;margin-top:8px;}",
    "#mma-host .mma-settings-actions button{height:32px;padding:0 12px;border-radius:8px;border:1px solid var(--dsw-alias-primary,#2563eb);background:var(--dsw-alias-primary,#2563eb);color:var(--dsw-alias-primary-fg,#fff);cursor:pointer;}",
    "#mma-host .mma-settings-actions button.ghost{background:transparent;color:inherit;border-color:var(--dsw-alias-border,#e5e7eb);}",
    "#mma-host .mma-settings-msg{font-size:12px;opacity:.7;}",
    "#mma-host .mma-settings-msg.err{color:#b91c1c;opacity:1;}",
    // —— 浏览面板（commits / storage 共用） ——
    "#mma-host .mma-browse{background:var(--dsw-alias-bg,#f7f7f8);}",
    "#mma-host .mma-browse-head{display:flex;align-items:center;gap:8px;margin:0 0 12px;}",
    "#mma-host .mma-browse-head h3{margin:0;font-size:15px;font-weight:700;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
    "#mma-host .mma-browse-head .sub{font-size:11.5px;color:var(--muted-foreground,inherit);opacity:.7;white-space:nowrap;}",
    "#mma-host .mma-btns{display:flex;gap:6px;}",
    "#mma-host .mma-btns button{height:26px;padding:0 10px;border-radius:7px;border:1px solid var(--dsw-alias-border,#e5e7eb);background:var(--dsw-alias-surface,#fff);cursor:pointer;font-size:12px;color:inherit;}",
    "#mma-host .mma-btns button:hover{border-color:var(--dsw-alias-primary,#3b82f6);color:var(--dsw-alias-primary,#3b82f6);}",
    "#mma-host .mma-blist{display:flex;flex-direction:column;gap:6px;}",
    "#mma-host .mma-bitem{display:block;width:100%;text-align:left;padding:10px 12px;border-radius:10px;border:1px solid var(--dsw-alias-border,#e5e7eb);background:var(--dsw-alias-surface,#fff);cursor:pointer;font:inherit;color:inherit;transition:border-color .14s ease,box-shadow .14s ease,transform .14s ease;}",
    "#mma-host .mma-bitem:hover{border-color:var(--dsw-alias-primary,#3b82f6);box-shadow:0 4px 12px var(--dsw-alias-shadow,rgba(0,0,0,.08));transform:translateY(-1px);}",
    "#mma-host .mma-bitem b{display:block;font-size:13px;font-weight:650;word-break:break-all;}",
    "#mma-host .mma-bitem .meta{display:flex;align-items:center;gap:8px;margin-top:4px;font-size:11px;color:var(--muted-foreground,inherit);opacity:.75;flex-wrap:wrap;}",
    "#mma-host .mma-bitem .meta code{font-size:10.5px;background:var(--dsw-alias-muted,#f3f4f6);padding:1px 5px;border-radius:5px;}",
    "#mma-host .mma-plus{color:#16a34a;font-weight:600;}",
    "#mma-host .mma-minus{color:#dc2626;font-weight:600;}",
    "#mma-host .mma-files{margin-top:8px;border-top:1px dashed var(--dsw-alias-border,#e5e7eb);padding-top:6px;}",
    "#mma-host .mma-fitem{display:flex;align-items:center;gap:8px;width:100%;padding:6px 4px;border:0;background:none;cursor:pointer;font:inherit;color:inherit;font-size:12px;text-align:left;border-radius:6px;}",
    "#mma-host .mma-fitem:hover{background:var(--dsw-alias-muted,#f3f4f6);}",
    "#mma-host .mma-fitem .p{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:ui-monospace,Menlo,Consolas,monospace;}",
    "#mma-host .mma-preview{margin:4px 0 2px;padding:8px 10px;border-radius:8px;background:var(--dsw-alias-muted,#f3f4f6);font:11px/1.55 ui-monospace,Menlo,Consolas,monospace;overflow-x:auto;white-space:pre;max-height:220px;overflow-y:auto;}",
    "#mma-host .mma-bempty{padding:18px;text-align:center;opacity:.6;font-size:12px;}",
    "#mma-host .mma-berr{padding:14px;color:#b91c1c;font-size:12px;}",
    "#mma-host .mma-browse .mma-bitem[data-sec='0']{cursor:default;}",
    "#mma-host .mma-browse .mma-bitem[data-sec='0']:hover{transform:none;box-shadow:none;}",

    ".mma-foot-btn{display:flex;align-items:center;gap:8px;width:calc(100% + 4px);height:42px;margin:4px -2px;padding:0 10px 0 8px;box-sizing:border-box;border:0;border-radius:8px;background:transparent;color:inherit;font:inherit;line-height:inherit;cursor:pointer;}",
    ".mma-foot-btn:hover,.mma-foot-btn[aria-pressed='true']{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06));}",
    ".mma-foot-ico{display:inline-flex;width:16px;height:16px;align-items:center;justify-content:center;flex:0 0 16px;}",
    ".mma-foot-ico svg{display:block;}",
    ".mma-foot-label{white-space:nowrap;overflow:hidden;}",
    "[class*='_collapsed'] .mma-foot-label{display:none !important;}",
    "[class*='_railIn'] .mma-foot-label{display:none !important;}",
    "[class*='_collapsed'] .mma-foot-btn{width:36px;height:36px;margin:18px 0 10px;padding:0;gap:0;justify-content:center;border-radius:50%;overflow:hidden;}",
  ].join("");
  document.head.appendChild(s);
}

function hostLeftPx() {
  var best = 0;
  var nodes = document.body.querySelectorAll("aside, nav, [class*='sidebar'], [class*='Sidebar']");
  for (var i = 0; i < nodes.length; i++) {
    var r = nodes[i].getBoundingClientRect();
    if (r.top > 24) continue;
    if (r.left > 80) continue;
    if (r.height < window.innerHeight * 0.45) continue;
    if (r.width < 48 || r.width > 560) continue;
    if (r.right > best) best = r.right;
  }
  if (best < 48) {
    function walk(el) {
      if (!el || !el.getBoundingClientRect) return;
      var r = el.getBoundingClientRect();
      if (r.left <= 4 && r.top <= 4 && r.height >= window.innerHeight * 0.8 && r.width >= 48 && r.width <= 560) {
        if (r.right > best) best = r.right;
      }
      var ch = el.children || [];
      for (var k = 0; k < Math.min(ch.length, 12); k++) walk(ch[k]);
    }
    var kids = document.body.children;
    for (var j = 0; j < kids.length; j++) walk(kids[j]);
  }
  return Math.max(56, Math.round(best || 56));
}

function sideWidthPx() {
  return Math.round(Math.min(440, window.innerWidth * 0.42));
}

function layoutBox() {
  var vw = window.innerWidth;
  if (state.dock === "side") {
    var w = sideWidthPx();
    return { left: vw - w, width: w };
  }
  var rail = hostLeftPx();
  return { left: rail, width: Math.max(0, vw - rail) };
}

function setDockPad(on) {
  var w = sideWidthPx();
  document.documentElement.style.setProperty("--mma-side-w", w + "px");
  document.documentElement.classList.toggle("mma-dock-side", !!on);
}

function armDockAnim() {
  var host = document.getElementById("mma-host");
  if (host) host.classList.add("mma-anim-dock");
  document.documentElement.classList.add("mma-anim-dock");
  if (_animTimer) clearTimeout(_animTimer);
  _animTimer = setTimeout(function () {
    var h = document.getElementById("mma-host");
    if (h) h.classList.remove("mma-anim-dock");
    document.documentElement.classList.remove("mma-anim-dock");
    _animTimer = 0;
  }, ANIM_MS + 40);
}

function lockLayout() {
  _layoutLockUntil = Date.now() + ANIM_MS + 50;
}

function layoutLocked() {
  return _closing || Date.now() < _layoutLockUntil;
}

function clearVisTimer() {
  if (_visTimer) {
    clearTimeout(_visTimer);
    _visTimer = 0;
  }
}

function syncHostToSidebar(animate) {
  var host = document.getElementById("mma-host");
  if (!host) return;
  if (!animate && layoutLocked()) return;
  if (animate) armDockAnim();
  var box = layoutBox();
  host.style.top = "0";
  host.style.bottom = "0";
  host.style.right = "auto";
  host.style.zIndex = "40";
  host.style.left = box.left + "px";
  host.style.width = box.width + "px";
  host.setAttribute("data-dock", state.dock);
  if (state.dock === "side" && state.visible) {
    host.style.borderLeft = "1px solid var(--dsw-alias-border, #e5e7eb)";
    host.style.boxShadow = "-8px 0 24px rgba(0,0,0,.06)";
    setDockPad(true);
  } else {
    host.style.borderLeft = "none";
    host.style.boxShadow = "none";
    setDockPad(false);
  }
}

var _followRaf = 0;
function followSidebar(ms) {
  var until = Date.now() + (ms || 360);
  if (_followRaf) cancelAnimationFrame(_followRaf);
  function frame() {
    syncHostToSidebar(false);
    if (Date.now() < until) _followRaf = requestAnimationFrame(frame);
    else _followRaf = 0;
  }
  _followRaf = requestAnimationFrame(frame);
}

var _sideObs = null;
function startSidebarSync() {
  syncHostToSidebar(false);
  if (_sideObs) return;
  _sideObs = new ResizeObserver(function () {
    followSidebar(360);
  });
  function observeCols() {
    var nodes = document.body.querySelectorAll("aside, nav, [class*='sidebar'], [class*='Sidebar']");
    for (var i = 0; i < nodes.length; i++) {
      try {
        _sideObs.observe(nodes[i]);
      } catch (_) {}
    }
  }
  observeCols();
  window.addEventListener("resize", function () {
    followSidebar(360);
  });
  document.addEventListener(
    "click",
    function () {
      followSidebar(360);
    },
    true
  );
  var mo = new MutationObserver(function () {
    observeCols();
    followSidebar(360);
    syncThemeFromDsh();
  });
  mo.observe(document.documentElement, {
    attributes: true,
    subtree: true,
    attributeFilter: ["class", "style", "data-sidebar-collapsed", "data-collapsed", "data-theme", "data-color-mode"],
  });
}

function startRailWatch() {
  installFootCss();
  function tick() {
    syncHostToSidebar(false);
    syncThemeFromDsh();
  }
  tick();
  if (!window.__mmaRailWatch) {
    window.__mmaRailWatch = true;
    window.addEventListener("resize", tick);
    document.addEventListener(
      "click",
      function () {
        tick();
        var n = 0;
        function frame() {
          tick();
          n++;
          if (n < 45) requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      },
      true
    );
    setInterval(tick, 400);
    if (window.matchMedia) {
      try {
        window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", syncThemeFromDsh);
      } catch (_) {}
    }
  }
}

function loadingMarkup() {
  return (
    '<div class="mma-load" role="status" aria-label="加载中">' +
    '<div class="mma-load-art" aria-hidden="true">' +
    '<svg viewBox="0 0 88 64" fill="none">' +
    '<rect x="10" y="8" width="68" height="48" rx="10" stroke="currentColor" stroke-width="1.6" opacity=".35"/>' +
    '<rect x="10" y="8" width="68" height="12" rx="10" fill="currentColor" opacity=".08"/>' +
    '<circle cx="20" cy="14" r="2.2" fill="currentColor" opacity=".35"/>' +
    '<rect x="26" y="12.2" width="18" height="3.6" rx="1.8" fill="currentColor" opacity=".22"/>' +
    '<rect x="20" y="28" width="28" height="4" rx="2" fill="currentColor" opacity=".16"/>' +
    '<rect x="20" y="36" width="40" height="4" rx="2" fill="currentColor" opacity=".1"/>' +
    '<rect x="20" y="44" width="22" height="4" rx="2" fill="currentColor" opacity=".08"/>' +
    '<path d="M62 40c6 0 10 5 10 10" stroke="var(--dsw-alias-primary,#3b82f6)" stroke-width="1.8" stroke-linecap="round" opacity=".85"/>' +
    '<circle cx="72" cy="50" r="3.2" fill="var(--dsw-alias-primary,#3b82f6)" opacity=".9"/>' +
    "</svg>" +
    '<div class="mma-load-dots"><i></i><i></i><i></i></div></div></div>'
  );
}

function hue(id) {
  var h = 0;
  for (var i = 0; i < String(id).length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}

function appBlurb(a) {
  return a.description || BLURB[a.id] || a.id;
}

function markFooter(open) {
  var nodes = document.querySelectorAll("[data-mma-open]");
  for (var i = 0; i < nodes.length; i++) {
    nodes[i].setAttribute("aria-pressed", open ? "true" : "false");
  }
}

function ensureSkeleton() {
  var host = document.getElementById("mma-host");
  if (host && host.getAttribute("data-ready")) return host;
  if (!host) {
    host = document.createElement("div");
    host.id = "mma-host";
    css(host, {
      position: "fixed",
      top: "0",
      right: "auto",
      bottom: "0",
      left: "0",
      zIndex: "40",
      display: "none",
      flexDirection: "column",
      background: "var(--dsw-alias-bg, #f7f7f8)",
      color: "var(--dsw-alias-fg, #111)",
      fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
    });
    document.body.appendChild(host);
  }
  host.innerHTML =
    '<div class="mma-chrome">' +
    '<div class="mma-tabs" id="mma-tabs"></div>' +
    '<button type="button" class="mma-textbtn danger" id="mma-delete" hidden>删除</button>' +
    '<button type="button" class="mma-iconbtn" id="mma-reload" hidden title="重新加载" aria-label="重新加载">' +
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/></svg></button>' +
    '<div class="mma-theme-wrap" id="mma-theme-wrap">' +
    '<button type="button" class="mma-iconbtn" id="mma-theme-btn" title="主题" aria-label="主题" aria-haspopup="menu">' +
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="8" height="8" rx="1.6"/><rect x="13" y="3" width="8" height="8" rx="1.6"/><rect x="3" y="13" width="8" height="8" rx="1.6"/><rect x="13" y="13" width="8" height="8" rx="1.6"/></svg></button>' +
    '<div class="mma-pop" id="mma-theme-pop" role="menu">' +
    '<div class="mma-pop-seg">' +
    '<button type="button" data-mode="light">浅色</button>' +
    '<button type="button" data-mode="dark">深色</button></div>' +
    '<div class="mma-pop-list">' +
    paletteMenuHtml() +
    '</div><div class="mma-pop-seg mma-scope-seg">' +
    '<button type="button" data-scope="global">全局</button>' +
    '<button type="button" data-scope="app" id="mma-scope-app" title="保存到当前小程序">当前应用</button></div>' +
    '<button type="button" class="mma-textbtn" id="mma-clear-app-theme" hidden>跟随全局（清除本应用主题）</button>' +
    "</div></div>" +
    '<button type="button" class="mma-iconbtn" id="mma-history-btn" title="提交历史" aria-label="提交历史" hidden>' +
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></button>' +
    '<button type="button" class="mma-iconbtn" id="mma-storage-btn" title="存储" aria-label="存储" hidden>' +
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/></svg></button>' +
    '<button type="button" class="mma-iconbtn" id="mma-settings-btn" title="设置" aria-label="设置">' +
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c0 .7.4 1.3 1.1 1.5H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg></button>' +
    '<button type="button" class="mma-iconbtn" id="mma-dock-host" title="钉到聊天右侧" aria-label="钉到聊天右侧">' +
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18"/></svg></button>' +
    '<button type="button" class="mma-iconbtn" id="mma-close-host" title="关闭" aria-label="关闭">✕</button>' +
    "</div>" +
    '<div class="mma-stage">' +
    '<div class="mma-list" id="mma-list"></div>' +
    '<div class="mma-frames" id="mma-frames"></div>' +
    '<div class="mma-settings" id="mma-settings">' +
    " <h3>小程序设置</h3>" +
    '<p class="lead">这些是本 Host 自己的配置，不会读 dsh 的设置。改端口后会立刻换监听；冲突时保持原端口。</p>' +
    '<div class="mma-field"><label for="mma-cfg-port">Host 端口（127.0.0.1）</label>' +
    '<input id="mma-cfg-port" type="number" min="1024" max="65535" step="1" /></div>' +
    '<div class="mma-field"><label for="mma-cfg-lang">界面语言（ctx.config.chatLanguage）</label>' +
    '<select id="mma-cfg-lang"><option value="zh">中文</option><option value="en">English</option></select></div>' +
    '<div class="mma-field"><label for="mma-cfg-theme">外观（ctx.config.theme）</label>' +
    '<select id="mma-cfg-theme"><option value="light">浅色</option><option value="dark">深色</option></select></div>' +
    '<div class="mma-field"><label for="mma-cfg-palette">配色（ctx.config.palette）</label>' +
    '<select id="mma-cfg-palette">' +
    paletteOptionsHtml() +
    "</select></div>" +
    '<div class="mma-field"><label for="mma-cfg-cardstyle">卡片方案（列表样式）</label>' +
    '<select id="mma-cfg-cardstyle">' +
    '<option value="stamp">印章 · 线框邮戳</option>' +
    '<option value="hero">海报 · 渐变字 + 光晕</option>' +
    '<option value="etch">蚀刻 · 空心描边字</option>' +
    "</select></div>" +
    '<div class="mma-field"><label for="mma-cfg-provider">模型 provider</label>' +
    '<input id="mma-cfg-provider" type="text" /></div>' +
    '<div class="mma-field"><label for="mma-cfg-model">模型 model</label>' +
    '<input id="mma-cfg-model" type="text" /></div>' +
    '<div class="mma-settings-actions">' +
    '<button type="button" id="mma-cfg-save">保存</button>' +
    '<button type="button" class="ghost" id="mma-cfg-close">返回</button>' +
    '<span class="mma-settings-msg" id="mma-cfg-msg"></span></div></div>' +
    '<div class="mma-modal" id="mma-modal" hidden>' +
    '<div class="mma-dialog" role="dialog" aria-modal="true" aria-labelledby="mma-dialog-title">' +
    '<h3 id="mma-dialog-title">删除小程序？</h3>' +
    '<p id="mma-dialog-body"></p>' +
    '<div class="mma-dialog-actions">' +
    '<button type="button" id="mma-dialog-cancel">取消</button>' +
    '<button type="button" class="go" id="mma-dialog-ok">删除</button>' +
    "</div></div></div>" +
    '<div class="mma-settings mma-browse" id="mma-browse">' +
    '<div id="mma-browse-body"></div></div></div>';
  host.setAttribute("data-ready", "1");
  host.setAttribute("data-cardstyle", state.cardStyle);
  bindHost(host);
  startSidebarSync();
  loadCustomPalettes();
  return host;
}

function bindHost(host) {
  if (_bound) return;
  _bound = true;
  host.addEventListener("click", function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var close = t.closest("[data-close]");
    if (close) {
      e.preventDefault();
      e.stopPropagation();
      closeTab(close.getAttribute("data-close"));
      return;
    }
    var tab = t.closest("[data-tab]");
    if (tab) {
      state.active = tab.getAttribute("data-tab");
      render();
      return;
    }
    var open = t.closest("[data-open]");
    if (open) {
      var id = open.getAttribute("data-open");
      var app = state.apps.find(function (a) {
        return a.id === id;
      });
      if (app) openAppTab(app);
    }
  });
  host.querySelector("#mma-theme-btn").onclick = function (e) {
    e.stopPropagation();
    toggleThemePop();
  };
  host.querySelector("#mma-theme-pop").addEventListener("click", function (e) {
    e.stopPropagation();
    var t = e.target;
    if (!t || !t.closest) return;
    var scopeBtn = t.closest("[data-scope]");
    if (scopeBtn) {
      state.themeScope = scopeBtn.getAttribute("data-scope") === "app" ? "app" : "global";
      try {
        localStorage.setItem("mma-theme-scope", state.themeScope);
      } catch (_) {}
      paintThemePop();
      return;
    }
    if (t.closest("#mma-clear-app-theme")) {
      clearAppTheme();
      return;
    }
    var modeBtn = t.closest("[data-mode]");
    if (modeBtn) {
      setAppearance({ theme: modeBtn.getAttribute("data-mode") }, state.themeScope);
      return;
    }
    var palBtn = t.closest("[data-palette]");
    if (palBtn) {
      setAppearance({ palette: palBtn.getAttribute("data-palette") }, state.themeScope);
      hideThemePop();
    }
  });
  document.addEventListener(
    "click",
    function (e) {
      var n = e.target;
      if (n && n.closest && n.closest("#mma-theme-wrap")) return;
      hideThemePop();
    },
    true
  );
  host.querySelector("#mma-dock-host").onclick = function () {
    setDock(state.dock === "side" ? "fill" : "side");
  };
  host.querySelector("#mma-close-host").onclick = function () {
    closeDashboard();
  };
  host.querySelector("#mma-history-btn").onclick = function () {
    toggleBrowse("history");
  };
  host.querySelector("#mma-storage-btn").onclick = function () {
    toggleBrowse("storage");
  };
  var browseEl = host.querySelector("#mma-browse");
  if (browseEl) {
    browseEl.addEventListener("click", function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var act = t.closest("[data-act]");
      if (!act) return;
      var v = act.getAttribute("data-act");
      if (v === "close") toggleBrowse();
      else if (v === "back") {
        browseState.detail = null;
        browseState.table = null;
        browseState.tableValue = null;
        browseState.openFile = null;
        renderBrowse();
      } else if (v === "commit") loadCommitDetail(act.getAttribute("data-id"));
      else if (v === "table") loadTable(act.getAttribute("data-id"));
      else if (v === "file") {
        var p = act.getAttribute("data-id");
        browseState.openFile = browseState.openFile === p ? null : p;
        renderBrowse();
      }
    });
  }
  host.querySelector("#mma-reload").onclick = function () {
    reloadActive();
  };
  host.querySelector("#mma-delete").onclick = function () {
    askDelete();
  };
  host.querySelector("#mma-dialog-cancel").onclick = function () {
    hideModal();
  };
  host.querySelector("#mma-dialog-ok").onclick = function () {
    confirmDelete();
  };
  var settingsBtn = host.querySelector("#mma-settings-btn");
  if (settingsBtn) {
    settingsBtn.onclick = function () {
      toggleSettings(true);
    };
  }
  var cfgClose = host.querySelector("#mma-cfg-close");
  if (cfgClose) cfgClose.onclick = function () { toggleSettings(false); };
  var cfgSave = host.querySelector("#mma-cfg-save");
  if (cfgSave) cfgSave.onclick = function () { saveHostConfig(); };
  host.addEventListener("input", function (e) {
    if (e.target && e.target.id === "mma-search") {
      state.query = e.target.value;
      paintList();
    }
  });
}

function dockIcon(side) {
  return side
    ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/></svg>'
    : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18"/></svg>';
}

function paintChrome() {
  var host = ensureSkeleton();
  var tabs = host.querySelector("#mma-tabs");
  tabs.innerHTML = state.tabs
    .map(function (tb) {
      var active = tb.id === state.active;
      var close =
        tb.id === "all"
          ? ""
          : '<button type="button" class="mma-tab-x" data-close="' +
            escapeHtml(tb.id) +
            '" aria-label="关闭 ' +
            escapeHtml(tb.title) +
            '">×</button>';
      var label =
        tb.id === "all"
          ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="8" height="8" rx="1.6"/><rect x="13" y="3" width="8" height="8" rx="1.6"/><rect x="3" y="13" width="8" height="8" rx="1.6"/><rect x="13" y="13" width="8" height="8" rx="1.6"/></svg>' +
            escapeHtml("全部")
          : escapeHtml(tb.title);
      return (
        '<button type="button" class="mma-tab" data-tab="' +
        escapeHtml(tb.id) +
        '" data-active="' +
        (active ? "1" : "0") +
        '" title="' +
        escapeHtml(tb.id === "all" ? "全部小程序" : tb.title) +
        '"><span>' +
        label +
        "</span>" +
        close +
        "</button>"
      );
    })
    .join("");
  var side = state.dock === "side";
  var dockBtn = host.querySelector("#mma-dock-host");
  var dockTitle = side ? "铺满主区" : "钉到聊天右侧";
  dockBtn.setAttribute("title", dockTitle);
  dockBtn.setAttribute("aria-label", dockTitle);
  dockBtn.innerHTML = dockIcon(side);
  var appTab = state.tabs.find(function (t) {
    return t.id === state.active && t.kind === "app";
  });
  host.querySelector("#mma-reload").hidden = !appTab;
  host.querySelector("#mma-delete").hidden = !appTab;
  var anyApp = state.tabs.some(function (t) {
    return t.kind === "app";
  });
  host.querySelector("#mma-history-btn").hidden = !anyApp;
  host.querySelector("#mma-storage-btn").hidden = !anyApp;
}

function paintList() {
  var host = ensureSkeleton();
  var el = host.querySelector("#mma-list");
  if (!el.querySelector("#mma-list-body")) {
    el.innerHTML =
      '<div class="mma-list-head"><h2>小程序</h2><span id="mma-app-count"></span></div>' +
      '<div class="mma-search"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3-3"/></svg>' +
      '<input id="mma-search" type="search" placeholder="搜索小程序" /></div>' +
      '<div id="mma-list-body"></div>';
  }
  var count = el.querySelector("#mma-app-count");
  if (count) count.textContent = state.apps.length + " 个";
  var search = el.querySelector("#mma-search");
  if (search && search.value !== state.query && document.activeElement !== search) search.value = state.query;
  var q = state.query.trim().toLowerCase();
  var apps = state.apps.filter(function (a) {
    if (!q) return true;
    return [a.name, a.id, a.description, BLURB[a.id]].join(" ").toLowerCase().indexOf(q) >= 0;
  });
  var body;
  if (state.loading && !state.apps.length) {
    body = loadingMarkup();
  } else if (state.error) {
    body =
      '<div class="mma-error">列表加载失败：' +
      escapeHtml(state.error) +
      ' <button type="button" id="mma-retry" class="mma-textbtn">重试</button></div>';
  } else if (!state.apps.length) {
    body =
      '<div class="mma-empty">还没有小程序。<br/>在对话里用 skill 生成，或把示例放到 <code>~/.monkey-mini-app/runtime/apps/</code></div>';
  } else if (!apps.length) {
    body = '<div class="mma-empty">没有匹配「' + escapeHtml(state.query) + "」的小程序。</div>";
  } else {
    body =
      '<div class="mma-grid">' +
      apps.map(appItemMarkup).join("") +
      "</div>";
  }
  el.querySelector("#mma-list-body").innerHTML = body;
  var retry = el.querySelector("#mma-retry");
  if (retry)
    retry.onclick = function () {
      fetchApps();
    };
}

function appOpen(a) {
  return state.tabs.some(function (t) {
    return t.id === "app:" + a.id;
  });
}
function metaMarkup(a) {
  var parts = [];
  if (a.commits > 0) parts.push('<span class="mma-ver">' + a.commits + " commits</span>");
  if (appOpen(a)) parts.push('<span class="mma-open"><i></i>已打开</span>');
  return parts.length ? '<span class="mma-meta">' + parts.join("") + "</span>" : "";
}
function markMarkup(a) {
  var mono = escapeHtml(monoOf(a));
  if (state.cardStyle === "etch") return '<span class="mma-etch">' + mono + "</span>";
  if (state.cardStyle === "stamp") return '<span class="mma-stamp">' + mono + "</span>";
  return '<span class="mma-mono">' + mono + "</span>";
}
function appItemMarkup(a) {
  var attrs = ' data-open="' + escapeHtml(a.id) + '" style="--h:' + hue(a.id) + '"';
  if (state.dock === "side") {
    var right = appOpen(a)
      ? '<span class="mma-right"><span class="mma-open"><i></i>已打开</span></span>'
      : '<span class="mma-right">' +
        (a.commits > 0 ? '<span class="mma-ver">' + a.commits + " commits</span>" : "") +
        '<svg class="mma-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 6l6 6-6 6"/></svg></span>';
    return (
      '<button type="button" class="mma-row"' + attrs + ">" +
      markMarkup(a) +
      '<span class="mma-twrap"><span class="mma-t">' +
      escapeHtml(a.name || a.id) +
      "</span><small>" +
      escapeHtml(appBlurb(a)) +
      "</small></span>" +
      right +
      "</button>"
    );
  }
  return (
    '<button type="button" class="mma-card"' + attrs + ">" +
    markMarkup(a) +
    "<h3>" +
    escapeHtml(a.name || a.id) +
    "</h3><p>" +
    escapeHtml(appBlurb(a)) +
    "</p>" +
    metaMarkup(a) +
    "</button>"
  );
}

function appFrameSrc(appId) {
  var env = envForApp(appId);
  return (
    APPS_HOST +
    "/app/" +
    encodeURIComponent(appId) +
    "?theme=" +
    encodeURIComponent(env.theme) +
    "&palette=" +
    encodeURIComponent(env.palette) +
    "&dock=" +
    encodeURIComponent(state.dock)
  );
}

function showAppFrame(app) {
  var frames = document.getElementById("mma-frames");
  Object.keys(frameMap).forEach(function (id) {
    frameMap[id].wrap.style.display = "none";
  });
  var rec = frameMap[app.id];
  if (!rec) {
    var wrap = document.createElement("div");
    wrap.className = "mma-frame";
    wrap.setAttribute("data-app", app.id);
    wrap.innerHTML = loadingMarkup() + "<iframe title=\"" + escapeHtml(app.name || app.id) + "\"></iframe>";
    frames.appendChild(wrap);
    var iframe = wrap.querySelector("iframe");
    iframe.src = appFrameSrc(app.id);
    iframe.addEventListener("load", function () {
      var overlay = wrap.querySelector(".mma-load");
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
      postEnvToFrames();
    });
    rec = { wrap: wrap, iframe: iframe };
    frameMap[app.id] = rec;
  }
  rec.wrap.style.display = "flex";
}

function destroyFrame(appId) {
  var rec = frameMap[appId];
  if (!rec) return;
  if (rec.wrap && rec.wrap.parentNode) rec.wrap.parentNode.removeChild(rec.wrap);
  delete frameMap[appId];
}

function paintStage() {
  var host = ensureSkeleton();
  var list = host.querySelector("#mma-list");
  var frames = host.querySelector("#mma-frames");
  if (state.active === "all") {
    list.style.display = "block";
    frames.style.display = "none";
    paintList();
    return;
  }
  var tab = state.tabs.find(function (t) {
    return t.id === state.active;
  });
  var app = tab && tab.app;
  list.style.display = "none";
  frames.style.display = "block";
  if (app) showAppFrame(app);
}

function render() {
  var host = ensureSkeleton();
  if (state.visible && !_closing) host.style.display = "flex";
  paintChrome();
  paintStage();
  applyTheme(host);
  if (!_closing) syncHostToSidebar(false);
  markFooter(state.visible);
  postEnvToFrames();
}

function setDock(next) {
  if (next === state.dock) return;
  state.dock = next;
  try {
    localStorage.setItem("mma-dock", state.dock);
  } catch (_) {}
  syncHostToSidebar(true);
  paintChrome();
  // fill 用卡片模板、side 用行模板，DOM 结构不同，切换 dock 必须重渲染列表
  paintList();
  postEnvToFrames();
}

function fetchApps() {
  state.loading = true;
  state.error = null;
  render();
  return fetch(APPS_HOST + "/api/apps")
    .catch(function () {
      return fetch("/api/monkey-mini-app/apps");
    })
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (j) {
      state.apps = (j && j.apps) || [];
      state.loading = false;
      state.error = null;
      render();
    })
    .catch(function (e) {
      state.loading = false;
      state.error = String(e && e.message ? e.message : e);
      render();
    });
}

function openAppTab(app) {
  var id = "app:" + app.id;
  if (
    !state.tabs.some(function (t) {
      return t.id === id;
    })
  ) {
    state.tabs.push({ id: id, title: app.name || app.id, kind: "app", app: app });
  }
  state.active = id;
  render();
}

function closeTab(tabId) {
  if (tabId === "all") return;
  var tab = state.tabs.find(function (t) {
    return t.id === tabId;
  });
  state.tabs = state.tabs.filter(function (t) {
    return t.id !== tabId;
  });
  if (tab && tab.app) destroyFrame(tab.app.id);
  if (state.active === tabId) state.active = "all";
  render();
}

function reloadActive() {
  var tab = state.tabs.find(function (t) {
    return t.id === state.active;
  });
  var app = tab && tab.app;
  if (!app || !frameMap[app.id]) return;
  var iframe = frameMap[app.id].iframe;
  var wrap = frameMap[app.id].wrap;
  if (!wrap.querySelector(".mma-load")) wrap.insertAdjacentHTML("afterbegin", loadingMarkup());
  iframe.src = appFrameSrc(app.id) + "&_=" + Date.now();
}

function askDelete() {
  var tab = state.tabs.find(function (t) {
    return t.id === state.active;
  });
  var app = tab && tab.app;
  if (!app) return;
  state.pendingDelete = app;
  var modal = document.getElementById("mma-modal");
  document.getElementById("mma-dialog-body").textContent =
    "将删除「" + (app.name || app.id) + "」及其本地数据，无法撤销。";
  modal.hidden = false;
}

function hideModal() {
  state.pendingDelete = null;
  var modal = document.getElementById("mma-modal");
  if (modal) modal.hidden = true;
}

function confirmDelete() {
  var app = state.pendingDelete;
  if (!app) return hideModal();
  fetch(APPS_HOST + "/api/app/" + encodeURIComponent(app.id), { method: "DELETE" }).then(function () {
    hideModal();
    closeTab("app:" + app.id);
    fetchApps();
  });
}

function warmHost() {
  var urls = [
    APPS_HOST + "/api/apps",
    APPS_HOST + "/ui-kit.js",
    "https://esm.sh/react@18.3.1",
    "https://esm.sh/react-dom@18.3.1/client",
    "https://esm.sh/sucrase@3.35.0",
  ];
  urls.forEach(function (u) {
    try {
      fetch(u, { mode: "no-cors" }).catch(function () {});
    } catch (_) {}
  });
}

var _pendingBusy = false;
function consumePendingOpen() {
  if (_pendingBusy) return;
  _pendingBusy = true;
  fetch(APPS_HOST + "/api/pending-open")
    .then(function (r) {
      return r.json();
    })
    .then(function (j) {
      if (!j || !j.appId) return;
      openDashboard();
      return fetchApps()
        .then(function () {
          var app = state.apps.find(function (a) {
            return a.id === j.appId;
          });
          if (app) {
            var existed = !!frameMap[app.id];
            openAppTab(app);
            if (existed) reloadActive();
          }
        })
        .then(function () {
          return fetch(APPS_HOST + "/api/pending-open/ack", { method: "POST" }).catch(function () {});
        });
    })
    .catch(function () {})
    .then(function () {
      _pendingBusy = false;
    });
}

function toggleSettings(open) {
  var host = ensureSkeleton();
  var el = host.querySelector("#mma-settings");
  if (!el) return;
  if (open) {
    openDashboard();
    el.setAttribute("data-open", "1");
    loadHostConfigIntoForm();
  } else {
    el.removeAttribute("data-open");
  }
}

function loadHostConfigIntoForm() {
  var host = ensureSkeleton();
  var msg = host.querySelector("#mma-cfg-msg");
  if (msg) {
    msg.textContent = "";
    msg.className = "mma-settings-msg";
  }
  fetch(APPS_HOST + "/api/host-config")
    .then(function (r) {
      return r.json();
    })
    .then(function (j) {
      if (!j || !j.ok) throw new Error((j && j.error) || "load failed");
      host.querySelector("#mma-cfg-port").value = j.hostPort || 17880;
      host.querySelector("#mma-cfg-lang").value = j.chatLanguage === "en" ? "en" : "zh";
      host.querySelector("#mma-cfg-theme").value = j.theme === "dark" ? "dark" : "light";
      host.querySelector("#mma-cfg-palette").value = clampPalette(j.palette);
      host.querySelector("#mma-cfg-cardstyle").value = state.cardStyle;
      host.querySelector("#mma-cfg-provider").value = (j.llm && j.llm.provider) || "deepseek-official";
      host.querySelector("#mma-cfg-model").value = (j.llm && j.llm.model) || "deepseek-v4-flash";
    })
    .catch(function (e) {
      if (msg) {
        msg.className = "mma-settings-msg err";
        msg.textContent = String(e && e.message ? e.message : e);
      }
    });
}

function saveHostConfig() {
  var host = ensureSkeleton();
  var msg = host.querySelector("#mma-cfg-msg");
  var port = Number(host.querySelector("#mma-cfg-port").value);
  var cardStyle = host.querySelector("#mma-cfg-cardstyle").value;
  var body = {
    hostPort: port,
    chatLanguage: host.querySelector("#mma-cfg-lang").value,
    theme: host.querySelector("#mma-cfg-theme").value,
    palette: host.querySelector("#mma-cfg-palette").value,
    llm: {
      provider: host.querySelector("#mma-cfg-provider").value.trim(),
      model: host.querySelector("#mma-cfg-model").value.trim(),
    },
  };
  fetch(APPS_HOST + "/api/host-config", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
    .then(function (r) {
      return r.json().then(function (j) {
        return { status: r.status, j: j };
      });
    })
    .then(function (x) {
      var j = x.j || {};
      if (!j.ok) throw new Error(j.error || "HTTP " + x.status);
      var next = "http://127.0.0.1:" + j.hostPort;
      if (next !== APPS_HOST) {
        setAppsHost(next);
        Object.keys(frameMap).forEach(function (id) {
          destroyFrame(id);
        });
      }
      if (msg) {
        msg.className = "mma-settings-msg";
        msg.textContent = "已保存 · Host :" + j.hostPort;
      }
      setAppearance({ theme: body.theme, palette: body.palette });
      setCardStyle(cardStyle);
      render();
    })
    .catch(function (e) {
      if (msg) {
        msg.className = "mma-settings-msg err";
        msg.textContent = String(e && e.message ? e.message : e);
      }
    });
}

function setCardStyle(v) {
  state.cardStyle = clampCardStyle(v);
  try {
    localStorage.setItem("mma-card-style", state.cardStyle);
  } catch (_) {}
  var host = document.getElementById("mma-host");
  if (host) host.setAttribute("data-cardstyle", state.cardStyle);
}

/* —— 浏览面板：提交历史 / storage —— */
function activeApp() {
  var tab =
    state.tabs.find(function (t) {
      return t.kind === "app" && t.id === state.active;
    }) ||
    state.tabs.find(function (t) {
      return t.kind === "app";
    });
  if (!tab) return null;
  var appId = String(tab.id).replace(/^app:/, "");
  var app = state.apps.find(function (a) {
    return a.id === appId;
  });
  return app || { id: appId, name: tab.title || appId };
}

function toggleBrowse(kind) {
  var host = ensureSkeleton();
  var panel = host.querySelector("#mma-browse");
  if (browseState.open) {
    browseState.open = false;
    if (panel) panel.setAttribute("data-open", "0");
    return;
  }
  var app = activeApp();
  if (!app) return;
  browseState.open = true;
  browseState.kind = kind === "storage" ? "storage" : "history";
  browseState.appId = app.id;
  browseState.appName = app.name || app.id;
  browseState.list = [];
  browseState.detail = null;
  browseState.table = null;
  browseState.tableValue = null;
  browseState.openFile = null;
  browseState.loading = true;
  browseState.error = null;
  openDashboard();
  if (panel) panel.setAttribute("data-open", "1");
  renderBrowse();
  loadBrowse();
}

function fmtTime(iso) {
  if (!iso) return "";
  var d = new Date(iso);
  var pad = function (n) {
    return n < 10 ? "0" + n : String(n);
  };
  return (
    d.getFullYear() +
    "-" +
    pad(d.getMonth() + 1) +
    "-" +
    pad(d.getDate()) +
    " " +
    pad(d.getHours()) +
    ":" +
    pad(d.getMinutes())
  );
}

function loadBrowse() {
  browseState.loading = true;
  browseState.error = null;
  renderBrowse();
  var url =
    browseState.kind === "history"
      ? APPS_HOST + "/api/apps/" + encodeURIComponent(browseState.appId) + "/history?limit=50"
      : APPS_HOST + "/api/apps/" + encodeURIComponent(browseState.appId) + "/storage";
  fetch(url)
    .then(function (r) {
      return r.json();
    })
    .then(function (j) {
      if (!j || !j.ok) throw new Error((j && j.error) || "加载失败");
      browseState.list = browseState.kind === "history" ? j.commits || [] : j.tables || [];
      browseState.loading = false;
      renderBrowse();
    })
    .catch(function (e) {
      browseState.loading = false;
      browseState.error = String(e && e.message ? e.message : e);
      renderBrowse();
    });
}

function loadCommitDetail(id) {
  browseState.detail = { id: id, loading: true };
  browseState.openFile = null;
  renderBrowse();
  fetch(APPS_HOST + "/api/apps/" + encodeURIComponent(browseState.appId) + "/history/" + encodeURIComponent(id))
    .then(function (r) {
      return r.json();
    })
    .then(function (j) {
      if (!j || !j.ok) throw new Error((j && j.error) || "加载失败");
      browseState.detail = j.commit || { id: id, files: [] };
      renderBrowse();
    })
    .catch(function (e) {
      browseState.detail = { id: id, error: String(e && e.message ? e.message : e), files: [] };
      renderBrowse();
    });
}

function loadTable(name) {
  browseState.table = name;
  browseState.tableValue = null;
  browseState.loading = true;
  renderBrowse();
  fetch(APPS_HOST + "/api/apps/" + encodeURIComponent(browseState.appId) + "/storage/" + encodeURIComponent(name))
    .then(function (r) {
      return r.json();
    })
    .then(function (j) {
      if (!j || !j.ok) throw new Error((j && j.error) || "加载失败");
      browseState.tableValue = j.value;
      browseState.loading = false;
      renderBrowse();
    })
    .catch(function (e) {
      browseState.loading = false;
      browseState.tableValue = { __error__: String(e && e.message ? e.message : e) };
      renderBrowse();
    });
}

function commitItem(c) {
  var files = (c.files || []).length;
  var add = 0;
  var del = 0;
  (c.files || []).forEach(function (f) {
    if (f.add > 0) add += f.add;
    if (f.del > 0) del += f.del;
  });
  return (
    '<button type="button" class="mma-bitem" data-act="commit" data-id="' +
    escapeHtml(c.id) +
    '"><b>' +
    escapeHtml(c.message) +
    '</b><span class="meta"><code>' +
    escapeHtml(c.id.slice(0, 7)) +
    "</code><span>" +
    escapeHtml(fmtTime(c.time)) +
    "</span><span>" +
    files +
    " 个文件</span>" +
    (add ? '<span class="mma-plus">+' + add + "</span>" : "") +
    (del ? '<span class="mma-minus">-' + del + "</span>" : "") +
    "</span></button>"
  );
}

function commitDetailHtml() {
  var d = browseState.detail;
  if (!d) return "";
  if (d.loading) return '<div class="mma-bempty">加载中…</div>';
  if (d.error) return '<div class="mma-berr">' + escapeHtml(d.error) + "</div>";
  var head =
    '<div class="mma-browse-head"><div class="mma-btns"><button type="button" data-act="back">← 返回</button></div><h3>' +
    escapeHtml(d.message) +
    '</h3></div><div class="meta" style="margin:0 0 10px;font-size:11px;color:var(--muted-foreground,inherit);opacity:.75"><code>' +
    escapeHtml(String(d.id || "").slice(0, 7)) +
    "</code><span>" +
    escapeHtml(fmtTime(d.time)) +
    "</span></div>";
  var files = (d.files || [])
    .map(function (f) {
      var open = browseState.openFile === f.path;
      return (
        '<div><button type="button" class="mma-fitem" data-act="file" data-id="' +
        escapeHtml(f.path) +
        '"><span class="mma-plus">' +
        (f.add > 0 ? "+" + f.add : "·") +
        '</span><span class="mma-minus">' +
        (f.del > 0 ? "-" + f.del : "·") +
        '</span><span class="p">' +
        escapeHtml(f.path) +
        '</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity:.5;flex:0 0 12px"><path d="M9.5 6l6 6-6 6"/></svg></button>' +
        (open && f.preview ? '<pre class="mma-preview">' + escapeHtml(f.preview) + "</pre>" : "") +
        "</div>"
      );
    })
    .join("");
  return head + '<div class="mma-files">' + (files || '<div class="mma-bempty">无文件改动</div>') + "</div>";
}

function storageItem(t) {
  return (
    '<button type="button" class="mma-bitem" data-act="table" data-id="' +
    escapeHtml(t.name) +
    '"><b>' +
    escapeHtml(t.name) +
    '</b><span class="meta"><span>' +
    (t.size || 0) +
    " B</span><span>" +
    escapeHtml(fmtTime(t.updatedAt)) +
    "</span></span></button>"
  );
}

function tableDetailHtml() {
  var head =
    '<div class="mma-browse-head"><div class="mma-btns"><button type="button" data-act="back">← 返回</button></div><h3>' +
    escapeHtml(browseState.table) +
    "</h3></div>";
  var body = browseState.loading
    ? '<div class="mma-bempty">加载中…</div>'
    : '<pre class="mma-preview" style="max-height:none;white-space:pre-wrap;word-break:break-all">' +
      escapeHtml(JSON.stringify(browseState.tableValue, null, 2)) +
      "</pre>";
  return head + body;
}

function renderBrowse() {
  var host = ensureSkeleton();
  var panel = host.querySelector("#mma-browse-body");
  if (!panel) return;
  if (!browseState.open) {
    panel.innerHTML = "";
    return;
  }
  if (browseState.kind === "history" && browseState.detail) {
    panel.innerHTML = commitDetailHtml();
    return;
  }
  if (browseState.kind === "storage" && browseState.table !== null) {
    panel.innerHTML = tableDetailHtml();
    return;
  }
  var head =
    '<div class="mma-browse-head"><h3>' +
    (browseState.kind === "history" ? "提交历史" : "存储") +
    '<span class="sub">' +
    escapeHtml(browseState.appName) +
    '</span></h3><div class="mma-btns"><button type="button" data-act="close">关闭</button></div></div>';
  var body;
  if (browseState.loading && !browseState.list.length) body = '<div class="mma-bempty">加载中…</div>';
  else if (browseState.error) body = '<div class="mma-berr">' + escapeHtml(browseState.error) + "</div>";
  else if (!browseState.list.length)
    body =
      '<div class="mma-bempty">' +
      (browseState.kind === "history" ? "暂无提交记录" : "暂无 storage 文件") +
      "</div>";
  else body = '<div class="mma-blist">' + browseState.list.map(browseState.kind === "history" ? commitItem : storageItem).join("") + "</div>";
  panel.innerHTML = head + body;
}

function openDashboard() {
  clearVisTimer();
  _closing = false;
  lockLayout();
  startRailWatch();
  state.visible = true;
  initAppearance();
  var host = ensureSkeleton();
  host.style.display = "flex";
  host.style.pointerEvents = "auto";
  paintChrome();
  paintStage();
  applyTheme(host);
  var box = layoutBox();
  host.style.top = "0";
  host.style.bottom = "0";
  host.style.right = "auto";
  host.style.zIndex = "40";
  host.style.width = box.width + "px";
  host.setAttribute("data-dock", state.dock);
  host.classList.remove("mma-anim-dock");
  if (state.dock === "side") {
    host.style.borderLeft = "1px solid var(--dsw-alias-border, #e5e7eb)";
    host.style.boxShadow = "-8px 0 24px rgba(0,0,0,.06)";
    host.style.opacity = "1";
    host.style.transform = "none";
    host.style.left = window.innerWidth + "px";
  } else {
    host.style.borderLeft = "none";
    host.style.boxShadow = "none";
    host.style.left = box.left + "px";
    host.style.opacity = "0";
    host.style.transform = "translateX(16px)";
  }
  void host.offsetWidth;
  armDockAnim();
  void host.offsetWidth;
  if (state.dock === "side") {
    setDockPad(true);
    host.style.left = box.left + "px";
  } else {
    host.style.opacity = "1";
    host.style.transform = "none";
  }
  startSidebarSync();
  warmHost();
  fetchApps();
  markFooter(true);
  fetch(APPS_HOST + "/api/host-config")
    .then(function (r) {
      return r.json();
    })
    .then(function (j) {
      if (!j || !j.ok) return;
      if (j.theme === "light" || j.theme === "dark") state.theme = j.theme;
      if (j.palette) {
        var localPal = null;
        try {
          localPal = localStorage.getItem("mma-palette");
        } catch (_) {}
        if (!localPal) state.palette = clampPalette(j.palette);
      }
      try {
        localStorage.setItem("mma-theme-mode", state.theme);
        localStorage.setItem("mma-palette", state.palette);
      } catch (_) {}
      applyTheme();
      postEnvToFrames();
    })
    .catch(function () {});
}

function closeDashboard() {
  if (!state.visible && !_closing) return;
  state.visible = false;
  _closing = true;
  lockLayout();
  hideThemePop();
  hideModal();
  markFooter(false);
  var host = document.getElementById("mma-host");
  if (!host) {
    _closing = false;
    setDockPad(false);
    return;
  }
  host.style.pointerEvents = "none";
  armDockAnim();
  void host.offsetWidth;
  if (state.dock === "side") {
    host.style.left = window.innerWidth + "px";
    setDockPad(false);
  } else {
    host.style.opacity = "0";
    host.style.transform = "translateX(16px)";
  }
  clearVisTimer();
  _visTimer = setTimeout(function () {
    _visTimer = 0;
    _closing = false;
    if (state.visible) return;
    host.style.display = "none";
    host.style.opacity = "";
    host.style.transform = "";
    host.style.pointerEvents = "";
    setDockPad(false);
  }, ANIM_MS + 40);
}

function toggleDashboard() {
  if (state.visible) closeDashboard();
  else openDashboard();
}

export function FooterButton(props) {
  var React = require("react");
  if (!React || !React.createElement) return null;
  var h = React.createElement;
  var icon = h(
    "span",
    { className: "mma-foot-ico", "aria-hidden": true },
    h(
      "svg",
      {
        width: 16,
        height: 16,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 2,
        strokeLinecap: "round",
        strokeLinejoin: "round",
      },
      h("rect", { x: 3, y: 4, width: 18, height: 16, rx: 2 }),
      h("path", { d: "M3 8h18" })
    )
  );
  var wide = !(props && props.wide === false);
  var label = h("span", { className: "mma-foot-label", style: wide ? null : { display: "none" } }, "小程序");
  return h(
    "span",
    {
      "data-mma-open": "1",
      className: "mma-foot-btn",
      role: "button",
      tabIndex: 0,
      title: "小程序",
      "aria-pressed": state.visible ? "true" : "false",
    },
    icon,
    label
  );
}

export function apply(ctx) {
  var disposers = [];
  try {
    if (ctx && ctx.slots && typeof ctx.slots.inject === "function") {
      disposers.push(
        ctx.slots.inject("sidebar.footer.action", function () {
          return ctx.slots.register(
            { name: "sidebar.footer.action", id: "monkey-mini-app", order: 20 },
            FooterButton
          );
        })
      );
    }
  } catch (e) {
    console.warn("[monkey-mini-app-client] footer slot failed", e);
  }
  initAppearance();
  startRailWatch();
  if (!window.__mmaPendingPoll) {
    window.__mmaPendingPoll = true;
    consumePendingOpen();
    setInterval(consumePendingOpen, 900);
  }
  if (!window.__mmaOpenBound) {
    window.__mmaOpenBound = true;
    document.addEventListener(
      "click",
      function (e) {
        var n = e.target;
        if (n && n.closest && n.closest("[data-mma-open]")) {
          e.preventDefault();
          e.stopPropagation();
          try {
            toggleDashboard();
          } catch (err) {
            console.error("[mma] open", err);
          }
        }
      },
      true
    );
    document.addEventListener(
      "keydown",
      function (e) {
        var n = e.target;
        if ((e.key === "Enter" || e.key === " ") && n && n.closest && n.closest("[data-mma-open]")) {
          e.preventDefault();
          try {
            toggleDashboard();
          } catch (err) {
            console.error("[mma] open", err);
          }
          return;
        }
        if (e.key === "Escape" && state.visible) {
          if (hideThemePop()) return;
          if (state.pendingDelete) hideModal();
          else closeDashboard();
        }
      },
      true
    );
  }
  console.log("[monkey-mini-app-client] ui mounted (footer only)");
  return function () {
    for (var i = 0; i < disposers.length; i++) {
      try {
        disposers[i]();
      } catch (_) {}
    }
    clearVisTimer();
    _closing = false;
    var host = document.getElementById("mma-host");
    if (host) host.remove();
    setDockPad(false);
  };
}

