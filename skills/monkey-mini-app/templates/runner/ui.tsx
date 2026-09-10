import { useCallback, useEffect, useState } from "react";

import {
  Badge,
  Button,
  Icon,
  Input,
  RunTimeline,
  Terminal,
  useApp,
} from "@monkey-mini-app/ui";

import { EV, type Run, type Step } from "./shared/events";

type AgentEvent =
  | { type: "status"; status: string }
  | { type: "text-delta"; text: string }
  | { type: "tool"; phase: string; name: string }
  | { type: "turn"; phase: string; turn: number }
  | { type: "done"; text: string }
  | { type: "error"; message: string };
type TimelineItem = {
  id: string;
  title: string;
  description?: string;
  time?: string;
  status?: "pass" | "fail" | "running" | "skipped";
};

const LAMP: Record<string, string> = {
  idle: "bg-muted-foreground/40",
  running: "bg-amber-400",
  done: "bg-emerald-400",
  cancelled: "bg-muted-foreground",
  error: "bg-destructive",
};

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
    const offRun = on(EV.run, (data) => applyRun(data as Run));
    const offAgent = on(EV.agent, (data) => {
      const ev = data as AgentEvent;
      const at = Date.now();
      if (ev.type === "text-delta") setLive((prev) => prev + ev.text);
      else if (ev.type === "tool" && ev.phase === "start")
        setSteps((p) => [...p, { phase: "tool", name: ev.name, at }]);
      else if (ev.type === "turn" && ev.phase === "start")
        setSteps((p) => [...p, { phase: "turn", turn: ev.turn, at }]);
      else if (ev.type === "done")
        setSteps((p) => [...p, { phase: "done", at }]);
      else if (ev.type === "error")
        setSteps((p) => [...p, { phase: "error", text: ev.message, at }]);
    });
    // Events dropped from the host replay buffer (long disconnect): refetch, don't guess.
    const offAny = onAny((e) => {
      if (e.name === "*" && (e.data as { gap?: boolean })?.gap) {
        void (call("runStatus", {}) as Promise<Run>)
          .then(applyRun)
          .catch(() => {});
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

  // ⭐ key: a run's phases on a time axis = RunTimeline. Plain ordered events = Timeline.
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
    status:
      s.phase === "error"
        ? "fail"
        : s.phase === "done"
          ? "pass"
          : running && i === steps.length - 1
            ? "running"
            : "skipped",
  }));

  const status = run?.status ?? "idle";

  return (
    // ⭐ Look: terminal — lamp header, a command bar, mono wells. Colour is state, nothing else.
    <div className="flex h-full min-h-0 flex-col bg-background font-mono text-sm">
      <div className="border-border text-muted-foreground flex items-center gap-2 border-b px-4 py-2.5 text-xs">
        <span className={`size-2 rounded-full ${LAMP[status] ?? LAMP.idle}`} />
        runner · {goal.trim() || "未指定目标"}
        <Badge
          variant={status === "error" ? "destructive" : "outline"}
          className="ml-auto"
        >
          {status}
        </Badge>
      </div>

      <div className="border-border flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <Icon.ChevronRight className="text-muted-foreground size-4 shrink-0" />
        <Input
          value={goal}
          placeholder="读 packages/ui/src 下组件，总结导出清单写到 storage"
          onChange={(e) => setGoal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !running && goal.trim()) void start();
          }}
          className="h-8 min-w-52 flex-1 border-0 bg-transparent px-0 font-mono text-sm shadow-none focus-visible:ring-0"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => void start()}
          disabled={running || !goal.trim()}
        >
          <Icon.Play size={14} strokeWidth={2} /> 运行
        </Button>
        {running ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void call("cancel", {})}
          >
            <Icon.Square size={14} strokeWidth={2} /> 取消
          </Button>
        ) : null}
      </div>
      {error ? (
        <p className="text-destructive px-4 py-2 text-xs">{error}</p>
      ) : null}

      <div className="border-border grid min-h-0 flex-1 grid-rows-[auto_1fr]">
        <div className="border-border max-h-56 min-h-0 overflow-y-auto border-b px-4 py-3">
          {items.length ? (
            <RunTimeline items={items} />
          ) : (
            <p className="text-muted-foreground text-xs">等待运行…</p>
          )}
        </div>
        <div className="min-h-0 p-4">
          {/* ⭐ Phosphor well: token surfaces (not the kit's hard zinc), green glow, scanlines
              and a corner vignette on top. Square-ish corners — rounds read as a chat app. */}
          <div
            className="border-border relative h-full min-h-0 overflow-hidden rounded-lg border"
            style={{
              textShadow:
                "0 0 6px color-mix(in oklch, var(--primary) 65%, transparent)",
            }}
          >
            <Terminal
              className="border-border bg-card text-card-foreground h-full rounded-lg"
              lines={live ? live.split("\n") : ["$ 输出会实时写到这里", "$ █"]}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(0deg, color-mix(in oklch, var(--foreground) 7%, transparent) 0 1px, transparent 1px 3px)," +
                  "radial-gradient(120% 90% at 50% 40%, transparent 62%, var(--shadow))",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
