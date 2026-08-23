import { useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Inline,
  Stack,
  Text,
  useDashboardApi,
} from "@monkeyagent/ui";

type Ping = { now: number; theme: string };

function errText(e: unknown) {
  return String((e as Error)?.message || e);
}

export default function Ui() {
  const { call } = useDashboardApi();
  const [data, setData] = useState<Ping | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      setData(await call("ping", {}));
    } catch (e) {
      setError(errText(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  const status = error ? "出错" : loading ? "连接中" : "正常";
  const badge = error ? "destructive" : loading ? "secondary" : "default";

  return (
    <Stack
      gap={16}
      style={{ padding: 24, maxWidth: 520, margin: "0 auto", width: "100%", boxSizing: "border-box" }}
    >
      <div>
        <Text variant="h2">连通检查</Text>
        <Text variant="muted" style={{ marginTop: 4 }}>
          用来确认小程序已经连上 Host
        </Text>
      </div>

      <Card>
        <CardHeader>
          <Inline style={{ justifyContent: "space-between" }}>
            <CardTitle>接口状态</CardTitle>
            <Badge variant={badge}>{status}</Badge>
          </Inline>
          <CardDescription>走 Host 往返一次</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <Text style={{ color: "var(--destructive)" }}>{error}</Text>
          ) : data ? (
            <Stack gap={8}>
              <Inline style={{ justifyContent: "space-between" }}>
                <Text variant="muted">时间</Text>
                <Text>{new Date(data.now).toLocaleString("zh-CN")}</Text>
              </Inline>
              <Inline style={{ justifyContent: "space-between" }}>
                <Text variant="muted">主题</Text>
                <Badge variant="outline">{data.theme}</Badge>
              </Inline>
            </Stack>
          ) : (
            <Text variant="muted">正在探测…</Text>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={() => void reload()} disabled={loading}>
            {loading ? "刷新中…" : "刷新"}
          </Button>
        </CardFooter>
      </Card>
    </Stack>
  );
}
