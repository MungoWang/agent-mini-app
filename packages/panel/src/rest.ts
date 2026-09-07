/**
 * RestPanelHost — a host-agnostic `PanelHost` backed by a mini-app host over HTTP.
 *
 * This is the reusable core of the panel↔host seam: it knows how to talk to a
 * `packages/host` Hono server (/api/*) and persist theme prefs, but knows nothing
 * about dsh. Both the dsh plugin and a standalone `apps/react-host` SPA implement
 * the same `PanelHost` by wrapping this. All data/HTTP logic lives here; the panel
 * never contains /api strings.
 */
import type { FrameController, ViewEvalAnswer, ViewEvalQuery } from "./frame.ts";
import type {
  AboutInfo,
  Palette,
  PanelHost as PanelHostIF,
  UpdateCheck,
} from "./panel-host.ts";
import type {
  AppItem,
  CardStyle,
  Commit,
  LocaleId,
  StorageNotice,
  StorageTable,
} from "./types.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type RestOptions = {
  /** Origin to reach a `packages/host` Hono server (e.g. http://127.0.0.1:17880). */
  hostUrl: string;
  /** Optional: resolve the host URL dynamically (host-port migration). Defaults to hostUrl. */
  getHostUrl?: () => string;
  /** Persistence backend for theme prefs. Defaults to window.localStorage. */
  storage?: Pick<Storage, "getItem" | "setItem"> | null;
  /** The current host's card style (for host-config form defaults). */
  cardStyle?: CardStyle;
  /** Optional: resolve the current card style dynamically (defaults to cardStyle). */
  getCardStyle?: () => CardStyle;
  locale?: LocaleId;
  emptyText?: string;
  /** Optional overrides for opening/closing the panel (SPA wiring). */
  onOpen?: () => void;
  onClose?: () => void;
  /** Fired when the host reports a new port (e.g. after saving a different hostPort). */
  onHostChange?: (nextHostUrl: string) => void;
  /** Fired after a successful host-config save (theme/cardStyle/origin side effects). */
  onConfigSaved?: (form: Record<string, string>) => void;
  /** Iframe control — provide a function that mounts/unmounts the app iframe. */
  frameController?: PanelHostIF["frame"];
  deleteApp?: (appId: string) => Promise<void>;
};

export async function readJson(url: string, init?: RequestInit): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (cause) {
    throw new HostUnreachableError(url, cause);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<unknown>;
}

/** Thrown when a `packages/host` server cannot be reached at the network level (port blocked / host not started). */
export class HostUnreachableError extends Error {
  readonly url: string;
  constructor(url: string, cause?: unknown) {
    super(`Cannot reach apps host: ${url}`);
    this.name = "HostUnreachableError";
    this.url = url;
    if (cause !== undefined) {
      Object.defineProperty(this, "cause", { value: cause, configurable: true, writable: true });
    }
  }
}

export function isHostUnreachable(e: unknown): e is HostUnreachableError {
  return e instanceof HostUnreachableError;
}

/**
 * The frame URL carries exactly what the runner reads back out of `location.search`
 * (`http/app-runner-html.ts`: theme / palette / dock). CSS variables do **not** travel here —
 * they go over the `mma-set-env` postMessage.
 *
 * Callers hand us the whole app env, which also holds a `vars` map. Letting that reach
 * `URLSearchParams` stringifies it to `[object Object]` and puts the junk in every iframe src,
 * and TypeScript cannot catch it: excess-property checks apply to fresh literals, and this
 * arrives as a variable. Picking the keys here keeps the invariant in one place, so a future
 * caller cannot reintroduce it.
 */
export function appFrameUrl(
  origin: string,
  appId: string,
  query: { theme: string; palette: string; dock: string },
): string {
  const params = new URLSearchParams();
  for (const key of ["theme", "palette", "dock"] as const) {
    const value = query[key];
    if (value) params.set(key, value);
  }
  return `${origin}/app/${encodeURIComponent(appId)}?${params.toString()}`;
}

/** What the host pushes on `GET /api/events`. */
export type HostEventHandlers = {
  onOpen?: (appId: string, title?: string) => void;
  /** Sources were recompiled: an already-open iframe must refetch, not keep old code. */
  onReload?: (appId: string) => void;
  /**
   * The host wants an answer from a rendered view. Only the shell can deliver it: the iframe
   * is cross-origin, so `postMessage` is the one door from this page into that one.
   */
  onEval?: (query: ViewEvalQuery) => void;
  /** A storage table crossed a size band — soft banner, writes were not blocked. */
  onStorageNotice?: (notice: StorageNotice) => void;
};

/**
 * Relay one host view query into the iframe that renders `appId`, or answer on the app's
 * behalf when no shell here is showing it.
 *
 * Answering `not-open` immediately is what makes the distinction real: without it the host
 * can only see "nobody replied" and has to guess between a closed app and a wedged one.
 * Reused by every adapter (panel shell, dsh client) so hosts get identical freshness
 * semantics instead of subtly different ones.
 */
export function relayViewEval(origin: string, frames: FrameController, query: ViewEvalQuery): void {
  if (!query.requestId || !query.appId) return;
  if (frames.postViewEval(query)) return;
  const body: ViewEvalAnswer & { appId: string } = { appId: query.appId, requestId: query.requestId, view: "not-open" };
  fetch(`${origin.replace(/\/$/, "")}/api/app/${encodeURIComponent(query.appId)}/view/eval`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {
    /* the host's own timeout says the same thing, later and less precisely */
  });
}

/**
 * Subscribe to the host event stream. Returns an unsubscribe function.
 *
 * Lives here rather than in each adapter so every host gets the same freshness
 * semantics for free. A missing/blocked stream is not fatal — it only costs live
 * refresh, so failures degrade to the old behaviour and stay silent.
 */
export function subscribeHostEvents(origin: string, handlers: HostEventHandlers): () => void {
  if (typeof EventSource === "undefined") return () => {};
  let es: EventSource | null = null;
  const listen = (fn: (data: Record<string, unknown>) => void) => {
    return (raw: Event) => {
      const e = raw as MessageEvent<string>;
      let data: unknown;
      try {
        data = JSON.parse(e.data || "{}");
      } catch {
        return;
      }
      if (!data || typeof data !== "object") return;
      fn(data as Record<string, unknown>);
    };
  };
  try {
    es = new EventSource(`${origin.replace(/\/$/, "")}/api/events`);
    es.addEventListener(
      "app:open",
      listen((d) => {
        if (typeof d.appId === "string") handlers.onOpen?.(d.appId, typeof d.title === "string" ? d.title : undefined);
      }),
    );
    es.addEventListener(
      "app:reload",
      listen((d) => {
        if (typeof d.appId === "string") handlers.onReload?.(d.appId);
      }),
    );
    es.addEventListener(
      "app:eval",
      listen((d) => {
        if (typeof d.requestId !== "string" || typeof d.appId !== "string") return;
        handlers.onEval?.({
          requestId: d.requestId,
          appId: d.appId,
          code: typeof d.code === "string" ? d.code : "",
          maxBytes: typeof d.maxBytes === "number" ? d.maxBytes : 0,
        });
      }),
    );
    es.addEventListener(
      "app:storage-notice",
      listen((d) => {
        if (typeof d.appId !== "string" || typeof d.table !== "string" || typeof d.prompt !== "string") return;
        const heavyRaw = Array.isArray(d.heavy) ? d.heavy : [];
        const heavy = heavyRaw.flatMap((h) => {
          if (!isRecord(h) || typeof h.key !== "string" || typeof h.bytes !== "number") return [];
          const kind: "list" | "map" | "value" =
            h.kind === "list" || h.kind === "map" || h.kind === "value" ? h.kind : "value";
          return [{
            key: h.key,
            bytes: h.bytes,
            kind,
            entries: typeof h.entries === "number" ? h.entries : undefined,
          }];
        });
        handlers.onStorageNotice?.({
          appId: d.appId,
          table: d.table,
          bytes: typeof d.bytes === "number" ? d.bytes : 0,
          keys: typeof d.keys === "number" ? d.keys : 0,
          heavy,
          prompt: d.prompt,
        });
      }),
    );
  } catch {
    return () => {};
  }
  return () => {
    try {
      es?.close();
    } catch {
      /* ignore */
    }
    es = null;
  };
}

function parseAppTheme(raw: unknown): AppItem["theme"] {
  if (raw === null) return null;
  if (!isRecord(raw)) return undefined;
  const theme = typeof raw.theme === "string" ? raw.theme : "";
  const palette = typeof raw.palette === "string" ? raw.palette : "";
  if (!theme && !palette) return null;
  return { theme, palette };
}

export function parseAbout(raw: unknown): AboutInfo {
  const rec = isRecord(raw) ? raw : {};
  const packages: AboutInfo["packages"] = [];
  if (Array.isArray(rec.packages)) {
    for (const p of rec.packages) {
      if (!isRecord(p) || typeof p.name !== "string" || typeof p.version !== "string") continue;
      packages.push({ name: p.name, version: p.version });
    }
  }
  return {
    adapter: typeof rec.adapter === "string" ? rec.adapter : "host",
    env: typeof rec.env === "string" ? rec.env : "unknown",
    packages,
  };
}

export function parseUpdateCheck(raw: unknown): UpdateCheck {
  const rec = isRecord(raw) ? raw : {};
  return {
    name: typeof rec.name === "string" ? rec.name : "",
    current: typeof rec.current === "string" ? rec.current : "",
    latest: typeof rec.latest === "string" ? rec.latest : null,
    updateAvailable: rec.updateAvailable === true,
    error: typeof rec.error === "string" ? rec.error : undefined,
  };
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
  const rec = isRecord(raw) ? raw : {};
  const list = Array.isArray(rec.commits)
    ? rec.commits
    : Array.isArray(rec.nodes)
      ? rec.nodes
      : [];
  return list.map((c) => asCommit(c)).filter((c): c is Commit => c !== null);
}

export function parseCommitDetail(raw: unknown, id: string): Commit {
  const rec = isRecord(raw) ? raw : {};
  const inner = isRecord(rec.commit) ? rec.commit : rec;
  return asCommit(inner) ?? { id, message: "", time: "", files: [] };
}

export function parseStorageTables(raw: unknown): StorageTable[] {
  const rec = isRecord(raw) ? raw : {};
  const list = Array.isArray(rec.tables) ? rec.tables : [];
  const out: StorageTable[] = [];
  for (const row of list) {
    if (!isRecord(row) || typeof row.name !== "string") continue;
    out.push({
      name: row.name,
      size: typeof row.size === "number" ? row.size : undefined,
      updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : undefined,
      keys: typeof row.keys === "number" ? row.keys : undefined,
    });
  }
  return out;
}

export function parseStorageNotices(raw: unknown, appId: string): StorageNotice[] {
  const rec = isRecord(raw) ? raw : {};
  const list = Array.isArray(rec.notices) ? rec.notices : [];
  const out: StorageNotice[] = [];
  for (const row of list) {
    if (!isRecord(row) || typeof row.table !== "string" || typeof row.prompt !== "string") continue;
    const heavyRaw = Array.isArray(row.heavy) ? row.heavy : [];
    const heavy = heavyRaw.flatMap((h) => {
      if (!isRecord(h) || typeof h.key !== "string" || typeof h.bytes !== "number") return [];
      const kind: "list" | "map" | "value" =
        h.kind === "list" || h.kind === "map" || h.kind === "value" ? h.kind : "value";
      return [{
        key: h.key,
        bytes: h.bytes,
        kind,
        entries: typeof h.entries === "number" ? h.entries : undefined,
      }];
    });
    out.push({
      appId: typeof row.appId === "string" ? row.appId : appId,
      table: row.table,
      bytes: typeof row.bytes === "number" ? row.bytes : 0,
      keys: typeof row.keys === "number" ? row.keys : 0,
      heavy,
      prompt: row.prompt,
    });
  }
  return out;
}

export function parsePalettes(raw: unknown): Palette[] {
  const rec = isRecord(raw) ? raw : {};
  const list = Array.isArray(rec.palettes) ? rec.palettes : [];
  const out: Palette[] = [];
  for (const p of list) {
    if (!isRecord(p) || typeof p.id !== "string") continue;
    if (p.custom === false) continue;
    out.push({
      id: p.id,
      label: typeof p.label === "string" ? p.label : p.id,
      swatch: typeof p.swatch === "string" ? p.swatch : "#888",
      tokens: isRecord(p.tokens) ? (p.tokens as Palette["tokens"]) : undefined,
    });
  }
  return out;
}

/** Build a `PanelHost` that talks to a `packages/host` Hono server over HTTP. */
export function createRestPanelHost(opts: RestOptions): PanelHostIF {
  const storage = opts.storage ?? (typeof window !== "undefined" ? window.localStorage : null);
  function origin(): string {
    return (opts.getHostUrl ? opts.getHostUrl() : opts.hostUrl).replace(/\/$/, "");
  }

  const host: PanelHostIF = {
    locale: opts.locale,
    emptyText: opts.emptyText,
    fetchApps: async () => parseAppsResponse(await readJson(`${origin()}/api/apps`)),
    palettes: async () => {
      try {
        return parsePalettes(await readJson(`${origin()}/api/palettes`));
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
      void fetch(`${origin()}/api/host-config`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ theme, palette }) }).catch(() => {});
    },
    appTheme: {
      save: async (appId, t) => {
        await fetch(`${origin()}/api/apps/${encodeURIComponent(appId)}/theme`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(t) }).catch(() => {});
      },
      clear: async (appId) => {
        await fetch(`${origin()}/api/apps/${encodeURIComponent(appId)}/theme`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reset: true }) }).catch(() => {});
      },
    },
    config: {
      load: async () =>
        hostConfigToForm(await readJson(`${origin()}/api/host-config`), opts.getCardStyle?.() ?? opts.cardStyle ?? "stamp"),
      save: async (cfg) => {
        const body = formToHostConfigBody(cfg);
        const res = await fetch(`${origin()}/api/host-config`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
        const raw: unknown = await res.json().catch(() => ({}));
        if (!res.ok || (isRecord(raw) && raw.ok === false)) {
          throw new Error(isRecord(raw) && typeof raw.error === "string" ? raw.error : `HTTP ${res.status}`);
        }
        // host may report a new port; notify so the shell can migrate.
        const hostPort = isRecord(raw) ? raw.hostPort : undefined;
        if (typeof hostPort === "number" && Number.isInteger(hostPort) && hostPort > 0) {
          const next = `${new URL(origin()).protocol}//${new URL(origin()).hostname}:${hostPort}`;
          if (next !== origin()) opts.onHostChange?.(next);
        }
        opts.onConfigSaved?.(cfg);
      },
    },
    about: {
      load: async () => parseAbout(await readJson(`${origin()}/api/about`)),
      checkUpdates: async () => parseUpdateCheck(await readJson(`${origin()}/api/updates`)),
    },
    history: {
      list: async (appId) => parseCommitList(await readJson(`${origin()}/api/apps/${encodeURIComponent(appId)}/history?limit=50`)),
      detail: async (appId, id) => parseCommitDetail(await readJson(`${origin()}/api/apps/${encodeURIComponent(appId)}/history/${encodeURIComponent(id)}`), id),
    },
    storage: {
      listTables: async (appId) => {
        const raw = await readJson(`${origin()}/api/apps/${encodeURIComponent(appId)}/storage`);
        return {
          tables: parseStorageTables(raw),
          notices: parseStorageNotices(raw, appId),
        };
      },
      readTable: async (appId, name) => {
        const raw = await readJson(`${origin()}/api/apps/${encodeURIComponent(appId)}/storage/${encodeURIComponent(name)}`);
        return isRecord(raw) && "value" in raw ? raw.value : raw;
      },
    },
    deleteApp: opts.deleteApp ?? (async (appId: string) => {
      await fetch(`${origin()}/api/app/${encodeURIComponent(appId)}`, { method: "DELETE" }).catch(() => {});
    }),
    frame: opts.frameController ?? {
      url: (appId) => `${origin()}/app/${encodeURIComponent(appId)}`,
      mount: () => undefined,
      unmount: () => undefined,
      reload: () => undefined,
      syncEnv: () => undefined,
    },
  };
  return host;
}
