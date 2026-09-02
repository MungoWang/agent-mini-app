import { useEffect, useState } from "react";

import {
  AppShell,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Icon,
  PageHeader,
  useApp,
} from "@monkey-mini-app/ui";

type Ping = { appId: string; theme: string; now: number };

export default function Ui() {
  // ⭐ key: the backend is reachable through **one** entry only — useApp().call(method, args)
  //          method must be a key of defineApp({ api }); the UI never imports main.api.ts.
  const { call } = useApp();
  const [data, setData] = useState<Ping | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // ⭐ key: don't setState after the component unmounts (long/slow tasks with cancellation: see insights / agentrun)
    let alive = true;
    (async () => {
      try {
        const d = await call("ping", {});
        if (alive) setData(d as Ping);
      } catch (e) {
        if (alive) setError(String((e as Error)?.message || e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [call]);

  const badge = error ? "destructive" : loading ? "secondary" : "default";
  const label = error ? "出错" : loading ? "连接中" : "正常";

  return (
    // ⭐ key: wrap the page in AppShell (optional sidebar/header), use PageHeader for the page header.
    //         This is the "skeleton baseline"; other templates put lists/kanban/charts inside main.
    <AppShell header={<PageHeader title="骨架示例" description="最小可运行结构" />}>
      <div className="max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle>连通状态</CardTitle>
            <div className="flex items-center gap-2">
              <Icon.Check size={16} strokeWidth={2} className="text-primary" />
              <Badge variant={badge}>{label}</Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {error && <p style={{ color: "var(--destructive)" }}>{error}</p>}
            {data && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">App ID</span>
                  <span className="font-mono">{data.appId}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">主题</span>
                  <span>{data.theme}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Host 往返</span>
                  <span>{new Date(data.now).toLocaleTimeString("zh-CN")}</span>
                </div>
              </>
            )}
            {!data && !error && <span className="text-muted-foreground">正在检测…</span>}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
