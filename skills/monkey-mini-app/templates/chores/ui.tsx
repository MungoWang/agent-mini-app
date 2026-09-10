import { useEffect, useState } from "react";

import { Badge, Button, Icon, Terminal, useApp } from "@monkey-mini-app/ui";

type Job = { id: string; title: string };
type Run = {
  id: string;
  title: string;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  at: number;
};

export default function Ui() {
  const { call } = useApp();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [run, setRun] = useState<Run | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void call("jobs", {}).then((d) =>
      setJobs((d as { jobs: Job[] }).jobs ?? []),
    );
  }, [call]);

  async function runJob(id: string) {
    setBusy(id);
    setError(null);
    try {
      setRun((await call("run", { id })) as Run);
    } catch (e) {
      setError(String((e as Error)?.message || e));
    } finally {
      setBusy(null);
    }
  }

  const lines = run
    ? [
        `$ ${run.command}`,
        run.stdout.trim() || "(no stdout)",
        run.stderr.trim() ? `stderr:\n${run.stderr.trim()}` : "",
        `exit ${run.exitCode}`,
      ].filter(Boolean)
    : ["点一个按钮。没有对话框，没有模型。"];

  return (
    // ⭐ Look: terminal — buttons on top, kit Terminal well below. Never a prompt box.
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        {/* one state lamp, not three decorative traffic lights: colour = state, and a literal
            `fill-emerald-400` would fight this look's phosphor ground. */}
        <span
          className={`size-2 rounded-full ${busy ? "bg-primary/50" : run ? (run.exitCode === 0 ? "bg-primary" : "bg-destructive") : "bg-muted-foreground/40"}`}
        />
        <span className="font-mono text-xs">chores</span>
        {run ? (
          <Badge
            variant={run.exitCode === 0 ? "default" : "destructive"}
            className="ml-auto"
          >
            {run.exitCode === 0 ? "ok" : "fail"}
          </Badge>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2 px-4 py-3">
        {jobs.map((j) => (
          <Button
            key={j.id}
            size="sm"
            variant="outline"
            disabled={busy !== null}
            onClick={() => void runJob(j.id)}
          >
            {busy === j.id ? (
              <Icon.Loader2 className="animate-spin" size={14} />
            ) : (
              <Icon.Play size={14} />
            )}
            {j.title}
          </Button>
        ))}
      </div>
      {error ? <p className="text-destructive px-4 text-sm">{error}</p> : null}
      <div className="min-h-0 flex-1 p-3">
        {/* ⭐ Same phosphor well as `runner`: token surfaces instead of the kit's hard zinc,
            green glow, scanlines + vignette on a click-through overlay. */}
        <div
          className="border-border relative h-full min-h-0 overflow-hidden rounded-lg border"
          style={{
            textShadow:
              "0 0 6px color-mix(in oklch, var(--primary) 65%, transparent)",
          }}
        >
          <Terminal
            className="bg-card text-card-foreground h-full rounded-lg"
            lines={
              lines.length ? lines : ["$ 挑一个上面的按钮，本机跑一条", "$ █"]
            }
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
  );
}
