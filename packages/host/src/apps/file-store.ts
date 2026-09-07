/**
 * Where a mini-app's JSON table lives on disk.
 *
 * One table = one file (`storage/<table>.json`). Writes are atomic (tmp + rename) so a process
 * killed mid-`set` never leaves a half-written file for the next read. An unreadable file is
 * quarantined and fails loudly (`STORAGE_CORRUPT`) — never read back as `{}`, which used to let
 * the next `set` wipe the rest of the table.
 *
 * Auto-splitting into one-file-per-key was tried and withdrawn: with fsync + directory stats it
 * cost more than rewriting a mid-sized JSON file on the common "many small keys" shape. Growth
 * is handled by guidance (and a host notice that points at the heavy keys), not by a second layout.
 */
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeSync,
} from "node:fs";
import path from "node:path";

import { HostError } from "../errors.ts";

/** Size at which the host starts reminding about table shape (one notice per band). */
export const NOTICE_BYTES = 512 * 1024;

/** How many of the heaviest top-level keys to surface in a notice / AI prompt. */
const HEAVY_KEY_LIMIT = 5;

/** Leftover suffix from the withdrawn auto-split layout. Absorbed back into one file on touch. */
const SHARD_DIR = ".d";

export type TableStats = {
  bytes: number;
  keys: number;
};

export type HeavyKey = {
  key: string;
  bytes: number;
  /** Rough shape hint so the AI prompt can say "this looks like a list". */
  kind: "list" | "map" | "value";
  /** For lists/maps: entry count when cheap. */
  entries?: number;
};

export type StorageAdvice = {
  table: string;
  bytes: number;
  keys: number;
  heavy: HeavyKey[];
  /** Ready-to-paste prompt for an agent, in the requested locale. */
  prompt: string;
};

function tableFile(dir: string, table: string): string {
  return path.join(dir, `${table}.json`);
}

function shardDir(dir: string, table: string): string {
  return path.join(dir, `${table}${SHARD_DIR}`);
}

/**
 * Write so a reader sees either the old file or the new one — never a third half-written thing.
 * `rename` is the atomic step. We deliberately do **not** fsync: that bought power-loss durability
 * at ~10× the cost of the rename, and the bug we fix is "process killed mid-write", which rename
 * alone covers.
 */
function atomicWrite(fp: string, payload: string): void {
  mkdirSync(path.dirname(fp), { recursive: true });
  const tmp = `${fp}.tmp-${process.pid}`;
  const fd = openSync(tmp, "w");
  try {
    writeSync(fd, payload);
  } finally {
    closeSync(fd);
  }
  renameSync(tmp, fp);
}

/** Move an unreadable file aside (it is the only copy) and say so. Never read it as empty. */
function quarantine(fp: string, why: string): never {
  const kept = `${fp}.corrupt-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  try {
    renameSync(fp, kept);
  } catch {
    /* read-only media: still fail, just without keeping the evidence under a new name */
  }
  throw new HostError(
    "STORAGE_CORRUPT",
    `${path.basename(fp)} is not valid JSON (${why}); moved to ${path.basename(kept)} — ` +
      "recover it by hand instead of letting the next set() replace the table",
  );
}

function parseObject(fp: string, raw: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    quarantine(fp, cause instanceof Error ? cause.message : String(cause));
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    quarantine(fp, `expected a JSON object, got ${Array.isArray(parsed) ? "array" : typeof parsed}`);
  }
  return parsed as Record<string, unknown>;
}

/**
 * If a withdrawn auto-split left `<table>.d/` behind, fold it back into one JSON file once.
 * Crash-safe: write the merged file first, then remove the directory.
 */
function absorbLegacyShards(dir: string, table: string): void {
  const sd = shardDir(dir, table);
  if (!existsSync(sd)) return;
  let names: string[];
  try {
    names = readdirSync(sd).filter((n) => n.endsWith(".json"));
  } catch {
    return;
  }
  const merged: Record<string, unknown> = {};
  // Prefer the single file when both exist (it was authoritative if a split crashed mid-way).
  if (existsSync(tableFile(dir, table))) {
    Object.assign(merged, readWholeTable(dir, table));
  }
  for (const name of names) {
    const fp = path.join(sd, name);
    let raw: string;
    try {
      raw = readFileSync(fp, "utf8");
    } catch {
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    const rec = parsed as { key?: unknown; value?: unknown } | null;
    if (rec && typeof rec === "object" && typeof rec.key === "string") {
      merged[rec.key] = rec.value;
    }
  }
  atomicWrite(tableFile(dir, table), JSON.stringify(merged, null, 2));
  rmSync(sd, { recursive: true, force: true });
  const leftover = `${tableFile(dir, table)}.split`;
  if (existsSync(leftover)) rmSync(leftover, { force: true });
}

function readWholeTable(dir: string, table: string): Record<string, unknown> {
  absorbLegacyShards(dir, table);
  const fp = tableFile(dir, table);
  let raw: string;
  try {
    raw = readFileSync(fp, "utf8");
  } catch {
    return {};
  }
  return parseObject(fp, raw);
}

function classifyValue(value: unknown): Pick<HeavyKey, "kind" | "entries"> {
  if (Array.isArray(value)) return { kind: "list", entries: value.length };
  if (value && typeof value === "object") {
    return { kind: "map", entries: Object.keys(value as object).length };
  }
  return { kind: "value" };
}

/** Rank top-level keys by serialised size — what the notice / AI prompt points at. */
export function analyzeTable(
  table: string,
  obj: Record<string, unknown>,
  locale: "zh-CN" | "en" = "zh-CN",
): StorageAdvice {
  const heavy: HeavyKey[] = Object.entries(obj)
    .map(([key, value]) => {
      const bytes = Buffer.byteLength(JSON.stringify(value));
      return { key, bytes, ...classifyValue(value) };
    })
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, HEAVY_KEY_LIMIT);
  const bytes = Buffer.byteLength(JSON.stringify(obj, null, 2));
  const keys = Object.keys(obj).length;
  return { table, bytes, keys, heavy, prompt: buildSplitPrompt({ table, bytes, keys, heavy }, locale) };
}

function humanBytes(n: number, locale: "zh-CN" | "en"): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) {
    const v = (n / 1024).toFixed(1);
    return locale === "zh-CN" ? `${v} KB` : `${v} KB`;
  }
  const v = (n / (1024 * 1024)).toFixed(1);
  return locale === "zh-CN" ? `${v} MB` : `${v} MB`;
}

function kindHint(h: HeavyKey, locale: "zh-CN" | "en"): string {
  if (locale === "zh-CN") {
    if (h.kind === "list") return `列表，约 ${h.entries ?? "?"} 条 — 适合一行一个 key`;
    if (h.kind === "map") return `对象，约 ${h.entries ?? "?"} 个字段`;
    return "单个值";
  }
  if (h.kind === "list") return `list, ~${h.entries ?? "?"} items — prefer one key per row`;
  if (h.kind === "map") return `object, ~${h.entries ?? "?"} fields`;
  return "single value";
}

/** Prompt a human can paste to an agent. Plain language; concrete table/key names. */
export function buildSplitPrompt(
  advice: Pick<StorageAdvice, "table" | "bytes" | "keys" | "heavy">,
  locale: "zh-CN" | "en",
): string {
  const size = humanBytes(advice.bytes, locale);
  const lines = advice.heavy.map(
    (h, i) => `${i + 1}. \`${h.key}\` ≈ ${humanBytes(h.bytes, locale)}（${kindHint(h, locale)}）`,
  );
  if (locale === "zh-CN") {
    return [
      `小程序存储表「${advice.table}」现在大约 ${size}（${advice.keys} 个顶层 key）。继续往同一个表里塞会越来越慢。`,
      ``,
      `按体积，这些 key 最该先处理：`,
      ...lines,
      ``,
      `请只改存储形状，不要改业务含义：`,
      `- 会增长的数据各自放到 ctx.storage.table("…")，别和设置/小状态挤在一张表`,
      `- 大列表改成一行一个 key：const rows = ctx.storage.table("…"); await rows.set(id, row)`,
      `- 不要再对一个巨大的数组/对象做整包 set`,
      `- 改完用 ctx.storage.bytes() 看体积是否降下来`,
    ].join("\n");
  }
  return [
    `Mini-app storage table "${advice.table}" is about ${size} (${advice.keys} top-level keys). Keeping growth in one table will keep getting slower.`,
    ``,
    `Heaviest keys to deal with first:`,
    ...advice.heavy.map(
      (h, i) => `${i + 1}. \`${h.key}\` ≈ ${humanBytes(h.bytes, "en")} (${kindHint(h, "en")})`,
    ),
    ``,
    `Change storage shape only — keep the product behaviour:`,
    `- Put anything that grows in its own ctx.storage.table("…"), not next to settings`,
    `- Turn large lists into one key per row: const rows = ctx.storage.table("…"); await rows.set(id, row)`,
    `- Do not keep set()-ing one giant array/object`,
    `- Check ctx.storage.bytes() afterwards`,
  ].join("\n");
}

export function readKey(dir: string, table: string, key: string): unknown {
  const obj = readWholeTable(dir, table);
  return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : null;
}

export function writeKey(dir: string, table: string, key: string, value: unknown): TableStats {
  mkdirSync(dir, { recursive: true });
  const obj = readWholeTable(dir, table);
  obj[key] = value;
  const payload = JSON.stringify(obj, null, 2);
  atomicWrite(tableFile(dir, table), payload);
  return { bytes: Buffer.byteLength(payload), keys: Object.keys(obj).length };
}

export function deleteKey(dir: string, table: string, key: string): TableStats {
  const obj = readWholeTable(dir, table);
  if (!Object.prototype.hasOwnProperty.call(obj, key)) return stats(dir, table);
  delete obj[key];
  const payload = JSON.stringify(obj, null, 2);
  atomicWrite(tableFile(dir, table), payload);
  return { bytes: Buffer.byteLength(payload), keys: Object.keys(obj).length };
}

export function clearTable(dir: string, table: string): void {
  mkdirSync(dir, { recursive: true });
  rmSync(shardDir(dir, table), { recursive: true, force: true });
  atomicWrite(tableFile(dir, table), "{}");
}

export function stats(dir: string, table: string): TableStats {
  absorbLegacyShards(dir, table);
  const fp = tableFile(dir, table);
  try {
    const raw = readFileSync(fp, "utf8");
    return {
      bytes: Buffer.byteLength(raw),
      keys: Object.keys(parseObject(fp, raw)).length,
    };
  } catch {
    return { bytes: 0, keys: 0 };
  }
}

/** Read the whole table — browse API only. Absorbs any leftover shard directory first. */
export function readTable(dir: string, table: string): Record<string, unknown> {
  return readWholeTable(dir, table);
}

/** Advice for a table already on disk, or `null` when it is under the notice threshold. */
export function adviceForTable(
  dir: string,
  table: string,
  locale: "zh-CN" | "en" = "zh-CN",
): StorageAdvice | null {
  const obj = readWholeTable(dir, table);
  const bytes = Buffer.byteLength(JSON.stringify(obj, null, 2));
  if (bytes < NOTICE_BYTES) return null;
  return analyzeTable(table, obj, locale);
}
