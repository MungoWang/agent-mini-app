import { useCallback, useEffect, useMemo, useState } from "react";

import {
  AppShell,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  type ColumnDef,
  DataGrid,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FilterBar,
  Icon,
  Input,
  Kanban,
  type KanbanCard,
  NativeSelect,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  StatCard,
  Tabs,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@monkey-mini-app/ui";
import { useDashboardApi } from "@monkeyagent/host";

type Issue = {
  key: string;
  type: "Story" | "Task" | "Bug" | "Epic";
  summary: string;
  status: "To Do" | "In Progress" | "Done" | "Blocked";
  priority: "P0" | "P1" | "P2" | "P3";
  assignee: string;
  reporter: string;
  points: number;
  comments: { author: string; text: string; at: number }[];
  createdAt: number;
  updatedAt: number;
};

const STATUSES: Issue["status"][] = ["To Do", "In Progress", "Done", "Blocked"];
const ASSIGNEES = ["陈", "李", "王"];
const STATUS_TONE: Record<Issue["status"], string> = {
  "To Do": "default",
  "In Progress": "secondary",
  Done: "secondary",
  Blocked: "destructive",
};
const STATUS_COLOR: Record<Issue["status"], string> = {
  "To Do": "var(--muted-foreground)",
  "In Progress": "var(--primary)",
  Done: "oklch(0.627 0.17 149.2)",
  Blocked: "oklch(0.704 0.191 22.216)",
};

export default function Ui() {
  const { call } = useDashboardApi();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [sel, setSel] = useState<Issue | null>(null);
  const [assignee, setAssignee] = useState("all");
  const [summary, setSummary] = useState<{ byStatus: Record<string, number>; total: number } | null>(null);
  const [wlOpen, setWlOpen] = useState(false);
  const [wlNote, setWlNote] = useState("");
  const [wlMinutes, setWlMinutes] = useState(30);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  // ⭐ 关键：主题切换 —— 存 ctx.storage（刷新恢复），live 改 document.documentElement
  const load = useCallback(async () => {
    try {
      const data = (await call("list", {})) as { issues: Issue[] };
      const s = (await call("summary", {})) as { byStatus: Record<string, number>; total: number };
      let list = data.issues || [];
      if (assignee !== "all") list = list.filter((i) => i.assignee === assignee);
      setIssues(list);
      setSummary(s);
    } catch (e) {
      setError(String((e as Error)?.message || e));
    }
  }, [call, assignee]);

  useEffect(() => {
    void load();
  }, [load]);

  // 乐观更新 + 落库（后端 update 已持久化）
  async function patch(key: string, p: Partial<Issue>) {
    setSel((prev) => (prev?.key === key ? { ...prev, ...p } : prev));
    await call("update", { key, patch: p });
    void load();
  }

  // ⭐ 关键：Kanban 拖拽 → onCardsChange 拿到新 cards，按 status 映射回 patch
  const onKanban = (cards: KanbanCard[]) => {
    for (const c of cards) {
      const cur = issues.find((i) => i.key === c.key);
      if (cur && cur.status !== c.columnId) void patch(c.key!, { status: c.columnId as Issue["status"] });
    }
  };

  const kanbanColumns = STATUSES.map((status) => ({ id: status, title: status, limit: undefined as number | undefined }));
  const kanbanCards: KanbanCard[] = issues.map((i) => ({
    id: i.key,
    key: i.key,
    title: i.summary,
    columnId: i.status,
    type: i.type,
    status: i.status,
    assignee: i.assignee,
    tags: [i.priority],
    updated: new Date(i.updatedAt).toLocaleDateString("zh-CN"),
  }));

  const columns: ColumnDef<Issue>[] = [
    { accessorKey: "key", header: "键", meta: { sort: true, search: "text" } },
    { accessorKey: "type", header: "类型", meta: { sort: true, search: "select" } },
    { accessorKey: "summary", header: "摘要", meta: { sort: true, search: "text" } },
    { accessorKey: "assignee", header: "负责人", meta: { sort: true, search: "text" } },
    {
      accessorKey: "status",
      header: "状态",
      meta: { sort: true, search: "select" },
      cell: ({ getValue }) => <StatusBadgeMini status={String(getValue())} />,
    },
    { accessorKey: "priority", header: "优先级", meta: { sort: true, search: "select" } },
  ];

  async function openWorklog() {
    if (!sel) return;
    setWlOpen(true);
    setWlNote("生成中…");
    try {
      const d = (await call("worklogDraft", { key: sel.key })) as { note: string };
      setWlNote(d.note);
    } catch (e) {
      setWlNote("（AI 生成失败，手动填写）" + String((e as Error)?.message || e));
    }
  }
  async function saveWorklog() {
    if (!sel) return;
    await call("logWork", { key: sel.key, note: wlNote, minutes: wlMinutes });
    setWlOpen(false);
    void load();
  }
  async function addComment() {
    if (!sel || !comment.trim()) return;
    await call("comment", { key: sel.key, text: comment });
    setComment("");
    void load();
    setSel((prev) => (prev ? { ...prev } : prev));
  }

  const byStatus = summary?.byStatus ?? {};

  return (
    <AppShell
      header={
        <PageHeader
          title="Jira 看板"
          description={`${summary?.total ?? 0} 个 Issue`}
          actions={
            <>
              <Button size="sm" variant="outline" onClick={() => { setSel(issues[0] ?? null); setView("kanban"); }}>
                <Icon.Sparkles size={16} strokeWidth={2} /> AI 记工时
              </Button>
            </>
          }
        />
      }
    >
      <div className="flex h-full min-h-0 flex-col gap-3">
        {/* 状态汇总（简约）：复用 StatCard，改成一次遍历的色点条 */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {STATUSES.map((s) => (
            <StatCard key={s} title={s} value={byStatus[s] ?? 0}>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: STATUS_COLOR[s] }} />
                <span className="text-xs text-muted-foreground">{s}</span>
              </span>
            </StatCard>
          ))}
        </div>

        <FilterBar>
          <Tabs value={view} onValueChange={(v) => setView(v as "kanban" | "table")}>
            <TabsList>
              <TabsTrigger value="kanban"><Icon.LayoutGrid size={14} strokeWidth={2} /> 看板</TabsTrigger>
              <TabsTrigger value="table"><Icon.Table size={14} strokeWidth={2} /> 表格</TabsTrigger>
            </TabsList>
          </Tabs>
          <NativeSelect value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            {["all", ...ASSIGNEES].map((a) => (
              <option key={a} value={a}>{a === "all" ? "全部负责人" : a}</option>
            ))}
          </NativeSelect>
          {error && <span className="text-sm" style={{ color: "var(--destructive)" }}>{error}</span>}
        </FilterBar>

        <Card className="min-h-0 flex-1 overflow-y-auto">
          <CardContent>
            {view === "kanban" ? (
              <div className="flex gap-3 overflow-x-auto pb-2">
                <Kanban columns={kanbanColumns} cards={kanbanCards} onCardsChange={onKanban}
                  onCardClick={(c) => setSel(issues.find((i) => i.key === c.key) ?? null)} />
              </div>
            ) : (
              <DataGrid
                columns={columns}
                data={issues}
                pageSize={10}
                onRowClick={(issue) => setSel(issue)}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* 详情编辑 Sheet */}
      <Sheet open={Boolean(sel)} onOpenChange={(o) => { if (!o) setSel(null); }}>
        <SheetContent className="sm:max-w-lg">
          {sel && (
            <>
              <SheetHeader>
                <SheetTitle className="font-mono flex items-center gap-2">{sel.key} <StatusBadgeMini status={sel.status} /></SheetTitle>
                <SheetDescription>{sel.summary}</SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-4 px-4 pb-4">
                <div className="grid grid-cols-2 gap-2">
                  <Field label="状态">
                    <MapSelect value={sel.status} onChange={(v) => void patch(sel.key, { status: v })} options={STATUSES.map((s) => ({ v: s, label: s }))} />
                  </Field>
                  <Field label="负责人">
                    <MapSelect value={sel.assignee} onChange={(v) => void patch(sel.key, { assignee: v })} options={ASSIGNEES.map((a) => ({ v: a, label: a }))} />
                  </Field>
                  <Field label="优先级">
                    <MapSelect value={sel.priority} onChange={(v) => void patch(sel.key, { priority: v })} options={(["P0", "P1", "P2", "P3"] as const).map((p) => ({ v: p, label: p }))} />
                  </Field>
                  <Field label="工时点">
                    <MapSelect value={String(sel.points) as "1" | "2" | "3" | "5" | "8"} onChange={(v) => void patch(sel.key, { points: Number(v) })} options={["1", "2", "3", "5", "8"].map((p) => ({ v: p as "1" | "2" | "3" | "5" | "8", label: p }))} />
                  </Field>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="text-xs text-muted-foreground">评论 · {sel.comments.length}</div>
                  <div className="flex flex-col gap-2">
                    {sel.comments.map((c, i) => (
                      <div key={i} className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                        <div className="flex items-center justify-between"><span className="font-medium">{c.author}</span><span className="text-[11px] text-muted-foreground">{new Date(c.at).toLocaleString("zh-CN")}</span></div>
                        <div className="mt-0.5">{c.text}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Textarea className="flex-1" value={comment} placeholder="写评论" onChange={(e) => setComment(e.target.value)} />
                    <Button onClick={() => void addComment()}>发送</Button>
                  </div>
                  <Button variant="outline" onClick={() => void openWorklog()}><Icon.Sparkles size={16} strokeWidth={2} /> AI 记工时</Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* AI 工时确认 Dialog */}
      <Dialog open={wlOpen} onOpenChange={setWlOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>记工时</DialogTitle><DialogDescription>{sel?.key} · {sel?.summary}</DialogDescription></DialogHeader>
          <Textarea value={wlNote} onChange={(e) => setWlNote(e.target.value)} rows={4} />
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">工时</span>
            <Input value={wlMinutes} onChange={(e) => setWlMinutes(Number(e.target.value))} type="number" className="w-24" /> <span className="text-sm">分钟</span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWlOpen(false)}>取消</Button>
            <Button onClick={() => void saveWorklog()}>确认记录</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1"><span className="text-xs text-muted-foreground">{label}</span>{children}</div>;
}
// ⭐ 关键：ui 的 Select 是 Base-UI 组合（Trigger/Value/Content/Item），别当原生 <select> 用
function MapSelect<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { v: T; label: string }[] }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as T)}>
      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
      <SelectContent>
        {options.map((o) => <SelectItem key={o.v} value={o.v}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
function StatusBadgeMini({ status }: { status: string }) {
  return <Badge variant={(STATUS_TONE as Record<string, never>)[status] ?? "default"}>{status}</Badge>;
}
