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
  Inline,
  Input,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
  useDashboardApi,
} from "@monkeyagent/ui";

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
    <Stack
      gap={16}
      style={{ padding: 24, maxWidth: 720, margin: "0 auto", width: "100%", boxSizing: "border-box" }}
    >
      <Inline style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <Text variant="h2">待办</Text>
          <Text variant="muted" style={{ marginTop: 4 }}>
            记在这台电脑上，关掉也不会丢
          </Text>
        </div>
        <Inline gap={8}>
          <Badge variant="secondary">{stats.active} 未完成</Badge>
          <Badge variant="outline">{stats.done} 已完成</Badge>
        </Inline>
      </Inline>

      <Card>
        <CardHeader>
          <CardTitle>添加任务</CardTitle>
          <CardDescription>回车即可提交</CardDescription>
        </CardHeader>
        <CardContent>
          <Inline>
            <Input
              value={draft}
              placeholder="要做什么？"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void add();
              }}
              style={{ flex: 1 }}
            />
            <Button onClick={() => void add()} disabled={!draft.trim()}>
              添加
            </Button>
          </Inline>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Inline style={{ justifyContent: "space-between" }}>
            <CardTitle>任务</CardTitle>
            <Inline gap={6}>
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
            </Inline>
          </Inline>
        </CardHeader>
        <CardContent>
          {error ? <Text style={{ color: "var(--destructive)" }}>{error}</Text> : null}
          {loading && !items.length ? <Text variant="muted">加载中…</Text> : null}
          {!loading && !items.length ? (
            <Empty title="还没有任务" description="在上面加一条就开始。" />
          ) : null}
          {items.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead style={{ width: 40 }}></TableHead>
                  <TableHead>标题</TableHead>
                  <TableHead style={{ width: 100 }}>状态</TableHead>
                  <TableHead style={{ width: 88 }}></TableHead>
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
                      <Text
                        style={{
                          textDecoration: item.done ? "line-through" : "none",
                          opacity: item.done ? 0.55 : 1,
                        }}
                      >
                        {item.title}
                      </Text>
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
    </Stack>
  );
}
