import { useEffect, useState } from "react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Inline,
  Stack,
  Text,
  useDashboardApi,
} from "@monkeyagent/ui";

type Digest = { headline: string; bullets: string[] };
type Item = { title: string };
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
    <Stack
      gap={16}
      style={{ padding: 24, maxWidth: 720, margin: "0 auto", width: "100%", boxSizing: "border-box" }}
    >
      <Inline style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <Text variant="h2">今日摘要</Text>
          <Text variant="muted" style={{ marginTop: 4 }}>
            看看今天大家在热议什么
          </Text>
        </div>
        <Button disabled={loading} onClick={() => void run("refresh")}>
          {loading ? "整理中…" : "刷新"}
        </Button>
      </Inline>

      {error ? <Text style={{ color: "var(--destructive)" }}>{error}</Text> : null}

      <Card>
        <CardHeader>
          <CardTitle>{digest?.headline || (loading ? "正在整理…" : "还没有摘要")}</CardTitle>
          <CardDescription>
            {data?.at ? "更新于 " + new Date(data.at).toLocaleString("zh-CN") : "点刷新拉取公开头条"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {bullets.length ? (
            <Stack gap={8}>
              {bullets.map((line, i) => (
                <Text key={line}>
                  {i + 1}. {line}
                </Text>
              ))}
            </Stack>
          ) : (
            <Text variant="muted">还没有要点。</Text>
          )}
        </CardContent>
      </Card>

      {items.length ? (
        <Card>
          <CardHeader>
            <CardTitle>头条</CardTitle>
            <CardDescription>{items.length} 条</CardDescription>
          </CardHeader>
          <CardContent>
            <Stack gap={8}>
              {items.map((item) => (
                <Text key={item.title}>{item.title}</Text>
              ))}
            </Stack>
          </CardContent>
        </Card>
      ) : null}
    </Stack>
  );
}
