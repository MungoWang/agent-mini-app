import { useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ChartContainer,
  Inline,
  Progress,
  Sparkline,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
  useDashboardApi,
} from "@monkeyagent/ui";

function errText(e: unknown) {
  return String((e as Error)?.message || e);
}

function MetricCard({ label, value, sub, children }) {
  return (
    <Card style={{ flex: "1 1 200px", minWidth: 180 }}>
      <CardHeader style={{ paddingBottom: 0 }}>
        <CardDescription>{label}</CardDescription>
        <CardTitle style={{ fontSize: 22, marginTop: 6 }}>{value}</CardTitle>
      </CardHeader>
      <CardContent>
        {sub ? <Text variant="small">{sub}</Text> : null}
        {children}
      </CardContent>
    </Card>
  );
}

export default function Ui() {
  const { call } = useDashboardApi();
  const [snap, setSnap] = useState(null);
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
    <Stack
      gap={16}
      style={{ padding: 24, maxWidth: 1080, margin: "0 auto", width: "100%", boxSizing: "border-box" }}
    >
      <Inline style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <Inline gap={10} style={{ alignItems: "center" }}>
            <Text variant="h2">系统监控</Text>
            {snap ? <Badge variant="secondary">{snap.platform}/{snap.arch}</Badge> : null}
          </Inline>
          <Text variant="muted" style={{ marginTop: 4 }}>
            {snap ? snap.hostname + " · 实时" : "正在读取本机指标…"}
          </Text>
        </div>
        <Button variant="outline" onClick={() => void refresh()}>
          刷新
        </Button>
      </Inline>

      {error ? <Text style={{ color: "var(--destructive)" }}>{error}</Text> : null}

      <Inline style={{ gap: 12, alignItems: "stretch" }}>
        <MetricCard label="CPU" value={snap ? snap.cpu.count + " 核" : "—"} sub={snap?.cpu?.model || ""} />
        <MetricCard
          label="平均负载"
          value={load ? Number(load["1m"]).toFixed(2) + " / " + Number(load["5m"]).toFixed(2) + " / " + Number(load["15m"]).toFixed(2) : "—"}
          sub={snap ? "已运行 " + snap.uptimeLabel : ""}
        />
        <MetricCard
          label="内存"
          value={snap ? snap.memoryLabel.usedPct + "%" : "—"}
          sub={snap ? snap.memoryLabel.used + " / " + snap.memoryLabel.total : ""}
        >
          <div style={{ marginTop: 10 }}>
            <Progress value={snap?.memoryLabel?.usedPct ?? 0} />
          </div>
        </MetricCard>
        <MetricCard
          label="磁盘 /"
          value={disk ? disk.usedPct + "%" : "—"}
          sub={disk ? disk.used + " / " + disk.total : "读取中…"}
        >
          <div style={{ marginTop: 10 }}>
            <Progress value={disk?.usedPct ?? 0} />
          </div>
        </MetricCard>
      </Inline>

      <Inline style={{ gap: 12, alignItems: "stretch" }}>
        <div style={{ flex: "1 1 320px" }}>
          <ChartContainer title="内存压力 (%)">
            <Sparkline data={memHist} max={100} height={88} />
            <Text variant="small" style={{ marginTop: 8 }}>
              最近 {memHist.length} 次 · 每 2 秒
            </Text>
          </ChartContainer>
        </div>
        <div style={{ flex: "1 1 320px" }}>
          <ChartContainer title="负载（1 分钟）">
            <Sparkline data={loadHist} max={loadMax} height={88} />
            <Text variant="small" style={{ marginTop: 8 }}>
              峰值 {loadMax.toFixed(2)}
            </Text>
          </ChartContainer>
        </div>
      </Inline>

      <Card>
        <CardHeader>
          <CardTitle>占用最高的进程</CardTitle>
          <CardDescription>按 CPU 排序，随指标一起刷新</CardDescription>
        </CardHeader>
        <CardContent>
          {!procs.length ? (
            <Text variant="muted">还没有进程列表。</Text>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead style={{ width: 80 }}>PID</TableHead>
                  <TableHead style={{ width: 80 }}>CPU%</TableHead>
                  <TableHead style={{ width: 80 }}>内存%</TableHead>
                  <TableHead>进程</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {procs.map((p) => (
                  <TableRow key={p.pid}>
                    <TableCell style={{ fontFamily: "ui-monospace, monospace" }}>{p.pid}</TableCell>
                    <TableCell>{Number(p.cpu).toFixed(1)}</TableCell>
                    <TableCell>{Number(p.mem).toFixed(1)}</TableCell>
                    <TableCell style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 420 }}>
                      {p.name}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Text variant="small" style={{ opacity: 0.5 }}>
        {snap ? new Date(snap.collectedAt).toLocaleString("zh-CN") : ""}
      </Text>
    </Stack>
  );
}
