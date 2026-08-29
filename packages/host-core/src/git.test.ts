import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createGitHistoryAdapter } from "./git.js";

describe("git HistoryPort (isomorphic-git)", () => {
  let dir: string;
  const history = createGitHistoryAdapter();

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "mma-hist-"));
    await history.init(dir);
  });

  it("commits and lists tree", async () => {
    await fs.writeFile(path.join(dir, "a.txt"), "one");
    const { commitId: c1 } = await history.commit(dir, "add a");
    await fs.writeFile(path.join(dir, "a.txt"), "two");
    const { commitId: c2 } = await history.commit(dir, "change a");
    const tree = await history.listCommits(dir);
    expect(tree.head).toBe(c2);
    expect(tree.nodes.some((n) => n.id === c1)).toBe(true);
    expect(tree.nodes.some((n) => n.id === c2)).toBe(true);
    const tip = tree.nodes.find((n) => n.id === c2);
    expect(tip?.parentIds).toContain(c1);
  });

  it("resetTo keeps backup tip visible in tree", async () => {
    await fs.writeFile(path.join(dir, "a.txt"), "one");
    const { commitId: c1 } = await history.commit(dir, "c1");
    await fs.writeFile(path.join(dir, "a.txt"), "two");
    const { commitId: c2 } = await history.commit(dir, "c2");
    const { backupRef } = await history.resetTo(dir, c1);
    expect(backupRef).toBeTruthy();
    const tree = await history.listCommits(dir);
    expect(tree.head).toBe(c1);
    expect(tree.nodes.some((n) => n.id === c2)).toBe(true);
    expect(tree.tips?.some((t) => t.commitId === c2)).toBe(true);
  });

  it("does not track storage/", async () => {
    await fs.mkdir(path.join(dir, "storage"), { recursive: true });
    await fs.writeFile(path.join(dir, "storage", "default.json"), "{}");
    await fs.writeFile(path.join(dir, "app.txt"), "x");
    await history.commit(dir, "app only");
    const raw = await fs.readFile(
      path.join(dir, "storage", "default.json"),
      "utf8"
    );
    expect(raw).toBe("{}");
  });
});
