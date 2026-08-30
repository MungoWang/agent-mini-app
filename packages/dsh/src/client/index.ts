import { createElement, type ReactElement } from "react";

import { defaultHideThemePop, getPanelState, subscribePanel } from "@monkey-mini-app/panel";

import { installFootCss } from "./css.ts";
import { DshShell } from "./shell.ts";

import "./globals.ts";

export const name = "monkey-mini-app-client";
export const inject = ["slots"] as const;

export { DshPanelHost } from "../panel-host.ts";
export { appFrameUrl, appsOrigin } from "./apps-host.ts";
export { createMiniAppPanel } from "@monkey-mini-app/panel";

type SlotsCtx = {
  slots?: {
    inject?: (slot: string, fn: () => unknown) => () => void;
    register?: (meta: { name: string; id: string; order: number }, component: unknown) => unknown;
  };
};

let shell: DshShell | null = null;
let sse: EventSource | null = null;
let dockUnsub: (() => void) | null = null;

function getShell(): DshShell {
  if (!shell) shell = new DshShell();
  return shell;
}

export type FooterButtonProps = { wide?: boolean };

export function FooterButton(props: FooterButtonProps): ReactElement {
  const wide = !(props && props.wide === false);
  const visible = getShell().layout.visible;
  const icon = createElement(
    "span",
    { className: "mma-foot-ico", "aria-hidden": true },
    createElement(
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
      createElement("rect", { x: 3, y: 4, width: 18, height: 16, rx: 2 }),
      createElement("path", { d: "M3 8h18" }),
    ),
  );
  const label = createElement(
    "span",
    { className: "mma-foot-label", style: wide ? undefined : { display: "none" } },
    "小程序",
  );
  return createElement(
    "span",
    {
      "data-mma-open": "1",
      className: "mma-foot-btn",
      role: "button",
      tabIndex: 0,
      title: "小程序",
      "aria-pressed": visible ? "true" : "false",
    },
    icon,
    label,
  );
}

function subscribeAppOpen(current: DshShell): void {
  if (sse) return;
  try {
    const es = new EventSource(`${current.origin}/api/events`);
    sse = es;
    es.addEventListener("app:open", (e: MessageEvent<string>) => {
      let appId = "";
      try {
        const d: unknown = JSON.parse(e.data || "{}");
        if (d && typeof d === "object" && "appId" in d && typeof (d as { appId: unknown }).appId === "string") {
          appId = (d as { appId: string }).appId;
        }
      } catch {
        return;
      }
      if (!appId) return;
      current.openPanel();
      void current.host.fetchApps().then((apps) => {
        const app = apps.find((a) => a.id === appId);
        if (app) current.bindPanel().actions.openAppTab(app);
      });
    });
  } catch (err) {
    console.warn("[monkey-mini-app-client] sse subscribe failed", err);
  }
}

function bindUiEvents(current: DshShell): void {
  if (window.__mmaOpenBound) return;
  window.__mmaOpenBound = true;
  document.addEventListener(
    "click",
    (e) => {
      const n = e.target;
      if (n instanceof Element && n.closest("[data-mma-open]")) {
        e.preventDefault();
        e.stopPropagation();
        try {
          current.toggle();
        } catch (err) {
          console.error("[mma] open", err);
        }
      }
    },
    true,
  );
  document.addEventListener(
    "keydown",
    (e) => {
      const n = e.target;
      if ((e.key === "Enter" || e.key === " ") && n instanceof Element && n.closest("[data-mma-open]")) {
        e.preventDefault();
        try {
          current.toggle();
        } catch (err) {
          console.error("[mma] open", err);
        }
        return;
      }
      if (e.key === "Escape" && current.layout.visible) {
        if (defaultHideThemePop()) return;
        if (getPanelState().pendingDelete) {
          current.bindPanel().actions.hideModal();
        } else {
          current.closePanel();
        }
      }
    },
    true,
  );
}

export function apply(ctx: SlotsCtx): () => void {
  const current = getShell();
  // Footer slot renders before the panel opens — install styles on client boot.
  installFootCss();
  current.bindPanel();
  const disposers: Array<() => void> = [];
  try {
    if (ctx && ctx.slots && typeof ctx.slots.inject === "function") {
      disposers.push(
        ctx.slots.inject("sidebar.footer.action", () => {
          return ctx.slots?.register?.(
            { name: "sidebar.footer.action", id: "monkey-mini-app", order: 20 },
            FooterButton,
          );
        }),
      );
    }
  } catch (e) {
    console.warn("[monkey-mini-app-client] footer slot failed", e);
  }
  if (!dockUnsub) {
    dockUnsub = subscribePanel(() => current.followDockFromStore());
  }
  subscribeAppOpen(current);
  bindUiEvents(current);
  console.log("[monkey-mini-app-client] ui mounted (footer only)");
  return () => {
    for (const d of disposers) {
      try {
        d();
      } catch {
        /* ignore */
      }
    }
    dockUnsub?.();
    dockUnsub = null;
    sse?.close();
    sse = null;
    current.dispose();
    shell = null;
  };
}
