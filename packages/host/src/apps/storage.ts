/**
 * App storage table listing / safe path join (browse API).
 *
 * Read-only by design: writes go through `file-store.ts`. A leftover `<name>.d/` from the
 * withdrawn auto-split is absorbed into `<name>.json` on first touch (via `readTable`), so the
 * panel never sees a half-migrated layout.
 */
import fs from "node:fs";
import path from "node:path";

import { adviceForTable, readTable,type StorageAdvice } from "./file-store.ts";

export type StorageTableInfo = {
  name: string;
  size: number;
  updatedAt: string;
  /** Top-level key count when the file parses. */
  keys?: number;
};

export type { StorageAdvice };

/** Enumerate the app's tables, newest first. One entry per `*.json` file. */
export function listStorageTables(dir: string): StorageTableInfo[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }) : [];
  } catch {
    return [];
  }

  // Fold any leftover auto-split dirs back into `.json` before we list — listing itself must
  // never quarantine a merely odd `.json` (e.g. `[]` fixtures); that stays a read/write concern.
  for (const ent of entries) {
    if (ent.isDirectory() && ent.name.endsWith(".d")) {
      try {
        readTable(dir, ent.name.slice(0, -".d".length));
      } catch {
        /* corrupt shards: leave them; the write path will surface STORAGE_CORRUPT */
      }
    }
  }

  let names: string[];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return [];
  }

  const out: StorageTableInfo[] = [];
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    const fp = path.join(dir, name);
    let st: fs.Stats;
    try {
      st = fs.statSync(fp);
      if (!st.isFile()) continue;
    } catch {
      continue;
    }
    let keys: number | undefined;
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(fp, "utf8"));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        keys = Object.keys(parsed as Record<string, unknown>).length;
      }
    } catch {
      /* listing must not throw */
    }
    out.push({
      name: name.replace(/\.json$/, ""),
      size: st.size,
      updatedAt: st.mtime.toISOString(),
      keys,
    });
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Notices for every table past the size band — used by the storage API and the panel banner. */
export function listStorageNotices(dir: string, locale: "zh-CN" | "en" = "zh-CN"): StorageAdvice[] {
  return listStorageTables(dir)
    .map((t) => adviceForTable(dir, t.name, locale))
    .filter((a): a is StorageAdvice => a !== null);
}

/** Basename-only join + `.json` — blocks path traversal. */
export function storageTablePath(dir: string, table: string): string {
  return path.join(dir, `${path.basename(String(table ?? ""))}.json`);
}

export function readTableView(dir: string, table: string): unknown {
  const safe = path.basename(String(table ?? ""));
  try {
    return readTable(dir, safe);
  } catch {
    return readJsonFile(storageTablePath(dir, safe), null);
  }
}

export function readJsonFile(fp: string, fallback: unknown = null): unknown {
  try {
    return JSON.parse(fs.readFileSync(fp, "utf8")) as unknown;
  } catch {
    return fallback;
  }
}
