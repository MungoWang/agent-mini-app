import { defineDashboard } from "@monkeyagent/dashboard";
import {
  fmtBytes,
  fmtUptime,
  parseDarwinVmStat,
  parseDf,
  parseMeminfo,
  parsePs,
  type Mem,
} from "./lib/hostStats";

async function sh(ctx, cmd: string): Promise<string> {
  try {
    const r = await ctx.bash(cmd);
    if (r.exitCode !== 0) return "";
    return String(r.stdout || "").trim();
  } catch (e) {
    ctx.log("bash fail", cmd, String(e));
    return "";
  }
}

function labelMem(mem: Mem) {
  return {
    total: fmtBytes(mem.total),
    used: fmtBytes(mem.used),
    free: fmtBytes(mem.free),
    usedPct: Math.round((mem.usedRatio || 0) * 100),
  };
}

export default defineDashboard({
  name: "系统监控",
  description: "CPU、内存、磁盘和进程",
  api: {
    async getSnapshot(ctx) {
      const base = ctx.system && (await ctx.system.metrics());
      const platform = base?.platform || "";
      let mem: Mem = base?.memory ? { ...base.memory } : { total: 0, free: 0, used: 0, usedRatio: 0 };
      let cpuModel = base?.cpu?.model || "";
      let cpuCount = base?.cpu?.count || 0;
      let disk = null;
      let processes = [];

      if (platform === "darwin") {
        const [vm, pageStr, dfLine, psText, brand, ncpu] = await Promise.all([
          sh(ctx, "vm_stat"),
          sh(ctx, "pagesize"),
          sh(ctx, "df -k / | tail -1"),
          sh(ctx, "ps -axo pid,pcpu,pmem,comm -r | head -n 9"),
          sh(ctx, "sysctl -n machdep.cpu.brand_string"),
          sh(ctx, "sysctl -n hw.logicalcpu"),
        ]);
        const parsed = parseDarwinVmStat(vm, Number(pageStr) || 16384);
        if (parsed.used || parsed.free) mem = { ...parsed, total: mem.total || parsed.total };
        disk = parseDf(dfLine);
        processes = parsePs(psText);
        if (brand) cpuModel = brand;
        if (Number(ncpu)) cpuCount = Number(ncpu);
      } else {
        const [meminfo, dfLine, psText] = await Promise.all([
          sh(ctx, "cat /proc/meminfo 2>/dev/null | head -n 8"),
          sh(ctx, "df -k / | tail -1"),
          sh(ctx, "ps -axo pid,pcpu,pmem,comm --sort=-pcpu 2>/dev/null | head -n 9"),
        ]);
        mem = parseMeminfo(meminfo) || mem;
        disk = parseDf(dfLine);
        processes = parsePs(psText);
      }

      return {
        hostname: base?.hostname,
        platform: base?.platform,
        arch: base?.arch,
        loadavg: base?.loadavg,
        collectedAt: Date.now(),
        cpu: { model: cpuModel, count: cpuCount },
        processes,
        memoryLabel: labelMem(mem),
        diskLabel: disk
          ? {
              total: fmtBytes(disk.total),
              used: fmtBytes(disk.used),
              free: fmtBytes(disk.avail),
              usedPct: disk.usedPct,
              mount: disk.mount,
            }
          : null,
        uptimeLabel: fmtUptime(base?.uptimeSec || 0),
      };
    },
  },
});
