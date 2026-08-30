import { DOCK_ANIM_MS, DOCK_EASE } from "./layout-box.ts";

/** Footer slot + dock-side padding. Panel chrome CSS lives in @monkey-mini-app/panel. */
export function installFootCss(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById("mma-foot-css")) return;
  const s = document.createElement("style");
  s.id = "mma-foot-css";
  s.textContent = [
    `html.mma-anim-dock{transition:padding-right ${DOCK_ANIM_MS}ms ${DOCK_EASE};}`,
    "html.mma-dock-side{padding-right:var(--mma-side-w,440px);box-sizing:border-box;}",
    `#mma-host{overflow:hidden;transition:background-color .22s ease,color .22s ease,border-color .22s ease;}`,
    `#mma-host.mma-anim-dock{transition:left ${DOCK_ANIM_MS}ms ${DOCK_EASE},width ${DOCK_ANIM_MS}ms ${DOCK_EASE},opacity ${DOCK_ANIM_MS}ms ${DOCK_EASE},transform ${DOCK_ANIM_MS}ms ${DOCK_EASE},box-shadow ${DOCK_ANIM_MS}ms ease,border-color ${DOCK_ANIM_MS}ms ease,background-color .22s ease,color .22s ease;}`,
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
