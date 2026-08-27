import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Empty,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@monkey-mini-app/ui";
import { useDashboardApi } from "@monkeyagent/host";

type Filter = "all" | "active" | "done";
type TodoItem = { id: string; title: string; done: boolean };
type Stats = { total: number; active: number; done: number };

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "active", label: "未完成" },
  { id: "done", label: "已完成" },
];

function errText(e: unknown) {
  return String((e as Error)?.message || e);
}

export default function Ui() {
  const { call } = useDashboardApi();
  const [filter, setFilter] = useState<Filter>("all");
  const [draft, setDraft] = useState("");
  const [items, setItems] = useState<TodoItem[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, done: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pack = await call("list", { filter });
      setItems(Array.isArray(pack?.items) ? pack.items : []);
      setStats(pack?.stats ?? { total: 0, active: 0, done: 0 });
    } catch (e) {
      setError(errText(e));
    } finally {
      setLoading(false);
    }
  }, [call, filter]);

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

  async function add() {
    const title = draft.trim();
    if (!title) return;
    await act(async () => {
      await call("add", { title });
      setDraft("");
    });
  }

  return (
    <div className="p-6 w-full box-border flex flex-col gap-4">
      <div className="flex items-start justify-between w-full">
        <div>
          <h2 className="text-xl font-semibold text-foreground m-0">待办</h2>
          <p className="text-sm text-muted-foreground mt-1">记在这台电脑上，关掉也不会丢</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="secondary">{stats.active} 未完成</Badge>
          <Badge variant="outline">{stats.done} 已完成</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>添加任务</CardTitle>
          <CardDescription>回车即可提交</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            value={draft}
            placeholder="要做什么？"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void add();
            }}
            className="flex-1"
          />
          <Button onClick={() => void add()} disabled={!draft.trim()}>
            添加
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full flex-wrap gap-2">
            <CardTitle>任务</CardTitle>
            <div className="flex gap-1.5 flex-wrap">
              {FILTERS.map((item) => (
                <Button
                  key={item.id}
                  size="sm"
                  variant={filter === item.id ? "default" : "outline"}
                  onClick={() => setFilter(item.id)}
                >
                  {item.label}
                </Button>
              ))}
              <Button size="sm" variant="ghost" onClick={() => void act(() => call("clearDone", {}))}>
                清除已完成
              </Button>
              <Button size="sm" variant="secondary" onClick={() => void refresh()}>
                刷新
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error ? <p className="text-sm" style={{ color: "var(--destructive)" }}>{error}</p> : null}
          {loading && !items.length ? <p className="text-sm text-muted-foreground">加载中…</p> : null}
          {!loading && !items.length ? (
            <Empty title="还没有任务" description="在上面加一条就开始。" />
          ) : null}
          {items.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>标题</TableHead>
                  <TableHead className="w-24">状态</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Checkbox
                        checked={item.done}
                        onCheckedChange={() => void act(() => call("toggle", { id: item.id }))}
                      />
                    </TableCell>
                    <TableCell>
                      <span
                        style={{
                          textDecoration: item.done ? "line-through" : "none",
                          opacity: item.done ? 0.55 : 1,
                        }}
                      >
                        {item.title}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.done ? "secondary" : "default"}>
                        {item.done ? "已完成" : "未完成"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void act(() => call("remove", { id: item.id }))}
                      >
                        删除
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
