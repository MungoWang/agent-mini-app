import { HostError } from "../errors.ts";

export type HttpRequest = {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  timeout?: number;
  signal?: AbortSignal;
};

export type HttpResponse = {
  ok: boolean;
  status: number;
  headers: Record<string, string>;
  text: string;
  json: unknown | null;
};

export const HTTP_DEFAULT_TIMEOUT_MS = 8_000;
export const HTTP_MAX_BYTES = 8 * 1024 * 1024;

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function withQuery(url: string, query?: HttpRequest["query"]): string {
  if (!query) {
    return url;
  }
  const u = new URL(url);
  for (const [key, value] of Object.entries(query)) {
    if (value == null) continue;
    u.searchParams.set(key, String(value));
  }
  return u.toString();
}

function encodeBody(
  body: unknown,
  headers: Headers,
): { body: string | undefined; headers: Headers } {
  if (body == null) {
    return { body: undefined, headers };
  }
  if (typeof body === "string") {
    return { body, headers };
  }
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return { body: JSON.stringify(body), headers };
}

function headersToObject(h: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  h.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

function parseJson(contentType: string, text: string): unknown | null {
  if (!/json/i.test(contentType)) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/** App-ctx HTTP helper (not the host Hono gateway). */
export async function httpRequest(
  urlOrReq: string | HttpRequest,
  opts?: Omit<HttpRequest, "url">,
): Promise<HttpResponse> {
  const req: HttpRequest =
    typeof urlOrReq === "string" ? { url: urlOrReq, ...opts } : { ...urlOrReq };
  const rawUrl = req.url.trim();
  if (!rawUrl) {
    throw new HostError("HTTP_INVALID_URL", "http: url required");
  }

  let url: URL;
  try {
    url = new URL(withQuery(rawUrl, req.query));
  } catch (cause) {
    throw new HostError("HTTP_INVALID_URL", "http: invalid url", { cause });
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new HostError("HTTP_INVALID_URL", "http: only http/https");
  }

  const method = (req.method ?? "GET").toUpperCase();
  const headers = new Headers(req.headers ?? {});
  if (!headers.has("user-agent")) {
    headers.set("user-agent", "monkey-mini-app/0.1");
  }
  const encoded =
    method === "GET" || method === "HEAD"
      ? { body: undefined, headers }
      : encodeBody(req.body, headers);
  const timeout = Number(req.timeout);
  const ms =
    Number.isFinite(timeout) && timeout > 0 ? Math.min(timeout, 120_000) : HTTP_DEFAULT_TIMEOUT_MS;

  const sig = req.signal;
  if (sig?.aborted) {
    throw new HostError("CANCELLED", "cancelled");
  }
  let res: Response;
  try {
    const timeoutSignal = AbortSignal.timeout(ms);
    const signal = sig ? AbortSignal.any([sig, timeoutSignal]) : timeoutSignal;
    res = await fetch(url, {
      method,
      headers: encoded.headers,
      body: encoded.body,
      redirect: "follow",
      signal,
    });
  } catch (cause) {
    if (sig?.aborted) {
      throw new HostError("CANCELLED", "cancelled", { cause });
    }
    const msg = errText(cause);
    if (/aborted|timeout/i.test(msg)) {
      throw new HostError("HTTP_TIMEOUT", "http: timeout", { cause });
    }
    throw new HostError("HTTP_FAILED", `http: ${msg}`, { cause });
  }

  const contentLength = Number(res.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > HTTP_MAX_BYTES) {
    throw new HostError("HTTP_TOO_LARGE", "http: response too large");
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > HTTP_MAX_BYTES) {
    throw new HostError("HTTP_TOO_LARGE", "http: response too large");
  }
  const text = buf.toString("utf8");
  const headerObj = headersToObject(res.headers);
  return {
    ok: res.ok,
    status: res.status,
    headers: headerObj,
    text,
    json: parseJson(headerObj["content-type"] ?? "", text),
  };
}
