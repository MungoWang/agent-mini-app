window.__ModuleLoader__.load({
  id: "@monkey-mini-app/dsh-plugin",
  factory: function (require) {
    var module = { exports: {} };
    var exports = module.exports;

    var name = "monkey-mini-app-client";
    var inject = ["slots"];

    var APPS_HOST = "http://127.0.0.1:17880";
    var state = {
      theme: (function(){ try { return localStorage.getItem("mma-theme") || "light"; } catch(_) { return "light"; } })(),
      tabs: [{ id: "all", title: "程序列表", kind: "all" }],
      active: "all",
      apps: [],
      error: null,
      loading: false,
      dock: (function(){ try { return localStorage.getItem("mma-dock") || "fill"; } catch(_) { return "fill"; } })(),
    };

    function css(el, obj) {
      Object.keys(obj).forEach(function (k) {
        el.style[k] = obj[k];
      });
    }

    function applyTheme(root) {
      var dark = state.theme === "dark";
      var el = root || document.getElementById("mma-host");
      if (!el) return;
      el.setAttribute("data-theme", state.theme);
      var vars = dark
        ? {
            "--dsw-alias-bg": "#0b0b0c",
            "--dsw-alias-fg": "#f4f4f5",
            "--dsw-alias-surface": "#171717",
            "--dsw-alias-border": "#2a2a2c",
            "--dsw-alias-muted": "#27272a",
            "--dsw-alias-primary": "#3b82f6",
          }
        : {
            "--dsw-alias-bg": "#f7f7f8",
            "--dsw-alias-fg": "#111",
            "--dsw-alias-surface": "#fff",
            "--dsw-alias-border": "#e5e7eb",
            "--dsw-alias-muted": "#f3f4f6",
            "--dsw-alias-primary": "#2563eb",
          };
      Object.keys(vars).forEach(function (k) { el.style.setProperty(k, vars[k]); });
      el.style.background = vars["--dsw-alias-bg"];
      el.style.color = vars["--dsw-alias-fg"];
    }

    function toggleTheme() {
      state.theme = state.theme === "dark" ? "light" : "dark";
      try { localStorage.setItem("mma-theme", state.theme); } catch (_) {}
      render();
    }

    function installFootCss() {
      if (document.getElementById("mma-foot-css")) return;
      var s = document.createElement("style");
      s.id = "mma-foot-css";
      s.textContent = [
        "#mma-host{color:var(--dsw-alias-fg,#111);background:var(--dsw-alias-bg,#f7f7f8);}",
        "#mma-host button,#mma-host input{color:inherit;}",
        "#mma-host [data-open]{color:var(--dsw-alias-fg,#111);background:var(--dsw-alias-surface,#fff);border-color:var(--dsw-alias-border,#e5e7eb);}",
        ".mma-foot-btn{display:flex;align-items:center;gap:8px;width:calc(100% + 4px);height:42px;margin:4px -2px;padding:0 10px 0 8px;box-sizing:border-box;border:0;border-radius:8px;background:transparent;color:inherit;font:inherit;line-height:inherit;cursor:pointer;}",
        ".mma-foot-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06));}",
        ".mma-foot-ico{display:inline-flex;width:16px;height:16px;align-items:center;justify-content:center;flex:0 0 16px;}",
        ".mma-foot-ico svg{display:block;}",
        ".mma-foot-label{white-space:nowrap;overflow:hidden;}",
        /* dsh SidebarRoot adds *_collapsed when !wide — same flag Settings uses */
        "[class*='_collapsed'] .mma-foot-label{display:none !important;}",
        "[class*='_railIn'] .mma-foot-label{display:none !important;}",
        "[class*='_collapsed'] .mma-foot-btn{width:36px;height:36px;margin:18px 0 10px;padding:0;gap:0;justify-content:center;border-radius:50%;overflow:hidden;}",
      ].join("");
      document.head.appendChild(s);
    }

    function leftmostRailWidth() {
      var maxW = 0;
      var nodes = document.querySelectorAll("aside, nav, [class*='sidebar'], [class*='Sidebar']");
      for (var i = 0; i < nodes.length; i++) {
        var r = nodes[i].getBoundingClientRect();
        if (r.top <= 16 && r.height >= window.innerHeight * 0.5 && r.left < 80) {
          if (r.width > 40 && r.width < 560 && r.width > maxW) maxW = r.width;
        }
      }
      if (maxW < 40) {
        var all = document.body.querySelectorAll("div,aside,nav");
        for (var j = 0; j < all.length; j++) {
          var rr = all[j].getBoundingClientRect();
          if (rr.left <= 8 && rr.top <= 8 && rr.height >= window.innerHeight * 0.7 && rr.width > 40 && rr.width < 560) {
            if (rr.width > maxW) maxW = rr.width;
          }
        }
      }
      return maxW || 240;
    }

    function startRailWatch() {
      installFootCss();
      function tick() {
        syncHostToSidebar();
      }
      tick();
      if (!window.__mmaRailWatch) {
        window.__mmaRailWatch = true;
        window.addEventListener("resize", tick);
        document.addEventListener("click", function () {
          tick();
          var n = 0;
          function frame() {
            tick();
            n++;
            if (n < 45) requestAnimationFrame(frame);
          }
          requestAnimationFrame(frame);
        }, true);
        setInterval(tick, 200);
      }
    }

    function findListSidebar() {
      var el = document.querySelector('button[title="小程序"]');
      if (!el) return null;
      var best = null;
      while (el && el !== document.body) {
        var r = el.getBoundingClientRect();
        if (r.height >= window.innerHeight * 0.55 && r.left < 280) best = el;
        el = el.parentElement;
      }
      return best;
    }

    function sidebarCollapsed() {
      var side = findListSidebar();
      if (!side) return false;
      return side.getBoundingClientRect().width < 96;
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

    function syncHostToSidebar() {
      var host = document.getElementById("mma-host");
      if (!host) return;
      host.style.transition = "none";
      host.style.top = "0";
      host.style.bottom = "0";
      host.style.zIndex = "40";
      if (state.dock === "side") {
        host.style.left = "auto";
        host.style.right = "0";
        host.style.width = "min(440px, 42vw)";
        host.style.borderLeft = "1px solid var(--dsw-alias-border, #e5e7eb)";
        host.style.boxShadow = "-8px 0 24px rgba(0,0,0,.06)";
      } else {
        host.style.left = hostLeftPx() + "px";
        host.style.right = "0";
        host.style.width = "auto";
        host.style.borderLeft = "none";
        host.style.boxShadow = "none";
      }
    }

    var _followRaf = 0;
    function followSidebar(ms) {
      var until = Date.now() + (ms || 360);
      if (_followRaf) cancelAnimationFrame(_followRaf);
      function frame() {
        syncHostToSidebar();
        if (Date.now() < until) _followRaf = requestAnimationFrame(frame);
        else _followRaf = 0;
      }
      _followRaf = requestAnimationFrame(frame);
    }

    var _sideObs = null;
    function startSidebarSync() {
      syncHostToSidebar();
      if (_sideObs) return;
      _sideObs = new ResizeObserver(function () {
        followSidebar(360);
      });
      function observeCols() {
        var nodes = document.body.querySelectorAll("aside, nav, [class*='sidebar'], [class*='Sidebar']");
        for (var i = 0; i < nodes.length; i++) {
          try { _sideObs.observe(nodes[i]); } catch (_) {}
        }
      }
      observeCols();
      window.addEventListener("resize", function () { followSidebar(360); });
      document.addEventListener("click", function () { followSidebar(360); }, true);
      var mo = new MutationObserver(function () {
        observeCols();
        followSidebar(360);
      });
      mo.observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ["class", "style", "data-sidebar-collapsed", "data-collapsed"] });
    }

    function fetchApps() {
      state.loading = true;
      state.error = null;
      render();
      return fetch(APPS_HOST + "/api/apps").catch(function(){ return fetch("/api/monkey-mini-app/apps"); })
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
      if (!state.tabs.some(function (t) { return t.id === id; })) {
        state.tabs.push({
          id: id,
          title: app.name || app.id,
          kind: "app",
          app: app,
        });
      }
      state.active = id;
      render();
    }

    function closeTab(tabId) {
      if (tabId === "all") return;
      state.tabs = state.tabs.filter(function (t) { return t.id !== tabId; });
      if (state.active === tabId) state.active = "all";
      render();
    }

    function ensureHost() {
      var host = document.getElementById("mma-host");
      if (host) return host;

      host = document.createElement("div");
      host.id = "mma-host";
      css(host, {
        position: "fixed",
        top: "0",
        right: "0",
        bottom: "0",
        left: "0",
        zIndex: "9000",
        display: "none",
        flexDirection: "column",
        background: "var(--dsw-alias-bg, #f7f7f8)",
        color: "var(--dsw-alias-fg, #111)",
        fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
      });
      document.body.appendChild(host);
      startSidebarSync();
      return host;
    }

    function render() {
      var host = ensureHost();
      host.style.display = "flex";
      startSidebarSync();

      var tabsHtml = state.tabs
        .map(function (t) {
          var active = t.id === state.active;
          var close =
            t.id === "all"
              ? ""
              : '<button type="button" data-close="' +
                t.id +
                '" style="margin-left:6px;border:0;background:transparent;cursor:pointer;opacity:.55;color:inherit;padding:0 2px;line-height:1;font-size:14px">×</button>';
          return (
            '<button type="button" data-tab="' +
            t.id +
            '" style="display:inline-flex;align-items:center;height:32px;padding:0 12px;border:0;border-bottom:2px solid ' +
            (active ? "var(--dsw-alias-primary,#3b82f6)" : "transparent") +
            ";background:transparent;cursor:pointer;font-size:13px;font-weight:" +
            (active ? "600" : "500") +
            ";color:inherit;opacity:" +
            (active ? "1" : ".7") +
            '">' +
            escapeHtml(t.title) +
            close +
            "</button>"
          );
        })
        .join("");

      var body = "";
      if (state.active === "all") {
        if (state.loading) {
          body = '<div style="padding:24px;opacity:.7">Loading…</div>';
        } else if (state.error) {
          body =
            '<div style="padding:24px"><div style="color:#b91c1c;margin-bottom:8px">列表加载失败：' +
            escapeHtml(state.error) +
            '</div><button type="button" id="mma-retry" style="height:32px;padding:0 12px;border-radius:8px;border:1px solid var(--dsw-alias-border,#ddd);background:var(--dsw-alias-surface,#fff);color:inherit;cursor:pointer">重试</button></div>';
        } else if (!state.apps.length) {
          body =
            '<div style="padding:24px;opacity:.75;line-height:1.6">暂无 mini app。<br/>在对话中用 skill 生成并 <code>mini_app_register</code>，或把示例拷到 <code>~/.monkey-mini-app/runtime/apps/</code></div>';
        } else {
          body =
            '<div style="padding:16px;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px">' +
            state.apps
              .map(function (a) {
                return (
                  '<button type="button" data-open="' +
                  escapeHtml(a.id) +
                  '" style="text-align:left;padding:14px;border-radius:12px;border:1px solid var(--dsw-alias-border,#e5e7eb);background:var(--dsw-alias-surface,#fff);color:var(--dsw-alias-fg,#111);cursor:pointer">' +
                  '<div style="font-weight:600;margin-bottom:4px">' +
                  escapeHtml(a.name || a.id) +
                  "</div>" +
                  '<div style="font-size:12px;opacity:.6">' +
                  escapeHtml(a.id) +
                  (a.version ? " · " + escapeHtml(a.version) : "") +
                  "</div></button>"
                );
              })
              .join("") +
            "</div>";
        }
      } else {
        var tab = state.tabs.find(function (t) {
          return t.id === state.active;
        });
        var app = tab && tab.app;
        if (app) {
          var src = APPS_HOST + "/app/" + encodeURIComponent(app.id) + "?theme=" + encodeURIComponent(state.theme);
          body =
            '<div style="display:flex;flex-direction:column;height:100%;min-height:0">' +
            '<div style="flex:0 0 40px;display:flex;align-items:center;gap:12px;padding:0 12px;border-bottom:1px solid var(--dsw-alias-border,#e5e7eb);background:var(--dsw-alias-surface,#fff);font-size:12px">' +
            '<div style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
            '<b>' + escapeHtml(app.name || app.id) + '</b>' +
            '<span style="opacity:.55;margin-left:8px">' + escapeHtml(app.id) +
            (app.version ? " · v" + escapeHtml(app.version) : "") +
            "</span></div>" +
            '<button type="button" data-theme-toggle title="切换主题" style="width:32px;height:28px;border:0;border-radius:6px;background:transparent;cursor:pointer;color:var(--dsw-alias-fg,currentColor);display:inline-flex;align-items:center;justify-content:center;">' +
            (state.theme === "dark" ? "<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4\"/></svg>" : "<svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M21 14.5A8.5 8.5 0 1 1 9.5 3 7 7 0 0 0 21 14.5z\"/></svg>") +
            "</button>" +
            '<button type="button" data-refresh-app title="Refresh" style="width:32px;height:28px;border:0;border-radius:6px;background:transparent;cursor:pointer;color:var(--dsw-alias-fg,currentColor);display:inline-flex;align-items:center;justify-content:center;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/></svg></button>' +
            '<button type="button" data-delete-app="' + escapeHtml(app.id) + '" title="Delete app" style="width:32px;height:28px;border:0;border-radius:6px;background:transparent;cursor:pointer;color:var(--dsw-alias-fg,currentColor);display:inline-flex;align-items:center;justify-content:center;color:#f87171;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg></button>' +

            "</div>" +
            '<iframe id="mma-app-frame" src="' + src + '" title="' + escapeHtml(app.name || app.id) +
            '" style="flex:1;min-height:0;width:100%;border:0;background:var(--dsw-alias-bg,#f7f7f8)"></iframe></div>';
        }
      }

      host.innerHTML =
        '<div style="display:flex;align-items:center;gap:8px;height:48px;padding:0 12px;border-bottom:1px solid var(--dsw-alias-border,#e5e7eb);background:var(--dsw-alias-surface,#fff)">' +
        '<div style="display:flex;align-items:center;gap:2px;flex:1;overflow:auto">' +
        tabsHtml +
        "</div>" +
        '<button type="button" id="mma-dock-host" title="" + (state.dock === "side" ? "铺满主区" : "嵌入聊天右侧") + "" style="width:32px;height:32px;border:0;border-radius:8px;background:transparent;cursor:pointer;color:inherit;display:inline-flex;align-items:center;justify-content:center">' +
        (state.dock === "side" ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/></svg>' : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18"/></svg>') +
        "</button>" +
        '<button type="button" id="mma-close-host" title="关闭" style="width:32px;height:32px;border:0;border-radius:8px;background:transparent;cursor:pointer;font-size:16px;color:inherit">✕</button>' +
        "</div>" +
        '<div style="flex:1;overflow:hidden;min-height:0;display:flex;flex-direction:column">' +
        body +
        "</div>";

      host.querySelectorAll("[data-tab]").forEach(function (btn) {
        btn.addEventListener("click", function (e) {
          if (e.target && e.target.getAttribute("data-close")) return;
          state.active = btn.getAttribute("data-tab");
          render();
        });
      });
      host.querySelectorAll("[data-close]").forEach(function (btn) {
        btn.addEventListener("click", function (e) {
          e.stopPropagation();
          closeTab(btn.getAttribute("data-close"));
        });
      });
      host.querySelectorAll("[data-open]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var id = btn.getAttribute("data-open");
          var app = state.apps.find(function (a) {
            return a.id === id;
          });
          if (app) openAppTab(app);
        });
      });
      var dockBtn = host.querySelector("#mma-dock-host");
      if (dockBtn)
        dockBtn.onclick = function () {
          state.dock = state.dock === "side" ? "fill" : "side";
          try { localStorage.setItem("mma-dock", state.dock); } catch (_) {}
          render();
        };
      var close = host.querySelector("#mma-close-host");
      if (close)
        close.onclick = function () {
          host.style.display = "none";
        };
      var retry = host.querySelector("#mma-retry");
      if (retry) retry.onclick = function () {
        fetchApps();
      };
      applyTheme(host);
      var th = host.querySelector("[data-theme-toggle]");
      if (th) th.onclick = function () { toggleTheme(); };
      var rf = host.querySelector("[data-refresh-app]");
      if (rf) rf.onclick = function () {
        var fr = document.getElementById("mma-app-frame");
        if (fr) fr.src = fr.src;
      };
      var del = host.querySelector("[data-delete-app]");
      if (del) del.onclick = function () {
        var id = del.getAttribute("data-delete-app");
        if (!id || !confirm("删除 app " + id + " ?")) return;
        fetch(APPS_HOST + "/api/app/" + encodeURIComponent(id), { method: "DELETE" })
          .then(function () {
            closeTab("app:" + id);
            fetchApps();
          });
      };
    }

    function escapeHtml(s) {
      return String(s == null ? "" : s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
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
        try { fetch(u, { mode: "no-cors" }).catch(function () {}); } catch (_) {}
      });
    }

    function openDashboard() {
      startRailWatch();
      var host = ensureHost();
      host.style.display = "flex";
      startSidebarSync();
      warmHost();
      fetchApps();
    }

    function isRailCollapsed(props) {
      if (props && typeof props.wide === "boolean") return !props.wide;
      if (props && typeof props.collapsed === "boolean") return props.collapsed;
      try {
        if (document.querySelector("[data-sidebar-collapsed='true']")) return true;
        if (document.documentElement.getAttribute("data-sidebar-collapsed") === "true") return true;
        if (document.body.getAttribute("data-sidebar-collapsed") === "true") return true;
      } catch (_) {}
      return false;
    }

    function FooterButton(props) {
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
        },
        icon,
        label
      );
    }

    function apply(ctx) {
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
      startRailWatch();
      if (!window.__mmaOpenBound) {
        window.__mmaOpenBound = true;
        document.addEventListener("click", function (e) {
          var n = e.target;
          if (n && n.closest && n.closest("[data-mma-open]")) {
            e.preventDefault();
            e.stopPropagation();
            try { openDashboard(); } catch (err) { console.error("[mma] open", err); }
          }
        }, true);
        document.addEventListener("keydown", function (e) {
          if (e.key !== "Enter" && e.key !== " ") return;
          var n = e.target;
          if (n && n.closest && n.closest("[data-mma-open]")) {
            e.preventDefault();
            try { openDashboard(); } catch (err) { console.error("[mma] open", err); }
          }
        }, true);
      }
      console.log("[monkey-mini-app-client] ui mounted (footer only)");
      return function () {
        for (var i = 0; i < disposers.length; i++) {
          try {
            disposers[i]();
          } catch (_) {}
        }
        var host = document.getElementById("mma-host");
        if (host) host.remove();
      };
    }

    exports.name = name;
    exports.inject = inject;
    exports.apply = apply;
    exports.default = { name: name, inject: inject, apply: apply };
    return module.exports;
  },
});
