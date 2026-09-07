import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  analyzeTable,
  NOTICE_BYTES,
  readKey,
  readTable,
  stats,
  writeKey,
} from "../src/apps/file-store.ts";
import { listStorageNotices, listStorageTables } from "../src/apps/storage.ts";
import { HostEventBus } from "../src/events/host-events.ts";
import { formatSse } from "../src/events/host-events.ts";

const TABLE = "main.storage";

function big(n: number): string {
  return "x".repeat(n);
}

describe("storage notice + single-file layout", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "mma-notice-"));
  });

  afterEach(() => {
    /* tmp dirs are fine to leave; OS cleans */
  });

  it("keeps a grown table as one JSON file (auto-split withdrawn)", () => {
    writeKey(dir, TABLE, "blob", big(NOTICE_BYTES + 100));
    expect(stats(dir, TABLE).bytes).toBeGreaterThan(NOTICE_BYTES);
    expect(existsSync(path.join(dir, `${TABLE}.json`))).toBe(true);
    expect(existsSync(path.join(dir, `${TABLE}.d`))).toBe(false);
    expect(readKey(dir, TABLE, "blob")).toHaveLength(NOTICE_BYTES + 100);
  });

  it("absorbs a leftover .d directory from the withdrawn split into one file", () => {
    const sd = path.join(dir, `${TABLE}.d`);
    mkdirSync(sd, { recursive: true });
    writeFileSync(path.join(sd, "aaa.json"), JSON.stringify({ key: "a", value: 1 }));
    writeFileSync(path.join(sd, "bbb.json"), JSON.stringify({ key: "b", value: "two" }));
    expect(readTable(dir, TABLE)).toEqual({ a: 1, b: "two" });
    expect(existsSync(sd)).toBe(false);
    expect(JSON.parse(readFileSync(path.join(dir, `${TABLE}.json`), "utf8"))).toEqual({ a: 1, b: "two" });
  });

  it("ranks the heaviest top-level keys and builds a pasteable AI prompt", () => {
    const obj = {
      theme: "dark",
      reads: Array.from({ length: 50 }, (_, i) => ({ id: i, body: big(2000) })),
      settings: { a: 1 },
    };
    const advice = analyzeTable("main.storage", obj, "zh-CN");
    expect(advice.heavy[0]?.key).toBe("reads");
    expect(advice.heavy[0]?.kind).toBe("list");
    expect(advice.prompt).toContain("main.storage");
    expect(advice.prompt).toContain("`reads`");
    expect(advice.prompt).toContain("一行一个 key");
  });

  it("lists notices only for tables past the band", () => {
    writeKey(dir, "small", "k", "v");
    writeKey(dir, "big", "blob", big(NOTICE_BYTES + 50));
    const notices = listStorageNotices(dir, "en");
    expect(notices.map((n) => n.table)).toEqual(["big"]);
    expect(notices[0].prompt).toContain("big");
    expect(listStorageTables(dir).map((t) => t.name).sort()).toEqual(["big", "small"]);
  });

  it("SSE payload for app:storage-notice carries the prompt", () => {
    const frame = formatSse(
      {
        type: "app:storage-notice",
        appId: "com.example.radar",
        table: "main.storage",
        bytes: 900_000,
        keys: 3,
        heavy: [{ key: "reads", bytes: 800_000, kind: "list", entries: 100 }],
        prompt: "please split reads",
      },
      9,
    );
    expect(frame).toContain("event: app:storage-notice");
    expect(frame).toContain("please split reads");
  });

  it("HostEventBus fans storage notices to subscribers", () => {
    const bus = new HostEventBus();
    const seen: string[] = [];
    bus.subscribe((e) => {
      if (e.type === "app:storage-notice") seen.push(e.table);
    });
    bus.emit({
      type: "app:storage-notice",
      appId: "com.example.x",
      table: "reads",
      bytes: NOTICE_BYTES,
      keys: 1,
      heavy: [],
      prompt: "x",
    });
    expect(seen).toEqual(["reads"]);
  });
});
