import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { bootstrapHostConfig,GitHistory, HostError } from "@monkey-mini-app/host";

async function tempDir(): Promise<string> {
  const config = bootstrapHostConfig({
    runtimeRoot: await mkdtemp(path.join(tmpdir(), "mma-git-")),
    hostPort: 0,
  });
  return config.runtimeRoot;
}

describe("GitHistory", () => {
  it("inits, commits, and lists a commit tree", async () => {
    const dir = await tempDir();
    const git = new GitHistory();
    await git.init(dir);
    await writeFile(path.join(dir, "a.txt"), "one");
    const { commitId: c1 } = await git.commit(dir, "add a");
    await writeFile(path.join(dir, "a.txt"), "two");
    const { commitId: c2 } = await git.commit(dir, "change a");

    const tree = await git.listCommits(dir);
    expect(tree.head).toBe(c2);
    expect(tree.nodes.some((n) => n.id === c1)).toBe(true);
    expect(tree.nodes.some((n) => n.id === c2)).toBe(true);
    expect(tree.nodes.find((n) => n.id === c2)?.parentIds).toContain(c1);
  });

  it("resetTo keeps a backup tip visible in the tree", async () => {
    const dir = await tempDir();
    const git = new GitHistory();
    await git.init(dir);
    await writeFile(path.join(dir, "a.txt"), "one");
    const { commitId: c1 } = await git.commit(dir, "c1");
    await writeFile(path.join(dir, "a.txt"), "two");
    const { commitId: c2 } = await git.commit(dir, "c2");

    const { backupRef } = await git.resetTo(dir, c1);
    expect(backupRef).toBeTruthy();
    const tree = await git.listCommits(dir);
    expect(tree.head).toBe(c1);
    expect(tree.nodes.some((n) => n.id === c2)).toBe(true);
    expect(tree.tips.some((t) => t.commitId === c2)).toBe(true);
  });

  it("does not track storage/", async () => {
    const dir = await tempDir();
    const git = new GitHistory();
    await git.init(dir);
    await mkdir(path.join(dir, "storage"), { recursive: true });
    await writeFile(path.join(dir, "storage", "default.json"), "{}");
    await writeFile(path.join(dir, "app.txt"), "x");
    await git.commit(dir, "app only");
    expect(await readFile(path.join(dir, "storage", "default.json"), "utf8")).toBe("{}");
  });

  it("returns 0 / empty log for a directory that is not a git repo", async () => {
    const dir = await tempDir();
    const git = new GitHistory();
    expect(await git.commitCount(dir)).toBe(0);
    expect(await git.log(dir, 10)).toEqual([]);
  });

  it("logs newest first and counts commits per directory", async () => {
    const dir = await tempDir();
    const git = new GitHistory();
    await git.init(dir);
    await writeFile(path.join(dir, "a.ts"), "line1\nline2\n");
    await git.commit(dir, "init commit");
    await writeFile(path.join(dir, "a.ts"), "line1\nchanged\n");
    await git.commit(dir, "second");

    const log = await git.log(dir, 10);
    expect(log).toHaveLength(3);
    expect(log[0]?.message).toBe("second");
    expect(log[1]?.message).toBe("init commit");
    expect(log[0]?.id).toHaveLength(40);
    expect(new Date(log[0]?.time ?? "").getTime()).toBeGreaterThan(0);
    expect(await git.log(dir, 1)).toHaveLength(1);
    expect(await git.commitCount(dir)).toBe(3);
  });

  it("computes file stats and a truncated preview", async () => {
    const dir = await tempDir();
    const git = new GitHistory();
    await git.init(dir);
    await writeFile(path.join(dir, "a.ts"), "line1\nline2\n");
    await git.commit(dir, "init commit");
    await writeFile(path.join(dir, "a.ts"), "line1\nchanged\n");
    await git.commit(dir, "second");

    const log = await git.log(dir, 2);
    const second = log[0];
    const init = log[1];
    if (!second || !init) throw new Error("expected two commits");
    expect(await git.fileStats(dir, init.id)).toEqual([{ path: "a.ts", add: 2, del: 0 }]);
    expect(await git.fileStats(dir, second.id)).toEqual([{ path: "a.ts", add: 1, del: 1 }]);

    const preview = await git.filePreview(dir, second.id, "a.ts");
    expect(preview).toContain("-line2");
    expect(preview).toContain("+changed");
    const short = await git.filePreview(dir, second.id, "a.ts", 1);
    expect(short).toMatch(/\+/);
  });

  it("reverts a commit and refuses to revert the root", async () => {
    const dir = await tempDir();
    const git = new GitHistory();
    await git.init(dir);
    await writeFile(path.join(dir, "a.txt"), "one");
    const { commitId: c1 } = await git.commit(dir, "c1");
    await writeFile(path.join(dir, "a.txt"), "two");
    const { commitId: c2 } = await git.commit(dir, "c2");

    const reverted = await git.revert(dir, c2);
    expect(reverted.commitId).not.toBe(c2);
    expect(await readFile(path.join(dir, "a.txt"), "utf8")).toBe("one");

    const root = (await git.log(dir, 100)).at(-1);
    if (!root) throw new Error("expected root commit");
    await expect(git.revert(dir, root.id)).rejects.toThrow(HostError);
    expect(c1).toHaveLength(40);
  });
});
