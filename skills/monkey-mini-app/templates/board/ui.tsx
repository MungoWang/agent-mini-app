import { useCallback, useEffect, useMemo, useState } from "react";

import {
  AppShell,
  Badge,
  Button,
  Card,
  CardContent,
  cn,
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
  Textarea,
  useApp,
} from "@monkey-mini-app/ui";

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
// Literal Tailwind classes — never a composed name (`bg-${x}-500` compiles to nothing),
// and never a hex/oklch literal here: these have to survive a palette + dark-mode switch.
const STATUS_DOT: Record<Issue["status"], string> = {
  "To Do": "bg-muted-foreground/40",
  "In Progress": "bg-primary/60",
  Done: "bg-primary",
  Blocked: "bg-destructive",
};

// One literal string per status: the tile wash is the same token family as the dot.
const STATUS_TILE: Record<Issue["status"], string> = {
  "To Do": "bg-card",
  "In Progress": "bg-primary/10",
  Done: "bg-card",
  Blocked: "bg-destructive/10",
};

// ⭐ The aurora: three hue pools mixed out of the palette's own primary — toward the ink for
//   depth, toward destructive for the warm drift. A flat `bg-muted` ground is why a bento
//   grid reads as "admin dashboard" instead of this look. No colour literals.
const AURORA =
  "radial-gradient(42% 40% at 10% 2%, color-mix(in oklch, var(--primary) 92%, transparent), transparent 58%)," +
  "radial-gradient(38% 44% at 90% 10%, color-mix(in oklch, var(--primary) 62%, var(--foreground)), transparent 60%)," +
  "radial-gradient(52% 46% at 42% 104%, color-mix(in oklch, var(--primary) 58%, var(--destructive)), transparent 62%)";

// Tiles are OPAQUE and raised — glass is glass-island's job. Two shadows: contact + lift.
const RAISED = {
  boxShadow:
    "0 1px 2px color-mix(in oklch, var(--foreground) 14%, transparent)," +
    "0 14px 30px -14px var(--shadow)",
} as const;

export default function Ui() {
  const { call } = useApp();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [sel, setSel] = useState<Issue | null>(null);
  const [assignee, setAssignee] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | Issue["status"]>(
    "all",
  );
  const [summary, setSummary] = useState<{
    byStatus: Record<string, number>;
    total: number;
  } | null>(null);
  const [wlOpen, setWlOpen] = useState(false);
  const [wlNote, setWlNote] = useState("");
  const [wlMinutes, setWlMinutes] = useState(30);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  // ⭐ key: theme switching — stored in ctx.storage (restored after refresh), applied live on document.documentElement
  const load = useCallback(async () => {
    try {
      const data = (await call("list", {})) as { issues: Issue[] };
      const s = (await call("summary", {})) as {
        byStatus: Record<string, number>;
        total: number;
      };
      let list = data.issues || [];
      if (assignee !== "all")
        list = list.filter((i) => i.assignee === assignee);
      setIssues(list);
      setSummary(s);
    } catch (e) {
      setError(String((e as Error)?.message || e));
    }
  }, [call, assignee]);

  useEffect(() => {
    void load();
  }, [load]);

  // optimistic update + persist (the backend update already saved)
  async function patch(key: string, p: Partial<Issue>) {
    setSel((prev) => (prev?.key === key ? { ...prev, ...p } : prev));
    await call("update", { key, patch: p });
    void load();
  }

  // ⭐ key: Kanban drag → onCardsChange yields the new cards, mapped back into patches by status
  const onKanban = (cards: KanbanCard[]) => {
    for (const c of cards) {
      const cur = issues.find((i) => i.key === c.key);
      if (cur && cur.status !== c.columnId)
        void patch(c.key!, { status: c.columnId as Issue["status"] });
    }
  };

  // ⭐ key: a bento tile is a destination — the status tiles filter the board, they are not decoration.
  const shown =
    statusFilter === "all"
      ? issues
      : issues.filter((i) => i.status === statusFilter);

  const kanbanColumns = STATUSES.map((status) => ({
    id: status,
    title: status,
    limit: undefined as number | undefined,
  }));
  const kanbanCards: KanbanCard[] = shown.map((i) => ({
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
    {
      accessorKey: "type",
      header: "类型",
      meta: { sort: true, search: "select" },
    },
    {
      accessorKey: "summary",
      header: "摘要",
      meta: { sort: true, search: "text" },
    },
    {
      accessorKey: "assignee",
      header: "负责人",
      meta: { sort: true, search: "text" },
    },
    {
      accessorKey: "status",
      header: "状态",
      meta: { sort: true, search: "select" },
      cell: ({ getValue }) => <StatusBadgeMini status={String(getValue())} />,
    },
    {
      accessorKey: "priority",
      header: "优先级",
      meta: { sort: true, search: "select" },
    },
  ];

  async function openWorklog() {
    if (!sel) return;
    setWlOpen(true);
    setWlNote("生成中…");
    try {
      const d = (await call("worklogDraft", { key: sel.key })) as {
        note: string;
      };
      setWlNote(d.note);
    } catch (e) {
      setWlNote(
        "（AI 生成失败，手动填写）" + String((e as Error)?.message || e),
      );
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
          title="阶段看板"
          description={`${summary?.total ?? 0} 个 Issue`}
          actions={
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSel(issues[0] ?? null);
                  setView("kanban");
                }}
              >
                <Icon.Sparkles size={16} strokeWidth={2} /> AI 记工时
              </Button>
            </>
          }
        />
      }
    >
      <div className="flex h-full min-h-0 flex-col gap-3">
        {/* `fixed` so the field runs behind the shell header too, not just the main band. */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10"
          style={{ backgroundImage: AURORA }}
        />
        {/* ⭐ Look: aurora-bento — a tessellation that fills the band, and every tile is a
            destination (filter / switch view), not a stat readout sitting there. Tiles are
            opaque + raised; glass belongs to glass-island. See references/looks/aurora-bento.md. */}
        {/* spans written out, no `sm:` — the panel width is user-dragged, so a breakpoint
            there is a lie (same lesson as `today`). Capped + gapped: an edge-to-edge tile
            wall hides the aurora, and the aurora is the look. */}
        <div className="mx-auto grid w-full max-w-5xl grid-cols-6 gap-2.5">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            style={RAISED}
            className={cn(
              "bg-foreground text-background col-span-2 row-span-2 rounded-2xl p-4 text-left",
              statusFilter === "all" &&
                "ring-2 ring-ring ring-offset-2 ring-offset-muted",
            )}
          >
            <p className="text-xs opacity-70">阶段看板</p>
            <p className="mt-2 text-2xl font-medium tabular-nums">
              {summary?.total ?? 0}
            </p>
            <p className="mt-1 text-xs opacity-70">全部事项 · 点回总览</p>
          </button>
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}
              style={RAISED}
              className={cn(
                "bg-card col-span-2 rounded-2xl p-3 text-left",
                statusFilter === s && STATUS_TILE[s],
              )}
            >
              <span className="flex items-center gap-1.5">
                <span className={cn("size-2 rounded-full", STATUS_DOT[s])} />
                <span className="text-muted-foreground text-xs">{s}</span>
              </span>
              <b className="mt-1 block text-lg tabular-nums">
                {byStatus[s] ?? 0}
              </b>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setView(view === "kanban" ? "table" : "kanban")}
            style={RAISED}
            className="bg-card col-span-6 flex items-center justify-between rounded-2xl p-3 text-left text-sm"
          >
            <span className="flex items-center gap-2">
              {view === "kanban" ? (
                <Icon.LayoutGrid size={14} strokeWidth={2} />
              ) : (
                <Icon.Table size={14} strokeWidth={2} />
              )}
              当前：{view === "kanban" ? "看板" : "表格"}
            </span>
            <span className="text-muted-foreground text-xs">点这里切换</span>
          </button>
        </div>

        <FilterBar>
          {/* the view switch moved into its bento tile — one destination, one control */}
          <NativeSelect
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
          >
            {["all", ...ASSIGNEES].map((a) => (
              <option key={a} value={a}>
                {a === "all" ? "全部负责人" : a}
              </option>
            ))}
          </NativeSelect>
          {error && (
            <span className="text-sm" style={{ color: "var(--destructive)" }}>
              {error}
            </span>
          )}
        </FilterBar>

        <Card className="min-h-0 flex-1 overflow-y-auto">
          <CardContent>
            {view === "kanban" ? (
              <div className="flex gap-3 overflow-x-auto pb-2">
                <Kanban
                  columns={kanbanColumns}
                  cards={kanbanCards}
                  onCardsChange={onKanban}
                  onCardClick={(c) =>
                    setSel(issues.find((i) => i.key === c.key) ?? null)
                  }
                />
              </div>
            ) : (
              <DataGrid
                columns={columns}
                data={shown}
                pageSize={10}
                onRowClick={(issue) => setSel(issue)}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* detail editing Sheet */}
      <Sheet
        open={Boolean(sel)}
        onOpenChange={(o) => {
          if (!o) setSel(null);
        }}
      >
        <SheetContent className="sm:max-w-lg">
          {sel && (
            <>
              <SheetHeader>
                <SheetTitle className="font-mono flex items-center gap-2">
                  {sel.key} <StatusBadgeMini status={sel.status} />
                </SheetTitle>
                <SheetDescription>{sel.summary}</SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-4 px-4 pb-4">
                <div className="grid grid-cols-2 gap-2">
                  <Field label="状态">
                    <MapSelect
                      value={sel.status}
                      onChange={(v) => void patch(sel.key, { status: v })}
                      options={STATUSES.map((s) => ({ v: s, label: s }))}
                    />
                  </Field>
                  <Field label="负责人">
                    <MapSelect
                      value={sel.assignee}
                      onChange={(v) => void patch(sel.key, { assignee: v })}
                      options={ASSIGNEES.map((a) => ({ v: a, label: a }))}
                    />
                  </Field>
                  <Field label="优先级">
                    <MapSelect
                      value={sel.priority}
                      onChange={(v) => void patch(sel.key, { priority: v })}
                      options={(["P0", "P1", "P2", "P3"] as const).map((p) => ({
                        v: p,
                        label: p,
                      }))}
                    />
                  </Field>
                  <Field label="工时点">
                    <MapSelect
                      value={String(sel.points) as "1" | "2" | "3" | "5" | "8"}
                      onChange={(v) =>
                        void patch(sel.key, { points: Number(v) })
                      }
                      options={["1", "2", "3", "5", "8"].map((p) => ({
                        v: p as "1" | "2" | "3" | "5" | "8",
                        label: p,
                      }))}
                    />
                  </Field>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="text-xs text-muted-foreground">
                    评论 · {sel.comments.length}
                  </div>
                  <div className="flex flex-col gap-2">
                    {sel.comments.map((c, i) => (
                      <div
                        key={i}
                        className="rounded-lg border bg-muted/30 px-3 py-2 text-sm"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{c.author}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {new Date(c.at).toLocaleString("zh-CN")}
                          </span>
                        </div>
                        <div className="mt-0.5">{c.text}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Textarea
                      className="flex-1"
                      value={comment}
                      placeholder="写评论"
                      onChange={(e) => setComment(e.target.value)}
                    />
                    <Button onClick={() => void addComment()}>发送</Button>
                  </div>
                  <Button variant="outline" onClick={() => void openWorklog()}>
                    <Icon.Sparkles size={16} strokeWidth={2} /> AI 记工时
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* AI worklog confirmation Dialog */}
      <Dialog open={wlOpen} onOpenChange={setWlOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>记工时</DialogTitle>
            <DialogDescription>
              {sel?.key} · {sel?.summary}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={wlNote}
            onChange={(e) => setWlNote(e.target.value)}
            rows={4}
          />
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">工时</span>
            <Input
              value={wlMinutes}
              onChange={(e) => setWlMinutes(Number(e.target.value))}
              type="number"
              className="w-24"
            />{" "}
            <span className="text-sm">分钟</span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWlOpen(false)}>
              取消
            </Button>
            <Button onClick={() => void saveWorklog()}>确认记录</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
// ⭐ key: the ui Select is a Base-UI composition (Trigger/Value/Content/Item) — don't treat it as a native <select>
function MapSelect<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { v: T; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as T)}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.v} value={o.v}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
function StatusBadgeMini({ status }: { status: string }) {
  return (
    <Badge
      variant={(STATUS_TONE as Record<string, never>)[status] ?? "default"}
    >
      {status}
    </Badge>
  );
}
