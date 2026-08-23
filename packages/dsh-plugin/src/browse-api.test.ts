import { describe, it, expect, afterAll } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { listStorageTables, storageTablePath, readAppTheme, writeAppTheme } from "./index.js";

const tmpDirs: string[] = [];
async function mkdir() {
  const d = await fs.promises.mkdtemp(path.join(os.tmpdir(), "mma-sto-"));
  tmpDirs.push(d);
  return d;
}
afterAll(async () => {
  await Promise.all(tmpDirs.map((d) => fs.promises.rm(d, { recursive: true, force: true })));
});

describe("listStorageTables（storage 目录枚举）", () => {
  it("空目录 / 不存在目录 → []", async () => {
    const d1 = await mkdir();
    expect(listStorageTables(d1)).toEqual([]);
    expect(listStorageTables(path.join(d1, "nope"))).toEqual([]);
  });
  it("只列 .json、去后缀、带 size/updatedAt、按更新时间倒序", async () => {
    const d = await mkdir();
    const old = path.join(d, "old.json");
    const fresh = path.join(d, "fresh.json");
    const bin = path.join(d, "notes.txt");
    await fs.promises.writeFile(old, "{}");
    await fs.promises.writeFile(fresh, '{"a":1}');
    await fs.promises.writeFile(bin, "not json");
    // 让 fresh 的 mtime 更新
    const now = Date.now();
    await fs.promises.utimes(fresh, new Date(now), new Date(now));
    await fs.promises.utimes(old, new Date(now - 60_000), new Date(now - 60_000));

    const tables = listStorageTables(d);
    expect(tables.map((t) => t.name)).toEqual(["fresh", "old"]); // fresh 最新在前
    expect(tables[0].size).toBeGreaterThan(0);
    expect(new Date(tables[0].updatedAt).getTime()).toBeGreaterThan(new Date(tables[1].updatedAt).getTime());
    expect(tables.some((t) => t.name === "notes")).toBe(false); // 非 .json 过滤
  });
});

describe("storageTablePath（basename 防目录穿越）", () => {
  it("正常表名 → dir/name.json", () => {
    expect(storageTablePath("/tmp/x", "main.storage")).toBe("/tmp/x/main.storage.json");
  });
  it("穿越路径被 basename 截断（../secret → secret.json，不会读上层文件）", () => {
    expect(storageTablePath("/tmp/x", "../secret")).toBe("/tmp/x/secret.json");
    expect(storageTablePath("/tmp/x", "../../etc/passwd")).toBe("/tmp/x/passwd.json");
    expect(storageTablePath("/tmp/x", "a/b/c")).toBe("/tmp/x/c.json");
  });
  it("空表名 → dir/.json（调用方负责校验）", () => {
    expect(storageTablePath("/tmp/x", "")).toBe("/tmp/x/.json");
    expect(storageTablePath("/tmp/x", null as unknown as string)).toBe("/tmp/x/.json");
  });
});

describe("per-app theme（theme.json）", () => {
  it("writeAppTheme 保存并回读；readAppTheme 无文件 → null", async () => {
    const d = await mkdir();
    expect(readAppTheme(d)).toBeNull();
    const saved = writeAppTheme(d, { theme: "dark", palette: "tokyo" });
    expect(saved).toEqual({ theme: "dark", palette: "tokyo" });
    expect(readAppTheme(d)).toEqual({ theme: "dark", palette: "tokyo" });
    expect(JSON.parse(await fs.promises.readFile(path.join(d, "theme.json"), "utf8"))).toEqual({ theme: "dark", palette: "tokyo" });
  });
  it("非法值被 clamp；writeAppTheme(null) 删除文件（回退全局）", async () => {
    const d = await mkdir();
    writeAppTheme(d, { theme: "neon" as never, palette: "ocean" as never });
    expect(readAppTheme(d)).toEqual({ theme: "light", palette: "tokyo" }); // neon→light, ocean→tokyo 迁移
    writeAppTheme(d, null);
    expect(readAppTheme(d)).toBeNull();
    await expect(fs.promises.access(path.join(d, "theme.json"))).rejects.toThrow();
  });
});
