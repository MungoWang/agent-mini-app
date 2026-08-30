/**
 * createHostShell — reusable outer host chrome for mini-apps.
 *
 * Assembles the panel↔host seam in one call: a `PanelHost` (REST to a
 * `packages/host` server), a frame controller for the app iframes, and a mount
 * that renders `MiniAppPanel` into a container with theme apply/persist. Host
 * layout details (dock tab sizing, sidebar sync) are supplied by the caller via
 * injected callbacks; this shell owns the theme + panel + frames.
 *
 * Both the dsh plugin and a standalone apps/react-host SPA use this.
 */
import { createMiniAppPanel, type PanelInstance } from "./panel.tsx";
import { applyThemeTo } from "./themes.ts";
import { createRestPanelHost, appFrameUrl } from "./rest.ts";
import { createFrameController, type FrameController } from "./frame.ts";
import type { PanelHost } from "./panel-host.ts";
import { getPanelState, setPanelState } from "./store.ts";
import type { CardStyle, DockId } from "./types.ts";

export type HostShellOptions = {
  /** Origin to a `packages/host` Hono server (e.g. http://127.0.0.1:17880). */
  hostUrl: string;
  /** Persistence backend. Defaults to window.localStorage. */
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
  cardStyle?: CardStyle;
  locale?: string;
  emptyText?: string;
  /** Optional: resolve the host URL (defaults to the passed hostUrl). */
  resolveHostUrl?: (current: string, storage: HostShellOptions["storage"]) => string;
  /** Fired when the host reports a new port. */
  onHostChange?: (nextHostUrl: string) => void;
  /** Dock layout hooks — real layout is host-specific; shell just tracks dock state. */
  layout?: {
    setDock?(dock: DockId): void;
    getDock?(): DockId;
  };
  onOpen?: () => void;
  onClose?: () => void;
};

export interface HostShellInstance {
  panel: PanelInstance;
  host: PanelHost;
  frames: FrameController;
  mount(el: HTMLElement): void;
  unmount(): void;
  openPanel(): void;
  closePanel(): void;
  toggle(): void;
  /** Persist theme to storage + re-apply to the panel host DOM + push to frames. */
  persistTheme(theme: string, palette: string): void;
  setCardStyle(v: CardStyle): void;
  setDock(v: DockId): void;
}

function safeStorage(storage: HostShellOptions["storage"]): Pick<Storage, "getItem" | "setItem"> | null {
  if (storage) return storage;
  try {
    if (typeof window !== "undefined") return window.localStorage;
  } catch {
    /* ignore */
  }
  return null;
}

function readThemePrefs(storage: Pick<Storage, "getItem"> | null): { theme: string; palette: string } {
  const get = (k: string): string | null => {
    try {
      return storage?.getItem(k) ?? null;
    } catch {
      return null;
    }
  };
  return { theme: get("mma-theme-mode") || "light", palette: get("mma-palette") || "default" };
}

export function createHostShell(opts: HostShellOptions): HostShellInstance {
  const storage = safeStorage(opts.storage);
  const themePrefs = readThemePrefs(storage);

  const frame = createFrameController({
    urlOf: (appId) => appFrameUrl(opts.hostUrl, appId, envFor(appId)),
    envOf: (appId) => envFor(appId),
  });

  function envFor(appId: string): { theme: string; palette: string; dock: string } {
    const s = getPanelState();
    const app = s.apps.find((a) => a.id === appId);
    return { theme: app?.theme?.theme || s.theme, palette: app?.theme?.palette || s.palette, dock: s.dock };
  }

  const host: PanelHost = createRestPanelHost({
    hostUrl: opts.hostUrl,
    storage,
    cardStyle: opts.cardStyle,
    locale: (opts.locale as PanelHost["locale"]) ?? undefined,
    emptyText: opts.emptyText,
    onOpen: () => optOnOpen(),
    onClose: () => optOnClose(),
    onHostChange: (next) => opts.onHostChange?.(next),
    frameController: {
      url: (appId) => frame.url(appId),
      // Lazy-bind the frames container (React may not have rendered #mma-frames yet).
      mount: (appId) => { ensureFrameContainer(); frame.mount(appId); },
      unmount: (appId) => frame.unmount(appId),
      reload: (appId) => { ensureFrameContainer(); frame.reload(appId); },
      syncEnv: () => frame.postEnvAll(),
    },
  });

  let framesBound = false;
  function ensureFrameContainer(): void {
    if (framesBound) return;
    const el = containerEl?.querySelector("#mma-frames") ?? document.getElementById("mma-frames");
    if (el) {
      frame.setContainer(el as HTMLElement);
      framesBound = true;
    }
  }

  let panel: PanelInstance | null = null;
  let containerEl: HTMLElement | null = null;

  function optOnOpen(): void {
    setPanelState({ visible: true });
    opts.onOpen?.();
  }
  function optOnClose(): void {
    setPanelState({ visible: false });
    opts.onClose?.();
  }

  function persistTheme(theme: string, palette: string): void {
    setPanelState({ theme, palette });
    try {
      storage?.setItem("mma-theme-mode", theme);
      storage?.setItem("mma-palette", palette);
    } catch {
      /* ignore */
    }
    if (containerEl) applyThemeTo(containerEl, theme, palette);
    frame.postEnvAll();
  }

  return {
    host,
    frames: frame,
    get panel(): PanelInstance {
      if (!panel) panel = createMiniAppPanel(host);
      return panel;
    },
    mount(el) {
      // The panel chrome CSS is scoped to #mma-host; create a fixed dock container so
      // the panel lays out (mirrors dsh's ensureSkeleton). Setting data-ready/dock/
      // cardstyle activates the panel's position + dock rules.
      containerEl = document.createElement("div");
      containerEl.id = "mma-host";
      containerEl.setAttribute("data-ready", "1");
      containerEl.setAttribute("data-dock", getPanelState().dock);
      containerEl.setAttribute("data-cardstyle", getPanelState().cardStyle);
      Object.assign(containerEl.style, {
        position: "fixed",
        top: "0",
        left: "0",
        right: "0",
        bottom: "0",
        zIndex: "40",
        display: "flex",
        flexDirection: "column",
        background: "var(--dsw-alias-bg, #f7f7f8)",
        color: "var(--dsw-alias-fg, #111)",
        fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
      });
      const target = el ?? document.body;
      target.appendChild(containerEl);

      setPanelState({ theme: themePrefs.theme, palette: themePrefs.palette, visible: true });
      applyThemeTo(containerEl, themePrefs.theme, themePrefs.palette);
      this.panel.mount(containerEl);
      // MiniAppPanel renders #mma-frames inside .mma-stage; bind it AFTER mount.
      const framesEl = containerEl.querySelector("#mma-frames");
      if (framesEl) frame.setContainer(framesEl as HTMLElement);
      void this.panel.actions.fetchApps();
    },
    unmount() {
      panel?.unmount();
      panel = null;
      frame.unmountAll();
      containerEl?.parentNode?.removeChild(containerEl);
      containerEl = null;
    },
    openPanel: optOnOpen,
    closePanel: optOnClose,
    toggle() {
      if (getPanelState().visible) optOnClose();
      else optOnOpen();
    },
    persistTheme,
    setCardStyle(v) {
      setPanelState({ cardStyle: v });
      try {
        storage?.setItem("mma-card-style", v);
      } catch {
        /* ignore */
      }
      containerEl?.setAttribute("data-cardstyle", v);
    },
    setDock(v) {
      setPanelState({ dock: v });
      opts.layout?.setDock?.(v);
    },
  };
}
