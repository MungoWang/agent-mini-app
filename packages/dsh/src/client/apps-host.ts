/** Locator used only when localStorage has no origin yet. Matches host bootstrap seed hostPort. */
export const FALLBACK_HOST_PORT = 17880;

export const APPS_HOST_KEY = "mma-apps-host";

export function appsOrigin(port: number): string {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`invalid host port: ${port}`);
  }
  return `http://127.0.0.1:${port}`;
}

export function appFrameUrl(
  origin: string,
  appId: string,
  query: { theme: string; palette: string; dock: string },
): string {
  const params = new URLSearchParams({
    theme: query.theme,
    palette: query.palette,
    dock: query.dock,
  });
  return `${origin}/app/${encodeURIComponent(appId)}?${params.toString()}`;
}

export function readStoredAppsOrigin(storage: Pick<Storage, "getItem"> | null): string | null {
  if (!storage) return null;
  try {
    const v = storage.getItem(APPS_HOST_KEY);
    return v && /^https?:\/\//.test(v) ? v : null;
  } catch {
    return null;
  }
}

export function writeStoredAppsOrigin(storage: Pick<Storage, "setItem"> | null, origin: string): void {
  if (!storage) return;
  try {
    storage.setItem(APPS_HOST_KEY, origin);
  } catch {
    /* ignore */
  }
}

export function resolveAppsOrigin(explicit?: string, storage?: Pick<Storage, "getItem"> | null): string {
  if (explicit && /^https?:\/\//.test(explicit)) return explicit.replace(/\/$/, "");
  const stored = readStoredAppsOrigin(storage ?? null);
  if (stored) return stored.replace(/\/$/, "");
  return appsOrigin(FALLBACK_HOST_PORT);
}

export function originFromHostPort(port: unknown, current: string): string {
  if (typeof port === "number" && Number.isInteger(port) && port > 0) {
    return appsOrigin(port);
  }
  if (typeof port === "string" && /^\d+$/.test(port)) {
    return appsOrigin(Number(port));
  }
  return current;
}
