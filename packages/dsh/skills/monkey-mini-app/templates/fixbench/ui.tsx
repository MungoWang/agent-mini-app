import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CodeEditor,
  DataGrid,
  DiffViewer,
  JsonViewer,
  LogViewer,
  StatusBadge,
  type ColumnDef,
} from "@monkey-mini-app/ui";
import { useDashboardApi } from "@monkeyagent/host";

type LogLine = { level: string; text: string };
type TestCase = { id: string; name: string; status: string; duration: number };

const FIX_NOTE = `# 修复说明

**根因**：\`fetchWithRetry\` 缺少异常捕获与重试逻辑，网络抖动时直接抛错。

- 增加 \`retries\` 参数（默认 2 次重试）
- 用 \`try/catch\` 包裹请求，失败后循环重试
- 保留最后一次错误，重试耗尽时抛出

> 修复要点见下方 diff 对比，用例结果见底部表格。`;

function errText(e: unknown) {
  return String((e as Error)?.message || e);
}

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
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [cases, setCases] = useState<TestCase[]>([]);
  const [savedAt, setSavedAt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pack = await call("get", {});
      setBefore(pack?.before ?? "");
      setAfter(pack?.after ?? "");
      setLogs(Array.isArray(pack?.logs) ? pack.logs : []);
      setCases(Array.isArray(pack?.cases) ? pack.cases : []);
      setSavedAt(pack?.savedAt ?? 0);
    } catch (e) {
      setError(errText(e));
    } finally {
      setLoading(false);
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
      setError(errText(e));
    }
  }

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

  const filteredLogs = filter
    ? logs.filter((l) => l.level.includes(filter) || l.text.includes(filter))
    : logs;

  return (
    <div className="p-6 w-full box-border flex flex-col gap-4">
      <div className="flex items-start justify-between w-full">
        <div>
          <h2 className="text-xl font-semibold text-foreground m-0">修复台</h2>
          <p className="text-sm text-muted-foreground mt-1">编辑 → diff 对比 → 跑用例，一站式回归</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="secondary">{cases.filter((c) => c.status === "pass").length}/{cases.length} 通过</Badge>
          <Button variant="outline" onClick={() => void act(() => call("reset", {}))}>重置</Button>
          <Button onClick={() => void act(() => call("save", { after }))}>保存修复</Button>
        </div>
      </div>

      {error ? <p className="text-sm" style={{ color: "var(--destructive)" }}>{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>编辑</CardTitle>
          <CardDescription>{fmtTime(savedAt)} · 修改后保存，diff 会实时刷新</CardDescription>
        </CardHeader>
        <CardContent>
          <CodeEditor
            value={after}
            onChange={setAfter}
            language="ts"
            height={240}
            placeholder={FIX_NOTE}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Diff 对比</CardTitle>
          <CardDescription>before → after，红绿行级高亮</CardDescription>
        </CardHeader>
        <CardContent>
          <DiffViewer oldText={before} newText={after} language="ts" collapsible maxHeight={260} />
        </CardContent>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>运行日志</CardTitle>
            <CardDescription>级别着色 · 支持过滤</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <LogViewer lines={filteredLogs} maxHeight={220} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>数据结构</CardTitle>
            <CardDescription>后端返回的原始 JSON</CardDescription>
          </CardHeader>
          <CardContent>
            <JsonViewer data={{ before, after, logs: logs.length, cases: cases.length }} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>用例结果</CardTitle>
          <CardDescription>排序 / 列搜索 / 分页自带</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && !cases.length ? (
            <p className="text-sm text-muted-foreground">加载中…</p>
          ) : (
            <DataGrid columns={columns} data={cases} pageSize={8} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
