// @ts-nocheck — client shell is loosely typed against dsh DOM; track proper typing separately
/** dsh-plugin client 入口（组装层）：app 流程 + dsh adapter + 事件绑定。
 *  拆分自原 client.ts：state/layout/theme/frame/bridge/api 见同级模块。 */
import { createMiniAppPanel } from "@monkey-mini-app/panel-core";
import { MMA_STATE, MMA_HOST, MMA_PUSH, MMA_GET, syncHostState } from "./state.js";
var EASE = "cubic-bezier(.22,.8,.24,1)";
var ANIM_MS = 320;
import { installFootCss, layoutBox, setDockPad, armDockAnim, lockLayout, layoutLocked, clearVisTimer, syncHostToSidebar, followSidebar, startSidebarSync, startRailWatch, markFooter, setCardStyle } from "./layout.js";
import { css, clampCardStyle } from "./utils.js";
import { dshIsDark, initAppearance, normalizePalette, loadCustomPalettes, persistAppearance, setAppearance, syncThemeFromDsh, applyPanelTheme } from "./theme.js";
import { frameMap, loadingMarkup, escapeHtml, postEnvToFrames, postEnvToFrameByApp, envForApp, appFrameSrc, showAppFrame, destroyFrame } from "./frame.js";
import { subscribeHostSideEffects, subscribeDockLayout, hideThemePop, hideModal } from "./bridge.js";
import { fetchApps, warmHost } from "./api.js";

export const name = "monkey-mini-app-client";
export const inject = ["slots"] as const;


var _panelRoot = null;
let panelInstance = null;

// 工具事件订阅（SSE /api/events——取代 pendingOpen 轮询）：
// 模型调 mini_app_open → host EventBus → SSE → 这里直接打开面板 + app tab
var _sse = null;
function subscribeAppOpen() {
  if (_sse) return;
  try {
    var es = new EventSource(MMA_HOST.APPS_HOST + "/api/events");
    _sse = es;
    es.addEventListener("app:open", function (e) {
      var d = JSON.parse(e.data || "{}");
      if (!d || !d.appId) return;
      openDashboard();
      fetchApps().then(function () {
        var app = MMA_STATE.apps.find(function (a) {
          return a.id === d.appId;
        });
        if (app) {
          var existed = !!frameMap[app.id];
          openAppTab(app);
          if (existed) reloadActive();
        }
      });
    });
  } catch (err) {
    console.warn("[monkey-mini-app-client] sse subscribe failed", err);
  }
}

function ensureSkeleton() {
  installFootCss();
  var host = document.getElementById("mma-host");
  if (host) {
    if (MMA_STATE.visible && !MMA_HOST._closing) host.style.display = "flex";
    return host;
  }
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
  host.setAttribute("data-ready", "1");
  host.setAttribute("data-cardstyle", MMA_STATE.cardStyle);
  // React 渲染全部面板 UI（core createMiniAppPanel；adapter 提供宿主能力）
  if (!host.querySelector(".mma-chrome")) {
    getPanel().mount(host);
    subscribeHostSideEffects();
    subscribeDockLayout();
  }
  startSidebarSync();
  loadCustomPalettes();
  return host;
}


function openAppTab(app) {
  var id = "app:" + app.id;
  if (
    !MMA_STATE.tabs.some(function (t) {
      return t.id === id;
    })
  ) {
    MMA_STATE.tabs.push({ id: id, title: app.name || app.id, kind: "app", app: app });
  }
  MMA_STATE.active = id;
  syncHostState();
  showAppFrame(app);
}


function closeTab(tabId) {
  if (tabId === "all") return;
  var tab = MMA_STATE.tabs.find(function (t) {
    return t.id === tabId;
  });
  MMA_STATE.tabs = MMA_STATE.tabs.filter(function (t) {
    return t.id !== tabId;
  });
  if (tab && tab.app) destroyFrame(tab.app.id);
  if (MMA_STATE.active === tabId) MMA_STATE.active = "all";
  syncHostState();
}


function reloadActive() {
  var tab = MMA_STATE.tabs.find(function (t) {
    return t.id === MMA_STATE.active;
  });
  var app = tab && tab.app;
  if (!app || !frameMap[app.id]) return;
  var iframe = frameMap[app.id].iframe;
  var wrap = frameMap[app.id].wrap;
  if (!wrap.querySelector(".mma-load")) wrap.insertAdjacentHTML("afterbegin", loadingMarkup());
  iframe.src = appFrameSrc(app.id) + "&_=" + Date.now();
}


function activeApp() {
  var tab =
    MMA_STATE.tabs.find(function (t) {
      return t.kind === "app" && t.id === MMA_STATE.active;
    }) ||
    MMA_STATE.tabs.find(function (t) {
      return t.kind === "app";
    });
  if (!tab) return null;
  var appId = String(tab.id).replace(/^app:/, "");
  var app = MMA_STATE.apps.find(function (a) {
    return a.id === appId;
  });
  return app || { id: appId, name: tab.title || appId };
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


function openDashboard() {
  clearVisTimer();
  MMA_HOST._closing = false;
  lockLayout();
  startRailWatch();
  MMA_STATE.visible = true;
  initAppearance();
  var host = ensureSkeleton();
  host.style.display = "flex";
  host.style.pointerEvents = "auto";
  syncHostState();
  // 激活 app tab 时显示对应 iframe（React 已切 display，这里确保 frame 存在）
  var tab = MMA_STATE.tabs.find(function (t) {
    return t.id === MMA_STATE.active && t.kind === "app";
  });
  if (tab && tab.app) showAppFrame(tab.app);
  applyPanelTheme();
  var box = layoutBox();
  host.style.top = "0";
  host.style.bottom = "0";
  host.style.right = "auto";
  host.style.zIndex = "40";
  host.style.width = box.width + "px";
  host.setAttribute("data-dock", MMA_STATE.dock);
  host.classList.remove("mma-anim-dock");
  if (MMA_STATE.dock === "side") {
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
  if (MMA_STATE.dock === "side") {
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
  fetch(MMA_HOST.APPS_HOST + "/api/host-config")
    .then(function (r) {
      return r.json();
    })
    .then(function (j) {
      if (!j || !j.ok) return;
      if (j.theme === "light" || j.theme === "dark") MMA_STATE.theme = j.theme;
      if (j.palette) {
        var localPal = null;
        try {
          localPal = localStorage.getItem("mma-palette");
        } catch (_) {}
        if (!localPal) MMA_STATE.palette = clampPalette(j.palette);
      }
      try {
        localStorage.setItem("mma-theme-mode", MMA_STATE.theme);
        localStorage.setItem("mma-palette", MMA_STATE.palette);
      } catch (_) {}
      applyPanelTheme();
      postEnvToFrames();
    })
    .catch(function () {});
}


function closeDashboard() {
  if (!MMA_STATE.visible && !MMA_HOST._closing) return;
  MMA_STATE.visible = false;
  MMA_HOST._closing = true;
  lockLayout();
  hideThemePop();
  hideModal();
  markFooter(false);
  var host = document.getElementById("mma-host");
  if (!host) {
    MMA_HOST._closing = false;
    setDockPad(false);
    return;
  }
  host.style.pointerEvents = "none";
  armDockAnim();
  void host.offsetWidth;
  if (MMA_STATE.dock === "side") {
    host.style.left = window.innerWidth + "px";
    setDockPad(false);
  } else {
    host.style.opacity = "0";
    host.style.transform = "translateX(16px)";
  }
  clearVisTimer();
  MMA_HOST._visTimer = setTimeout(function () {
    MMA_HOST._visTimer = 0;
    MMA_HOST._closing = false;
    if (MMA_STATE.visible) return;
    host.style.display = "none";
    host.style.opacity = "";
    host.style.transform = "";
    host.style.pointerEvents = "";
    setDockPad(false);
  }, ANIM_MS + 40);
}


function toggleDashboard() {
  if (MMA_STATE.visible) closeDashboard();
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
      "aria-pressed": MMA_STATE.visible ? "true" : "false",
    },
    icon,
    label
  );
}

// dsh 宿主 adapter：数据/iframe/面板显示/持久化，其余由 core 默认行为
function buildDshAdapter() {
  return {
    emptyText: "还没有小程序。\n在对话里用 skill 生成，或把示例放到 ~/.monkey-mini-app/runtime/apps/",
    listApps: function () {
      return fetch(MMA_HOST.APPS_HOST + "/api/apps")
        .catch(function () { return fetch("/api/monkey-mini-app/apps"); })
        .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
        .then(function (j) { return (j && j.apps) || []; });
    },
    frame: {
      url: appFrameSrc,
      mount: function (appId) {
        // core 调 frame.mount(appId)（string）；showAppFrame 期待 app 对象
        var app =
          MMA_STATE.apps.find(function (a) {
            return a.id === appId;
          }) || { id: appId, name: appId };
        showAppFrame(app);
      },
      unmount: destroyFrame,
      reload: reloadActive,
    },
    openPanel: openDashboard,
    closePanel: closeDashboard,
    palettes: loadCustomPalettes,
    persistTheme: persistAppearance,
    appTheme: {
      save: function (appId, t) {
        return fetch(MMA_HOST.APPS_HOST + "/api/apps/" + encodeURIComponent(appId) + "/theme", {
          method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(t),
        }).then(function (r) { return r.json(); }).then(function (j) {
          var a = MMA_STATE.apps.find(function (x) { return x.id === appId; });
          if (a && j && j.theme) { a.theme = j.theme; postEnvToFrameByApp(appId); }
        });
      },
      clear: function (appId) {
        return fetch(MMA_HOST.APPS_HOST + "/api/apps/" + encodeURIComponent(appId) + "/theme", {
          method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reset: true }),
        }).then(function () {
          var a = MMA_STATE.apps.find(function (x) { return x.id === appId; });
          if (a) a.theme = null;
          postEnvToFrameByApp(appId);
        });
      },
    },
    config: {
      load: function () {
        return fetch(MMA_HOST.APPS_HOST + "/api/host-config").then(function (r) { return r.json(); }).then(function (j) {
          if (!j || !j.ok) throw new Error((j && j.error) || "load failed");
          return {
            hostPort: String(j.hostPort || 17880),
            chatLanguage: j.chatLanguage === "en" ? "en" : "zh",
            theme: j.theme === "dark" ? "dark" : "light",
            palette: clampPalette(j.palette),
            cardStyle: MMA_STATE.cardStyle,
            provider: (j.llm && j.llm.provider) || "deepseek-official",
            model: (j.llm && j.llm.model) || "deepseek-v4-flash",
          };
        });
      },
      save: function (form) {
        var body = {
          hostPort: Number(form.hostPort),
          chatLanguage: form.chatLanguage,
          theme: form.theme,
          palette: form.palette,
          llm: { provider: String(form.provider || "").trim(), model: String(form.model || "").trim() },
        };
        return fetch(MMA_HOST.APPS_HOST + "/api/host-config", {
          method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
        }).then(function (r) { return r.json().then(function (j) { return { status: r.status, j: j }; }); })
          .then(function (x) {
            var j = x.j || {};
            if (!j.ok) throw new Error(j.error || "HTTP " + x.status);
            var next = "http://127.0.0.1:" + j.hostPort;
            if (next !== MMA_HOST.APPS_HOST) { setAppsHost(next); Object.keys(frameMap).forEach(destroyFrame); }
            setAppearance({ theme: body.theme, palette: body.palette });
            setCardStyle(String(form.cardStyle || MMA_STATE.cardStyle));
            return j;
          });
      },
    },
    history: {
      list: function (appId) {
        return fetch(MMA_HOST.APPS_HOST + "/api/apps/" + encodeURIComponent(appId) + "/history?limit=50")
          .then(function (r) { return r.json(); })
          .then(function (j) { if (!j || !j.ok) throw new Error((j && j.error) || "加载失败"); return j.commits || []; });
      },
      detail: function (appId, id) {
        return fetch(MMA_HOST.APPS_HOST + "/api/apps/" + encodeURIComponent(appId) + "/history/" + encodeURIComponent(id))
          .then(function (r) { return r.json(); })
          .then(function (j) { if (!j || !j.ok) throw new Error((j && j.error) || "加载失败"); return j.commit || { id: id, files: [] }; });
      },
    },
    storage: {
      listTables: function (appId) {
        return fetch(MMA_HOST.APPS_HOST + "/api/apps/" + encodeURIComponent(appId) + "/storage")
          .then(function (r) { return r.json(); })
          .then(function (j) { if (!j || !j.ok) throw new Error((j && j.error) || "加载失败"); return j.tables || []; });
      },
      readTable: function (appId, name) {
        return fetch(MMA_HOST.APPS_HOST + "/api/apps/" + encodeURIComponent(appId) + "/storage/" + encodeURIComponent(name))
          .then(function (r) { return r.json(); })
          .then(function (j) { if (!j || !j.ok) throw new Error((j && j.error) || "加载失败"); return j.value; });
      },
    },
    deleteApp: function (appId) {
      return fetch(MMA_HOST.APPS_HOST + "/api/app/" + encodeURIComponent(appId), { method: "DELETE" }).then(function () {});
    },
  };
}


function getPanel() {
  if (!panelInstance) panelInstance = createMiniAppPanel(buildDshAdapter());
  return panelInstance;
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
  subscribeAppOpen();
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
        if (e.key === "Escape" && MMA_STATE.visible) {
          if (hideThemePop()) return;
          if (MMA_GET().pendingDelete) hideModal();
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
    MMA_HOST._closing = false;
    var host = document.getElementById("mma-host");
    if (host) host.remove();
    setDockPad(false);
  };
}
