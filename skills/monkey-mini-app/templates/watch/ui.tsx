import { useEffect, useState } from "react";

import {
  Reveal,
  Sparkline,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useApp,
} from "@monkey-mini-app/ui";

type Snapshot = {
  hostname?: string;
  platform?: string;
  arch?: string;
  loadavg?: Record<string, number>;
  uptimeSec?: number;
  collectedAt: number;
  cpu: { model: string; count: number };
  processes: { pid: string; cpu: number; mem: number; name: string }[];
  memory: { total: number; used: number; free: number; usedPct: number };
  disk: { total: string; used: string; free: string; usedPct: number } | null;
};

export default function Ui() {
  const { call } = useApp();
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [memHist, setMemHist] = useState<number[]>([]);
  const [loadHist, setLoadHist] = useState<number[]>([]);

  // ⭐ key: polling — fetch every 2s; stop when the page is hidden (in background) to avoid wasted runs.
  //         busy prevents issuing the next tick before the previous one returns; alive prevents setState after unmount.
  useEffect(() => {
    let alive = true;
    let busy = false;
    async function tick() {
      if (busy) return;
      busy = true;
      try {
        const next = (await call("getSnapshot", {})) as Snapshot;
        if (!alive) return;
        setSnap(next);
        setError(null);
        setMemHist((prev) => prev.concat(next.memory.usedPct).slice(-48));
        const load = Number(next.loadavg?.["1m"] ?? 0);
        setLoadHist((prev) => prev.concat(load).slice(-48));
      } catch (e) {
        if (alive) setError(String((e as Error)?.message || e));
      } finally {
        busy = false;
      }
    }
    void tick();
    const id = setInterval(() => void tick(), 2000);
    const stop = () => {
      if (document.hidden) clearInterval(id);
    };
    document.addEventListener("visibilitychange", stop);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", stop);
    };
  }, [call]);

  const procs = snap?.processes ?? [];
  const load = snap?.loadavg;
  const memPct = snap?.memory.usedPct ?? 0;

  return (
    // ⭐ Look: tape — numerals + vertical rules, no card chrome. Reveal only lives on this facade.
    <div className="flex h-full min-h-0 flex-col bg-background font-mono">
      <div className="text-muted-foreground flex items-center justify-between border-b px-4 py-2 text-xs tracking-widest uppercase">
        <span>{snap?.hostname ?? "值班屏"}</span>
        <span>每 2 秒 · {fmtUptime(snap?.uptimeSec ?? 0)}</span>
      </div>
      {error ? <p className="text-destructive px-4 py-2 text-sm">{error}</p> : null}
      <Reveal>
        <div className="grid grid-cols-2 divide-x divide-border md:grid-cols-4">
          <div className="px-4 py-5">
            <div className="text-muted-foreground text-[10px] tracking-widest uppercase">Load</div>
            <div className="mt-1 text-3xl font-medium tracking-tight tabular-nums">{load ? Number(load["1m"]).toFixed(2) : "—"}</div>
          </div>
          <div className="px-4 py-5">
            <div className="text-muted-foreground text-[10px] tracking-widest uppercase">Mem</div>
            <div className="mt-1 text-3xl font-medium tracking-tight tabular-nums">{memPct}%</div>
          </div>
          <div className="px-4 py-5">
            <div className="text-muted-foreground text-[10px] tracking-widest uppercase">Disk</div>
            <div className="mt-1 text-3xl font-medium tracking-tight tabular-nums">{snap?.disk ? `${snap.disk.usedPct}%` : "—"}</div>
          </div>
          <div className="px-4 py-5">
            <div className="text-muted-foreground text-[10px] tracking-widest uppercase">CPU</div>
            <div className="mt-1 text-3xl font-medium tracking-tight tabular-nums">{snap ? snap.cpu.count : "—"}</div>
          </div>
        </div>
      </Reveal>
      <div className="grid grid-cols-2 gap-0 border-t">
        <div className="border-r p-4">
          <Sparkline data={memHist.map((v) => ({ value: v }))} />
        </div>
        <div className="p-4">
          <Sparkline data={loadHist.map((v) => ({ value: v }))} />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto border-t">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">PID</TableHead>
              <TableHead className="w-24">CPU%</TableHead>
              <TableHead className="w-24">MEM%</TableHead>
              <TableHead>PROC</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {procs.map((p) => (
              <TableRow key={p.pid}>
                <TableCell className="font-mono">{p.pid}</TableCell>
                <TableCell>{p.cpu.toFixed(1)}</TableCell>
                <TableCell>{p.mem.toFixed(1)}</TableCell>
                <TableCell className="max-w-[420px] truncate">{p.name}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

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

function fmtUptime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}
