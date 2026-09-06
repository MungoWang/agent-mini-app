/**
 * Where a mini-app's JSON data lives, and when it stops living in one file.
 *
 * The author-facing contract (`ctx.storage.get/set/delete/clear/table`) addresses **one key at a
 * time** — there is no `keys()`, no enumeration, no query. That is what makes the layout here a
 * private detail: a table can be one file or one file per key, and every method means the same
 * thing either way. So the platform splits a table that has outgrown a single rewrite, instead of
 * making every app author size-plan, split-by-hand and migrate later.
 *
 * Two layouts, chosen per table and invisible above this module:
 *
 *   storage/<table>.json        whole table, one atomic write   (the default)
 *   storage/<table>.d/          one file per key                (past SPLIT_THRESHOLD_BYTES)
 *
 * `.d` is a directory, so the browser API (`listStorageTables`) never mistakes a shard for a
 * table, and a table that split once stays split: flipping back and forth on a threshold would
 * re-migrate on every write around the boundary for no benefit.
 *
 * Both layouts share the rules that matter more than shape:
 *
 * - **A write is never observable half-done.** Bytes go to `<target>.tmp-<pid>`, are fsynced, then
 *   `rename`d over the destination — atomic within a filesystem. Writing in place used to truncate
 *   first, so a process killed mid-`set` left unreadable JSON.
 * - **An unreadable file is never read as empty.** A parse failure used to return `{}`, and the
 *   next `set` then wrote a table containing only its own key: the rest of the app's data gone,
 *   silently, with the UI merely looking empty. Now the bytes are moved to `<name>.corrupt-<stamp>`
 *   and the call fails loudly — `storage/` is gitignored (git-history.ts:31), so those bytes are
 *   the only copy and the only evidence.
 * - **A key is not a filename.** Author keys are arbitrary strings (URLs, Chinese titles, `a/b`),
 *   so a shard is named by a hash and carries the real key inside it, verified on read. A hash
 *   collision therefore reads as a miss, never as somebody else's value.
 */
import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeSync,
} from "node:fs";
import path from "node:path";

import { HostError } from "../errors.ts";

/** Table size at which the next write migrates it to one file per key. */
export const SPLIT_THRESHOLD_BYTES = 512 * 1024;

/** Size at which the host starts reminding the author about table shape (per 512 KB band). */
export const SPLIT_NOTICE_BYTES = 512 * 1024;

/** Shard directory suffix for a table. Kept out of `*.json` so table listings stay correct. */
const SHARD_DIR = ".d";
const SHARD_SUFFIX = ".json";

/** What a write cost, so callers can report it without re-deriving anything. */
export type TableStats = {
  /** Bytes now on disk for this table (summed across shards). */
  bytes: number;
  keys: number;
  /** Whether the table is currently one-file-per-key. */
  split: boolean;
};

type ShardRecord = { key: string; value: unknown };

function tableFile(dir: string, table: string): string {
  return path.join(dir, `${table}.json`);
}

function shardDir(dir: string, table: string): string {
  return path.join(dir, `${table}${SHARD_DIR}`);
}

function shardPath(dir: string, table: string, key: string, into?: string): string {
  const hash = createHash("sha1").update(key).digest("hex").slice(0, 16);
  return path.join(into ?? shardDir(dir, table), `${hash}${SHARD_SUFFIX}`);
}

/**
 * Write bytes so a reader sees either the old file or the new one. `rename` is the atomic step;
 * the fsync before it is what makes "the new file exists" imply "the new file has content".
 */
function atomicWrite(fp: string, payload: string): void {
  mkdirSync(path.dirname(fp), { recursive: true });
  const tmp = `${fp}.tmp-${process.pid}`;
  const fd = openSync(tmp, "w");
  try {
    writeSync(fd, payload);
    fsyncSync(fd);
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

function readWholeTable(dir: string, table: string): Record<string, unknown> {
  const fp = tableFile(dir, table);
  let raw: string;
  try {
    raw = readFileSync(fp, "utf8");
  } catch {
    return {}; // no file yet — the ordinary first-run case
  }
  return parseObject(fp, raw);
}

function listShards(dir: string, table: string): string[] {
  try {
    return readdirSync(shardDir(dir, table)).filter((n) => n.endsWith(SHARD_SUFFIX));
  } catch {
    return [];
  }
}

/**
 * One shard's value, or `undefined` when absent. `found` distinguishes "no such key" from
 * "no such table", which the callers need because a missing key is a normal answer.
 */
function readShard(dir: string, table: string, key: string): { found: boolean; value?: unknown } {
  const fp = shardPath(dir, table, key);
  let raw: string;
  try {
    raw = readFileSync(fp, "utf8");
  } catch {
    return { found: false };
  }
  const rec = parseShardRecord(fp, raw);
  // The filename is a hash: without this, a collision would hand back another key's data.
  if (rec.key !== key) return { found: false };
  return { found: true, value: rec.value };
}

function parseShardRecord(fp: string, raw: string): ShardRecord {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    quarantine(fp, cause instanceof Error ? cause.message : String(cause));
  }
  const rec = parsed as Partial<ShardRecord> | null;
  if (!rec || typeof rec !== "object" || typeof rec.key !== "string") {
    quarantine(fp, "shard is not a { key, value } record");
  }
  return rec as ShardRecord;
}

function writeShard(dir: string, table: string, key: string, value: unknown, into?: string): void {
  atomicWrite(shardPath(dir, table, key, into), JSON.stringify({ key, value } satisfies ShardRecord));
}

/** Whole-table serialisation size for a split table, without reading every value. */
function shardBytes(dir: string, table: string): number {
  let bytes = 0;
  for (const name of listShards(dir, table)) {
    try {
      bytes += statSync(path.join(shardDir(dir, table), name)).size;
    } catch {
      /* raced away */
    }
  }
  return bytes;
}

/**
 * Move `storage/<table>.json` into `storage/<table>.d/`, key by key.
 *
 * The shards are staged in `<table>.d.tmp/` and the directory is `rename`d into place **only when
 * every key is on disk**, because the mere existence of `<table>.d/` is what makes the split layout
 * authoritative: writing straight into it would leave a table half-migrated and readable-by-shards,
 * silently losing every key that had not been copied yet. With the staging step a crash leaves the
 * single file in charge and untouched. The old file is moved aside last and never deleted — it is
 * the fallback copy, and `<name>.json.split` is inert to both layouts.
 */
function splitTable(dir: string, table: string, obj: Record<string, unknown>): void {
  const staging = `${shardDir(dir, table)}.tmp`;
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(staging, { recursive: true });
  for (const [key, value] of Object.entries(obj)) writeShard(dir, table, key, value, staging);
  // A previous attempt may have died between the rename and moving the file aside.
  rmSync(shardDir(dir, table), { recursive: true, force: true });
  renameSync(staging, shardDir(dir, table));
  const source = tableFile(dir, table);
  if (existsSync(source)) renameSync(source, `${source}.split`);
}

function isSplit(dir: string, table: string): boolean {
  return existsSync(shardDir(dir, table));
}

/** Read the whole table as an object — used by the browse API, which is allowed to enumerate. */
export function readTable(dir: string, table: string): Record<string, unknown> {
  if (!isSplit(dir, table)) return readWholeTable(dir, table);
  const out: Record<string, unknown> = {};
  for (const name of listShards(dir, table)) {
    const fp = path.join(shardDir(dir, table), name);
    let raw: string;
    try {
      raw = readFileSync(fp, "utf8");
    } catch {
      continue;
    }
    const rec = parseShardRecord(fp, raw);
    out[rec.key] = rec.value;
  }
  return out;
}

export function tableHas(dir: string, table: string): boolean {
  return isSplit(dir, table) || existsSync(tableFile(dir, table));
}

export function readKey(dir: string, table: string, key: string): unknown {
  if (isSplit(dir, table)) {
    const hit = readShard(dir, table, key);
    return hit.found ? hit.value : null;
  }
  const obj = readWholeTable(dir, table);
  return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : null;
}

/**
 * Write one key. Past the threshold the table becomes one file per key, so the *next* write to a
 * 4 MB table costs one small file instead of re-serialising 4 MB — which is the whole reason this
 * module exists.
 */
export function writeKey(dir: string, table: string, key: string, value: unknown): TableStats {
  mkdirSync(dir, { recursive: true });
  if (isSplit(dir, table)) {
    writeShard(dir, table, key, value);
    return stats(dir, table);
  }
  const obj = readWholeTable(dir, table);
  obj[key] = value;
  const payload = JSON.stringify(obj, null, 2);
  if (Buffer.byteLength(payload) > SPLIT_THRESHOLD_BYTES) {
    splitTable(dir, table, obj);
    return stats(dir, table);
  }
  atomicWrite(tableFile(dir, table), payload);
  return stats(dir, table);
}

export function deleteKey(dir: string, table: string, key: string): TableStats {
  if (isSplit(dir, table)) {
    rmSync(shardPath(dir, table, key), { force: true });
    return stats(dir, table);
  }
  const obj = readWholeTable(dir, table);
  if (!Object.prototype.hasOwnProperty.call(obj, key)) return stats(dir, table);
  delete obj[key];
  atomicWrite(tableFile(dir, table), JSON.stringify(obj, null, 2));
  return stats(dir, table);
}

/** Both layouts, because a table that never split still has a file to clear. */
export function clearTable(dir: string, table: string): void {
  mkdirSync(dir, { recursive: true });
  rmSync(shardDir(dir, table), { recursive: true, force: true });
  atomicWrite(tableFile(dir, table), "{}");
}

export function stats(dir: string, table: string): TableStats {
  if (isSplit(dir, table)) {
    const names = listShards(dir, table);
    return { bytes: shardBytes(dir, table), keys: names.length, split: true };
  }
  const fp = tableFile(dir, table);
  let bytes = 0;
  let keys = 0;
  try {
    const raw = readFileSync(fp, "utf8");
    bytes = Buffer.byteLength(raw);
    keys = Object.keys(parseObject(fp, raw)).length;
  } catch {
    /* absent table is simply empty */
  }
  return { bytes, keys, split: false };
}
