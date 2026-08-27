import { useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Empty,
} from "@monkey-mini-app/ui";
import { useDashboardApi } from "@monkeyagent/host";

type Digest = { headline: string; bullets: string[] };
type Item = { title: string; link?: string };
type Payload = { items: Item[]; digest: Digest | null; at: number };

function errText(e: unknown) {
  return String((e as Error)?.message || e);
}

export default function Ui() {
  const { call } = useDashboardApi();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function run(method: "latest" | "refresh") {
    setLoading(true);
    setError(null);
    try {
      setData(await call(method, {}));
    } catch (e) {
      setError(errText(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void run("latest");
  }, []);

  const digest = data?.digest;
  const bullets = digest?.bullets ?? [];
  const items = data?.items ?? [];

  return (
    <div className="p-6 w-full box-border flex flex-col gap-4">
      <div className="flex items-start justify-between w-full">
        <div>
          <h2 className="text-xl font-semibold text-foreground m-0">今日摘要</h2>
          <p className="text-sm text-muted-foreground mt-1">看看今天大家在热议什么</p>
        </div>
        <Button disabled={loading} onClick={() => void run("refresh")}>
          {loading ? "整理中…" : "刷新"}
        </Button>
      </div>

      {error ? <p className="text-sm" style={{ color: "var(--destructive)" }}>{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>{digest?.headline || (loading ? "正在整理…" : "还没有摘要")}</CardTitle>
          <CardDescription>
            {data?.at ? "更新于 " + new Date(data.at).toLocaleString("zh-CN") : "点刷新拉取公开头条"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {bullets.length ? (
            <ol className="flex flex-col gap-2 m-0 pl-5">
              {bullets.map((line, i) => (
                <li key={line} className="text-sm leading-relaxed">
                  {line}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">还没有要点。</p>
          )}
        </CardContent>
      </Card>

      {items.length ? (
        <Card>
          <CardHeader>
            <CardTitle>来源</CardTitle>
            <CardDescription>来自公开 RSS 聚合</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y divide-border m-0 p-0">
              {items.map((it, i) => (
                <li key={it.title + i} className="flex flex-col gap-1 py-2.5">
                  <span className="text-sm font-medium">{it.title}</span>
                  {it.link ? (
                    <a
                      href={it.link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary no-underline hover:underline w-fit"
                    >
                      阅读原文
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : (
        <Empty title="还没有内容" description="点刷新拉取一次看看。" />
      )}
    </div>
  );
}
