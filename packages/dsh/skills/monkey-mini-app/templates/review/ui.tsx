import { useCallback, useEffect, useState } from "react";

import {
  AppShell,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CodeEditor,
  type ColumnDef,
  DataGrid,
  DiffViewer,
  FilterBar,
  Icon,
  LogViewer,
  PageHeader,
  StatusBadge,
} from "@monkey-mini-app/ui";
import { useDashboardApi } from "@monkeyagent/host";

type LogLine = { level: string; text: string };
type TestCase = { id: string; name: string; status: "pass" | "fail" | "blocked"; duration: number };

function fmtTime(ts: number) {
  if (!ts) return "尚未保存";
  const d = new Date(ts);
  const pad = (n: number) => (n < 10 ? "0" + n : String(n));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function Ui() {
  const { call } = useDashboardApi();
  const [before, setBefore] = useState("");
  const [after, setAfter] = useState("");
  const [cases, setCases] = useState<TestCase[]>([]);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [savedAt, setSavedAt] = useState(0);
  const [status, setStatus] = useState<"all" | TestCase["status"]>("all");
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const pack = (await call("get", {})) as { before: string; after: string; cases: TestCase[]; logs: LogLine[]; savedAt: number };
      setBefore(pack?.before ?? "");
      setAfter(pack?.after ?? "");
      setCases(Array.isArray(pack?.cases) ? pack.cases : []);
      setLogs(Array.isArray(pack?.logs) ? pack.logs : []);
      setSavedAt(pack?.savedAt ?? 0);
      setDirty(false);
    } catch (e) {
      setError(String((e as Error)?.message || e));
    }
  }, [call]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function act(job: () => Promise<unknown>) {
    setError(null);
    try {
      await job();
      await refresh();
    } catch (e) {
      setError(String((e as Error)?.message || e));
    }
  }

  const filtered = status === "all" ? cases : cases.filter((c) => c.status === status);

  // ⭐ 关键：DataGrid 的列用 meta 声明排序/列搜索；StatusBadge 认小写状态
  const columns: ColumnDef<TestCase>[] = [
    { accessorKey: "id", header: "ID", meta: { sort: true, search: "text" } },
    { accessorKey: "name", header: "用例", meta: { sort: true, search: "text" } },
    {
      accessorKey: "status",
      header: "状态",
      meta: { sort: true, search: "select" },
      cell: ({ getValue }) => <StatusBadge status={String(getValue())} />,
    },
    {
      accessorKey: "duration",
      header: "耗时 (ms)",
      meta: { sort: true, search: "number" },
      cell: ({ getValue }) => String(getValue()),
    },
  ];

  return (
    <AppShell header={<PageHeader title="修复基准" description="编辑 → diff → 用例表格，改完写回" />}>
      <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto">
        {error && <p className="text-sm" style={{ color: "var(--destructive)" }}>{error}</p>}

        <Card>
          <CardHeader>
            <CardTitle>编辑</CardTitle>
            <CardDescription>修改后保存，diff 实时刷新 · {fmtTime(savedAt)}{dirty ? " · 未保存" : ""}</CardDescription>
          </CardHeader>
          <CardContent>
            <CodeEditor value={after} onChange={(v) => { setAfter(v); setDirty(true); }} language="ts" height="240px" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Diff 对比</CardTitle>
            <CardDescription>before → after</CardDescription>
          </CardHeader>
          <CardContent>
            {/* ⭐ 关键：DiffViewer 用 original/modified（不是老版的 oldText/newText） */}
            <DiffViewer original={before} modified={after} mode="unified" fileName="fetchWithRetry.ts" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>用例结果</CardTitle>
            <CardDescription>排序 / 列搜索 / 分页自带</CardDescription>
          </CardHeader>
          <CardContent>
            <FilterBar>
              {( ["all", "pass", "fail", "blocked"] as const ).map((s) => (
                <Button key={s} size="sm" variant={status === s ? "default" : "outline"} onClick={() => setStatus(s)}>
                  {s === "all" ? "全部" : s}
                </Button>
              ))}
              <div className="ml-auto flex gap-2">
                <Button size="sm" variant="outline" onClick={() => void act(() => call("reset", {}))}>
                  <Icon.RotateCcw size={16} strokeWidth={2} /> 重置
                </Button>
                <Button size="sm" onClick={() => void act(() => call("save", { after }))}>
                  <Icon.Save size={16} strokeWidth={2} /> 保存修复
                </Button>
              </div>
            </FilterBar>
            <div className="mt-3">
              <DataGrid columns={columns} data={filtered} pageSize={8} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>日志</CardTitle>
            <CardDescription>级别着色</CardDescription>
          </CardHeader>
          <CardContent>
            <LogViewer lines={logs.map((l) => `[${l.level}] ${l.text}`)} />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
