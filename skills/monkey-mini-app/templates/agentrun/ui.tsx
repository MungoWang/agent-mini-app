import { useCallback, useEffect, useState } from "react";

import {
  ActivityFeed,
  AppShell,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Icon,
  Input,
  PageHeader,
  Stepper,
  StepperItem,
  useApp,
} from "@monkey-mini-app/ui";

type Step = { phase: string; name?: string; turn?: number; text?: string; at: number };
type Run = { goal: string; status: string; steps: Step[]; result: string; startedAt: number };
type AgentEvent =
  | { type: "status"; status: string }
  | { type: "text-delta"; text: string }
  | { type: "tool"; phase: string; name: string }
  | { type: "turn"; phase: string; turn: number }
  | { type: "done"; text: string }
  | { type: "error"; message: string };
type TimelineItem = { id: string; title: string; description?: string; time?: string };

export default function Ui() {
  const { call, on, onAny } = useApp();
  const [goal, setGoal] = useState("");
  const [run, setRun] = useState<Run | null>(null);
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [live, setLive] = useState("");
  const [error, setError] = useState<string | null>(null);

  const applyRun = useCallback((next: Run) => {
    setRun(next);
    setRunning(next?.status === "running");
    if (next?.status !== "running") {
      // finished: the persisted snapshot is authoritative, drop the optimistic feed
      setSteps(next.steps ?? []);
      setLive(next.result ?? "");
    }
  }, []);

  // ⭐ key: fetch the snapshot ONCE, then let ctx.push events keep it current — no interval polling.
  useEffect(() => {
    void (call("runStatus", {}) as Promise<Run>).then(applyRun).catch(() => {});
  }, [call, applyRun]);

  useEffect(() => {
    const offRun = on("run", (data) => applyRun(data as Run));
    const offAgent = on("agent", (data) => {
      const ev = data as AgentEvent;
      const at = Date.now();
      if (ev.type === "text-delta") setLive((prev) => prev + ev.text);
      else if (ev.type === "tool" && ev.phase === "start") setSteps((p) => [...p, { phase: "tool", name: ev.name, at }]);
      else if (ev.type === "turn" && ev.phase === "start") setSteps((p) => [...p, { phase: "turn", turn: ev.turn, at }]);
      else if (ev.type === "done") setSteps((p) => [...p, { phase: "done", at }]);
      else if (ev.type === "error") setSteps((p) => [...p, { phase: "error", text: ev.message, at }]);
    });
    // Events dropped from the host replay buffer (long disconnect): refetch, don't guess.
    const offAny = onAny((e) => {
      if (e.name === "*" && (e.data as { gap?: boolean })?.gap) {
        void (call("runStatus", {}) as Promise<Run>).then(applyRun).catch(() => {});
      }
    });
    return () => {
      offRun();
      offAgent();
      offAny();
    };
  }, [on, onAny, call, applyRun]);

  async function start() {
    setError(null);
    setSteps([]);
    setLive("");
    try {
      await call("start", { goal });
    } catch (e) {
      setError(String((e as Error)?.message || e));
    }
  }

  const items: TimelineItem[] = steps.map((s, i) => ({
    id: String(i),
    title:
      s.phase === "tool"
        ? `调用工具 ${s.name ?? ""}`
        : s.phase === "turn"
          ? `第 ${s.turn} 轮`
          : s.phase === "done"
            ? "完成"
            : s.phase,
    description: s.text ?? (s.phase === "tool" ? "结束" : undefined),
    time: new Date(s.at).toLocaleTimeString("zh-CN"),
  }));
  const statusTone =
    run?.status === "done"
      ? "default"
      : run?.status === "error" || run?.status === "cancelled"
        ? "destructive"
        : "secondary";

  return (
    <AppShell header={<PageHeader title="任务执行器" description="模型跑多步活 · 实时过程 · 可取消" />}>
      <div className="flex h-full min-h-0 max-w-3xl flex-col gap-3 overflow-y-auto">
        <Card>
          <CardHeader>
            <CardTitle>目标</CardTitle>
            <CardDescription>给一个多步目标，模型会拆解并用工具逐步完成</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Input value={goal} placeholder="例如：读 packages/ui/src 下组件，总结导出清单写到 storage" onChange={(e) => setGoal(e.target.value)} />
            <div className="flex items-center gap-2">
              <Button onClick={() => void start()} disabled={running || !goal.trim()}>
                <Icon.Play size={16} strokeWidth={2} /> 开始
              </Button>
              {running && (
                <Button variant="outline" onClick={() => void call("cancel", {})}>
                  <Icon.Square size={16} strokeWidth={2} /> 取消
                </Button>
              )}
              <div className="ml-auto">
                <Badge variant={statusTone}>{run?.status ?? "idle"}</Badge>
              </div>
            </div>
            {error && <p className="text-sm" style={{ color: "var(--destructive)" }}>{error}</p>}
          </CardContent>
        </Card>

        {run && (
          <>
            {/* ⭐ key: use Stepper to show "which step we're on + status of each step" */}
            <Card>
              <CardHeader><CardTitle>进度</CardTitle></CardHeader>
              <CardContent>
                <Stepper orientation="horizontal">
                  {(["理解", "执行", "总结"] as const).map((title, index) => {
                    const current = steps.length >= 2 ? 2 : steps.length;
                    const status =
                      index < current
                        ? "completed"
                        : index === current
                          ? "active"
                          : "default";
                    return <StepperItem key={title} title={title} status={status} />;
                  })}
                </Stepper>
              </CardContent>
            </Card>

            <Card className="min-h-0 flex-1 overflow-hidden">
              <CardHeader><CardTitle>过程</CardTitle><CardDescription>工具调用 / 轮次时间线（SSE 实时）</CardDescription></CardHeader>
              <CardContent className="max-h-72 overflow-y-auto">
                <ActivityFeed items={items} />
              </CardContent>
            </Card>

            {live && (
              <Card>
                <CardHeader><CardTitle>结果</CardTitle></CardHeader>
                <CardContent>
                  <pre className="whitespace-pre-wrap text-sm">{live}</pre>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
