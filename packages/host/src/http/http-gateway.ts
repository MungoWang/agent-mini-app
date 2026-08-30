import fs from "node:fs";
import { createServer, type Server } from "node:http";
import { createServer as createNetServer } from "node:net";
import path from "node:path";

import { getRequestListener } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { readAppTheme, writeAppTheme } from "../apps/app-theme.ts";
import type { AppItem, AppsManager } from "../apps/apps-manager.ts";
import { listStorageTables, readJsonFile, storageTablePath } from "../apps/storage.ts";
import { asAppId } from "../brand.ts";
import type { AppCssCompiler } from "../compile/app-css.ts";
import { resolveUiDistDir, type UiBuildFile, type UiCompiler } from "../compile/ui-compiler.ts";
import { writeHostConfig } from "../config/write.ts";
import { HostError } from "../errors.ts";
import { formatSse, type HostEventBus } from "../events/host-events.ts";
import type { GitHistory } from "../git/git-history.ts";
import { WorkspacePaths } from "../paths/workspace-paths.ts";
import { EMPTY_THEME_RESOURCE, type ThemeResource } from "../theme-resource.ts";
import { type HostConfig, LOCALE_IDS, type LocaleId, THEME_IDS, type ThemeId } from "../types.ts";
import { appRunnerHtml } from "./app-runner-html.ts";

/** Resolve a @fontsource-variable/geist font file (walk up from the ui dist). */
function geistFontPath(name: string): string {
  for (let dir = resolveUiDistDir(); dir !== path.dirname(dir); dir = path.dirname(dir)) {
    const fp = path.join(dir, "..", "..", "node_modules", "@fontsource-variable", "geist", "files", name);
    const p = path.resolve(fp);
    if (fs.existsSync(p)) return p;
  }
  return path.join(resolveUiDistDir(), "..", "..", "node_modules", "@fontsource-variable", "geist", "files", name);
}

function listenHttp(server: Server, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const onError = (err: Error) => {
      server.off("listening", onListening);
      reject(err);
    };
    const onListening = () => {
      server.off("error", onError);
      const addr = server.address();
      resolve(typeof addr === "object" && addr ? addr.port : port);
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, "127.0.0.1");
  });
}

function closeHttp(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function publicHostConfig(config: HostConfig, hostPort: number): Record<string, unknown> {
  return {
    theme: config.theme,
    palette: config.palette,
    locale: config.locale,
    chatLanguage: config.chatLanguage,
    hostPort,
    llm: config.llm,
  };
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function probePort(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const probe = createNetServer();
    const onError = (err: Error) => {
      probe.off("listening", onListening);
      reject(err);
    };
    const onListening = () => {
      probe.off("error", onError);
      probe.close((err) => (err ? reject(err) : resolve()));
    };
    probe.once("error", onError);
    probe.once("listening", onListening);
    probe.listen(port, "127.0.0.1");
  });
}

function mergeHostConfigPatch(cur: HostConfig, body: Record<string, unknown>): HostConfig {
  const theme =
    typeof body.theme === "string" && (THEME_IDS as readonly string[]).includes(body.theme)
      ? (body.theme as ThemeId)
      : cur.theme;
  const palette =
    typeof body.palette === "string" && body.palette.trim().length > 0
      ? body.palette.trim()
      : cur.palette;
  const locale =
    typeof body.locale === "string" && (LOCALE_IDS as readonly string[]).includes(body.locale)
      ? (body.locale as LocaleId)
      : cur.locale;
  const chatLanguage =
    typeof body.chatLanguage === "string" &&
    (LOCALE_IDS as readonly string[]).includes(body.chatLanguage)
      ? (body.chatLanguage as LocaleId)
      : cur.chatLanguage;
  let hostPort = cur.hostPort;
  if (body.hostPort !== undefined) {
    const n = Number(body.hostPort);
    if (!Number.isInteger(n) || n < 0 || n > 65535) {
      throw new HostError("INVALID_HOST_CONFIG", "hostPort must be an integer 0–65535");
    }
    hostPort = n;
  }
  let llm = cur.llm;
  if (body.llm === null) {
    llm = null;
  } else if (isRecord(body.llm)) {
    const provider = body.llm.provider;
    const model = body.llm.model;
    if (typeof provider !== "string" || !provider.trim() || typeof model !== "string" || !model.trim()) {
      throw new HostError("INVALID_HOST_CONFIG", "llm requires non-empty provider and model");
    }
    llm = { provider: provider.trim(), model: model.trim() };
  }
  return {
    runtimeRoot: cur.runtimeRoot,
    hostPort,
    theme,
    palette,
    locale,
    chatLanguage,
    llm,
  };
}

/** Localhost HTTP surface. Calls AppsManager / UiCompiler — never ToolFacade. */
export class HttpGateway {
  readonly app: Hono;
  private server: Server | null = null;
  private boundPort = 0;

  constructor(
    private readonly apps: AppsManager,
    private readonly config: HostConfig,
    private readonly paths: WorkspacePaths,
    private readonly compiler: UiCompiler,
    private readonly css: AppCssCompiler,
    private readonly git: GitHistory,
    private readonly themes: ThemeResource = EMPTY_THEME_RESOURCE,
    private readonly events?: HostEventBus,
    private readonly onHostPortChanged?: (port: number) => void,
  ) {
    this.app = this.buildApp();
  }

  get port(): number {
    return this.boundPort;
  }

  async listen(port: number): Promise<number> {
    if (this.server) {
      return this.boundPort;
    }
    const listener = getRequestListener((request, env) => this.app.fetch(request, env));
    const server = createServer(listener);
    try {
      this.boundPort = await listenHttp(server, port);
      this.server = server;
    } catch (cause) {
      server.close();
      throw new HostError("HOST_LISTEN_FAILED", `failed to listen on ${port}`, { cause });
    }
    return this.boundPort;
  }

  async close(): Promise<void> {
    const server = this.server;
    this.server = null;
    this.boundPort = 0;
    if (server) {
      await closeHttp(server);
    }
  }

  private buildApp(): Hono {
    const app = new Hono();
    app.use(
      "*",
      cors({
        origin: "*",
        allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
        allowHeaders: ["content-type"],
      }),
    );
    app.onError((err, c) => {
      if (err instanceof HostError) {
        return c.json({ ok: false, error: err.message, code: err.code }, 400);
      }
      return c.json({ error: errorMessage(err) }, 500);
    });
    app.notFound((c) => c.json({ error: "not_found" }, 404));

    app.get("/health", (c) => c.json({ ok: true, hostPort: this.boundPort }));

    app.get("/api/events", (c) => {
      const bus = this.events;
      if (!bus) {
        return c.text("events bus unavailable", 503);
      }
      const signal = c.req.raw.signal;
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const enc = new TextEncoder();
          controller.enqueue(enc.encode("retry: 3000\n\n"));
          const unsub = bus.subscribe((event) => {
            try {
              controller.enqueue(enc.encode(formatSse(event, bus.nextId())));
            } catch {
              unsub();
            }
          });
          const onAbort = () => {
            unsub();
            try {
              controller.close();
            } catch {
              /* already closed */
            }
          };
          if (signal.aborted) {
            onAbort();
            return;
          }
          signal.addEventListener("abort", onAbort, { once: true });
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    });

    app.get("/api/host-config", (c) =>
      c.json({ ok: true, ...publicHostConfig(this.config, this.boundPort) }),
    );

    app.post("/api/host-config", async (c) => {
      let body: unknown;
      try {
        body = await c.req.json();
      } catch {
        return c.json({ ok: false, error: "invalid json" }, 400);
      }
      if (!isRecord(body)) {
        return c.json({ ok: false, error: "invalid json" }, 400);
      }

      let next: HostConfig;
      try {
        next = mergeHostConfigPatch(this.config, body);
      } catch (cause) {
        if (cause instanceof HostError) {
          return c.json({ ok: false, error: cause.message, code: cause.code }, 400);
        }
        throw cause;
      }

      const portChanged = next.hostPort !== this.boundPort && next.hostPort !== 0;
      if (portChanged) {
        try {
          await probePort(next.hostPort);
        } catch (cause) {
          return c.json(
            {
              ok: false,
              error: `port in use or bind failed: ${errorMessage(cause)}`,
              hostPort: this.boundPort,
              ...publicHostConfig(this.config, this.boundPort),
            },
            409,
          );
        }
      }

      Object.assign(this.config, next);
      writeHostConfig(this.paths, this.config);

      const responsePort = portChanged ? next.hostPort : this.boundPort;
      if (portChanged) {
        const target = next.hostPort;
        setImmediate(() => {
          void (async () => {
            try {
              await this.close();
              await this.listen(target);
              this.onHostPortChanged?.(this.boundPort);
            } catch (cause) {
              console.warn("[monkey-mini-app] rebound failed", cause);
            }
          })();
        });
      }

      return c.json({ ok: true, ...publicHostConfig(this.config, responsePort) });
    });

    app.get("/api/apps", async (c) => {
      const apps = await this.apps.list();
      return c.json({ apps });
    });

    /** Custom palettes only; builtins live in panel. */
    app.get("/api/palettes", async (c) => {
      const palettes = (await this.themes.listCustomPalettes?.()) ?? [];
      return c.json({ palettes });
    });

    app.post("/api/call", async (c) => {
      let body: unknown;
      try {
        body = await c.req.json();
      } catch {
        return c.json({ ok: false, error: "invalid json" }, 400);
      }
      if (!isRecord(body)) {
        return c.json({ ok: false, error: "invalid json" }, 400);
      }
      const appId = typeof body.appId === "string" ? body.appId : "";
      const method = typeof body.method === "string" ? body.method : "";
      if (!appId || !method) {
        return c.json({ ok: false, error: "missing appId or method" }, 400);
      }
      try {
        const value = await this.apps.call(appId, method, body.args, c.req.raw.signal);
        return c.json({ ok: true, value });
      } catch (cause) {
        return c.json({ ok: false, error: errorMessage(cause) }, 400);
      }
    });

    app.get("/api/apps/:appId/history", async (c) => {
      const appId = asAppId(c.req.param("appId"));
      const dir = this.apps.dirOf(appId);
      const limitRaw = Number(c.req.query("limit"));
      const limit = Math.min(Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 50, 200);
      const list = await this.git.log(dir, limit);
      const commits = await Promise.all(
        list.map(async (entry) => ({
          ...entry,
          files: await this.git.fileStats(dir, entry.id),
        })),
      );
      return c.json({ ok: true, commits });
    });

    app.get("/api/apps/:appId/history/:commitId", async (c) => {
      const appId = asAppId(c.req.param("appId"));
      const commitId = c.req.param("commitId");
      const dir = this.apps.dirOf(appId);
      const stats = await this.git.fileStats(dir, commitId);
      const log = await this.git.log(dir, 200);
      const meta = log.find((entry) => entry.id === commitId || entry.id.startsWith(commitId));
      const files = await Promise.all(
        stats.map(async (s) => ({
          ...s,
          preview: await this.git.filePreview(dir, commitId, s.path),
        })),
      );
      return c.json({
        ok: true,
        commit: {
          id: meta?.id || commitId,
          time: meta?.time || "",
          message: meta?.message || "",
          files,
        },
      });
    });

    app.get("/api/apps/:appId/storage", (c) => {
      const appId = asAppId(c.req.param("appId"));
      const dir = path.join(this.apps.dirOf(appId), WorkspacePaths.Rel.storage);
      return c.json({ ok: true, tables: listStorageTables(dir) });
    });

    app.get("/api/apps/:appId/storage/:table", (c) => {
      const appId = asAppId(c.req.param("appId"));
      const table = c.req.param("table");
      const dir = path.join(this.apps.dirOf(appId), WorkspacePaths.Rel.storage);
      const fp = storageTablePath(dir, table);
      return c.json({ ok: true, table, value: readJsonFile(fp, null) });
    });

    app.get("/api/apps/:appId/theme", (c) => {
      const appId = asAppId(c.req.param("appId"));
      const dir = this.apps.dirOf(appId);
      return c.json({ ok: true, appId, theme: readAppTheme(dir) });
    });

    app.post("/api/apps/:appId/theme", async (c) => {
      const appId = asAppId(c.req.param("appId"));
      const dir = this.apps.dirOf(appId);
      let body: unknown = {};
      try {
        body = await c.req.json();
      } catch {
        /* empty body ok */
      }
      const rec = isRecord(body) ? body : {};
      const saved = rec.reset
        ? writeAppTheme(dir, null)
        : writeAppTheme(dir, {
            theme: String(rec.theme || "light"),
            palette: String(rec.palette || "default"),
          });
      return c.json({ ok: true, appId, theme: saved });
    });

    app.delete("/api/app/:appId", async (c) => {
      const appId = asAppId(c.req.param("appId"));
      await this.apps.remove(appId);
      return c.json({ ok: true });
    });

    // 首页索引：列出已安装的 mini-app，方便逐个打开（裸 host 也有一张入口页）
    app.get("/", async (c) => {
      let items: AppItem[] = [];
      try {
        items = await this.apps.list();
      } catch {
        items = [];
      }
      const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] as string));
      const cards = items
        .map((a) => `<a class="card" href="/app/${encodeURIComponent(a.id)}">
          <div class="mono">${esc(a.acronym || a.name.slice(0, 2).toUpperCase())}</div>
          <div>
            <div class="name">${esc(a.name)}</div>
            <div class="desc">${esc(a.description || a.id)}</div>
            <div class="meta">${esc(a.id)} · ${a.commits} commits</div>
          </div>
        </a>`)
        .join("\n");
      const html = `<!doctype html>
<html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(this.config.theme ?? "monkey-mini-app")} · 小程序</title>
<link rel="stylesheet" href="/ui.css"/>
<style>
  html,body{margin:0;height:100%;background:var(--background,#fff);color:var(--foreground,#111);font-family:var(--font-sans,ui-sans-serif,system-ui,sans-serif);}
  body{padding:40px;}
  h1{font-size:1.5rem;margin:0 0 4px;}
  .sub{color:var(--muted-foreground,#666);margin:0 0 24px;font-size:.9rem;}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;max-width:1100px;}
  .card{display:flex;gap:14px;padding:16px;border:1px solid var(--border,#e2e2e2);border-radius:14px;text-decoration:none;color:inherit;background:var(--card,#fff);transition:border-color .15s, transform .15s;}
  .card:hover{border-color:var(--primary,#2563eb);transform:translateY(-2px);}
  .mono{width:48px;height:48px;border-radius:12px;background:var(--muted,#f2f2f2);display:flex;align-items:center;justify-content:center;font-weight:600;color:var(--primary,#2563eb);flex-shrink:0;}
  .name{font-weight:600;font-size:1rem;}
  .desc{color:var(--muted-foreground,#666);font-size:.85rem;margin-top:2px;}
  .meta{color:var(--muted-foreground,#999);font-size:.72rem;margin-top:8px;font-family:monospace;}
</style>
</head><body>
<h1>小程序</h1>
<p class="sub">共 ${items.length} 个 · 点开进入</p>
<div class="grid">${cards}</div>
</body></html>`;
      return c.html(html);
    });

    app.get("/ui.css", (c) => {
      try {
        const css = fs.readFileSync(path.join(resolveUiDistDir(), "globals.css"), "utf8");
        return c.body(css, 200, { "Content-Type": "text/css; charset=utf-8" });
      } catch (cause) {
        return c.text(`ui.css missing: ${errorMessage(cause)}`, 500);
      }
    });

    // Geist 字体（@fontsource-variable/geist）由 winocss @font-face url 引用，host 在这里直接吐文件
    app.get("/files/:name", (c) => {
      const name = path.basename(c.req.param("name") || "");
      try {
        const p = geistFontPath(name);
        const buf = fs.readFileSync(p);
        const ext = path.extname(name).toLowerCase();
        return c.body(buf, 200, { "Content-Type": ext === ".woff2" ? "font/woff2" : "application/octet-stream" });
      } catch (cause) {
        return c.text(`font missing: ${errorMessage(cause)}`, 404);
      }
    });

    app.get("/api/app/:appId/ui.css", async (c) => {
      const appId = c.req.param("appId");
      const dir = this.apps.dirOf(asAppId(appId));
      try {
        const css = await this.css.compile(dir);
        return c.body(css, 200, { "Content-Type": "text/css; charset=utf-8" });
      } catch (cause) {
        // Fall back to the shared stylesheet so the app still renders.
        try {
          const css = fs.readFileSync(path.join(resolveUiDistDir(), "globals.css"), "utf8");
          return c.body(css, 200, { "Content-Type": "text/css; charset=utf-8" });
        } catch {
          return c.text(`app ui.css failed: ${errorMessage(cause)}`, 500);
        }
      }
    });

    app.get("/api/app/:appId/ui/:name", async (c) => {
      const appId = c.req.param("appId");
      const name = path.basename(c.req.param("name") || "");
      if (!name.endsWith(".js")) {
        return c.json({ error: `bundle file missing: ${name}` }, 404);
      }
      let files: UiBuildFile[];
      try {
        files = await this.compiler.compile(this.apps.dirOf(appId), {
          locale: this.config.locale,
        });
      } catch (cause) {
        const status = cause instanceof HostError ? 400 : 500;
        return c.json({ error: errorMessage(cause) }, status);
      }
      const file = files.find((f) => f.name === name);
      if (!file) {
        return c.json({ error: `bundle file missing: ${name}` }, 404);
      }
      return c.body(Buffer.from(file.contents).toString("utf8"), 200, {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "no-cache",
      });
    });

    app.get("/app/:appId", (c) => {
      const html = appRunnerHtml(c.req.param("appId"), this.themes.runnerCss());
      return c.html(html);
    });

    return app;
  }
}
