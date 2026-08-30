import { useEffect, useState } from "react";

import { AppShell, Badge, Card, CardContent, CardHeader, CardTitle, Icon, PageHeader } from "@monkey-mini-app/ui";
import { useDashboardApi } from "@monkeyagent/host";

type Ping = { appId: string; theme: string; now: number };

export default function Ui() {
  // ⭐ 关键：访问后端**只有**一个入口 —— useDashboardApi().call(method, args)
  //          method 必须是 defineDashboard({ api }) 的键；UI 永不 import main.api.ts。
  const { call } = useDashboardApi();
  const [data, setData] = useState<Ping | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // ⭐ 关键：组件卸载后别 setState（长/慢任务与取消配套见 insights / agentrun）
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
    // ⭐ 关键：页面用 AppShell 包一层（可选 sidebar/header），页头用 PageHeader。
    //         这里是「骨架基线」；别的模板会在 main 里放列表/看板/图表。
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
