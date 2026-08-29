// @ts-nocheck — client shell is loosely typed against dsh DOM; track proper typing separately
import { MMA_HOST, MMA_STATE, MMA_PUSH, syncHostState } from "./state.js";
/** dsh-plugin client 模块：数据获取/预热/pending-open 轮询 */

export function fetchApps() {
  MMA_STATE.loading = true;
  MMA_STATE.error = null;
  syncHostState();
  return fetch(MMA_HOST.APPS_HOST + "/api/apps")
    .catch(function () {
      return fetch("/api/monkey-mini-app/apps");
    })
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (j) {
      MMA_STATE.apps = (j && j.apps) || [];
      MMA_STATE.loading = false;
      MMA_STATE.error = null;
      syncHostState();
    })
    .catch(function (e) {
      MMA_STATE.loading = false;
      MMA_STATE.error = String(e && e.message ? e.message : e);
      syncHostState();
    });
}
export function warmHost() {
  var urls = [MMA_HOST.APPS_HOST + "/api/apps", MMA_HOST.APPS_HOST + "/ui.css"];
  urls.forEach(function (u) {
    try {
      fetch(u, { mode: "no-cors" }).catch(function () {});
    } catch (_) {}
  });
}
