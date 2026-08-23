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
  Field,
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

export default function Ui() {
  const { call } = useDashboardApi();
  const [filter, setFilter] = useState("all");
  const [draft, setDraft] = useState("");
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, done: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, st] = await Promise.all([call("list", { filter }), call("stats", {})]);
      setItems(Array.isArray(list) ? list : []);
      setStats(st || { total: 0, active: 0, done: 0 });
    } catch (e) {
      setError(String((e && e.message) || e));
    } finally {
      setLoading(false);
    }
  }, [call, filter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function add() {
    const title = draft.trim();
    if (!title) return;
    await call("add", { title });
    setDraft("");
    await refresh();
  }
  async function toggle(id) {
    await call("toggle", { id });
    await refresh();
  }
  async function remove(id) {
    await call("remove", { id });
    await refresh();
  }
  async function clearDone() {
    await call("clearDone", {});
    await refresh();
  }

  return (
    <Stack style={{ padding: 20, maxWidth: 720, margin: "0 auto", gap: 16, width: "100%", boxSizing: "border-box" }}>
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
          <Field>
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
              <Button onClick={() => void add()}>添加</Button>
            </Inline>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Inline style={{ justifyContent: "space-between" }}>
            <CardTitle>任务</CardTitle>
            <Inline gap={6} style={{ flexWrap: "wrap" }}>
              {[
                ["all", "全部"],
                ["active", "未完成"],
                ["done", "已完成"],
              ].map(([f, label]) => (
                <Button
                  key={f}
                  size="sm"
                  variant={filter === f ? "default" : "outline"}
                  onClick={() => setFilter(f)}
                >
                  {label}
                </Button>
              ))}
              <Button size="sm" variant="ghost" onClick={() => void clearDone()}>
                清除已完成
              </Button>
              <Button size="sm" variant="secondary" onClick={() => void refresh()}>
                刷新
              </Button>
            </Inline>
          </Inline>
        </CardHeader>
        <CardContent>
          {error ? <Text variant="muted">{error}</Text> : null}
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
                      <Checkbox checked={!!item.done} onCheckedChange={() => void toggle(item.id)} />
                    </TableCell>
                    <TableCell>
                      <Text style={{ textDecoration: item.done ? "line-through" : "none", opacity: item.done ? 0.55 : 1 }}>
                        {item.title}
                      </Text>
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.done ? "secondary" : "default"}>{item.done ? "已完成" : "未完成"}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => void remove(item.id)}>
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
