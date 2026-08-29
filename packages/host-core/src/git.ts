/** host-core git：全部走 isomorphic-git（读写一体，无 CLI）。
 *  HistoryPort writes (init/commit/list/revert/resetTo) + host UI reads. */
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import git from "isomorphic-git";
import type { HistoryPort, CommitNode } from "./ports.js";

const commitCountCache = new Map<string, { at: number; count: number }>();
const COMMIT_TTL_MS = 60_000;

async function resolveHead(dir: string): Promise<string | null> {
  try {
    return await git.resolveRef({ fs, dir, ref: "HEAD" });
  } catch {
    return null;
  }
}

async function readBlobText(dir: string, oid: string): Promise<string | null> {
  try {
    const { blob } = await git.readBlob({ fs, dir, oid });
    // Treat as text; binary detection is approximate
    const buf = Buffer.from(blob);
    if (buf.includes(0)) return null;
    return buf.toString("utf8");
  } catch {
    return null;
  }
}

async function treeFileMap(
  dir: string,
  treeOid: string,
  prefix = ""
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const tree = await git.readTree({ fs, dir, oid: treeOid });
  for (const entry of tree.tree) {
    const fp = prefix ? `${prefix}/${entry.path}` : entry.path;
    if (entry.type === "blob") map.set(fp, entry.oid);
    else if (entry.type === "tree") {
      const sub = await treeFileMap(dir, entry.oid, fp);
      for (const [k, v] of sub) map.set(k, v);
    }
  }
  return map;
}

function countLines(text: string): number {
  if (text === "") return 0;
  return text.replace(/\n$/, "").split("\n").length;
}

function lineStats(before: string | null, after: string | null): { add: number; del: number } {
  if (before === null && after === null) return { add: -1, del: -1 };
  if (before === null) return { add: countLines(after ?? ""), del: 0 };
  if (after === null) return { add: 0, del: countLines(before) };
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
  // Simple line-oriented diff (enough for preview UI)
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
    // look ahead for match
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

export async function gitCommitCount(dir: string): Promise<number> {
  const hit = commitCountCache.get(dir);
  if (hit && Date.now() - hit.at < COMMIT_TTL_MS) return hit.count;
  let count = 0;
  try {
    const head = await resolveHead(dir);
    if (!head) {
      commitCountCache.set(dir, { at: Date.now(), count: 0 });
      return 0;
    }
    const commits = await git.log({ fs, dir, depth: 100_000 });
    count = commits.length;
  } catch {
    count = 0;
  }
  commitCountCache.set(dir, { at: Date.now(), count });
  return count;
}

/** git log：id / 时间戳 / message（新→旧）。无 git 仓库返回空数组。 */
export async function gitLog(
  dir: string,
  limit: number
): Promise<{ id: string; time: string; message: string }[]> {
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

/** 单 commit 的文件改动统计（add/del 行数；二进制或不可解析为 -1）。 */
export async function gitFileStats(
  dir: string,
  id: string
): Promise<{ path: string; add: number; del: number }[]> {
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
    const out: { path: string; add: number; del: number }[] = [];
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

/** 单文件 diff 预览：最多 maxLines 行，超出省略。 */
export async function gitFilePreview(
  dir: string,
  id: string,
  filepath: string,
  maxLines = 18
): Promise<string> {
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
    if (!bOid && !aOid) return "";
    const before = bOid ? await readBlobText(dir, bOid) : null;
    const after = aOid ? await readBlobText(dir, aOid) : null;
    if (before === null && bOid) return ""; // binary
    if (after === null && aOid) return "";
    const diff = unifiedDiff(bOid ? before : null, aOid ? after : null);
    // Prefer lines that show changes (match CLI `git show` patch feel for tests)
    const changeLines = diff
      .split("\n")
      .filter((l) => l.startsWith("+") || l.startsWith("-"));
    const lines = (changeLines.length ? changeLines : diff.split("\n")).filter(
      (l) => l.length > 0
    );
    if (lines.length <= maxLines) return lines.join("\n");
    return lines.slice(0, maxLines).join("\n") + `\n… (+${lines.length - maxLines} 行省略)`;
  } catch {
    return "";
  }
}

/** Clear commit-count cache (tests). */
export function clearGitCommitCountCache(): void {
  commitCountCache.clear();
}

/** Test/helper: init empty repo on main (isomorphic only). */
export async function gitInitRepo(dir: string): Promise<void> {
  await fsp.mkdir(dir, { recursive: true });
  await git.init({ fs, dir, defaultBranch: "main" });
}

/** Test/helper: stage all + commit (isomorphic only). */
export async function gitCommitAll(dir: string, message: string): Promise<string> {
  const status = await git.statusMatrix({ fs, dir });
  for (const [filepath, , workdirStatus, stageStatus] of status) {
    if (filepath === ".") continue;
    if (workdirStatus !== stageStatus || workdirStatus === 0) {
      try {
        if (workdirStatus === 0) await git.remove({ fs, dir, filepath });
        else await git.add({ fs, dir, filepath });
      } catch {
        /* skip */
      }
    }
  }
  return git.commit({
    fs,
    dir,
    message,
    author: { name: "t", email: "t@t" },
  });
}

const DEFAULT_AUTHOR = {
  name: "mini-agent",
  email: "agent@local",
};

const GITIGNORE = `storage/
.DS_Store
node_modules/
`;

async function ensureGitignore(dir: string): Promise<void> {
  const p = path.join(dir, ".gitignore");
  try {
    await fsp.access(p);
  } catch {
    await fsp.writeFile(p, GITIGNORE, "utf8");
  }
}

async function listBackupRefs(
  dir: string
): Promise<{ name: string; oid: string }[]> {
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

/** HistoryPort writes via isomorphic-git (same module as read helpers). */
export function createGitHistoryAdapter(): HistoryPort {
  return {
    async init(appDir: string) {
      await fsp.mkdir(appDir, { recursive: true });
      const gitdir = path.join(appDir, ".git");
      try {
        await fsp.access(gitdir);
      } catch {
        await git.init({ fs, dir: appDir, defaultBranch: "main" });
      }
      await ensureGitignore(appDir);
      try {
        await git.resolveRef({ fs, dir: appDir, ref: "main" });
      } catch {
        await git.add({ fs, dir: appDir, filepath: ".gitignore" });
        await git.commit({
          fs,
          dir: appDir,
          message: "init",
          author: DEFAULT_AUTHOR,
        });
      }
    },

    async commit(appDir, message, opts) {
      const status = await git.statusMatrix({ fs, dir: appDir });
      for (const [filepath, , workdirStatus, stageStatus] of status) {
        if (filepath === ".") continue;
        if (workdirStatus !== stageStatus || workdirStatus === 0) {
          try {
            if (workdirStatus === 0) {
              await git.remove({ fs, dir: appDir, filepath });
            } else {
              await git.add({ fs, dir: appDir, filepath });
            }
          } catch {
            /* skip unreadable */
          }
        }
      }
      const commitId = await git.commit({
        fs,
        dir: appDir,
        message,
        author: opts?.author ?? DEFAULT_AUTHOR,
      });
      return { commitId };
    },

    async listCommits(appDir, opts) {
      const limit = opts?.limit ?? 100;
      const nodesMap = new Map<string, CommitNode>();
      const tips: { name: string; commitId: string }[] = [];

      let head = "";
      try {
        head = await git.resolveRef({ fs, dir: appDir, ref: "HEAD" });
        tips.push({ name: "main", commitId: head });
      } catch {
        return { head: "", nodes: [], tips: [] };
      }

      async function walk(oid: string, remaining: number) {
        if (remaining <= 0 || nodesMap.has(oid)) return;
        const commit = await git.readCommit({ fs, dir: appDir, oid });
        const parentIds = commit.commit.parent ?? [];
        nodesMap.set(oid, {
          id: oid,
          parentIds,
          message: commit.commit.message.trim(),
          time: new Date(commit.commit.author.timestamp * 1000).toISOString(),
        });
        for (const p of parentIds) {
          await walk(p, remaining - 1);
        }
      }

      await walk(head, limit);

      const backups = await listBackupRefs(appDir);
      for (const b of backups) {
        tips.push({ name: b.name, commitId: b.oid });
        await walk(b.oid, limit);
      }

      return {
        head,
        nodes: [...nodesMap.values()],
        tips,
      };
    },

    async revert(appDir, commitId, opts) {
      const target = await git.readCommit({ fs, dir: appDir, oid: commitId });
      const parents = target.commit.parent;
      if (parents.length !== 1) {
        throw Object.assign(new Error("REVERT_CONFLICT"), {
          code: "REVERT_CONFLICT",
        });
      }
      const parentOid = parents[0]!;
      const parentCommit = await git.readCommit({
        fs,
        dir: appDir,
        oid: parentOid,
      });
      const before = await treeFileMap(appDir, parentCommit.commit.tree);
      const after = await treeFileMap(appDir, target.commit.tree);
      const allPaths = new Set([...before.keys(), ...after.keys()]);

      async function applyParentTree() {
        for (const fp of allPaths) {
          const b = before.get(fp);
          const a = after.get(fp);
          if (b === a) continue;
          const abs = path.join(appDir, fp);
          if (!b) {
            try {
              await fsp.unlink(abs);
            } catch {
              /* */
            }
            try {
              await git.remove({ fs, dir: appDir, filepath: fp });
            } catch {
              /* */
            }
          } else {
            const { blob } = await git.readBlob({
              fs,
              dir: appDir,
              oid: b,
            });
            await fsp.mkdir(path.dirname(abs), { recursive: true });
            await fsp.writeFile(abs, Buffer.from(blob));
            await git.add({ fs, dir: appDir, filepath: fp });
          }
        }
      }

      await applyParentTree();
      try {
        await git.checkout({ fs, dir: appDir, ref: "main", force: true });
      } catch {
        /* */
      }
      await applyParentTree();

      const newId = await git.commit({
        fs,
        dir: appDir,
        message: opts?.message ?? `revert: ${commitId.slice(0, 7)}`,
        author: DEFAULT_AUTHOR,
      });
      return { commitId: newId };
    },

    async resetTo(appDir, commitId, opts) {
      const createBackup = opts?.createBackupRef !== false;
      let backupRef: string | undefined;
      if (createBackup) {
        try {
          const head = await git.resolveRef({ fs, dir: appDir, ref: "HEAD" });
          const stamp = new Date().toISOString().replace(/[:.]/g, "-");
          const ref = `refs/backup/${stamp}`;
          await git.writeRef({ fs, dir: appDir, ref, value: head });
          backupRef = `backup/${stamp}`;
        } catch {
          /* no head yet */
        }
      }
      await git.branch({
        fs,
        dir: appDir,
        ref: "main",
        object: commitId,
        force: true,
        checkout: true,
      });
      return { backupRef };
    },
  };
}
