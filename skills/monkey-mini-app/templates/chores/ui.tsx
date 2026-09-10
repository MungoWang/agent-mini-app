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
    void call("jobs", {}).then((d) => setJobs((d as { jobs: Job[] }).jobs ?? []));
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
        <Icon.Circle className="size-2 fill-red-400 text-red-400" />
        <Icon.Circle className="size-2 fill-amber-400 text-amber-400" />
        <Icon.Circle className="size-2 fill-emerald-400 text-emerald-400" />
        <span className="font-mono text-xs">chores</span>
        {run ? (
          <Badge variant={run.exitCode === 0 ? "default" : "destructive"} className="ml-auto">
            {run.exitCode === 0 ? "ok" : "fail"}
          </Badge>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2 px-4 py-3">
        {jobs.map((j) => (
          <Button key={j.id} size="sm" variant="outline" disabled={busy !== null} onClick={() => void runJob(j.id)}>
            {busy === j.id ? <Icon.Loader2 className="animate-spin" size={14} /> : <Icon.Play size={14} />}
            {j.title}
          </Button>
        ))}
      </div>
      {error ? <p className="text-destructive px-4 text-sm">{error}</p> : null}
      <div className="min-h-0 flex-1 p-3">
        <Terminal lines={lines} />
      </div>
    </div>
  );
}
