// @ts-nocheck — client shell is loosely typed against dsh DOM; track proper typing separately
/** dsh-plugin client 模块：iframe 生命周期/环境注入（依赖数据层）。 */
import { MMA_HOST, MMA_STATE, normalizePalette, envForApp } from "./state.js";
import { escapeHtml } from "./utils.js";


export var frameMap = {};
export function loadingMarkup() {
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
export function postEnvToFrame(id) {
  var rec = frameMap[id];
  if (!rec || !rec.iframe || !rec.iframe.contentWindow) return;
  var appId = rec.wrap ? rec.wrap.getAttribute("data-app") : null;
  var env = appId ? envForApp(appId) : { theme: MMA_STATE.theme, palette: MMA_STATE.palette };
  try {
    rec.iframe.contentWindow.postMessage(
      { type: "mma-set-env", theme: env.theme, palette: env.palette, dock: MMA_STATE.dock },
      "*"
    );
  } catch (_) {}
}
export function postEnvToFrames() {
  Object.keys(frameMap).forEach(postEnvToFrame);
}
export function postEnvToFrameByApp(appId) {
  Object.keys(frameMap).forEach(function (id) {
    var rec = frameMap[id];
    if (rec && rec.wrap && rec.wrap.getAttribute("data-app") === appId) postEnvToFrame(id);
  });
}
export function appFrameSrc(appId) {
  var env = envForApp(appId);
  return (
    MMA_HOST.APPS_HOST +
    "/app/" +
    encodeURIComponent(appId) +
    "?theme=" +
    encodeURIComponent(env.theme) +
    "&palette=" +
    encodeURIComponent(env.palette) +
    "&dock=" +
    encodeURIComponent(MMA_STATE.dock)
  );
}
export function showAppFrame(app) {
  var frames = document.getElementById("mma-frames");
  if (!frames) return;
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
export function destroyFrame(appId) {
  var rec = frameMap[appId];
  if (!rec) return;
  if (rec.wrap && rec.wrap.parentNode) rec.wrap.parentNode.removeChild(rec.wrap);
  delete frameMap[appId];
}
