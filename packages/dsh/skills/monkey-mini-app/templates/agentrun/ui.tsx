import { useEffect, useState } from "react";

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
} from "@monkey-mini-app/ui";
import { useDashboardApi } from "@monkeyagent/host";

type Step = { phase: string; name?: string; turn?: number; text?: string; at: number };
type Run = { goal: string; status: string; steps: Step[]; result: string; startedAt: number };
type TimelineItem = { id: string; title: string; description?: string; time?: string };

export default function Ui() {
  const { call } = useDashboardApi();
  const [goal, setGoal] = useState("");
  const [run, setRun] = useState<Run | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ⭐ 关键：UI 不直接拿 agent 事件 —— 每 300ms 轮询 runStatus（后端 onEvent 已写进 storage）
  useEffect(() => {
    const poll = async () => {
      const r = (await call("runStatus", {})) as Run;
      setRun(r);
      setRunning(r?.status === "running");
    };
    void poll();
    const id = setInterval(() => void poll(), 300);
    return () => clearInterval(id);
  }, [call]);

  async function start() {
    setError(null);
    try {
      await call("start", { goal });
    } catch (e) {
      setError(String((e as Error)?.message || e));
    }
  }

  const items: TimelineItem[] = (run?.steps ?? []).map((s, i) => ({
    id: String(i),
    title: s.phase === "tool" ? `调用工具 ${s.name ?? ""}` : s.phase === "turn" ? `第 ${s.turn} 轮` : s.phase === "done" ? "完成" : s.phase,
    description: s.text ?? (s.phase === "tool" ? "结束" : undefined),
    time: new Date(s.at).toLocaleTimeString("zh-CN"),
  }));
  const statusTone = run?.status === "done" ? "default" : run?.status === "error" || run?.status === "cancelled" ? "destructive" : "secondary";

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
            {/* ⭐ 关键：用 Stepper 展示「进行到第几步 + 每步状态」 */}
            <Card>
              <CardHeader><CardTitle>进度</CardTitle></CardHeader>
              <CardContent>
                <Stepper
                  steps={[
                    { id: "s1", title: "理解" },
                    { id: "s2", title: "执行" },
                    { id: "s3", title: "总结" },
                  ]}
                  current={run.steps.length >= 2 ? 2 : run.steps.length}
                  horizontal
                />
              </CardContent>
            </Card>

            <Card className="min-h-0 flex-1 overflow-hidden">
              <CardHeader><CardTitle>过程</CardTitle><CardDescription>工具调用 / 轮次时间线</CardDescription></CardHeader>
              <CardContent className="max-h-72 overflow-y-auto">
                <ActivityFeed items={items} />
              </CardContent>
            </Card>

            {run.result && (
              <Card>
                <CardHeader><CardTitle>结果</CardTitle></CardHeader>
                <CardContent>
                  <pre className="whitespace-pre-wrap text-sm">{run.result}</pre>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
