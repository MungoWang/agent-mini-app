import { mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  listStorageTables,
  readJsonFile,
  storageTablePath,
} from "../src/apps/storage.ts";

function tmpDir(): string {
  return mkdtempSync(path.join(tmpdir(), "mma-store-"));
}

describe("listStorageTables", () => {
  it("lists only .json tables, newest first", () => {
    const dir = tmpDir();
    writeFileSync(path.join(dir, "todos.json"), "[]");
    writeFileSync(path.join(dir, "logs.json"), "{}");
    writeFileSync(path.join(dir, "notes.txt"), "ignore me");
    // deterministic mtimes: logs.json is the newer table
    utimesSync(path.join(dir, "todos.json"), new Date(1_700_000_000_000), new Date(1_700_000_000_000));
    utimesSync(path.join(dir, "logs.json"), new Date(1_800_000_000_000), new Date(1_800_000_000_000));

    const tables = listStorageTables(dir);
    expect(tables.map((t) => t.name)).toEqual(["logs", "todos"]);
    expect(tables[0].size).toBe(2);
    expect(tables[0].updatedAt).toBe(new Date(1_800_000_000_000).toISOString());
  });

  it("returns [] for an empty or missing directory", () => {
    expect(listStorageTables(tmpDir())).toEqual([]);
    expect(listStorageTables(path.join(tmpDir(), "nope"))).toEqual([]);
  });

  it("returns [] instead of throwing when the path is a file", () => {
    const dir = tmpDir();
    const fp = path.join(dir, "table.json");
    writeFileSync(fp, "[]");
    expect(listStorageTables(fp)).toEqual([]);
  });
});

describe("storageTablePath", () => {
  it("joins the basename plus .json so a table name cannot escape the dir", () => {
    const dir = "/tmp/mma-store";
    expect(storageTablePath(dir, "todos")).toBe(path.join(dir, "todos.json"));
    expect(storageTablePath(dir, "../../etc/passwd")).toBe(path.join(dir, "passwd.json"));
    expect(storageTablePath(dir, "nested/todos.json")).toBe(path.join(dir, "todos.json.json"));
  });

  it("stringifies junk table names", () => {
    const dir = "/tmp/mma-store";
    expect(storageTablePath(dir, undefined as unknown as string)).toBe(path.join(dir, ".json"));
  });
});

describe("readJsonFile", () => {
  it("parses a readable file", () => {
    const dir = tmpDir();
    const fp = path.join(dir, "todos.json");
    writeFileSync(fp, JSON.stringify([{ id: 1 }]));
    expect(readJsonFile(fp)).toEqual([{ id: 1 }]);
  });

  it("falls back when the file is missing or not valid JSON", () => {
    const dir = tmpDir();
    expect(readJsonFile(path.join(dir, "missing.json"))).toBeNull();

    const broken = path.join(dir, "broken.json");
    writeFileSync(broken, "{oops");
    expect(readJsonFile(broken)).toBeNull();
    expect(readJsonFile(broken, [])).toEqual([]);
  });
});
