import { useCallback, useEffect, useState } from "react";

import {
  AppShell,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  FilterBar,
  Icon,
  Input,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@monkey-mini-app/ui";
import { useDashboardApi } from "@monkeyagent/host";

type Filter = "all" | "active" | "done";
type TodoItem = { id: string; title: string; done: boolean; createdAt: number };
type Stats = { total: number; active: number; done: number };

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "active", label: "进行中" },
  { id: "done", label: "已完成" },
];

export default function Ui() {
  const { call } = useDashboardApi();
  const [filter, setFilter] = useState<Filter>("all");
  const [draft, setDraft] = useState("");
  const [items, setItems] = useState<TodoItem[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, done: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ⭐ 关键：refresh 依赖 filter，filter 变就重拉；用 useCallback 避免无限循环
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pack = (await call("list", { filter })) as { items: TodoItem[]; stats: Stats };
      setItems(Array.isArray(pack?.items) ? pack.items : []);
      setStats(pack?.stats ?? { total: 0, active: 0, done: 0 });
    } catch (e) {
      setError(String((e as Error)?.message || e));
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
      setError(String((e as Error)?.message || e));
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
    // ⭐ 关键：一屏固定 —— AppShell 定高，main 内部滚动，页面不整体滚。
    //         让「内容不被裁成一条缝」+ 侧栏折叠/钉到右侧后仍撑满。
    <AppShell header={<PageHeader title="待办" description="CRUD · 状态筛选 · 归档" />}>
      <div className="flex h-full min-h-0 flex-col gap-3">
        <FilterBar>
          {FILTERS.map((f) => (
            <Button key={f.id} size="sm" variant={filter === f.id ? "default" : "outline"} onClick={() => setFilter(f.id)}>
              {f.label}
            </Button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="secondary">{stats.active} 进行中</Badge>
            <Badge variant="outline">{stats.done} 已完成</Badge>
            <Button size="sm" variant="ghost" onClick={() => void act(() => call("archive", {}))}>
              <Icon.Archive size={16} strokeWidth={2} /> 归档
            </Button>
          </div>
        </FilterBar>

        <Card className="min-h-0 flex-1 overflow-hidden">
          <CardHeader>
            <CardTitle>添加任务</CardTitle>
            <div className="flex gap-2">
              <Input
                value={draft}
                placeholder="要做什么？回车提交"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void add();
                }}
                className="flex-1"
              />
              <Button onClick={() => void add()} disabled={!draft.trim()}>
                <Icon.Plus size={16} strokeWidth={2} /> 添加
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col min-h-0 flex-1 gap-2 overflow-y-auto">
            {error && <p className="text-sm" style={{ color: "var(--destructive)" }}>{error}</p>}
            {loading && !items.length ? <p className="text-sm text-muted-foreground">加载中…</p> : null}
            {!loading && !items.length ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>还没有任务</EmptyTitle>
                  <EmptyDescription>上面加一条就开始。</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : null}
            {items.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>标题</TableHead>
                    <TableHead className="w-20">状态</TableHead>
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
                      <TableCell
                        style={{ textDecoration: item.done ? "line-through" : "none", opacity: item.done ? 0.55 : 1 }}
                      >
                        {item.title}
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.done ? "secondary" : "default"}>{item.done ? "已完成" : "进行中"}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => void act(() => call("remove", { id: item.id }))}>
                          <Icon.Trash2 size={16} strokeWidth={2} />
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
    </AppShell>
  );
}
