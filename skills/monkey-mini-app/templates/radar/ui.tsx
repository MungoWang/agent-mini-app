import { useEffect, useState } from "react";

import {
  AppShell,
  Button,
  DetailPanel,
  Icon,
  PageHeader,
  Progress,
  Separator,
  useApp,
} from "@monkey-mini-app/ui";

import { EV, type Payload, type Progress as ScanProgress } from "./shared/events";
import { Brief } from "./ui/brief";

type Item = Payload["items"][number];

export default function Ui() {
  const { call, on } = useApp();
  const [data, setData] = useState<Payload | null>(null);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [selected, setSelected] = useState<Item | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => setData((await call("latest", {})) as Payload);

  // ⭐ key: on(EV.progress) / ctx.push(EV.progress) — the name exists only in shared/events.ts.
  useEffect(() => {
    const offProgress = on(EV.progress, (d) => {
      const p = d as ScanProgress;
      setProgress(p);
      if (!p.running && !p.error) void load();
      if (p.error) setError(p.error);
    });
    const offLatest = on(EV.latest, (d) => setData(d as Payload));
    return () => {
      offProgress();
      offLatest();
    };
  }, [on]);

  async function run() {
    setError(null);
    try {
      await call("scan", {}); // fire-and-forget start, returns immediately
    } catch (e) {
      setError(String((e as Error)?.message || e));
    }
  }

  useEffect(() => {
    void load();
  }, [call]);

  const items = data?.items ?? [];
  const running = Boolean(progress?.running);
  const pct = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <AppShell
      header={
        <PageHeader
          title="信息雷达"
          description="公开头条 · 模型整理成三条要点"
          actions={
            <Button disabled={running} onClick={() => void run()}>
              <Icon.Sparkles size={16} strokeWidth={2} /> 整理
            </Button>
          }
        />
      }
    >
      {/* ⭐ Look: editorial — one prose column, hairline rules, a numbered index. No card soup. */}
      <div className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col gap-6 overflow-y-auto px-2 py-2">
        {running ? (
          <div className="flex items-center gap-3">
            <Progress value={pct} className="h-1 flex-1" />
            <span className="text-muted-foreground font-mono text-xs">{progress?.step}</span>
          </div>
        ) : null}
        {error ? <p className="text-destructive text-sm">{error}</p> : null}

        <Brief data={data} stale={!running} />

        <Separator />

        <section>
          <p className="text-muted-foreground mb-2 text-xs tracking-[0.2em] uppercase">
            来源索引 · {items.length}
          </p>
          <ul className="list-none p-0">
            {items.map((it, i) => (
              <li key={it.title + i} className="border-border border-b last:border-b-0">
                <button
                  type="button"
                  onClick={() => setSelected(it)}
                  className="hover:bg-muted/50 flex w-full items-baseline gap-4 px-2 py-3 text-left"
                >
                  <span className="text-muted-foreground font-mono text-xs tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">{it.title}</span>
                  <Icon.ArrowUpRight size={14} strokeWidth={2} className="text-muted-foreground shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* reading a source is still a sheet — the look governs the page, not every overlay */}
      <DetailPanel
        open={Boolean(selected)}
        onOpenChange={(o) => {
          if (!o) setSelected(null);
        }}
        title={selected?.title ?? ""}
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm">{selected?.title}</p>
          {selected?.link ? (
            <a href={selected.link} target="_blank" rel="noreferrer" className="text-primary text-xs hover:underline">
              阅读原文
            </a>
          ) : null}
        </div>
      </DetailPanel>
    </AppShell>
  );
}
