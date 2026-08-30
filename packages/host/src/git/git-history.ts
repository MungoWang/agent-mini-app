import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

import git from "isomorphic-git";

import { HostError } from "../errors.ts";

export type GitAuthor = { name: string; email: string };
export type Commit = { id: string; time: string; message: string };
export type FileStat = { path: string; add: number; del: number };
export type CommitNode = {
  id: string;
  parentIds: string[];
  message: string;
  time: string;
};
export type CommitTree = {
  head: string;
  nodes: CommitNode[];
  tips: { name: string; commitId: string }[];
};

const COMMIT_TTL_MS = 60_000;

const DEFAULT_AUTHOR: GitAuthor = {
  name: "mini-agent",
  email: "agent@local",
};

const GITIGNORE = `storage/
.DS_Store
node_modules/
.ui-build/
`;

async function resolveHead(dir: string): Promise<string | null> {
  try {
    return await git.resolveRef({ fs, dir, ref: "HEAD" });
  } catch {
    return null;
  }
}

async function blobOidAtPath(dir: string, treeOid: string, filepath: string): Promise<string | null> {
  const parts = filepath.split("/").filter(Boolean);
  let oid = treeOid;
  for (let i = 0; i < parts.length; i++) {
    const { tree } = await git.readTree({ fs, dir, oid });
    const entry = tree.find((e) => e.path === parts[i]);
    if (!entry) return null;
    if (i === parts.length - 1) {
      return entry.type === "blob" ? entry.oid : null;
    }
    if (entry.type !== "tree") return null;
    oid = entry.oid;
  }
  return null;
}

async function readBlobText(dir: string, oid: string): Promise<string | null> {
  try {
    const { blob } = await git.readBlob({ fs, dir, oid });
    const buf = Buffer.from(blob);
    if (buf.includes(0)) {
      return null;
    }
    return buf.toString("utf8");
  } catch {
    return null;
  }
}

async function treeFileMap(
  dir: string,
  treeOid: string,
  prefix = "",
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const tree = await git.readTree({ fs, dir, oid: treeOid });
  for (const entry of tree.tree) {
    const fp = prefix ? `${prefix}/${entry.path}` : entry.path;
    if (entry.type === "blob") {
      map.set(fp, entry.oid);
    } else if (entry.type === "tree") {
      const sub = await treeFileMap(dir, entry.oid, fp);
      for (const [k, v] of sub) {
        map.set(k, v);
      }
    }
  }
  return map;
}

function countLines(text: string): number {
  if (text === "") {
    return 0;
  }
  return text.replace(/\n$/, "").split("\n").length;
}

function lineStats(before: string | null, after: string | null): { add: number; del: number } {
  if (before === null && after === null) {
    return { add: -1, del: -1 };
  }
  if (before === null) {
    return { add: countLines(after ?? ""), del: 0 };
  }
  if (after === null) {
    return { add: 0, del: countLines(before) };
  }
  const a = before.replace(/\n$/, "").split("\n");
  const b = after.replace(/\n$/, "").split("\n");
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i]![j] =
        a[i - 1] === b[j - 1] ? dp[i - 1]![j - 1]! + 1 : Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
    }
  }
  const lcs = dp[a.length]![b.length]!;
  return { add: b.length - lcs, del: a.length - lcs };
}

function unifiedDiff(before: string | null, after: string | null): string {
  const a = before == null ? [] : before.replace(/\n$/, "").split("\n");
  const b = after == null ? [] : after.replace(/\n$/, "").split("\n");
  const out: string[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      out.push(` ${a[i]}`);
      i++;
      j++;
      continue;
    }
    let foundJ = -1;
    for (let jj = j; jj < Math.min(j + 40, b.length); jj++) {
      if (a[i] !== undefined && a[i] === b[jj]) {
        foundJ = jj;
        break;
      }
    }
    let foundI = -1;
    for (let ii = i; ii < Math.min(i + 40, a.length); ii++) {
      if (b[j] !== undefined && b[j] === a[ii]) {
        foundI = ii;
        break;
      }
    }
    if (foundJ >= 0 && (foundI < 0 || foundJ - j <= foundI - i)) {
      while (j < foundJ) {
        out.push(`+${b[j]}`);
        j++;
      }
      continue;
    }
    if (foundI >= 0) {
      while (i < foundI) {
        out.push(`-${a[i]}`);
        i++;
      }
      continue;
    }
    if (i < a.length) {
      out.push(`-${a[i]}`);
      i++;
    }
    if (j < b.length) {
      out.push(`+${b[j]}`);
      j++;
    }
  }
  return out.join("\n");
}

async function ensureGitignore(dir: string): Promise<void> {
  const p = path.join(dir, ".gitignore");
  let existing = "";
  try {
    existing = await fsp.readFile(p, "utf8");
  } catch {
    await fsp.writeFile(p, GITIGNORE, "utf8");
    return;
  }
  // Keep older app repos current (e.g. .ui-build/ after reload compile).
  const missing = GITIGNORE.split("\n").filter((line) => {
    const t = line.trim();
    return t && !existing.split("\n").some((e) => e.trim() === t);
  });
  if (missing.length > 0) {
    const next = existing.endsWith("\n") || existing.length === 0
      ? `${existing}${missing.join("\n")}\n`
      : `${existing}\n${missing.join("\n")}\n`;
    await fsp.writeFile(p, next, "utf8");
  }
}

async function listBackupRefs(dir: string): Promise<{ name: string; oid: string }[]> {
  const refsDir = path.join(dir, ".git", "refs", "backup");
  try {
    const names = await fsp.readdir(refsDir);
    const out: { name: string; oid: string }[] = [];
    for (const name of names) {
      const oid = (await fsp.readFile(path.join(refsDir, name), "utf8")).trim();
      out.push({ name: `backup/${name}`, oid });
    }
    return out;
  } catch {
    return [];
  }
}

async function stageAll(dir: string): Promise<void> {
  const status = await git.statusMatrix({ fs, dir });
  for (const [filepath, headStatus, workdirStatus] of status) {
    if (filepath === ".") continue;
    try {
      if (workdirStatus === 0) {
        if (headStatus !== 0) {
          await git.remove({ fs, dir, filepath });
        }
      } else {
        // Always hash-add: statusMatrix can miss same-size, same-mtime edits.
        await git.add({ fs, dir, filepath });
      }
    } catch {
      /* skip unreadable */
    }
  }
}

/** isomorphic-git only. Read + write history for an app directory. */
export class GitHistory {
  private readonly commitCountCache = new Map<string, { at: number; count: number }>();

  private invalidateCount(dir: string): void {
    this.commitCountCache.delete(dir);
  }

  async init(dir: string): Promise<void> {
    await fsp.mkdir(dir, { recursive: true });
    const gitdir = path.join(dir, ".git");
    try {
      await fsp.access(gitdir);
    } catch {
      await git.init({ fs, dir, defaultBranch: "main" });
    }
    await ensureGitignore(dir);
    try {
      await git.resolveRef({ fs, dir, ref: "main" });
    } catch {
      await git.add({ fs, dir, filepath: ".gitignore" });
      await git.commit({
        fs,
        dir,
        message: "init",
        author: DEFAULT_AUTHOR,
      });
      this.invalidateCount(dir);
    }
  }

  async commit(
    dir: string,
    message: string,
    opts?: { author?: GitAuthor },
  ): Promise<{ commitId: string }> {
    await stageAll(dir);
    const commitId = await git.commit({
      fs,
      dir,
      message,
      author: opts?.author ?? DEFAULT_AUTHOR,
    });
    this.invalidateCount(dir);
    return { commitId };
  }

  /**
   * True when worktree or index differs from HEAD.
   * Content-hashes tracked files that statusMatrix marks clean — isomorphic-git
   * can miss same-size / same-mtime edits (see stageAll comment).
   */
  async isDirty(dir: string): Promise<boolean> {
    try {
      const status = await git.statusMatrix({ fs, dir });
      for (const [filepath, head, workdir, stage] of status) {
        if (filepath === ".") continue;
        if (head !== workdir || workdir !== stage) return true;
      }
      const headOid = await resolveHead(dir);
      if (!headOid) return false;
      const { commit } = await git.readCommit({ fs, dir, oid: headOid });
      for (const [filepath, head, workdir] of status) {
        if (filepath === "." || head !== 1 || workdir !== 1) continue;
        try {
          const workBuf = await fsp.readFile(path.join(dir, filepath));
          const { oid: workOid } = await git.hashBlob({ object: workBuf });
          const headBlobOid = await blobOidAtPath(dir, commit.tree, filepath);
          if (!headBlobOid || headBlobOid !== workOid) return true;
        } catch {
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  async listCommits(dir: string, opts?: { limit?: number }): Promise<CommitTree> {
    const limit = opts?.limit ?? 100;
    const nodesMap = new Map<string, CommitNode>();
    const tips: { name: string; commitId: string }[] = [];

    let head = "";
    try {
      head = await git.resolveRef({ fs, dir, ref: "HEAD" });
      tips.push({ name: "main", commitId: head });
    } catch {
      return { head: "", nodes: [], tips: [] };
    }

    const walk = async (oid: string, remaining: number): Promise<void> => {
      if (remaining <= 0 || nodesMap.has(oid)) {
        return;
      }
      const commit = await git.readCommit({ fs, dir, oid });
      const parentIds = commit.commit.parent ?? [];
      nodesMap.set(oid, {
        id: oid,
        parentIds,
        message: commit.commit.message.trim(),
        time: new Date(commit.commit.author.timestamp * 1000).toISOString(),
      });
      for (const parent of parentIds) {
        await walk(parent, remaining - 1);
      }
    };

    await walk(head, limit);

    const backups = await listBackupRefs(dir);
    for (const b of backups) {
      tips.push({ name: b.name, commitId: b.oid });
      await walk(b.oid, limit);
    }

    return {
      head,
      nodes: [...nodesMap.values()],
      tips,
    };
  }

  async revert(
    dir: string,
    commitId: string,
    opts?: { message?: string },
  ): Promise<{ commitId: string }> {
    const target = await git.readCommit({ fs, dir, oid: commitId });
    const parents = target.commit.parent;
    if (parents.length !== 1) {
      throw new HostError("REVERT_CONFLICT", "cannot revert a commit without exactly one parent");
    }
    const parentOid = parents[0]!;
    const parentCommit = await git.readCommit({ fs, dir, oid: parentOid });
    const before = await treeFileMap(dir, parentCommit.commit.tree);
    const after = await treeFileMap(dir, target.commit.tree);
    const allPaths = new Set([...before.keys(), ...after.keys()]);

    const applyParentTree = async (): Promise<void> => {
      for (const fp of allPaths) {
        const b = before.get(fp);
        const a = after.get(fp);
        if (b === a) continue;
        const abs = path.join(dir, fp);
        if (!b) {
          try {
            await fsp.unlink(abs);
          } catch {
            /* missing */
          }
          try {
            await git.remove({ fs, dir, filepath: fp });
          } catch {
            /* missing */
          }
        } else {
          const { blob } = await git.readBlob({ fs, dir, oid: b });
          await fsp.mkdir(path.dirname(abs), { recursive: true });
          await fsp.writeFile(abs, Buffer.from(blob));
          await git.add({ fs, dir, filepath: fp });
        }
      }
    };

    await applyParentTree();
    await stageAll(dir);

    const newId = await git.commit({
      fs,
      dir,
      message: opts?.message ?? `revert: ${commitId.slice(0, 7)}`,
      author: DEFAULT_AUTHOR,
    });
    this.invalidateCount(dir);
    return { commitId: newId };
  }

  async resetTo(
    dir: string,
    commitId: string,
    opts?: { createBackupRef?: boolean },
  ): Promise<{ backupRef?: string }> {
    const createBackup = opts?.createBackupRef !== false;
    let backupRef: string | undefined;
    if (createBackup) {
      try {
        const head = await git.resolveRef({ fs, dir, ref: "HEAD" });
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        const ref = `refs/backup/${stamp}`;
        await git.writeRef({ fs, dir, ref, value: head });
        backupRef = `backup/${stamp}`;
      } catch {
        /* no head yet */
      }
    }
    await git.branch({
      fs,
      dir,
      ref: "main",
      object: commitId,
      force: true,
      checkout: true,
    });
    this.invalidateCount(dir);
    return { backupRef };
  }

  async commitCount(dir: string): Promise<number> {
    const hit = this.commitCountCache.get(dir);
    if (hit && Date.now() - hit.at < COMMIT_TTL_MS) {
      return hit.count;
    }
    let count = 0;
    try {
      const head = await resolveHead(dir);
      if (!head) {
        this.commitCountCache.set(dir, { at: Date.now(), count: 0 });
        return 0;
      }
      const commits = await git.log({ fs, dir, depth: 100_000 });
      count = commits.length;
    } catch {
      count = 0;
    }
    this.commitCountCache.set(dir, { at: Date.now(), count });
    return count;
  }

  async log(dir: string, limit: number): Promise<Commit[]> {
    try {
      const commits = await git.log({ fs, dir, depth: Math.max(1, limit) });
      return commits.map((c) => ({
        id: c.oid,
        time: new Date(c.commit.author.timestamp * 1000).toISOString(),
        message: c.commit.message.trim().split("\n")[0] ?? "",
      }));
    } catch {
      return [];
    }
  }

  async fileStats(dir: string, id: string): Promise<FileStat[]> {
    try {
      const commit = await git.readCommit({ fs, dir, oid: id });
      const afterMap = await treeFileMap(dir, commit.commit.tree);
      let beforeMap = new Map<string, string>();
      const parents = commit.commit.parent ?? [];
      if (parents.length > 0) {
        const parent = await git.readCommit({ fs, dir, oid: parents[0]! });
        beforeMap = await treeFileMap(dir, parent.commit.tree);
      }
      const paths = new Set([...beforeMap.keys(), ...afterMap.keys()]);
      const out: FileStat[] = [];
      for (const fp of [...paths].sort()) {
        const bOid = beforeMap.get(fp);
        const aOid = afterMap.get(fp);
        if (bOid === aOid) continue;
        const beforeTxt = bOid ? await readBlobText(dir, bOid) : null;
        const afterTxt = aOid ? await readBlobText(dir, aOid) : null;
        if ((bOid && beforeTxt === null) || (aOid && afterTxt === null)) {
          out.push({
            path: fp,
            add: aOid ? -1 : 0,
            del: bOid ? -1 : 0,
          });
          continue;
        }
        out.push({
          path: fp,
          ...lineStats(bOid ? beforeTxt : null, aOid ? afterTxt : null),
        });
      }
      return out;
    } catch {
      return [];
    }
  }

  async filePreview(dir: string, id: string, filepath: string, maxLines = 18): Promise<string> {
    try {
      const commit = await git.readCommit({ fs, dir, oid: id });
      const afterMap = await treeFileMap(dir, commit.commit.tree);
      let beforeMap = new Map<string, string>();
      const parents = commit.commit.parent ?? [];
      if (parents.length > 0) {
        const parent = await git.readCommit({ fs, dir, oid: parents[0]! });
        beforeMap = await treeFileMap(dir, parent.commit.tree);
      }
      const bOid = beforeMap.get(filepath);
      const aOid = afterMap.get(filepath);
      if (!bOid && !aOid) {
        return "";
      }
      const before = bOid ? await readBlobText(dir, bOid) : null;
      const after = aOid ? await readBlobText(dir, aOid) : null;
      if (before === null && bOid) {
        return "";
      }
      if (after === null && aOid) {
        return "";
      }
      const diff = unifiedDiff(bOid ? before : null, aOid ? after : null);
      const changeLines = diff.split("\n").filter((l) => l.startsWith("+") || l.startsWith("-"));
      const lines = (changeLines.length ? changeLines : diff.split("\n")).filter((l) => l.length > 0);
      if (lines.length <= maxLines) {
        return lines.join("\n");
      }
      return `${lines.slice(0, maxLines).join("\n")}\n… (+${lines.length - maxLines})`;
    } catch {
      return "";
    }
  }
}
