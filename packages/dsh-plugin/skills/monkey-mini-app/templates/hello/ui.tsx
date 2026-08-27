import { useEffect, useState } from "react";
import { Badge, Button, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@monkey-mini-app/ui";
import { useDashboardApi } from "@monkeyagent/host";

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
    <div className="p-6 w-full box-border flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground m-0">连通检查</h2>
        <p className="text-sm text-muted-foreground mt-1">用来确认小程序已经连上 Host</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <CardTitle>接口状态</CardTitle>
            <Badge variant={badge}>{status}</Badge>
          </div>
          <CardDescription>走 Host 往返一次</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {error ? (
            <p className="text-sm" style={{ color: "var(--destructive)" }}>{error}</p>
          ) : data ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">时间</span>
                <span>{new Date(data.now).toLocaleString("zh-CN")}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">主题</span>
                <Badge variant="outline">{data.theme}</Badge>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">正在探测…</p>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={() => void reload()} disabled={loading}>
            {loading ? "刷新中…" : "刷新"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
