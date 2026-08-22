import path from "node:path";
import type { HostPort } from "@monkey-mini-app/host-port";

export type StorageConfig = {
  directory: string;
  defaultFile: string;
};

function safeStoreFile(
  appId: string,
  storageDir: string,
  file?: string
): string {
  let name = file?.trim() || "default.json";
  if (!name.endsWith(".json")) name = `${name}.json`;
  if (
    name.includes("..") ||
    name.includes("/") ||
    name.includes("\\") ||
    name === ".json"
  ) {
    throw Object.assign(new Error("INVALID_PAYLOAD"), {
      code: "INVALID_PAYLOAD",
    });
  }
  return path.join("apps", appId, storageDir, name);
}

async function readJsonObject(
  host: HostPort,
  relPath: string
): Promise<Record<string, unknown>> {
  if (!(await host.exists(relPath))) return {};
  const raw = await host.readFile(relPath);
  const text =
    typeof raw === "string" ? raw : new TextDecoder().decode(raw);
  if (!text.trim()) return {};
  const parsed = JSON.parse(text) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw Object.assign(new Error("INVALID_STORAGE_JSON"), {
      code: "INTERNAL",
    });
  }
  return parsed as Record<string, unknown>;
}

async function writeJsonObject(
  host: HostPort,
  relPath: string,
  obj: Record<string, unknown>
): Promise<void> {
  const body = JSON.stringify(obj, null, 2);
  await host.writeFile(relPath, body);
}

const queues = new Map<string, Promise<unknown>>();

function enqueue<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = queues.get(key) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  queues.set(
    key,
    next.then(
      () => undefined,
      () => undefined
    )
  );
  return next;
}

export function createStorageHandlers(
  host: HostPort,
  config: StorageConfig
) {
  return {
    async get(appId: string, payload: { key: string; file?: string }) {
      const rel = safeStoreFile(appId, config.directory, payload.file);
      return enqueue(`${appId}:${rel}`, async () => {
        const obj = await readJsonObject(host, rel);
        const value = Object.prototype.hasOwnProperty.call(obj, payload.key)
          ? obj[payload.key]
          : null;
        return { value };
      });
    },
    async set(
      appId: string,
      payload: { key: string; value: unknown; file?: string }
    ) {
      const rel = safeStoreFile(appId, config.directory, payload.file);
      return enqueue(`${appId}:${rel}`, async () => {
        const obj = await readJsonObject(host, rel);
        obj[payload.key] = payload.value;
        await writeJsonObject(host, rel, obj);
        return { ok: true as const };
      });
    },
    async delete(appId: string, payload: { key: string; file?: string }) {
      const rel = safeStoreFile(appId, config.directory, payload.file);
      return enqueue(`${appId}:${rel}`, async () => {
        const obj = await readJsonObject(host, rel);
        delete obj[payload.key];
        await writeJsonObject(host, rel, obj);
        return { ok: true as const };
      });
    },
    async keys(appId: string, payload: { file?: string }) {
      const rel = safeStoreFile(appId, config.directory, payload.file);
      return enqueue(`${appId}:${rel}`, async () => {
        const obj = await readJsonObject(host, rel);
        return { keys: Object.keys(obj) };
      });
    },
    async clear(appId: string, payload: { file?: string }) {
      const rel = safeStoreFile(appId, config.directory, payload.file);
      return enqueue(`${appId}:${rel}`, async () => {
        await writeJsonObject(host, rel, {});
        return { ok: true as const };
      });
    },
    async listFiles(appId: string) {
      const dir = path.join("apps", appId, config.directory);
      const names = await host.listDir(dir);
      return {
        files: names.filter((n) => n.endsWith(".json")),
      };
    },
  };
}
