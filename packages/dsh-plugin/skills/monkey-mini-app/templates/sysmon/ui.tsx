import { useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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

function errText(e: unknown) {
  return String((e as Error)?.message || e);
}

export default function Ui() {
  const { call } = useDashboardApi();
  const [snap, setSnap] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [memHist, setMemHist] = useState<number[]>([]);
  const [loadHist, setLoadHist] = useState<number[]>([]);

  useEffect(() => {
    let alive = true;
    let busy = false;

    async function tick() {
      if (busy) return;
      busy = true;
      try {
        const next = await call("getSnapshot", {});
        if (!alive) return;
        setSnap(next);
        setError(null);
        const memPct = next?.memoryLabel?.usedPct ?? 0;
        const load = Number(next?.loadavg?.["1m"] ?? 0);
        setMemHist((prev) => prev.concat(memPct).slice(-48));
        setLoadHist((prev) => prev.concat(load).slice(-48));
      } catch (e) {
        if (alive) setError(errText(e));
      } finally {
        busy = false;
      }
    }

    void tick();
    const id = setInterval(() => void tick(), 2000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [call]);

  async function refresh() {
    try {
      const next = await call("getSnapshot", {});
      setSnap(next);
      setError(null);
    } catch (e) {
      setError(errText(e));
    }
  }

  const disk = snap?.diskLabel;
  const procs = snap?.processes ?? [];
  const load = snap?.loadavg;
  const loadMax = Math.max(4, ...(loadHist.length ? loadHist : [1]));

  return (
    <div className="p-6 w-full box-border flex flex-col gap-4">
      <div className="flex items-start justify-between w-full">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-semibold text-foreground m-0">系统监控</h2>
            {snap ? <Badge variant="secondary">{snap.platform}/{snap.arch}</Badge> : null}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {snap ? snap.hostname + " · 实时" : "正在读取本机指标…"}
          </p>
        </div>
        <Button variant="outline" onClick={() => void refresh()}>
          刷新
        </Button>
      </div>

      {error ? <p className="text-sm" style={{ color: "var(--destructive)" }}>{error}</p> : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="CPU" value={snap ? snap.cpu.count + " 核" : "—"}>
          <span className="text-xs text-muted-foreground">{snap?.cpu?.model || ""}</span>
        </StatCard>
        <StatCard
          title="平均负载"
          value={load ? Number(load["1m"]).toFixed(2) : "—"}
          delta={snap ? "1/5/15 分钟" : ""}
        >
          <span className="text-xs text-muted-foreground">{snap ? "已运行 " + snap.uptimeLabel : ""}</span>
        </StatCard>
        <StatCard
          title="内存"
          value={snap ? snap.memoryLabel.usedPct + "%" : "—"}
          delta={snap ? snap.memoryLabel.used + " / " + snap.memoryLabel.total : ""}
        />
        <StatCard
          title="磁盘 /"
          value={disk ? disk.usedPct + "%" : "—"}
          delta={disk ? disk.used + " / " + disk.total : ""}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>内存压力 (%)</CardTitle>
            <CardDescription>最近 {memHist.length} 次 · 每 2 秒</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Sparkline data={memHist.map((v) => ({ value: v }))} />
            <Progress value={snap?.memoryLabel?.usedPct ?? 0} />
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
          <CardTitle>占用最高的进程</CardTitle>
          <CardDescription>按 CPU 排序，随指标一起刷新</CardDescription>
        </CardHeader>
        <CardContent>
          {!procs.length ? (
            <p className="text-sm text-muted-foreground">还没有进程列表。</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">PID</TableHead>
                  <TableHead className="w-20">CPU%</TableHead>
                  <TableHead className="w-20">内存%</TableHead>
                  <TableHead>进程</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {procs.map((p) => (
                  <TableRow key={p.pid}>
                    <TableCell className="font-mono">{p.pid}</TableCell>
                    <TableCell>{Number(p.cpu).toFixed(1)}</TableCell>
                    <TableCell>{Number(p.mem).toFixed(1)}</TableCell>
                    <TableCell className="max-w-[420px] truncate">{p.name}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs opacity-50 m-0">
        {snap ? new Date(snap.collectedAt).toLocaleString("zh-CN") : ""}
      </p>
    </div>
  );
}
