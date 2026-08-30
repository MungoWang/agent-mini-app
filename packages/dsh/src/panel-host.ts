/**
 * DshPanelHost — PanelHost for the dsh web client.
 * HTTP stays here; panel never contains /api strings.
 */
import type { AppItem, Commit, LocaleId, Palette, PanelHost, StorageTable } from "@monkey-mini-app/panel";

import { appFrameUrl, originFromHostPort, writeStoredAppsOrigin } from "./client/apps-host.ts";
import {
  formToHostConfigBody,
  hostConfigToForm,
  parseAppsResponse,
  parseCommitDetail,
  parseCommitList,
  parsePalettes,
  parseStorageTables,
  readJson,
} from "./client/http.ts";
import { isRecord } from "./client/utils.ts";

export type DshPanelHostHooks = {
  origin(): string;
  setOrigin(origin: string): void;
  theme(): string;
  palette(): string;
  dock(): string;
  cardStyle(): string;
  setCardStyle(v: string): void;
  persistThemeLocal(theme: string, palette: string): void;
  openPanel(): void;
  closePanel(): void;
  mountFrame(appId: string): void;
  unmountFrame(appId: string): void;
  reloadFrame(appId: string): void;
  syncFramesEnv(): void;
  storage(): Pick<Storage, "getItem" | "setItem"> | null;
};

export class DshPanelHost implements PanelHost {
  locale?: LocaleId;
  emptyText?: string;

  constructor(private readonly hooks: DshPanelHostHooks) {
    this.emptyText =
      "还没有小程序。\n在对话里用 skill 生成，或把示例放到 runtime/apps/";
  }

  frame: PanelHost["frame"] = {
    url: (appId: string) =>
      appFrameUrl(this.hooks.origin(), appId, {
        theme: this.hooks.theme(),
        palette: this.hooks.palette(),
        dock: this.hooks.dock(),
      }),
    mount: (appId: string) => this.hooks.mountFrame(appId),
    unmount: (appId: string) => this.hooks.unmountFrame(appId),
    reload: (appId: string) => this.hooks.reloadFrame(appId),
    syncEnv: () => this.hooks.syncFramesEnv(),
  };

  openPanel(): void {
    this.hooks.openPanel();
  }

  closePanel(): void {
    this.hooks.closePanel();
  }

  async fetchApps(): Promise<AppItem[]> {
    const raw = await readJson(`${this.hooks.origin()}/api/apps`);
    return parseAppsResponse(raw);
  }

  persistTheme(theme: string, palette: string): void {
    this.hooks.persistThemeLocal(theme, palette);
    void fetch(`${this.hooks.origin()}/api/host-config`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ theme, palette }),
    }).catch(() => {});
  }

  palettes = async (): Promise<Palette[]> => {
    try {
      const raw = await readJson(`${this.hooks.origin()}/api/palettes`);
      return parsePalettes(raw);
    } catch {
      return [];
    }
  };

  appTheme = {
    save: async (appId: string, t: { theme: string; palette: string }): Promise<void> => {
      await fetch(`${this.hooks.origin()}/api/apps/${encodeURIComponent(appId)}/theme`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(t),
      }).catch(() => {});
    },
    clear: async (appId: string): Promise<void> => {
      await fetch(`${this.hooks.origin()}/api/apps/${encodeURIComponent(appId)}/theme`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reset: true }),
      }).catch(() => {});
    },
  };

  config = {
    load: async (): Promise<Record<string, string>> => {
      const raw = await readJson(`${this.hooks.origin()}/api/host-config`);
      return hostConfigToForm(raw, this.hooks.cardStyle());
    },
    save: async (cfg: Record<string, string>): Promise<void> => {
      const body = formToHostConfigBody(cfg);
      const res = await fetch(`${this.hooks.origin()}/api/host-config`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const raw: unknown = await res.json().catch(() => ({}));
      if (!res.ok || (isRecord(raw) && raw.ok === false)) {
        const err = isRecord(raw) && typeof raw.error === "string" ? raw.error : `HTTP ${res.status}`;
        throw new Error(err);
      }
      const nextPort = isRecord(raw) ? raw.hostPort : body.hostPort;
      const next = originFromHostPort(nextPort, this.hooks.origin());
      if (next !== this.hooks.origin()) {
        this.hooks.setOrigin(next);
        writeStoredAppsOrigin(this.hooks.storage(), next);
      }
      if (typeof cfg.theme === "string" && typeof cfg.palette === "string") {
        this.hooks.persistThemeLocal(cfg.theme, cfg.palette);
      }
      if (cfg.cardStyle) this.hooks.setCardStyle(cfg.cardStyle);
    },
  };

  history = {
    list: async (appId: string): Promise<Commit[]> => {
      const raw = await readJson(
        `${this.hooks.origin()}/api/apps/${encodeURIComponent(appId)}/history?limit=50`,
      );
      return parseCommitList(raw);
    },
    detail: async (appId: string, id: string): Promise<Commit> => {
      const raw = await readJson(
        `${this.hooks.origin()}/api/apps/${encodeURIComponent(appId)}/history/${encodeURIComponent(id)}`,
      );
      return parseCommitDetail(raw, id);
    },
  };

  storage = {
    listTables: async (appId: string): Promise<StorageTable[]> => {
      const raw = await readJson(`${this.hooks.origin()}/api/apps/${encodeURIComponent(appId)}/storage`);
      return parseStorageTables(raw);
    },
    readTable: async (appId: string, name: string): Promise<unknown> => {
      const raw = await readJson(
        `${this.hooks.origin()}/api/apps/${encodeURIComponent(appId)}/storage/${encodeURIComponent(name)}`,
      );
      return isRecord(raw) && "value" in raw ? raw.value : raw;
    },
  };

  deleteApp = async (appId: string): Promise<void> => {
    await fetch(`${this.hooks.origin()}/api/app/${encodeURIComponent(appId)}`, { method: "DELETE" }).catch(
      () => {},
    );
  };
}
