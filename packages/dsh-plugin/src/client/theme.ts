// @ts-nocheck — client shell is loosely typed against dsh DOM; track proper typing separately
/** dsh-plugin client 模块：宿主主题探测/持久化/自定义（纯值计算，依赖数据层）。 */
import { applyThemeTo, clampPalette } from "@monkey-mini-app/panel-core";
import { MMA_STATE, MMA_HOST, normalizePalette, envForApp, appThemeOf, syncHostState } from "./state.js";
import { luminanceOf } from "./utils.js";


export function dshIsDark() {
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
export function initAppearance() {
  MMA_STATE.theme = storedMode() || (dshIsDark() ? "dark" : "light");
  try {
    var raw = localStorage.getItem("mma-palette");
    MMA_STATE.palette = typeof raw === "string" && raw ? raw : "default";
  } catch (_) {
    MMA_STATE.palette = "default";
  }
}
export function loadCustomPalettes() {
  fetch(MMA_HOST.APPS_HOST + "/api/palettes")
    .then(function (r) {
      return r.json();
    })
    .then(function (j) {
      if (!j || !j.ok || !Array.isArray(j.palettes)) return;
      MMA_STATE.customPalettes = {};
      j.palettes.forEach(function (p) {
        if (p.custom) {
          MMA_STATE.customPalettes[p.id] = { label: p.label, swatch: p.swatch, tokens: p.tokens };
        }
      });
      syncHostState();
    })
    .catch(function () {});
}
export function persistAppearance() {
  try {
    localStorage.setItem("mma-theme-mode", MMA_STATE.theme);
    localStorage.setItem("mma-palette", MMA_STATE.palette);
  } catch (_) {}
  fetch(MMA_HOST.APPS_HOST + "/api/host-config", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ theme: MMA_STATE.theme, palette: MMA_STATE.palette }),
  }).catch(function () {});
}
export function setAppearance(next, scope) {
  if (next.theme === "light" || next.theme === "dark") MMA_STATE.theme = next.theme;
  if (next.palette) MMA_STATE.palette = normalizePalette(next.palette);
  if (scope === "app") {
    var app = activeApp();
    if (app) {
      var env = envForApp(app.id);
      var body = { theme: next.theme || env.theme, palette: normalizePalette(next.palette || env.palette) };
      fetch(MMA_HOST.APPS_HOST + "/api/apps/" + encodeURIComponent(app.id) + "/theme", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      }).then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.theme) {
          var a = MMA_STATE.apps.find(function (x) { return x.id === app.id; });
          if (a) a.theme = j.theme;
          syncHostState();
        }
      }).catch(function () {});
      return;
    }
  }
  syncHostState();
  persistAppearance();
}
export function syncThemeFromDsh() {
  if (storedMode()) return;
  var next = dshIsDark() ? "dark" : "light";
  if (next === MMA_STATE.theme) return;
  MMA_STATE.theme = next;
  syncHostState();
}
export function applyPanelTheme() {
  var host = document.getElementById("mma-host");
  if (!host) return;
  applyThemeTo(host, MMA_STATE.theme, MMA_STATE.palette, MMA_STATE.customPalettes || undefined);
}
