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
  DetailPanel,
  Icon,
  PageHeader,
  Progress,
} from "@monkey-mini-app/ui";
import { useDashboardApi } from "@monkeyagent/host";

type Digest = { headline: string; bullets: string[] };
type Item = { title: string; link?: string };
type Payload = { items: Item[]; digest: Digest | null; at: number };
type Progress = { running: boolean; step: string; done: number; total: number; error?: string };

export default function Ui() {
  const { call } = useDashboardApi();
  const [data, setData] = useState<Payload | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [selected, setSelected] = useState<Item | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => setData((await call("latest", {})) as Payload);

  async function run() {
    setError(null);
    try {
      await call("scan", {}); // fire-and-forget 启动，立即返回
      // ⭐ 关键：长任务进度 —— UI 轮询 scanStatus 直到 running=false
      const iv = setInterval(async () => {
        const p = (await call("scanStatus", {})) as Progress;
        setProgress(p);
        if (!p.running) {
          clearInterval(iv);
          await load();
        }
      }, 300);
      // 兜底：一段时间后强制停轮询（防止 progress 卡在 running）
      setTimeout(() => clearInterval(iv), 60_000);
    } catch (e) {
      setError(String((e as Error)?.message || e));
    }
  }

  useEffect(() => {
    void load();
  }, [call]);

  const digest = data?.digest;
  const items = data?.items ?? [];
  const pct = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <AppShell
      header={
        <PageHeader
          title="今日摘要"
          description="公开头条 · 模型整理成三条要点"
          actions={<Button disabled={progress?.running} onClick={() => void run()}><Icon.Sparkles size={16} strokeWidth={2} /> 整理</Button>}
        />
      }
    >
      <div className="grid h-full min-h-0 grid-cols-1 gap-3 md:grid-cols-[1fr_360px]">
        {/* 主从：左列表 */}
        <Card className="min-h-0 overflow-hidden">
          <CardHeader>
            <CardTitle>来源</CardTitle>
            <CardDescription>点击看详情</CardDescription>
            {progress?.running && (
              <div className="flex items-center gap-2">
                <Progress value={pct} className="flex-1" />
                <span className="text-xs text-muted-foreground">{progress.step}</span>
              </div>
            )}
            {error && <p className="text-sm" style={{ color: "var(--destructive)" }}>{error}</p>}
          </CardHeader>
          <CardContent className="flex flex-col min-h-0 flex-1 gap-1 overflow-y-auto">
            {items.map((it, i) => (
              <button
                key={it.title + i}
                onClick={() => setSelected(it)}
                className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50"
              >
                <span className="min-w-0 flex-1 truncate">{it.title}</span>
                <Icon.ChevronRight size={16} strokeWidth={2} className="shrink-0 text-muted-foreground" />
              </button>
            ))}
          </CardContent>
        </Card>

        {/* 主从：右详情（选中某条才开，关掉即清） */}
        <DetailPanel
          open={Boolean(selected)}
          onOpenChange={(o) => { if (!o) setSelected(null); }}
          title={selected?.title ?? digest?.headline ?? "摘要"}
          description={selected ? selected.title : "模型整理的要点"}
        >
          <div className="flex flex-col gap-3">
            <Card>
              <CardHeader>
                <CardTitle>{digest?.headline || "还没有摘要"}</CardTitle>
                <CardDescription>{data?.at ? "更新于 " + new Date(data.at).toLocaleString("zh-CN") : "点「整理」用模型生成"}</CardDescription>
              </CardHeader>
              <CardContent>
                {digest?.bullets?.length ? (
                  <ol className="flex flex-col gap-2 pl-5 m-0">
                    {digest.bullets.map((b, i) => (
                      <li key={i} className="text-sm leading-relaxed">{b}</li>
                    ))}
                  </ol>
                ) : (
                  <span className="text-sm text-muted-foreground">还没有要点，先点「整理」。</span>
                )}
              </CardContent>
            </Card>
            {selected && (
              <Card>
                <CardHeader><CardTitle className="text-sm">选中条目</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm">{selected.title}</p>
                  {selected.link ? <a href={selected.link} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline w-fit">阅读原文</a> : null}
                </CardContent>
              </Card>
            )}
          </div>
        </DetailPanel>
      </div>
    </AppShell>
  );
}
