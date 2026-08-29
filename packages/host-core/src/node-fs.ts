import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import type { HostPort } from "./ports.js";

export function expandHome(p: string): string {
  if (p.startsWith("~/") || p === "~") {
    return path.join(os.homedir(), p.slice(1).replace(/^\//, "") || "");
  }
  return p;
}

export type PathConfig = {
  runtimeRoot?: string;
  sharedRoot?: string;
  configPath?: string;
};

export function resolvePaths(overrides: PathConfig = {}): {
  runtimeRoot: string;
  sharedRoot: string;
  userConfigPath: string;
} {
  const userConfigPath = expandHome(
    overrides.configPath ??
      process.env.MONKEY_MINI_APP_CONFIG ??
      "~/.monkey-mini-app/config.json"
  );

  let fromFile: Record<string, string> = {};
  try {
    // sync read not available here async; caller may pre-load. Env first.
  } catch {
    /* ignore */
  }

  const runtimeRoot = expandHome(
    overrides.runtimeRoot ??
      process.env.MONKEY_MINI_APP_ROOT ??
      fromFile.runtimeRoot ??
      "~/.monkey-mini-app/runtime"
  );
  const sharedRoot = expandHome(
    overrides.sharedRoot ??
      process.env.MONKEY_MINI_APP_SHARED ??
      fromFile.sharedRoot ??
      "~/.monkey-mini-app/shared"
  );

  return { runtimeRoot, sharedRoot, userConfigPath };
}

export async function loadUserConfig(
  configPath?: string
): Promise<Record<string, unknown>> {
  const p = expandHome(
    configPath ??
      process.env.MONKEY_MINI_APP_CONFIG ??
      "~/.monkey-mini-app/config.json"
  );
  try {
    const raw = await fs.readFile(p, "utf8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function createNodeHostPort(options: {
  runtimeRoot: string;
  hostHandlers?: Record<
    string,
    (payload: unknown) => Promise<unknown> | unknown
  >;
}): HostPort {
  const root = path.resolve(options.runtimeRoot);
  const handlers = options.hostHandlers ?? {};

  function resolve(p: string): string {
    if (path.isAbsolute(p)) return p;
    return path.join(root, p);
  }

  return {
    getRuntimeRoot() {
      return root;
    },
    async readFile(p) {
      const buf = await fs.readFile(resolve(p));
      return buf;
    },
    async writeFile(p, data) {
      const abs = resolve(p);
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, data);
    },
    async listDir(p) {
      try {
        return await fs.readdir(resolve(p));
      } catch {
        return [];
      }
    },
    async exists(p) {
      try {
        await fs.access(resolve(p));
        return true;
      } catch {
        return false;
      }
    },
    async mkdir(p, opts) {
      await fs.mkdir(resolve(p), { recursive: opts?.recursive ?? true });
    },
    async invoke(name, payload) {
      const h = handlers[name];
      if (!h) throw new Error(`HOST_API_NOT_FOUND: ${name}`);
      return await h(payload);
    },
    log(level, message, meta) {
      const line = meta
        ? `[${level}] ${message} ${JSON.stringify(meta)}`
        : `[${level}] ${message}`;
      // eslint-disable-next-line no-console
      console.log(line);
    },
  };
}
