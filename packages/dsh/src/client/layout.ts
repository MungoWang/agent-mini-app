import { installFootCss } from "./css.ts";
import { DOCK_ANIM_MS, type DockId,layoutBox, sideWidthPx } from "./layout-box.ts";
import { dshIsDark } from "./theme.ts";

import "./globals.ts";

export type LayoutState = {
  dock: DockId;
  visible: boolean;
  closing: boolean;
  layoutLockUntil: number;
  animTimer: ReturnType<typeof setTimeout> | 0;
  visTimer: ReturnType<typeof setTimeout> | 0;
  followRaf: number;
  sideObs: ResizeObserver | null;
};

export function createLayoutState(dock: DockId): LayoutState {
  return {
    dock,
    visible: false,
    closing: false,
    layoutLockUntil: 0,
    animTimer: 0,
    visTimer: 0,
    followRaf: 0,
    sideObs: null,
  };
}

export function hostLeftPx(root: ParentNode, innerHeight: number): number {
  let best = 0;
  const nodes = root.querySelectorAll("aside, nav, [class*='sidebar'], [class*='Sidebar']");
  for (let i = 0; i < nodes.length; i++) {
    const r = nodes[i]!.getBoundingClientRect();
    if (r.top > 24) continue;
    if (r.left > 80) continue;
    if (r.height < innerHeight * 0.45) continue;
    if (r.width < 48 || r.width > 560) continue;
    if (r.right > best) best = r.right;
  }
  return Math.max(56, Math.round(best || 56));
}

export function setDockPad(on: boolean, innerWidth: number): void {
  const w = sideWidthPx(innerWidth);
  document.documentElement.style.setProperty("--mma-side-w", `${w}px`);
  document.documentElement.classList.toggle("mma-dock-side", !!on);
}

export function armDockAnim(state: LayoutState): void {
  const host = document.getElementById("mma-host");
  if (host) host.classList.add("mma-anim-dock");
  document.documentElement.classList.add("mma-anim-dock");
  if (state.animTimer) clearTimeout(state.animTimer);
  state.animTimer = setTimeout(() => {
    const h = document.getElementById("mma-host");
    if (h) h.classList.remove("mma-anim-dock");
    document.documentElement.classList.remove("mma-anim-dock");
    state.animTimer = 0;
  }, DOCK_ANIM_MS + 40);
}

export function lockLayout(state: LayoutState): void {
  state.layoutLockUntil = Date.now() + DOCK_ANIM_MS + 50;
}

export function layoutLocked(state: LayoutState): boolean {
  return state.closing || Date.now() < state.layoutLockUntil;
}

export function clearVisTimer(state: LayoutState): void {
  if (state.visTimer) {
    clearTimeout(state.visTimer);
    state.visTimer = 0;
  }
}

export function syncHostToSidebar(state: LayoutState, animate: boolean): void {
  const host = document.getElementById("mma-host");
  if (!host) return;
  if (!animate && layoutLocked(state)) return;
  if (animate) armDockAnim(state);
  const box = layoutBox(state.dock, window.innerWidth, hostLeftPx(document.body, window.innerHeight));
  host.style.top = "0";
  host.style.bottom = "0";
  host.style.right = "auto";
  host.style.zIndex = "40";
  host.style.left = `${box.left}px`;
  host.style.width = `${box.width}px`;
  host.setAttribute("data-dock", state.dock);
  if (state.dock === "side" && state.visible) {
    host.style.borderLeft = "1px solid var(--dsw-alias-border, #e5e7eb)";
    host.style.boxShadow = "-8px 0 24px rgba(0,0,0,.06)";
    setDockPad(true, window.innerWidth);
  } else {
    host.style.borderLeft = "none";
    host.style.boxShadow = "none";
    setDockPad(false, window.innerWidth);
  }
}

export function followSidebar(state: LayoutState, ms: number): void {
  const until = Date.now() + (ms || 360);
  if (state.followRaf) cancelAnimationFrame(state.followRaf);
  const frame = (): void => {
    syncHostToSidebar(state, false);
    if (Date.now() < until) state.followRaf = requestAnimationFrame(frame);
    else state.followRaf = 0;
  };
  state.followRaf = requestAnimationFrame(frame);
}

export function markFooter(open: boolean): void {
  const nodes = document.querySelectorAll("[data-mma-open]");
  for (let i = 0; i < nodes.length; i++) {
    nodes[i]!.setAttribute("aria-pressed", open ? "true" : "false");
  }
}

export function startSidebarSync(state: LayoutState, onThemeMaybe: () => void): void {
  syncHostToSidebar(state, false);
  if (state.sideObs) return;
  state.sideObs = new ResizeObserver(() => {
    followSidebar(state, 360);
  });
  const observeCols = (): void => {
    const nodes = document.body.querySelectorAll("aside, nav, [class*='sidebar'], [class*='Sidebar']");
    for (let i = 0; i < nodes.length; i++) {
      try {
        state.sideObs?.observe(nodes[i]!);
      } catch {
        /* ignore */
      }
    }
  };
  observeCols();
  window.addEventListener("resize", () => {
    followSidebar(state, 360);
  });
  document.addEventListener(
    "click",
    () => {
      followSidebar(state, 360);
    },
    true,
  );
  const mo = new MutationObserver(() => {
    observeCols();
    followSidebar(state, 360);
    onThemeMaybe();
  });
  mo.observe(document.documentElement, {
    attributes: true,
    subtree: true,
    attributeFilter: ["class", "style", "data-sidebar-collapsed", "data-collapsed", "data-theme", "data-color-mode"],
  });
}

export function startRailWatch(state: LayoutState, onThemeMaybe: () => void): void {
  installFootCss();
  const tick = (): void => {
    syncHostToSidebar(state, false);
    onThemeMaybe();
  };
  tick();
  if (!window.__mmaRailWatch) {
    window.__mmaRailWatch = true;
    window.addEventListener("resize", tick);
    document.addEventListener(
      "click",
      () => {
        tick();
        let n = 0;
        const frame = (): void => {
          tick();
          n++;
          if (n < 45) requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      },
      true,
    );
    setInterval(tick, 400);
    if (window.matchMedia) {
      try {
        window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
          void dshIsDark();
          onThemeMaybe();
        });
      } catch {
        /* ignore */
      }
    }
  }
}
