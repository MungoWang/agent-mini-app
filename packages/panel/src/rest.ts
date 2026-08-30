/**
 * RestPanelHost — a host-agnostic `PanelHost` backed by a mini-app host over HTTP.
 *
 * This is the reusable core of the panel↔host seam: it knows how to talk to a
 * `packages/host` Hono server (/api/*) and persist theme prefs, but knows nothing
 * about dsh. Both the dsh plugin and a standalone `apps/react-host` SPA implement
 * the same `PanelHost` by wrapping this. All data/HTTP logic lives here; the panel
 * never contains /api strings.
 */
import type { Palette, PanelHost as PanelHostIF } from "./panel-host.ts";
import type {
  AppItem,
  CardStyle,
  Commit,
  LocaleId,
  StorageTable,
} from "./types.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type RestOptions = {
  /** Origin to reach a `packages/host` Hono server (e.g. http://127.0.0.1:17880). */
  hostUrl: string;
  /** Persistence backend for theme prefs. Defaults to window.localStorage. */
  storage?: Pick<Storage, "getItem" | "setItem"> | null;
  /** The current host's card style (for host-config form defaults). */
  cardStyle?: CardStyle;
  locale?: LocaleId;
  emptyText?: string;
  /** Optional overrides for opening/closing the panel (SPA wiring). */
  onOpen?: () => void;
  onClose?: () => void;
  /** Fired when the host reports a new port (e.g. after saving a different hostPort). */
  onHostChange?: (nextHostUrl: string) => void;
  /** Iframe control — provide a function that mounts/unmounts the app iframe. */
  frameController?: PanelHostIF["frame"];
  deleteApp?: (appId: string) => Promise<void>;
};

export async function readJson(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<unknown>;
}

export function appFrameUrl(
  origin: string,
  appId: string,
  query: { theme: string; palette: string; dock: string },
): string {
  return `${origin}/app/${encodeURIComponent(appId)}?${new URLSearchParams(query).toString()}`;
}

function parseAppTheme(raw: unknown): AppItem["theme"] {
  if (raw == null) return null;
  if (!isRecord(raw)) return undefined;
  const theme = typeof raw.theme === "string" ? raw.theme : "";
  const palette = typeof raw.palette === "string" ? raw.palette : "";
  if (!theme && !palette) return null;
  return { theme, palette };
}

export function parseAppsResponse(raw: unknown): AppItem[] {
  if (!isRecord(raw) || !Array.isArray(raw.apps)) return [];
  const out: AppItem[] = [];
  for (const item of raw.apps) {
    if (!isRecord(item) || typeof item.id !== "string") continue;
    out.push({
      id: item.id,
      name: typeof item.name === "string" ? item.name : item.id,
      description: typeof item.description === "string" ? item.description : undefined,
      acronym: typeof item.acronym === "string" ? item.acronym : undefined,
      commits: typeof item.commits === "number" ? item.commits : undefined,
      version: typeof item.version === "string" ? item.version : undefined,
      theme: parseAppTheme(item.theme),
    });
  }
  return out;
}

export function hostConfigToForm(raw: unknown, cardStyle: string): Record<string, string> {
  const rec = isRecord(raw) ? raw : {};
  const llm = isRecord(rec.llm) ? rec.llm : null;
  const locale = typeof rec.locale === "string" ? rec.locale : "";
  const chatLanguage = typeof rec.chatLanguage === "string" ? rec.chatLanguage : "";
  return {
    hostPort: rec.hostPort != null ? String(rec.hostPort) : "",
    locale: locale || chatLanguage,
    chatLanguage: chatLanguage || locale,
    theme: typeof rec.theme === "string" ? rec.theme : "",
    palette: typeof rec.palette === "string" ? rec.palette : "",
    cardStyle,
    provider: llm && typeof llm.provider === "string" ? llm.provider : "",
    model: llm && typeof llm.model === "string" ? llm.model : "",
  };
}

export function formToHostConfigBody(form: Record<string, string>): Record<string, unknown> {
  const provider = (form.provider ?? "").trim();
  const model = (form.model ?? "").trim();
  const locale = form.locale || form.chatLanguage;
  const body: Record<string, unknown> = { locale, chatLanguage: form.chatLanguage || locale, theme: form.theme, palette: form.palette };
  const port = Number(form.hostPort);
  if (Number.isInteger(port) && port >= 0 && port <= 65535) body.hostPort = port;
  if (provider && model) body.llm = { provider, model };
  else if (!provider && !model) body.llm = null;
  return body;
}

function asCommit(raw: unknown): Commit | null {
  if (!isRecord(raw) || typeof raw.id !== "string") return null;
  const files = Array.isArray(raw.files)
    ? raw.files.flatMap((f) => {
        if (!isRecord(f) || typeof f.path !== "string") return [];
        return [{ path: f.path, add: typeof f.add === "number" ? f.add : undefined, del: typeof f.del === "number" ? f.del : undefined, preview: typeof f.preview === "string" ? f.preview : undefined }];
      })
    : undefined;
  return { id: raw.id, message: typeof raw.message === "string" ? raw.message : "", time: typeof raw.time === "string" ? raw.time : "", files };
}

export function parseCommitList(raw: unknown): Commit[] {
  if (!isRecord(raw) || !Array.isArray(raw.commits)) return [];
  return raw.commits.map((c) => asCommit(c)).filter((c): c is Commit => c !== null);
}

export function parseCommitDetail(raw: unknown, id: string): Commit {
  const commit = isRecord(raw) && isRecord(raw.commit) ? raw.commit : raw;
  return asCommit(commit) ?? { id, message: "", time: "", files: undefined };
}

export function parseStorageTables(raw: unknown): StorageTable[] {
  if (!isRecord(raw) || !Array.isArray(raw.tables)) return [];
  const out: StorageTable[] = [];
  for (const row of raw.tables) {
    if (!isRecord(row)) continue;
    out.push({ name: typeof row.name === "string" ? row.name : "", size: typeof row.size === "number" ? row.size : 0, updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : "" });
  }
  return out;
}

export function parsePalettes(raw: unknown): Palette[] {
  if (!isRecord(raw) || !Array.isArray(raw.palettes)) return [];
  return raw.palettes.map((p) => (isRecord(p) ? { id: String(p.id ?? ""), label: String(p.label ?? p.id ?? ""), swatch: String(p.swatch ?? "") } : null)).filter((p): p is Palette => p !== null);
}

/** Build a `PanelHost` that talks to a `packages/host` Hono server over HTTP. */
export function createRestPanelHost(opts: RestOptions): PanelHostIF {
  const origin = opts.hostUrl.replace(/\/$/, "");
  const storage = opts.storage ?? (typeof window !== "undefined" ? window.localStorage : null);

  const host: PanelHostIF = {
    locale: opts.locale,
    emptyText: opts.emptyText,
    fetchApps: async () => parseAppsResponse(await readJson(`${origin}/api/apps`)),
    palettes: async () => {
      try {
        return parsePalettes(await readJson(`${origin}/api/palettes`));
      } catch {
        return [];
      }
    },
    openPanel: () => opts.onOpen?.(),
    closePanel: () => opts.onClose?.(),
    persistTheme: (theme, palette) => {
      try {
        storage?.setItem("mma-theme-mode", theme);
        storage?.setItem("mma-palette", palette);
      } catch {
        /* ignore */
      }
      void fetch(`${origin}/api/host-config`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ theme, palette }) }).catch(() => {});
    },
    appTheme: {
      save: async (appId, t) => {
        await fetch(`${origin}/api/apps/${encodeURIComponent(appId)}/theme`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(t) }).catch(() => {});
      },
      clear: async (appId) => {
        await fetch(`${origin}/api/apps/${encodeURIComponent(appId)}/theme`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reset: true }) }).catch(() => {});
      },
    },
    config: {
      load: async () => hostConfigToForm(await readJson(`${origin}/api/host-config`), opts.cardStyle ?? "stamp"),
      save: async (cfg) => {
        const body = formToHostConfigBody(cfg);
        const res = await fetch(`${origin}/api/host-config`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
        const raw: unknown = await res.json().catch(() => ({}));
        if (!res.ok || (isRecord(raw) && raw.ok === false)) {
          throw new Error(isRecord(raw) && typeof raw.error === "string" ? raw.error : `HTTP ${res.status}`);
        }
        // host may report a new port; notify so the shell can migrate.
        const hostPort = isRecord(raw) ? raw.hostPort : undefined;
        if (typeof hostPort === "number" && Number.isInteger(hostPort) && hostPort > 0) {
          const next = `${new URL(origin).protocol}//${new URL(origin).hostname}:${hostPort}`;
          if (next !== origin) opts.onHostChange?.(next);
        }
      },
    },
    history: {
      list: async (appId) => parseCommitList(await readJson(`${origin}/api/apps/${encodeURIComponent(appId)}/history?limit=50`)),
      detail: async (appId, id) => parseCommitDetail(await readJson(`${origin}/api/apps/${encodeURIComponent(appId)}/history/${encodeURIComponent(id)}`), id),
    },
    storage: {
      listTables: async (appId) => parseStorageTables(await readJson(`${origin}/api/apps/${encodeURIComponent(appId)}/storage`)),
      readTable: async (appId, name) => {
        const raw = await readJson(`${origin}/api/apps/${encodeURIComponent(appId)}/storage/${encodeURIComponent(name)}`);
        return isRecord(raw) && "value" in raw ? raw.value : raw;
      },
    },
    deleteApp: opts.deleteApp ?? (async (appId: string) => {
      await fetch(`${origin}/api/app/${encodeURIComponent(appId)}`, { method: "DELETE" }).catch(() => {});
    }),
    frame: opts.frameController ?? {
      url: (appId) => `${origin}/app/${encodeURIComponent(appId)}`,
      mount: () => undefined,
      unmount: () => undefined,
      reload: () => undefined,
      syncEnv: () => undefined,
    },
  };
  return host;
}
