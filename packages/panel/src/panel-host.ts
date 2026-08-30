/**
 * PanelHost — the only seam between the panel UI and a host (dsh client, demo, …).
 * Optional fields hide the matching chrome (history / storage / settings / delete).
 */
import type { TokenSet } from "./themes.ts";
import type { AppItem, Commit, LocaleId, PanelCapabilities, StorageTable } from "./types.ts";

export type Palette = {
  id: string;
  label: string;
  swatch: string;
  tokens?: { light: TokenSet; dark: TokenSet };
};

export interface PanelHost {
  /** Locale for panel chrome. Falls back to createMiniAppPanel options, then zh-CN. */
  locale?: LocaleId;
  fetchApps(): Promise<AppItem[]>;
  frame: {
    url(appId: string): string;
    mount(appId: string): void;
    unmount(appId: string): void;
    reload(appId: string): void;
    /** Push current theme/palette/dock into open app iframes. */
    syncEnv?(): void;
  };
  openPanel(): void;
  closePanel(): void;
  palettes?(): Promise<Palette[]>;
  persistTheme?(theme: string, palette: string): void;
  appTheme?: {
    save(appId: string, t: { theme: string; palette: string }): Promise<void>;
    clear(appId: string): Promise<void>;
  };
  config?: {
    load(): Promise<Record<string, string>>;
    save(cfg: Record<string, string>): Promise<void>;
  };
  history?: {
    list(appId: string): Promise<Commit[]>;
    detail(appId: string, id: string): Promise<Commit>;
  };
  storage?: {
    listTables(appId: string): Promise<StorageTable[]>;
    readTable(appId: string, name: string): Promise<unknown>;
  };
  onOpenRequest?(cb: (appId?: string) => void): () => void;
  emptyText?: string;
  deleteApp?(appId: string): Promise<void>;
}

export function capabilitiesOf(host: PanelHost): PanelCapabilities {
  return {
    history: !!host.history,
    storage: !!host.storage,
    config: !!host.config,
    appTheme: !!host.appTheme,
    customPalettes: !!host.palettes,
    deleteApp: !!host.deleteApp,
  };
}
