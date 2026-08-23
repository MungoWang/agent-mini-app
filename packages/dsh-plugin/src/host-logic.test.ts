import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { acronymOf, enrichAppMeta, gitCommitCount, gitLog, gitFileStats, gitFilePreview } from "./index.js";

const execFileAsync = promisify(execFile);

async function gitInit(dir: string) {
  await fs.promises.mkdir(dir, { recursive: true });
  await execFileAsync("git", ["init", "-q", "-b", "main"], { cwd: dir });
  await execFileAsync("git", ["config", "user.email", "t@t"], { cwd: dir });
  await execFileAsync("git", ["config", "user.name", "t"], { cwd: dir });
}
async function gitCommitAll(dir: string, message: string) {
  await execFileAsync("git", ["add", "-A"], { cwd: dir });
  await execFileAsync("git", ["commit", "-qm", message], { cwd: dir });
}

describe("acronymOf（monogram 缩写）", () => {
  it("manifest acronym 优先", () => {
    expect(acronymOf("待办", "DB")).toBe("DB");
    expect(acronymOf("任意名字", "ZZ")).toBe("ZZ");
    expect(acronymOf("任意名字", "ab")).toBe("AB"); // 小写转大写
  });
  it("非法 acronym（非 2 位字母数字）回退拼音", () => {
    expect(acronymOf("待办", "D")).toBe("DB");
    expect(acronymOf("待办", "ABC")).toBe("DB");
    expect(acronymOf("待办", "AB!")).toBe("DB");
    expect(acronymOf("待办", "")).toBe("DB");
  });
  it("中文名 → 前两字拼音声母", () => {
    expect(acronymOf("待办", "")).toBe("DB");
    expect(acronymOf("系统监控", "")).toBe("XT");
    expect(acronymOf("今日头条", "")).toBe("JR");
    expect(acronymOf("快捷笔记", "")).toBe("KJ");
    expect(acronymOf("工作台雷达", "")).toBe("GZ");
  });
  it("英文名 → 前两个字母字符", () => {
    expect(acronymOf("AI Agent News", "")).toBe("AI");
    expect(acronymOf("Hello", "")).toBe("HE");
    expect(acronymOf("Todo", "")).toBe("TO");
  });
  it("空名 / 无字母 → 空", () => {
    expect(acronymOf("", "")).toBe("");
    expect(acronymOf(null, "")).toBe("");
    expect(acronymOf(undefined, "")).toBe("");
  });
});

describe("git helpers（临时仓库）", () => {
  let dir = "";
  beforeAll(async () => {
    dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "mma-git-"));
    await gitInit(dir);
    await fs.promises.writeFile(path.join(dir, "a.ts"), "line1\nline2\n");
    await gitCommitAll(dir, "init commit");
    await fs.promises.writeFile(path.join(dir, "a.ts"), "line1\nchanged\n");
    await gitCommitAll(dir, "second");
  });
  afterAll(async () => {
    await fs.promises.rm(dir, { recursive: true, force: true });
  });

  it("gitCommitCount 计数（按目录独立；缓存 TTL 内同目录不变）", async () => {
    expect(await gitCommitCount(dir)).toBe(2);
    const dir2 = await fs.promises.mkdtemp(path.join(os.tmpdir(), "mma-git2-"));
    await gitInit(dir2);
    await fs.promises.writeFile(path.join(dir2, "x.txt"), "1\n");
    await gitCommitAll(dir2, "one");
    expect(await gitCommitCount(dir2)).toBe(1);
    expect(await gitCommitCount(dir)).toBe(2); // 缓存按 dir 隔离
    await fs.promises.rm(dir2, { recursive: true, force: true });
  });

  it("无 git 仓库目录 → 0 / 空", async () => {
    const empty = await fs.promises.mkdtemp(path.join(os.tmpdir(), "mma-nogit-"));
    expect(await gitCommitCount(empty)).toBe(0);
    expect(await gitLog(empty, 10)).toEqual([]);
    await fs.promises.rm(empty, { recursive: true, force: true });
  });

  it("gitLog 返回 message/时间（新→旧）", async () => {
    const log = await gitLog(dir, 10);
    expect(log.length).toBe(2);
    expect(log[0].message).toBe("second");
    expect(log[1].message).toBe("init commit");
    expect(log[0].id.length).toBe(40);
    expect(new Date(log[0].time).getTime()).toBeGreaterThan(0);
    expect((await gitLog(dir, 1)).length).toBe(1);
  });

  it("gitFileStats 统计新增/修改行数", async () => {
    const log = await gitLog(dir, 2);
    const init = log[1];
    const second = log[0];
    expect(await gitFileStats(dir, init.id)).toEqual([{ path: "a.ts", add: 2, del: 0 }]);
    expect(await gitFileStats(dir, second.id)).toEqual([{ path: "a.ts", add: 1, del: 1 }]);
  });

  it("gitFilePreview 返回 diff 片段并截断", async () => {
    const [second] = await gitLog(dir, 1);
    const p = await gitFilePreview(dir, second.id, "a.ts");
    expect(p).toContain("-line2");
    expect(p).toContain("+changed");
    const long = await gitFilePreview(dir, second.id, "a.ts", 1);
    expect(long).toContain("行省略");
  });
});

describe("enrichAppMeta（handleApps 元数据组装）", () => {
  it("manifest acronym 生效 + commits 注入", async () => {
    const d = await fs.promises.mkdtemp(path.join(os.tmpdir(), "mma-enrich-"));
    await gitInit(d);
    await fs.promises.writeFile(
      path.join(d, "manifest.json"),
      JSON.stringify({ id: "com.x.a", name: "待办", version: "1.0.0", entry: "ui.tsx", acronym: "MY" })
    );
    await fs.promises.writeFile(path.join(d, "ui.tsx"), "// x");
    await gitCommitAll(d, "init");
    const out = await enrichAppMeta({ id: "com.x.a", name: "待办" }, d);
    expect(out.acronym).toBe("MY"); // manifest 优先
    expect(out.commits).toBe(1);
    await fs.promises.rm(d, { recursive: true, force: true });
  });
  it("无 manifest acronym → 拼音声母；非法 acronym 忽略", async () => {
    const d = await fs.promises.mkdtemp(path.join(os.tmpdir(), "mma-enrich2-"));
    await gitInit(d);
    await fs.promises.writeFile(
      path.join(d, "manifest.json"),
      JSON.stringify({ id: "com.x.b", name: "系统监控", version: "1.0.0", entry: "ui.tsx", acronym: "Q" }) // 1 位非法
    );
    await gitCommitAll(d, "init");
    const out = await enrichAppMeta({ id: "com.x.b", name: "系统监控" }, d);
    expect(out.acronym).toBe("XT"); // 回退拼音
    await fs.promises.rm(d, { recursive: true, force: true });
  });
  it("无 manifest / 无 git → 拼音 + commits 0", async () => {
    const d = await fs.promises.mkdtemp(path.join(os.tmpdir(), "mma-enrich3-"));
    const out = await enrichAppMeta({ id: "com.x.c", name: "Hello" }, d);
    expect(out.acronym).toBe("HE");
    expect(out.commits).toBe(0);
    await fs.promises.rm(d, { recursive: true, force: true });
  });
});
