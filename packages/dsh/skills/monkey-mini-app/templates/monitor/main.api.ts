import { defineDashboard } from "@monkeyagent/dashboard";

// ⭐ 关键：host 已经把 OS 基础指标给到 ctx.system.metrics()（内存/CPU/负载/uptime 都有），
//         不要再用 bash 重算。ctx.bash 只用于拿 host 没有的：ps（进程）、df（磁盘）。
type Proc = { pid: string; cpu: number; mem: number; name: string };

function fmtBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return n.toFixed(i ? 1 : 0) + units[i];
}

async function sh(ctx, cmd: string): Promise<string> {
  try {
    const r = await ctx.bash(cmd);
    if (r.exitCode !== 0) return "";
    return String(r.stdout || "").trim();
  } catch {
    return "";
  }
}

function parseProcesses(text: string): Proc[] {
  // 最后一列是 comm，可能含空格；用最后一段当 name，前面 4 段是 pid/cpu/mem
  if (!text) return [];
  return text
    .split("\n")
    .map((line) => {
      const cols = line.trim().split(/\s+/);
      if (cols.length < 5) return null;
      const cpu = Number(cols[1]);
      const mem = Number(cols[2]);
      if (Number.isNaN(cpu) || Number.isNaN(mem)) return null;
      return { pid: cols[0], cpu, mem, name: cols.slice(3).join(" ") || "?" };
    })
    .filter((p): p is Proc => p !== null)
    .slice(0, 8);
}

function parseDisk(text: string): { total: number; used: number; avail: number; usedPct: number; mount: string } | null {
  const cols = text.trim().split(/\s+/);
  if (cols.length < 5) return null;
  const total = Number(cols[1]) * 1024;
  const used = Number(cols[2]) * 1024;
  const avail = Number(cols[3]) * 1024;
  const usedPct = Number(cols[4]?.replace("%", ""));
  if (Number.isNaN(total) || Number.isNaN(usedPct)) return null;
  return { total, used, avail, usedPct, mount: cols[5] || "/" };
}

export default defineDashboard({
  name: "系统监控",
  description: "CPU / 内存 / 磁盘 / 进程实时指标",
  api: {
    async getSnapshot(ctx) {
      const base = await ctx.system.metrics();
      const platform = base?.platform || "";
      // 内存/CPU/负载由 metrics 提供，这里只补 host 没有的：进程 + 磁盘
      const [psText, dfLine] = await Promise.all([
        sh(ctx, platform === "darwin" ? "ps -axo pid,pcpu,pmem,comm -r | head -n 9" : "ps -axo pid,pcpu,pmem,comm --sort=-pcpu | head -n 9"),
        sh(ctx, "df -k / | tail -1"),
      ]);
      const mem = base?.memory || { total: 0, free: 0, used: 0, usedRatio: 0 };
      const disk = parseDisk(dfLine);
      return {
        hostname: base?.hostname,
        platform,
        arch: base?.arch,
        loadavg: base?.loadavg,
        uptimeSec: base?.uptimeSec,
        collectedAt: Date.now(),
        cpu: { model: base?.cpu?.model || "—", count: base?.cpu?.count || 0 },
        processes: parseProcesses(psText),
        memory: {
          total: mem.total,
          used: mem.used,
          free: mem.free,
          usedPct: Math.round((mem.usedRatio || 0) * 100),
        },
        disk: disk
          ? { total: fmtBytes(disk.total), used: fmtBytes(disk.used), free: fmtBytes(disk.avail), usedPct: disk.usedPct }
          : null,
      };
    },
  },
});
