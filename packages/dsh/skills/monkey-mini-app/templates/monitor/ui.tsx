import { useEffect, useState } from "react";

import {
  AppShell,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Icon,
  PageHeader,
  Progress,
  Sparkline,
  StatCard,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@monkey-mini-app/ui";
import { useDashboardApi } from "@monkeyagent/host";

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
  const { call } = useDashboardApi();
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [memHist, setMemHist] = useState<number[]>([]);
  const [loadHist, setLoadHist] = useState<number[]>([]);

  // ⭐ 关键：轮询 —— 每 2s 拉一次；页面隐藏（或在后台）就停止，避免空跑。
  //         busy 防止上一帧未回再发下一帧；alive 防组件卸载后 setState。
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
  const loadMax = Math.max(4, ...(loadHist.length ? loadHist : [1]));
  const memPct = snap?.memory.usedPct ?? 0;

  return (
    <AppShell header={<PageHeader title="系统监控" description={snap ? `${snap.hostname ?? "本机"} · 每 2 秒刷新` : "正在读取本机指标…"} />}>
      <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto">
        {error && <p className="text-sm" style={{ color: "var(--destructive)" }}>{error}</p>}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title="CPU" value={snap ? `${snap.cpu.count} 核` : "—"}>
            <span className="text-xs text-muted-foreground">{snap?.cpu.model || ""}</span>
          </StatCard>
          <StatCard title="平均负载" value={load ? Number(load["1m"]).toFixed(2) : "—"} delta={snap ? "1 / 5 / 15 分钟" : ""}>
            <span className="text-xs text-muted-foreground">已运行 {fmtUptime(snap?.uptimeSec ?? 0)}</span>
          </StatCard>
          <StatCard title="内存" value={`${memPct}%`} delta={snap ? `${fmtBytes(snap.memory.used)} / ${fmtBytes(snap.memory.total)}` : ""} />
          <StatCard title="磁盘 /" value={snap?.disk ? `${snap.disk.usedPct}%` : "—"} delta={snap?.disk ? `${snap.disk.used} / ${snap.disk.total}` : ""} />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>内存压力 (%)</CardTitle>
              <CardDescription>最近 {memHist.length} 次 · 每 2 秒</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Sparkline data={memHist.map((v) => ({ value: v }))} />
              <Progress value={memPct} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>负载（1 分钟）</CardTitle>
              <CardDescription>峰值 {loadMax.toFixed(2)}</CardDescription>
            </CardHeader>
            <CardContent>
              <Sparkline data={loadHist.map((v) => ({ value: v }))} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>进程</CardTitle>
            <CardDescription>按 CPU 排序 · 跟随刷新</CardDescription>
          </CardHeader>
          <CardContent>
            {!procs.length ? (
              <span className="text-sm text-muted-foreground">还没有进程列表。</span>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">PID</TableHead>
                    <TableHead className="w-24">CPU%</TableHead>
                    <TableHead className="w-24">内存%</TableHead>
                    <TableHead>进程</TableHead>
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
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
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
