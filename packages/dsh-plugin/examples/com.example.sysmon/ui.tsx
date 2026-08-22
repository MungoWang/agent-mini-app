import { useEffect, useRef, useState } from "react";
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

function MetricCard(props) {
  return (
    <Card style={{ flex: "1 1 200px", minWidth: 180 }}>
      <CardHeader style={{ paddingBottom: 0 }}>
        <CardDescription>{props.label}</CardDescription>
        <CardTitle style={{ fontSize: 22, marginTop: 6 }}>{props.value}</CardTitle>
      </CardHeader>
      <CardContent>
        {props.sub ? <Text variant="small">{props.sub}</Text> : null}
        {props.children}
      </CardContent>
    </Card>
  );
}

export default function Ui() {
  const { call } = useDashboardApi();
  const [snap, setSnap] = useState(null);
  const [error, setError] = useState(null);
  const [memHist, setMemHist] = useState([]);
  const [loadHist, setLoadHist] = useState([]);
  const timer = useRef(null);

  async function tick() {
    try {
      const s = await call("getSnapshot", {});
      setSnap(s);
      setError(null);
      const memPct = s && s.memoryLabel ? s.memoryLabel.usedPct : 0;
      const load = s && s.loadavg ? Number(s.loadavg["1m"]) : 0;
      setMemHist((h) => h.concat(memPct).slice(-48));
      setLoadHist((h) => h.concat(load).slice(-48));
    } catch (e) {
      setError(String((e && e.message) || e));
    }
  }

  useEffect(() => {
    void tick();
    timer.current = setInterval(() => void tick(), 2000);
    return () => clearInterval(timer.current);
  }, []);

  const m = snap;
  const disk = m && m.diskLabel;
  const procs = (m && m.processes) || [];
  const loadMax = Math.max(4, ...(loadHist.length ? loadHist : [1]));

  return (
    <Stack style={{ padding: 24, maxWidth: 1080, margin: "0 auto", gap: 16 }}>
      <Inline style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <Inline gap={10} style={{ alignItems: "center" }}>
            <Text variant="h2">System Monitor</Text>
            {m ? <Badge variant="secondary">{m.platform}/{m.arch}</Badge> : null}
          </Inline>
          <Text variant="muted" style={{ marginTop: 4 }}>
            {m ? m.hostname + " · live via ctx.bash + os" : "Connecting to host metrics…"}
          </Text>
        </div>
        <Button variant="outline" onClick={() => void tick()}>
          Refresh
        </Button>
      </Inline>

      {error ? (
        <Card>
          <CardContent>
            <Text style={{ color: "var(--destructive)" }}>{error}</Text>
          </CardContent>
        </Card>
      ) : null}

      <Inline style={{ gap: 12, alignItems: "stretch" }}>
        <MetricCard
          label="CPU"
          value={m ? m.cpu.count + " cores" : "—"}
          sub={m ? m.cpu.model : ""}
        />
        <MetricCard
          label="Load average"
          value={
            m
              ? m.loadavg["1m"].toFixed(2) + " / " + m.loadavg["5m"].toFixed(2) + " / " + m.loadavg["15m"].toFixed(2)
              : "—"
          }
          sub={m ? "uptime " + m.uptimeLabel : ""}
        />
        <MetricCard
          label="Memory"
          value={m ? m.memoryLabel.usedPct + "%" : "—"}
          sub={m ? m.memoryLabel.used + " of " + m.memoryLabel.total : ""}
        >
          <div style={{ marginTop: 10 }}>
            <Progress value={m ? m.memoryLabel.usedPct : 0} />
          </div>
        </MetricCard>
        <MetricCard
          label="Disk /"
          value={disk ? disk.usedPct + "%" : "—"}
          sub={disk ? disk.used + " of " + disk.total : "waiting for df…"}
        >
          <div style={{ marginTop: 10 }}>
            <Progress value={disk ? disk.usedPct : 0} />
          </div>
        </MetricCard>
      </Inline>

      <Inline style={{ gap: 12, alignItems: "stretch" }}>
        <div style={{ flex: "1 1 320px" }}>
          <ChartContainer title="Memory pressure (%)">
            <Sparkline data={memHist} max={100} height={88} />
            <Text variant="small" style={{ marginTop: 8 }}>
              last {memHist.length} samples · 2s interval
            </Text>
          </ChartContainer>
        </div>
        <div style={{ flex: "1 1 320px" }}>
          <ChartContainer title="Load (1m)">
            <Sparkline data={loadHist} max={loadMax} height={88} />
            <Text variant="small" style={{ marginTop: 8 }}>
              scale auto · peak {loadMax.toFixed(2)}
            </Text>
          </ChartContainer>
        </div>
      </Inline>

      <Card>
        <CardHeader>
          <CardTitle>Top processes</CardTitle>
          <CardDescription>ps sorted by CPU · refreshed with metrics</CardDescription>
        </CardHeader>
        <CardContent>
          {!procs.length ? (
            <Text variant="muted">No process list yet (bash/ps).</Text>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead style={{ width: 80 }}>PID</TableHead>
                  <TableHead style={{ width: 80 }}>CPU%</TableHead>
                  <TableHead style={{ width: 80 }}>MEM%</TableHead>
                  <TableHead>Command</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {procs.map((p) => (
                  <TableRow key={String(p.pid)}>
                    <TableCell style={{ fontFamily: "ui-monospace, monospace" }}>{p.pid}</TableCell>
                    <TableCell>{p.cpu.toFixed(1)}</TableCell>
                    <TableCell>{p.mem.toFixed(1)}</TableCell>
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
        {m ? new Date(m.collectedAt).toLocaleString() + " · sources: os + vm_stat/meminfo + df + ps" : ""}
      </Text>
    </Stack>
  );
}
