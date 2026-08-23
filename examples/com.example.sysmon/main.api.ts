import { defineDashboard } from "@monkeyagent/dashboard";

function fmtBytes(n) {
  if (n == null || isNaN(n)) return "—";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let v = Number(n);
  let i = 0;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return v.toFixed(i === 0 ? 0 : 1) + " " + u[i];
}

function fmtUptime(sec) {
  const s = Math.floor(sec || 0);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return (d ? d + "d " : "") + h + "h " + m + "m";
}

async function sh(ctx, cmd) {
  try {
    const r = await ctx.bash(cmd);
    return String((r && r.stdout) || "").trim();
  } catch (e) {
    ctx.log("bash fail", cmd, String(e));
    return "";
  }
}

function parseDarwinVmStat(text, pageSize) {
  const map = {};
  String(text || "").split("\n").forEach((line) => {
    const m = line.match(/([^:]+):\s+([\d]+)/);
    if (m) map[m[1].trim()] = Number(m[2]);
  });
  const pages = (k) => (map[k] || 0) * pageSize;
  const free = pages("Pages free") + pages("Pages speculative");
  const active = pages("Pages active");
  const inactive = pages("Pages inactive");
  const wired = pages("Pages wired down") || pages("Pages wired");
  const compressed = pages("Pages occupied by compressor");
  const used = active + wired + compressed;
  return { free, active, inactive, wired, compressed, used };
}

function parseDf(line) {
  const parts = String(line || "").trim().split(/\s+/);
  if (parts.length < 6) return null;
  const total = Number(parts[1]) * 1024;
  const used = Number(parts[2]) * 1024;
  const avail = Number(parts[3]) * 1024;
  return { total, used, avail, usedPct: total ? Math.round((used / total) * 100) : 0, mount: parts[parts.length - 1] };
}

function parsePs(text) {
  return String(text || "")
    .split("\n")
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const p = line.split(/\s+/);
      return {
        pid: p[0],
        cpu: Number(p[1]) || 0,
        mem: Number(p[2]) || 0,
        name: p.slice(3).join(" ").replace(/^.*\//, "").slice(0, 40),
      };
    })
    .filter((x) => x.pid)
    .slice(0, 8);
}

export default defineDashboard({
  name: "SysMon",
  description: "Live host resource monitor (os + bash: df, vm_stat/meminfo, ps)",
  api: {
    async getSnapshot(ctx) {
      const base = ctx.system && (await ctx.system.metrics());
      const platform = (base && base.platform) || "";
      let mem = base ? Object.assign({}, base.memory) : { total: 0, free: 0, used: 0, usedRatio: 0 };
      let cpuModel = (base && base.cpu && base.cpu.model) || "";
      let cpuCount = (base && base.cpu && base.cpu.count) || 0;
      let disk = null;
      let procs = [];

      if (platform === "darwin") {
        const vm = await sh(ctx, "vm_stat");
        const pageStr = await sh(ctx, "pagesize");
        const dfLine = await sh(ctx, "df -k / | tail -1");
        const psText = await sh(ctx, "ps -axo pid,pcpu,pmem,comm -r | head -n 9");
        const brand = await sh(ctx, "sysctl -n machdep.cpu.brand_string");
        const ncpu = await sh(ctx, "sysctl -n hw.logicalcpu");
        const pageSize = Number(pageStr) || 16384;
        const parsed = parseDarwinVmStat(vm, pageSize);
        if (parsed.used || parsed.free) {
          const total = mem.total || parsed.used + parsed.free + parsed.inactive;
          mem = {
            total,
            free: parsed.free + parsed.inactive,
            used: parsed.used,
            usedRatio: total ? parsed.used / total : 0,
            wired: parsed.wired,
            compressed: parsed.compressed,
            inactive: parsed.inactive,
          };
        }
        disk = parseDf(dfLine);
        procs = parsePs(psText);
        if (brand) cpuModel = brand;
        if (Number(ncpu)) cpuCount = Number(ncpu);
      } else {
        const meminfo = await sh(ctx, "cat /proc/meminfo 2>/dev/null | head -n 8");
        const dfLine = await sh(ctx, "df -k / | tail -1");
        const psText = await sh(ctx, "ps -axo pid,pcpu,pmem,comm --sort=-pcpu 2>/dev/null | head -n 9");
        const kv = {};
        String(meminfo).split("\n").forEach((line) => {
          const m = line.match(/^(\w+):\s+(\d+)/);
          if (m) kv[m[1]] = Number(m[2]) * 1024;
        });
        if (kv.MemTotal) {
          const free = kv.MemAvailable || kv.MemFree || 0;
          mem = {
            total: kv.MemTotal,
            free,
            used: kv.MemTotal - free,
            usedRatio: (kv.MemTotal - free) / kv.MemTotal,
          };
        }
        disk = parseDf(dfLine);
        procs = parsePs(psText);
      }

      return {
        hostname: base && base.hostname,
        platform: base && base.platform,
        arch: base && base.arch,
        uptimeSec: base && base.uptimeSec,
        loadavg: base && base.loadavg,
        collectedAt: Date.now(),
        cpu: { model: cpuModel, count: cpuCount, speedMHz: base && base.cpu && base.cpu.speedMHz },
        memory: mem,
        disk,
        processes: procs,
        memoryLabel: {
          total: fmtBytes(mem.total),
          used: fmtBytes(mem.used),
          free: fmtBytes(mem.free),
          usedPct: Math.round((mem.usedRatio || 0) * 100),
        },
        diskLabel: disk
          ? {
              total: fmtBytes(disk.total),
              used: fmtBytes(disk.used),
              free: fmtBytes(disk.avail),
              usedPct: disk.usedPct,
              mount: disk.mount,
            }
          : null,
        uptimeLabel: fmtUptime(base && base.uptimeSec),
      };
    },
  },
});
