/** App storage table listing / safe path join (browse API). */
import fs from "node:fs";
import path from "node:path";

export type StorageTableInfo = {
  name: string;
  size: number;
  updatedAt: string;
};

/** Enumerate `*.json` tables under an app storage dir (newest first). */
export function listStorageTables(dir: string): StorageTableInfo[] {
  try {
    const names = fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => n.endsWith(".json")) : [];
    return names
      .map((n) => {
        const fp = path.join(dir, n);
        const st = fs.statSync(fp);
        return {
          name: n.replace(/\.json$/, ""),
          size: st.size,
          updatedAt: st.mtime.toISOString(),
        };
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

/** Basename-only join + `.json` — blocks path traversal. */
export function storageTablePath(dir: string, table: string): string {
  return path.join(dir, `${path.basename(String(table ?? ""))}.json`);
}

export function readJsonFile(fp: string, fallback: unknown = null): unknown {
  try {
    return JSON.parse(fs.readFileSync(fp, "utf8")) as unknown;
  } catch {
    return fallback;
  }
}
