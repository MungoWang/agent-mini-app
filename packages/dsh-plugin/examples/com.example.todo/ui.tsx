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
    <Stack style={{ padding: 24, maxWidth: 720, margin: "0 auto", gap: 16 }}>
      <Inline style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <Text variant="h2">Todo</Text>
          <Text variant="muted" style={{ marginTop: 4 }}>
            Local tasks · storage/main.storage.json
          </Text>
        </div>
        <Inline gap={8}>
          <Badge variant="secondary">{stats.active} active</Badge>
          <Badge variant="outline">{stats.done} done</Badge>
        </Inline>
      </Inline>

      <Card>
        <CardHeader>
          <CardTitle>Add task</CardTitle>
          <CardDescription>Enter to submit · persisted on the Host</CardDescription>
        </CardHeader>
        <CardContent>
          <Field>
            <Inline>
              <Input
                value={draft}
                placeholder="What needs doing?"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void add();
                }}
                style={{ flex: 1 }}
              />
              <Button onClick={() => void add()}>Add</Button>
            </Inline>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Inline style={{ justifyContent: "space-between" }}>
            <CardTitle>Tasks</CardTitle>
            <Inline gap={6}>
              {["all", "active", "done"].map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={filter === f ? "default" : "outline"}
                  onClick={() => setFilter(f)}
                >
                  {f}
                </Button>
              ))}
              <Button size="sm" variant="ghost" onClick={() => void clearDone()}>
                Clear done
              </Button>
              <Button size="sm" variant="secondary" onClick={() => void refresh()}>
                Refresh
              </Button>
            </Inline>
          </Inline>
        </CardHeader>
        <CardContent>
          {error ? <Text variant="muted">{error}</Text> : null}
          {loading && !items.length ? <Text variant="muted">Loading…</Text> : null}
          {!loading && !items.length ? (
            <Empty title="No tasks" description="Add one above to get started." />
          ) : null}
          {items.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead style={{ width: 40 }}></TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead style={{ width: 100 }}>Status</TableHead>
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
                      <Badge variant={item.done ? "secondary" : "default"}>{item.done ? "done" : "active"}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => void remove(item.id)}>
                        Delete
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
