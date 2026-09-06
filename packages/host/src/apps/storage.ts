/**
 * App storage table listing / safe path join (browse API).
 *
 * Read-only by design: writes go through `file-store.ts`, which owns the layout. This module's job
 * is to show the author and the panel what is actually on disk — including when the host has split
 * a table into one file per key, which must not turn into "my data disappeared from the panel".
 */
import fs from "node:fs";
import path from "node:path";

import { readTable } from "./file-store.ts";

export type StorageTableInfo = {
  name: string;
  size: number;
  updatedAt: string;
  /**
   * True when the host keeps this table one file per key (`<name>.d/`). It is still one table to
   * every reader — the flag exists so the panel can say "2.4 MB · 1400 entries" honestly instead of
   * implying a single file, and so a size complaint can point at the right thing.
   */
  split?: boolean;
  /** Keys in the table, when that is cheap to know. */
  keys?: number;
};

/** Shard directory suffix used by `file-store.ts`. Kept in sync by the shared `*.json` filter. */
const SHARD_DIR = ".d";

function newestMtime(dir: string, names: string[]): number {
  let best = 0;
  for (const name of names) {
    try {
      const t = fs.statSync(path.join(dir, name)).mtimeMs;
      if (t > best) best = t;
    } catch {
      /* raced away */
    }
  }
  return best;
}

function wholeTableInfo(dir: string, name: string): StorageTableInfo | null {
  const fp = path.join(dir, name);
  let st: fs.Stats;
  try {
    st = fs.statSync(fp);
  } catch {
    return null;
  }
  let keys: number | undefined;
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(fp, "utf8"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      keys = Object.keys(parsed as Record<string, unknown>).length;
    }
  } catch {
    /* corrupt or oversized: report the stat and let the reader decide — listing must not throw */
  }
  return {
    name: name.replace(/\.json$/, ""),
    size: st.size,
    updatedAt: st.mtime.toISOString(),
    keys,
  };
}

function splitTableInfo(dir: string, entry: string): StorageTableInfo | null {
  const shardDir = path.join(dir, entry);
  let shards: string[];
  try {
    shards = fs.readdirSync(shardDir).filter((n) => n.endsWith(".json"));
  } catch {
    return null;
  }
  return {
    name: entry.slice(0, -SHARD_DIR.length),
    size: shards.reduce((sum, n) => {
      try {
        return sum + fs.statSync(path.join(shardDir, n)).size;
      } catch {
        return sum;
      }
    }, 0),
    updatedAt: new Date(newestMtime(shardDir, shards)).toISOString(),
    split: true,
    keys: shards.length,
  };
}

/**
 * Enumerate the app's tables, newest first — one entry per table, whichever layout it uses.
 *
 * `<name>.d` is a directory, so a sweep for `*.json` can never mistake a shard for a table; the
 * split tables are folded in here. A `.corrupt-*` or `.split` leftover is inert by construction:
 * neither ends in `.json`, so it is off the list and out of every read path.
 */
export function listStorageTables(dir: string): StorageTableInfo[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }) : [];
  } catch {
    return [];
  }

  const out: StorageTableInfo[] = [];
  for (const ent of entries) {
    const info =
      ent.isFile() && ent.name.endsWith(".json")
        ? wholeTableInfo(dir, ent.name)
        : ent.isDirectory() && ent.name.endsWith(SHARD_DIR)
          ? splitTableInfo(dir, ent.name)
          : null;
    if (info) out.push(info);
  }
  // A table that split mid-life has both a `<name>.d/` and a `<name>.json.split` corpse; only the
  // directory is listed, so the name appears once.
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Basename-only join + `.json` — blocks path traversal. */
export function storageTablePath(dir: string, table: string): string {
  return path.join(dir, `${path.basename(String(table ?? ""))}.json`);
}

/**
 * The whole table as an object, whichever layout it uses. The browse API is the one place allowed to
 * enumerate (an app never can), so a split table is folded back into a single view here.
 */
export function readTableView(dir: string, table: string): unknown {
  const safe = path.basename(String(table ?? ""));
  if (fs.existsSync(path.join(dir, `${safe}${SHARD_DIR}`))) return readTable(dir, safe);
  return readJsonFile(storageTablePath(dir, safe), null);
}

export function readJsonFile(fp: string, fallback: unknown = null): unknown {
  try {
    return JSON.parse(fs.readFileSync(fp, "utf8")) as unknown;
  } catch {
    return fallback;
  }
}
