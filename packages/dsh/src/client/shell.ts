import {
  appFrameUrl,
  applyThemeTo,
  createFrameController,
  createMiniAppPanel,
  createRestPanelHost,
  defaultHideThemePop,
  type FrameController,
  getPanelState,
  type PanelHost,
  type PanelInstance,
  setPanelState,
} from "@monkey-mini-app/panel";

import { originFromHostPort, resolveAppsOrigin, writeStoredAppsOrigin } from "./apps-host.ts";
import { installFootCss } from "./css.ts";
import {
  armDockAnim,
  clearVisTimer,
  createLayoutState,
  hostLeftPx,
  lockLayout,
  markFooter,
  setDockPad,
  startRailWatch,
  startSidebarSync,
  syncHostToSidebar,
} from "./layout.ts";
import { type DockId,layoutBox } from "./layout-box.ts";
import { dshIsDark, readStoredMode, readStoredPalette } from "./theme.ts";
import { clampCardStyle, css } from "./utils.ts";

import "./globals.ts";

const ANIM_MS = 320;

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readDock(storage: Storage | null): DockId {
  try {
    const v = storage?.getItem("mma-dock");
    return v === "side" ? "side" : "fill";
  } catch {
    return "fill";
  }
}

export class DshShell {
  origin: string;
  cardStyle: ReturnType<typeof clampCardStyle>;
  readonly layout;
  readonly frames: FrameController;
  readonly host: PanelHost;
  panel: PanelInstance | null = null;
  private lastDock: DockId | null = null;
  private framesBound = false;

  constructor() {
    const storage = safeStorage();
    this.origin = resolveAppsOrigin(undefined, storage);
    this.cardStyle = clampCardStyle(storage?.getItem("mma-card-style"));
    this.layout = createLayoutState(readDock(storage));

    this.frames = createFrameController({
      urlOf: (appId) => appFrameUrl(this.origin, appId, this.envFor(appId)),
      envOf: (appId) => this.envFor(appId),
    });

    this.host = createRestPanelHost({
      hostUrl: this.origin,
      getHostUrl: () => this.origin,
      storage: safeStorage(),
      cardStyle: this.cardStyle,
      getCardStyle: () => this.cardStyle,
      locale: "zh-CN",
      emptyText: "还没有小程序。\n在对话里用 skill 生成，或把示例放到 runtime/apps/",
      onOpen: () => this.openPanel(),
      onClose: () => this.closePanel(),
      onHostChange: (next) => this.migrateOrigin(next),
      onConfigSaved: (form) => this.afterConfigSaved(form),
      frameController: {
        url: (appId) => this.frames.url(appId),
        mount: (appId) => {
          this.ensureFrameContainer();
          this.frames.mount(appId);
        },
        unmount: (appId) => this.frames.unmount(appId),
        reload: (appId) => {
          this.ensureFrameContainer();
          this.frames.reload(appId);
        },
        syncEnv: () => this.frames.postEnvAll(),
      },
    });
  }

  private envFor(appId: string): { theme: string; palette: string; dock: string } {
    const s = getPanelState();
    const app = s.apps.find((a) => a.id === appId);
    const t = app?.theme;
    return {
      theme: t?.theme || s.theme,
      palette: t?.palette || s.palette,
      dock: s.dock,
    };
  }

  private ensureFrameContainer(): void {
    if (this.framesBound) return;
    const el = document.getElementById("mma-frames");
    if (el) {
      this.frames.setContainer(el as HTMLElement);
      this.framesBound = true;
    }
  }

  bindPanel(): PanelInstance {
    if (!this.panel) {
      this.panel = createMiniAppPanel(this.host);
      // createMiniAppPanel resets the panel state to the store defaults, which
      // resets cardStyle to "stamp". Re-apply the shell's card style so the
      // avatar Mark and the host's data-cardstyle stay consistent across a
      // refresh (otherwise e.g. hero renders a stamp Mark that is unstyled).
      setPanelState({ cardStyle: this.cardStyle });
    }
    return this.panel;
  }

  private persistThemeLocal(theme: string, palette: string): void {
    const storage = safeStorage();
    try {
      storage?.setItem("mma-theme-mode", theme);
      storage?.setItem("mma-palette", palette);
    } catch {
      /* ignore */
    }
    setPanelState({ theme, palette });
    const host = document.getElementById("mma-host");
    if (host) applyThemeTo(host, theme, palette);
    this.frames.postEnvAll();
  }

  private migrateOrigin(next: string): void {
    if (next === this.origin) return;
    this.origin = next;
    writeStoredAppsOrigin(safeStorage(), next);
    this.frames.unmountAll();
  }

  private afterConfigSaved(form: Record<string, string>): void {
    if (typeof form.theme === "string" && typeof form.palette === "string") {
      this.persistThemeLocal(form.theme, form.palette);
    }
    if (form.cardStyle) this.setCardStyle(form.cardStyle);
  }

  setCardStyle(v: string): void {
    this.cardStyle = clampCardStyle(v);
    try {
      safeStorage()?.setItem("mma-card-style", this.cardStyle);
    } catch {
      /* ignore */
    }
    const host = document.getElementById("mma-host");
    if (host) host.setAttribute("data-cardstyle", this.cardStyle);
    setPanelState({ cardStyle: this.cardStyle });
  }

  private initAppearance(): void {
    const storage = safeStorage();
    const theme = readStoredMode(storage) || (dshIsDark() ? "dark" : "light");
    const palette = readStoredPalette(storage) || getPanelState().palette;
    setPanelState({ theme, palette });
  }

  private syncThemeFromDsh(): void {
    if (readStoredMode(safeStorage())) return;
    const next = dshIsDark() ? "dark" : "light";
    if (next === getPanelState().theme) return;
    setPanelState({ theme: next });
    const host = document.getElementById("mma-host");
    if (host) applyThemeTo(host, next, getPanelState().palette);
  }

  ensureSkeleton(): HTMLElement {
    installFootCss();
    let host = document.getElementById("mma-host");
    if (host) {
      if (this.layout.visible && !this.layout.closing) host.style.display = "flex";
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
    host.setAttribute("data-cardstyle", this.cardStyle);
    this.bindPanel().mount(host);
    this.ensureFrameContainer();
    startSidebarSync(this.layout, () => this.syncThemeFromDsh());
    return host;
  }

  openPanel(): void {
    clearVisTimer(this.layout);
    this.layout.closing = false;
    lockLayout(this.layout);
    startRailWatch(this.layout, () => this.syncThemeFromDsh());
    this.layout.visible = true;
    this.initAppearance();
    const host = this.ensureSkeleton();
    host.style.display = "flex";
    host.style.pointerEvents = "auto";
    setPanelState({ visible: true });
    const s = getPanelState();
    const tab = s.tabs.find((t) => t.id === s.active && t.kind === "app");
    if (tab?.app) this.frames.mount(tab.app.id);
    applyThemeTo(host, s.theme, s.palette);
    const box = layoutBox(this.layout.dock, window.innerWidth, hostLeftPx(document.body, window.innerHeight));
    host.style.top = "0";
    host.style.bottom = "0";
    host.style.right = "auto";
    host.style.zIndex = "40";
    host.style.width = `${box.width}px`;
    host.setAttribute("data-dock", this.layout.dock);
    host.classList.remove("mma-anim-dock");
    if (this.layout.dock === "side") {
      host.style.borderLeft = "1px solid var(--dsw-alias-border, #e5e7eb)";
      host.style.boxShadow = "-8px 0 24px rgba(0,0,0,.06)";
      host.style.opacity = "1";
      host.style.transform = "none";
      host.style.left = `${window.innerWidth}px`;
    } else {
      host.style.borderLeft = "none";
      host.style.boxShadow = "none";
      host.style.left = `${box.left}px`;
      host.style.opacity = "0";
      host.style.transform = "translateX(16px)";
    }
    void host.offsetWidth;
    armDockAnim(this.layout);
    void host.offsetWidth;
    if (this.layout.dock === "side") {
      setDockPad(true, window.innerWidth);
      host.style.left = `${box.left}px`;
    } else {
      host.style.opacity = "1";
      host.style.transform = "none";
    }
    startSidebarSync(this.layout, () => this.syncThemeFromDsh());
    this.panel?.actions.fetchApps();
    markFooter(true);
    void this.syncHostConfig();
  }

  closePanel(): void {
    if (!this.layout.visible && !this.layout.closing) return;
    this.layout.visible = false;
    this.layout.closing = true;
    lockLayout(this.layout);
    defaultHideThemePop();
    setPanelState({ pendingDelete: null, visible: false });
    markFooter(false);
    const host = document.getElementById("mma-host");
    if (!host) {
      this.layout.closing = false;
      setDockPad(false, window.innerWidth);
      return;
    }
    host.style.pointerEvents = "none";
    armDockAnim(this.layout);
    void host.offsetWidth;
    if (this.layout.dock === "side") {
      host.style.left = `${window.innerWidth}px`;
      setDockPad(false, window.innerWidth);
    } else {
      host.style.opacity = "0";
      host.style.transform = "translateX(16px)";
    }
    clearVisTimer(this.layout);
    this.layout.visTimer = setTimeout(() => {
      this.layout.visTimer = 0;
      this.layout.closing = false;
      if (this.layout.visible) return;
      host.style.display = "none";
      host.style.opacity = "";
      host.style.transform = "";
      host.style.pointerEvents = "";
      setDockPad(false, window.innerWidth);
    }, ANIM_MS + 40);
  }

  toggle(): void {
    if (this.layout.visible) this.closePanel();
    else this.openPanel();
  }

  followDockFromStore(): void {
    const dock = getPanelState().dock;
    if (dock === this.lastDock) return;
    this.lastDock = dock;
    this.layout.dock = dock;
    const host = document.getElementById("mma-host");
    if (host) host.setAttribute("data-dock", dock);
    if (!this.layout.closing) {
      syncHostToSidebar(this.layout, true);
      setDockPad(dock === "side", window.innerWidth);
    }
  }

  private async syncHostConfig(): Promise<void> {
    try {
      const form = await this.host.config?.load();
      if (!form) return;
      const next = originFromHostPort(form.hostPort, this.origin);
      if (next !== this.origin) {
        this.origin = next;
        writeStoredAppsOrigin(safeStorage(), next);
      }
      if (form.locale === "zh-CN" || form.locale === "en") {
        this.host.locale = form.locale;
      }
      // Prefer localStorage (written on every switch) so a failed/stale host POST
      // cannot wipe the user's choice on the next sync.
      const storedMode = readStoredMode(safeStorage());
      const storedPal = readStoredPalette(safeStorage());
      const theme =
        storedMode ||
        (form.theme === "dark" || form.theme === "light" ? form.theme : getPanelState().theme);
      const palette =
        storedPal || (typeof form.palette === "string" ? form.palette : getPanelState().palette);
      this.persistThemeLocal(theme, palette);
    } catch {
      /* ignore */
    }
  }

  dispose(): void {
    clearVisTimer(this.layout);
    this.layout.closing = false;
    this.panel?.unmount();
    this.panel = null;
    const host = document.getElementById("mma-host");
    host?.remove();
    setDockPad(false, window.innerWidth);
  }
}
