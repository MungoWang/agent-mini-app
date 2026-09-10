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
import { createFrameController, type FrameController } from "./frame.ts";
import { createMiniAppPanel, type PanelInstance } from "./panel.tsx";
import type { PanelHost } from "./panel-host.ts";
import { appFrameUrl,createRestPanelHost, relayViewEval, subscribeHostEvents } from "./rest.ts";
import { getPanelState, setPanelState } from "./store.ts";
import {
  applyThemeTo,
  type CustomPaletteMap,
  effectivePalette,
  LOCAL_PALETTE_ID,
  resolveMode,
  themeCssVars,
} from "./themes.ts";
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

function readThemePrefs(storage: Pick<Storage, "getItem"> | null): {
  theme: string;
  palette: string;
  cardStyle: string;
} {
  const get = (k: string): string | null => {
    try {
      return storage?.getItem(k) ?? null;
    } catch {
      return null;
    }
  };
  return {
    theme: (() => {
      const m = get("mma-theme-mode");
      return m === "system" || m === "dark" || m === "light" ? m : "light";
    })(),
    palette: get("mma-palette") || "default",
    cardStyle: get("mma-card-style") || "stamp",
  };
}

export function createHostShell(opts: HostShellOptions): HostShellInstance {
  const storage = safeStorage(opts.storage);
  const themePrefs = readThemePrefs(storage);
  let currentOrigin = opts.hostUrl.replace(/\/$/, "");

  const frame = createFrameController({
    urlOf: (appId) => appFrameUrl(currentOrigin, appId, envFor(appId)),
    envOf: (appId) => envFor(appId),
  });

  /**
   * Host → shell freshness. After `mini_app_reload` the bytes changed on disk, but an
   * iframe the user already has open keeps running the old bundle — without this the
   * agent says "refresh if it still errors" because nothing else tells the page.
   */
  let unsubEvents: (() => void) | null = null;
  function bindHostEvents(): void {
    unsubEvents?.();
    unsubEvents = subscribeHostEvents(currentOrigin, {
      // `mini_app_open` asked to show an app. Without this the panel opens on the list and
      // the agent's follow-up (`mini_app_errors`, `mini_app_view_eval`) waits on a view that
      // was never mounted — the dsh client already does this in its own stream handler.
      onOpen: (appId, title) => {
        optOnOpen();
        void host.fetchApps().then((apps) => {
          const app = apps.find((a) => a.id === appId);
          if (app) panelRef()?.actions.openAppTab(app);
          else if (title) console.warn(`[mma] opened app ${appId} is not registered on this host`);
        });
      },
      onReload: (appId) => {
        if (frame.map.has(appId)) frame.reload(appId);
      },
      onEval: (query) => relayViewEval(currentOrigin, frame, query),
      onStorageNotice: (notice) => {
        // Soft reminder only — do not steal focus; the banner is dismissible.
        setPanelState({ storageNotice: notice });
      },
    });
  }

  function envFor(appId: string): { theme: string; palette: string; dock: string; vars: Record<string, string> } {
    const s = getPanelState();
    const app = s.apps.find((a) => a.id === appId);
    const theme = app?.theme?.theme || s.theme;
    const palette = effectivePalette(app?.theme?.palette, Boolean(app?.localPalette), s.palette);
    const custom: CustomPaletteMap = { ...(s.customPalettes as CustomPaletteMap) };
    if (app?.localPalette) {
      custom[LOCAL_PALETTE_ID] = {
        label: app.localPalette.label,
        swatch: app.localPalette.swatch,
        tokens: app.localPalette.tokens,
      };
    }
    return {
      theme,
      palette,
      dock: s.dock,
      vars: themeCssVars(resolveMode(theme), palette, custom),
    };
  }

  async function migrateOrigin(next: string): Promise<void> {
    const origin = next.replace(/\/$/, "");
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch(`${origin}/health`);
        if (res.ok) break;
      } catch {
        /* rebind in flight */
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    currentOrigin = origin;
    try {
      storage?.setItem("mma-host-url", origin);
    } catch {
      /* ignore */
    }
    opts.onHostChange?.(origin);
    bindHostEvents();
    for (const id of [...frame.map.keys()]) frame.reload(id);
  }

  const host: PanelHost = createRestPanelHost({
    hostUrl: opts.hostUrl,
    getHostUrl: () => currentOrigin,
    storage,
    cardStyle: opts.cardStyle,
    locale: (opts.locale as PanelHost["locale"]) ?? undefined,
    emptyText: opts.emptyText,
    onOpen: () => optOnOpen(),
    onClose: () => optOnClose(),
    onHostChange: (next) => {
      void migrateOrigin(next);
    },
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

  /** The panel instance, created on demand — a host event can arrive before anyone mounted. */
  function panelRef(): PanelInstance {
    if (!panel) panel = createMiniAppPanel(host);
    return panel;
  }

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
      return panelRef();
    },
    mount(el) {
      // The panel chrome CSS is scoped to #mma-host; create a fixed dock container so
      // the panel lays out (mirrors dsh's ensureSkeleton). Setting data-ready/dock/
      // cardstyle activates the panel's position + dock rules.
      containerEl = document.createElement("div");
      containerEl.id = "mma-host";
      containerEl.setAttribute("data-ready", "1");
      containerEl.setAttribute("data-dock", getPanelState().dock);
      containerEl.setAttribute("data-cardstyle", themePrefs.cardStyle);
      bindHostEvents();
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

      const cardStyle = (themePrefs.cardStyle as CardStyle) || "stamp";
      setPanelState({
        theme: themePrefs.theme,
        palette: themePrefs.palette,
        cardStyle,
        visible: true,
      });
      this.panel.mount(containerEl);
      applyThemeTo(containerEl, themePrefs.theme, themePrefs.palette);
      setPanelState({ theme: themePrefs.theme, palette: themePrefs.palette, cardStyle });
      containerEl.setAttribute("data-cardstyle", cardStyle);
      // MiniAppPanel renders #mma-frames inside .mma-stage; bind it AFTER mount.
      const framesEl = containerEl.querySelector("#mma-frames");
      if (framesEl) frame.setContainer(framesEl as HTMLElement);
      void this.panel.actions.fetchApps();
    },
    unmount() {
      unsubEvents?.();
      unsubEvents = null;
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
