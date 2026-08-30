export type Disk = { total: number; used: number; avail: number; usedPct: number; mount: string };
export type Proc = { pid: string; cpu: number; mem: number; name: string };
export type Mem = { total: number; free: number; used: number; usedRatio: number };

export function fmtBytes(n: number) {
  if (n == null || Number.isNaN(n)) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = Number(n);
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return value.toFixed(i === 0 ? 0 : 1) + " " + units[i];
}

export function fmtUptime(sec: number) {
  const s = Math.floor(sec || 0);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return (d ? d + "天 " : "") + h + "小时 " + m + "分";
}

export function parseDarwinVmStat(text: string, pageSize: number): Mem & { inactive: number } {
  const map: Record<string, number> = {};
  String(text || "").split("\n").forEach((line) => {
    const m = line.match(/([^:]+):\s+(\d+)/);
    if (m) map[m[1].trim()] = Number(m[2]);
  });
  const pages = (key: string) => (map[key] || 0) * pageSize;
  const free = pages("Pages free") + pages("Pages speculative");
  const inactive = pages("Pages inactive");
  const used = pages("Pages active") + (pages("Pages wired down") || pages("Pages wired")) + pages("Pages occupied by compressor");
  const total = used + free + inactive;
  return { total, free: free + inactive, used, usedRatio: total ? used / total : 0, inactive };
}

export function parseDf(line: string): Disk | null {
  const parts = String(line || "").trim().split(/\s+/);
  if (parts.length < 6) return null;
  const total = Number(parts[1]) * 1024;
  const used = Number(parts[2]) * 1024;
  const avail = Number(parts[3]) * 1024;
  if (!total) return null;
  return { total, used, avail, usedPct: Math.round((used / total) * 100), mount: parts[parts.length - 1] };
}

export function parseMeminfo(text: string): Mem | null {
  const kv: Record<string, number> = {};
  String(text).split("\n").forEach((line) => {
    const m = line.match(/^(\w+):\s+(\d+)/);
    if (m) kv[m[1]] = Number(m[2]) * 1024;
  });
  if (!kv.MemTotal) return null;
  const free = kv.MemAvailable || kv.MemFree || 0;
  return { total: kv.MemTotal, free, used: kv.MemTotal - free, usedRatio: (kv.MemTotal - free) / kv.MemTotal };
}

export function parsePs(text: string): Proc[] {
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
    .filter((row) => row.pid)
    .slice(0, 8);
}
