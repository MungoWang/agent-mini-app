import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import {
  clearTable,
  deleteKey,
  listStorageTables,
  readKey,
  readTableView,
  SPLIT_THRESHOLD_BYTES,
  stats,
  writeKey,
} from "@monkey-mini-app/host";

/**
 * The platform splits a grown table into one file per key, and the app must not be able to tell.
 *
 * Every case here asserts something the author or the panel would notice — a value that comes back,
 * a table that still appears in the storage browser, a write that no longer rewrites everything —
 * rather than the layout itself, because the layout is exactly the part that is allowed to change.
 */

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "mma-split-"));
});

const big = (chars: number) => "x".repeat(chars);

const TABLE = "main.storage";

describe("table layout", () => {
  it("keeps a small table as the single file it always was", () => {
    writeKey(dir, TABLE, "theme", "dark");
    writeKey(dir, TABLE, "sources", ["a", "b"]);

    expect(existsSync(path.join(dir, "main.storage.json"))).toBe(true);
    expect(existsSync(path.join(dir, "main.storage.d"))).toBe(false);
    expect(readKey(dir, TABLE, "theme")).toBe("dark");
    expect(readKey(dir, TABLE, "sources")).toEqual(["a", "b"]);
  });

  it("splits once the table outgrows one rewrite, and every key still reads back", () => {
    const payload = big(SPLIT_THRESHOLD_BYTES);
    writeKey(dir, TABLE, "one", payload);

    expect(stats(dir, TABLE).split).toBe(true);
    expect(readdirSync(dir)).toContain("main.storage.d");
    // Nothing to keep as a fallback: the very first write went straight past the threshold, so a
    // single-file version of this table never existed.
    expect(existsSync(path.join(dir, "main.storage.json"))).toBe(false);

    expect(readKey(dir, TABLE, "one")).toBe(payload);
  });

  it("makes the next write cost one key, not the whole table", () => {
    for (let i = 0; i < 6; i++) writeKey(dir, TABLE, `k${i}`, big(SPLIT_THRESHOLD_BYTES / 2));
    expect(stats(dir, TABLE).split).toBe(true);
    const before = stats(dir, TABLE);

    // After a split there is no table-sized file left to rewrite: a new key is one small file.
    writeKey(dir, TABLE, "fresh", "tiny");

    const after = stats(dir, TABLE);
    expect(after.keys).toBe(before.keys + 1);
    expect(after.bytes - before.bytes).toBeLessThan(200);
    expect(readKey(dir, TABLE, "fresh")).toBe("tiny");
    expect(readKey(dir, TABLE, "k3")).toHaveLength(SPLIT_THRESHOLD_BYTES / 2);
  });

  it("survives a crash mid-split with the single file still in charge", () => {
    writeKey(dir, TABLE, "a", "1");
    writeKey(dir, TABLE, "b", "2");
    // The staging directory exists, the real one does not: the migration never published.
    const staging = path.join(dir, "main.storage.d.tmp");
    mkdirSync(staging, { recursive: true });
    writeFileSync(path.join(staging, "deadbeefdeadbeef.json"), '{"key":"a","value":"stale"}');

    expect(readKey(dir, TABLE, "a")).toBe("1");
    expect(readKey(dir, TABLE, "b")).toBe("2");
    // And a staged directory is never mistaken for a table in the browser listing.
    expect(listStorageTables(dir).map((t) => t.name)).toEqual([TABLE]);
  });

  it("keeps the pre-split file as an inert fallback when a later write triggers the split", () => {
    writeKey(dir, TABLE, "seed", "1"); // small: stays one file
    expect(stats(dir, TABLE).split).toBe(false);
    writeKey(dir, TABLE, "one", big(SPLIT_THRESHOLD_BYTES)); // crossing migrates it

    expect(stats(dir, TABLE).split).toBe(true);
    expect(existsSync(path.join(dir, "main.storage.json"))).toBe(false);
    // The old single file is renamed aside, not deleted — and the inert name keeps it out of both
    // read paths and out of the browser listing.
    expect(readFileSync(path.join(dir, "main.storage.json.split"), "utf8")).toContain('"seed"');
    expect(readKey(dir, TABLE, "seed")).toBe("1");
    expect(listStorageTables(dir).map((t) => t.name)).toEqual([TABLE]);
  });

  it("treats a stored key as the truth, so a hash collision cannot return the wrong value", () => {
    writeKey(dir, TABLE, "real", big(SPLIT_THRESHOLD_BYTES));
    expect(stats(dir, TABLE).split).toBe(true);
    const shards = readdirSync(path.join(dir, "main.storage.d"));
    const shardFile = path.join(dir, "main.storage.d", shards[0]);
    // Forge a shard under a name whose hash will not match the key it is asked for.
    writeFileSync(shardFile, JSON.stringify({ key: "someone-else", value: "leaked" }), "utf8");

    expect(readKey(dir, TABLE, "real")).toBeNull();
  });

  it("keeps keys that are not legal filenames", () => {
    const keys = ["中文标题", "a/b/c", "https://example.com/x?q=1&r=2", "../../etc/passwd", ""];
    mkdirSync(path.join(dir, "grow.d"), { recursive: true }); // force the split layout
    for (const k of keys) writeKey(dir, "grow", k, `v:${k}`);

    for (const k of keys) expect(readKey(dir, "grow", k)).toBe(`v:${k}`);
    // Nothing escaped the shard directory.
    for (const name of readdirSync(dir)) expect(name.endsWith(".d") || name.endsWith(".json")).toBe(true);
    expect(readdirSync(path.join(dir, "grow.d")).length).toBe(keys.length);
  });

  it("deletes and clears across the layout it chose", () => {
    for (let i = 0; i < 4; i++) writeKey(dir, TABLE, `k${i}`, big(SPLIT_THRESHOLD_BYTES / 2));
    expect(stats(dir, TABLE).split).toBe(true);

    deleteKey(dir, TABLE, "k1");
    expect(readKey(dir, TABLE, "k1")).toBeNull();
    expect(readKey(dir, TABLE, "k2")).not.toBeNull();

    clearTable(dir, TABLE);
    expect(readKey(dir, TABLE, "k2")).toBeNull();
    expect(existsSync(path.join(dir, "main.storage.d"))).toBe(false);
  });
});

describe("storage browser sees one table per table", () => {
  it("folds a split table into a single entry with a real size and count", () => {
    for (let i = 0; i < 3; i++) writeKey(dir, TABLE, `k${i}`, big(SPLIT_THRESHOLD_BYTES / 2));

    const tables = listStorageTables(dir);
    expect(tables).toHaveLength(1);
    expect(tables[0]).toMatchObject({ name: TABLE, split: true, keys: 3 });
    expect(tables[0].size).toBeGreaterThan(SPLIT_THRESHOLD_BYTES);
  });

  it("hands the panel the same object the author wrote, split or not", () => {
    const body = big(SPLIT_THRESHOLD_BYTES);
    writeKey(dir, "big", "a", body);
    writeKey(dir, "big", "b", "two");
    writeKey(dir, "small", "a", "short");
    writeKey(dir, "small", "b", "two");

    expect(stats(dir, "big").split).toBe(true);
    expect(stats(dir, "small").split).toBe(false);
    // One view per table, keys folded back in whichever layout the host chose.
    expect(Object.keys(readTableView(dir, "big") as object).sort()).toEqual(["a", "b"]);
    expect(readTableView(dir, "big")).toMatchObject({ b: "two", a: body });
    expect(readTableView(dir, "small")).toEqual({ a: "short", b: "two" });
  });

  it("ignores quarantine and migration corpses instead of listing them as tables", () => {
    writeKey(dir, TABLE, "k", big(SPLIT_THRESHOLD_BYTES));
    writeFileSync(path.join(dir, "other.storage.json.corrupt-2026-09-08"), "{oops");
    writeFileSync(path.join(dir, "gone.storage.json.split"), "{}");

    expect(listStorageTables(dir).map((t) => t.name)).toEqual([TABLE]);
    expect(statSync(path.join(dir, "main.storage.d")).isDirectory()).toBe(true);
  });
});

describe("corrupt data is never read as empty", () => {
  it("quarantines an unreadable whole-table file and refuses the read", () => {
    writeKey(dir, TABLE, "keep", "mine");
    writeFileSync(path.join(dir, "main.storage.json"), '{"keep":"mi');

    expect(() => readKey(dir, TABLE, "keep")).toThrowError(/not valid JSON/);
    expect(existsSync(path.join(dir, "main.storage.json"))).toBe(false);
    expect(readdirSync(dir).some((n) => n.includes(".corrupt-"))).toBe(true);
  });

  it("quarantines an unreadable shard instead of returning `{}` for the key", () => {
    writeKey(dir, TABLE, "keep", big(SPLIT_THRESHOLD_BYTES));
    const shardDir = path.join(dir, "main.storage.d");
    const shard = path.join(shardDir, readdirSync(shardDir)[0]);
    writeFileSync(shard, "{oops");

    expect(() => readKey(dir, TABLE, "keep")).toThrowError(/not valid JSON/);
    expect(readdirSync(shardDir).some((n) => n.includes(".corrupt-"))).toBe(true);
  });
});
