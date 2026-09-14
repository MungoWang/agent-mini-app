/**
 * Unified serve/connect transport for {@link AgentCapabilities}.
 * In-proc is identity; http serves/connects the same interface over localhost.
 */
import { randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

import type { AgentEvent, AgentRunOptions } from "./agent-events.ts";
import type { AppCallContext } from "./app-runtime.ts";
import type { AgentCapabilities } from "./capabilities.ts";
import { HostError } from "./errors.ts";
import type { LlmRunOptions } from "./model-call.ts";

export type MaybeAsync<T> = T | Promise<T>;

/** Http endpoint descriptor (in-proc endpoint is the caps object itself). */
export type AgentCapabilitiesHttpEndpoint = {
  url: string;
  token: string;
};

export type AgentCapabilitiesEndpoint = AgentCapabilities | AgentCapabilitiesHttpEndpoint;

export interface AgentCapabilitiesTransport {
  serve(caps: AgentCapabilities): MaybeAsync<AgentCapabilitiesEndpoint>;
  connect(endpoint: AgentCapabilitiesEndpoint): AgentCapabilities;
}

export function isAgentCapabilitiesHttpEndpoint(
  endpoint: AgentCapabilitiesEndpoint,
): endpoint is AgentCapabilitiesHttpEndpoint {
  if (endpoint === null || typeof endpoint !== "object") return false;
  const rec = endpoint as Record<string, unknown>;
  // Http endpoints are plain { url, token }. Caps impls are functions/classes — never both.
  return (
    typeof rec.url === "string" &&
    typeof rec.token === "string" &&
    typeof rec.llm !== "function" &&
    typeof rec.agent !== "function" &&
    typeof rec.bash !== "function"
  );
}

/** In-proc transport: serve/connect are identity (no proxy wrapper). */
export const inprocAgentCapabilitiesTransport: AgentCapabilitiesTransport = {
  serve(caps) {
    return caps;
  },
  connect(endpoint) {
    if (isAgentCapabilitiesHttpEndpoint(endpoint)) {
      throw new HostError(
        "CAPABILITY_TRANSPORT",
        "inproc transport cannot connect an http endpoint",
      );
    }
    return endpoint;
  },
};

export type ServeAgentCapabilitiesOptions = {
  /** Bind host; default 127.0.0.1 */
  host?: string;
  /** Port; default 0 (ephemeral) */
  port?: number;
  /** Shared bearer token; random if omitted */
  token?: string;
};

export type ServedAgentCapabilities = AgentCapabilitiesHttpEndpoint & {
  close(): Promise<void>;
};

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const raw = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
  });
  res.end(raw);
}

function unauthorized(res: ServerResponse): void {
  sendJson(res, 401, { ok: false, error: "unauthorized" });
}

function checkToken(req: IncomingMessage, token: string): boolean {
  const h = req.headers.authorization;
  if (typeof h === "string" && h === `Bearer ${token}`) return true;
  const q = new URL(req.url ?? "/", "http://127.0.0.1").searchParams.get("token");
  return q === token;
}

function stubCtx(app?: { appId?: string; appDir?: string }): AppCallContext {
  return {
    appId: (app?.appId as AppCallContext["appId"]) ?? ("_cap" as AppCallContext["appId"]),
    appDir: app?.appDir ?? "",
    signal: undefined,
  } as AppCallContext;
}

/**
 * Publish `caps` on localhost HTTP under `/v1/caps/*` (public methods) + `/v1/caps/_streaming/cancel` (transport-internal abort) + `/health`.
 * Returns endpoint + close — this is the http `serve` implementation.
 */
export async function serveAgentCapabilities(
  caps: AgentCapabilities,
  options: ServeAgentCapabilitiesOptions = {},
): Promise<ServedAgentCapabilities> {
  const token = options.token ?? randomBytes(16).toString("hex");
  const host = options.host ?? "127.0.0.1";
  const runs = new Map<string, AbortController>();

  const server: Server = createServer(async (req, res) => {
    try {
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,OPTIONS",
          "access-control-allow-headers": "content-type,authorization",
        });
        res.end();
        return;
      }
      const url = new URL(req.url ?? "/", `http://${host}`);
      if (url.pathname === "/health" && req.method === "GET") {
        sendJson(res, 200, { ok: true });
        return;
      }
      if (!checkToken(req, token)) {
        unauthorized(res);
        return;
      }
      if (url.pathname === "/v1/caps/_streaming/cancel" && req.method === "POST") {
        const raw = await readBody(req);
        const body = raw ? (JSON.parse(raw) as { runId?: string }) : {};
        const ac = body.runId ? runs.get(body.runId) : undefined;
        ac?.abort();
        if (body.runId) runs.delete(body.runId);
        sendJson(res, 200, { ok: true });
        return;
      }
      if (url.pathname === "/v1/caps/llm" && req.method === "POST") {
        if (!caps.llm) {
          sendJson(res, 501, { ok: false, error: "llm unavailable" });
          return;
        }
        const body = JSON.parse(await readBody(req)) as {
          runId?: string;
          prompt?: string;
          opts?: LlmRunOptions;
          app?: { appId?: string; appDir?: string };
        };
        if (typeof body.prompt !== "string") {
          sendJson(res, 400, { ok: false, error: "prompt required" });
          return;
        }
        const runId = typeof body.runId === "string" ? body.runId : randomBytes(8).toString("hex");
        const ac = new AbortController();
        runs.set(runId, ac);
        try {
          const opts = { ...body.opts, signal: ac.signal };
          const text = await caps.llm(stubCtx(body.app), body.prompt, opts);
          sendJson(res, 200, { text });
        } finally {
          runs.delete(runId);
        }
        return;
      }
      if (url.pathname === "/v1/caps/agent" && req.method === "POST") {
        if (!caps.agent) {
          sendJson(res, 501, { ok: false, error: "agent unavailable" });
          return;
        }
        const body = JSON.parse(await readBody(req)) as {
          runId?: string;
          goal?: string;
          opts?: AgentRunOptions;
          app?: { appId?: string; appDir?: string };
        };
        if (typeof body.goal !== "string") {
          sendJson(res, 400, { ok: false, error: "goal required" });
          return;
        }
        const runId = typeof body.runId === "string" ? body.runId : randomBytes(8).toString("hex");
        const ac = new AbortController();
        runs.set(runId, ac);
        res.writeHead(200, {
          "content-type": "text/event-stream; charset=utf-8",
          "cache-control": "no-cache",
          connection: "keep-alive",
          "access-control-allow-origin": "*",
        });
        const writeEvent = (event: AgentEvent) => {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        };
        const userOnEvent = body.opts?.onEvent;
        try {
          const text = await caps.agent(stubCtx(body.app), body.goal, {
            ...body.opts,
            signal: ac.signal,
            onEvent: (event) => {
              try {
                userOnEvent?.(event);
              } catch {
                /* ignore */
              }
              writeEvent(event);
            },
          });
          writeEvent({ type: "done", text });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          writeEvent({ type: "error", message });
          writeEvent({ type: "done", text: "" });
        } finally {
          runs.delete(runId);
          res.end();
        }
        return;
      }
      if (url.pathname === "/v1/caps/tool" && req.method === "POST") {
        if (!caps.tool) {
          sendJson(res, 501, { ok: false, error: "tool unavailable" });
          return;
        }
        const body = JSON.parse(await readBody(req)) as {
          name?: string;
          args?: Record<string, unknown>;
          app?: { appId?: string; appDir?: string };
        };
        if (typeof body.name !== "string" || !body.name) {
          sendJson(res, 400, { ok: false, error: "name required" });
          return;
        }
        const result = await caps.tool(stubCtx(body.app), body.name, body.args);
        sendJson(res, 200, { result });
        return;
      }
      if (url.pathname === "/v1/caps/mcp" && req.method === "POST") {
        if (!caps.mcp) {
          sendJson(res, 501, { ok: false, error: "mcp unavailable" });
          return;
        }
        const body = JSON.parse(await readBody(req)) as {
          name?: string;
          args?: Record<string, unknown>;
          app?: { appId?: string; appDir?: string };
        };
        if (typeof body.name !== "string" || !body.name) {
          sendJson(res, 400, { ok: false, error: "name required" });
          return;
        }
        const result = await caps.mcp(stubCtx(body.app), body.name, body.args);
        sendJson(res, 200, { result });
        return;
      }
      // listTools / credentials are sync on AgentCapabilities. Over http they are
      // still the same methods — exposed here so connect() can hydrate snapshots.
      if (url.pathname === "/v1/caps/list-tools" && req.method === "GET") {
        const tools = caps.listTools ? caps.listTools(stubCtx()) : [];
        sendJson(res, 200, { tools });
        return;
      }
      sendJson(res, 404, { ok: false, error: "not_found" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!res.headersSent) sendJson(res, 500, { ok: false, error: message });
      else res.end();
    }
  });

  const port = await new Promise<number>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? 0, host, () => {
      const addr = server.address();
      if (addr && typeof addr === "object") resolve(addr.port);
      else reject(new Error("serveAgentCapabilities: no bound port"));
    });
  });

  return {
    url: `http://${host}:${port}`,
    token,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

function parseSseChunk(buf: string): { events: AgentEvent[]; rest: string } {
  const events: AgentEvent[] = [];
  const parts = buf.split("\n\n");
  const rest = parts.pop() ?? "";
  for (const block of parts) {
    for (const line of block.split("\n")) {
      if (!line.startsWith("data:")) continue;
      const raw = line.slice(5).trim();
      if (!raw) continue;
      try {
        events.push(JSON.parse(raw) as AgentEvent);
      } catch {
        /* skip */
      }
    }
  }
  return { events, rest };
}

/**
 * Http `connect`: returns an {@link AgentCapabilities} proxy.
 * Paths like `/v1/caps/tool` are only the wire encoding of `caps.tool` — not a separate API.
 */
export function connectAgentCapabilities(
  endpoint: AgentCapabilitiesHttpEndpoint,
  opts?: { listTools?: unknown[] },
): AgentCapabilities {
  const base = endpoint.url.replace(/\/$/, "");
  const headers = {
    "content-type": "application/json",
    authorization: `Bearer ${endpoint.token}`,
  };
  const listToolsSnapshot = opts?.listTools ?? [];

  return {
    async llm(ctx, prompt, opts) {
      const runId = randomBytes(8).toString("hex");
      const onAbort = () => {
        void fetch(`${base}/v1/caps/_streaming/cancel`, {
          method: "POST",
          headers,
          body: JSON.stringify({ runId }),
        }).catch(() => {});
      };
      opts?.signal?.addEventListener("abort", onAbort, { once: true });
      try {
        const res = await fetch(`${base}/v1/caps/llm`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            runId,
            prompt,
            opts: {
              provider: opts?.provider,
              model: opts?.model,
              system: opts?.system,
              schema: opts?.schema,
              maxTokens: opts?.maxTokens,
              retryTimes: opts?.retryTimes,
            },
            app: { appId: ctx.appId, appDir: ctx.appDir },
          }),
          signal: opts?.signal,
        });
        const body = (await res.json()) as { text?: string; error?: string };
        if (!res.ok) {
          throw new HostError("CAPABILITY_UNAVAILABLE", body.error ?? `llm http ${res.status}`);
        }
        return body.text ?? "";
      } finally {
        opts?.signal?.removeEventListener("abort", onAbort);
      }
    },
    async agent(ctx, goal, opts) {
      const runId = randomBytes(8).toString("hex");
      const onAbort = () => {
        void fetch(`${base}/v1/caps/_streaming/cancel`, {
          method: "POST",
          headers,
          body: JSON.stringify({ runId }),
        }).catch(() => {});
      };
      opts?.signal?.addEventListener("abort", onAbort, { once: true });
      try {
        const res = await fetch(`${base}/v1/caps/agent`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            runId,
            goal,
            opts: {
              provider: opts?.provider,
              model: opts?.model,
              system: opts?.system,
              schema: opts?.schema,
              maxTokens: opts?.maxTokens,
              retryTimes: opts?.retryTimes,
              maxIterations: opts?.maxIterations,
              cwdType: opts?.cwdType,
              cwd: opts?.cwd,
            },
            app: { appId: ctx.appId, appDir: ctx.appDir },
          }),
          signal: opts?.signal,
        });
        if (!res.ok || !res.body) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new HostError("CAPABILITY_UNAVAILABLE", body.error ?? `agent http ${res.status}`);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let final = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const parsed = parseSseChunk(buf);
          buf = parsed.rest;
          for (const event of parsed.events) {
            try {
              opts?.onEvent?.(event);
            } catch {
              /* ignore */
            }
            if (event.type === "done") final = event.text;
            if (event.type === "error" && !final) {
              throw new HostError("CAPABILITY_UNAVAILABLE", event.message);
            }
          }
        }
        return final;
      } finally {
        opts?.signal?.removeEventListener("abort", onAbort);
      }
    },
    async tool(ctx, name, args) {
      const res = await fetch(`${base}/v1/caps/tool`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          name,
          args: args ?? {},
          app: { appId: ctx.appId, appDir: ctx.appDir },
        }),
      });
      const body = (await res.json()) as { result?: unknown; error?: string };
      if (!res.ok) {
        throw new HostError("CAPABILITY_UNAVAILABLE", body.error ?? `tool http ${res.status}`);
      }
      return body.result;
    },
    async mcp(ctx, name, args) {
      const res = await fetch(`${base}/v1/caps/mcp`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          name,
          args: args ?? {},
          app: { appId: ctx.appId, appDir: ctx.appDir },
        }),
      });
      const body = (await res.json()) as { result?: unknown; error?: string };
      if (!res.ok) {
        throw new HostError("CAPABILITY_UNAVAILABLE", body.error ?? `mcp http ${res.status}`);
      }
      return body.result;
    },
    // Still AgentCapabilities methods. listTools is sync in the interface; http
    // transport may pass a snapshot via connect opts (Shell loads it before createHost).
    // credentials: empty — Host already defaults to {} when absent; no separate store.
    listTools: () => listToolsSnapshot,
    credentials: () => ({}),
  };
}

/** Load listTools snapshot then connect — still one AgentCapabilities, not a new port. */
export async function connectAgentCapabilitiesAsync(
  endpoint: AgentCapabilitiesHttpEndpoint,
): Promise<AgentCapabilities> {
  const base = endpoint.url.replace(/\/$/, "");
  let listTools: unknown[] = [];
  try {
    const res = await fetch(`${base}/v1/caps/list-tools`, {
      headers: { authorization: `Bearer ${endpoint.token}` },
    });
    if (res.ok) {
      const body = (await res.json()) as { tools?: unknown[] };
      listTools = body.tools ?? [];
    }
  } catch {
    /* leave empty */
  }
  return connectAgentCapabilities(endpoint, { listTools });
}

export const httpAgentCapabilitiesTransport: AgentCapabilitiesTransport = {
  async serve(caps) {
    const served = await serveAgentCapabilities(caps);
    return { url: served.url, token: served.token };
  },
  connect(endpoint) {
    if (!isAgentCapabilitiesHttpEndpoint(endpoint)) {
      throw new HostError(
        "CAPABILITY_TRANSPORT",
        "http transport cannot connect an in-proc endpoint",
      );
    }
    return connectAgentCapabilities(endpoint);
  },
};
