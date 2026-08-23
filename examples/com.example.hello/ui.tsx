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

export default function Ui() {
  const { call } = useDashboardApi();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      setData(await call("ping", {}));
    } catch (e) {
      setError(String((e && e.message) || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  return (
    <Stack style={{ padding: 24, maxWidth: 520, margin: "0 auto", gap: 16 }}>
      <div>
        <Text variant="h2">Hello</Text>
        <Text variant="muted" style={{ marginTop: 4 }}>
          用来确认小程序已经连上 Host
        </Text>
      </div>

      <Card>
        <CardHeader>
          <Inline style={{ justifyContent: "space-between" }}>
            <CardTitle>接口状态</CardTitle>
            <Badge variant={error ? "destructive" : loading ? "secondary" : "default"}>
              {error ? "出错" : loading ? "连接中" : "正常"}
            </Badge>
          </Inline>
          <CardDescription>走 Host 的 call 接口往返一次</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <Text variant="muted">{error}</Text>
          ) : loading && !data ? (
            <Text variant="muted">正在探测…</Text>
          ) : data ? (
            <Stack gap={8}>
              <Inline style={{ justifyContent: "space-between" }}>
                <Text variant="muted">时间</Text>
                <Text style={{ fontFamily: "ui-monospace, monospace" }}>{String(data.now)}</Text>
              </Inline>
              <Inline style={{ justifyContent: "space-between" }}>
                <Text variant="muted">主题</Text>
                <Badge variant="outline">{String(data.theme)}</Badge>
              </Inline>
            </Stack>
          ) : (
            <Text variant="muted">暂无数据</Text>
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
