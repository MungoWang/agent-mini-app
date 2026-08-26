import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Calendar,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CodeBlock,
  DataGrid,
  DiffView,
  Editor,
  FileInput,
  FullCalendar,
  Inline,
  JsonBlock,
  KanbanBoard,
  KeyValueEditor,
  LogViewer,
  Markdown,
  Stack,
  Stepper,
  SummaryBar,
  TagInput,
  Text,
  copyText,
  useDashboardApi,
} from "@monkeyagent/ui";

type LogLine = { level: string; text: string };
type TestCase = { id: string; name: string; status: string; duration: number };
type KV = { key: string; value: string };

const FIX_NOTE = `# 修复说明

**根因**：\`fetchWithRetry\` 缺少异常捕获与重试逻辑，网络抖动时直接抛错。

- 增加 \`retries\` 参数（默认 2 次重试）
- 用 \`try/catch\` 包裹请求，失败后循环重试
- 保留最后一次错误，重试耗尽时抛出

> 修复要点见下方 diff 对比，用例结果见底部表格。`;

function fmtTime(ts: number) {
  if (!ts) return "尚未保存";
  const d = new Date(ts);
  const pad = (n: number) => (n < 10 ? "0" + n : String(n));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const KANBAN_COLUMNS = [
  { id: "todo", title: "待办", accent: "#f59e0b" },
  { id: "doing", title: "进行中", accent: "#3b82f6" },
  { id: "verify", title: "验证", accent: "#8b5cf6" },
  { id: "done", title: "完成", accent: "#22c55e" },
];

/* Jira ticket 风格示例：key / title / type / priority / assignee / status */
const INITIAL_TASKS = [
  { key: "BUG-104", columnId: "todo", title: "登录超时无重试，网络抖动即失败", type: "Bug", priority: "P0", assignee: "Ada", status: "Open" },
  { key: "TASK-12", columnId: "todo", title: "补充重试边界用例", type: "Task", priority: "P1", assignee: "Ben", status: "Open" },
  { key: "BUG-101", columnId: "doing", title: "fetchWithRetry 异常捕获缺失", type: "Bug", priority: "P0", assignee: "Ada", status: "In Progress" },
  { key: "TASK-15", columnId: "doing", title: "重构请求封装层", type: "Task", priority: "P2", assignee: "Cici", status: "In Progress" },
  { key: "BUG-98", columnId: "verify", title: "回归：重试耗尽抛错", type: "Bug", priority: "P1", assignee: "Ben", status: "Review" },
  { key: "TASK-08", columnId: "done", title: "定位根因：缺少 try/catch", type: "Task", priority: "P0", assignee: "Ada", status: "Done" },
];

const PRIORITY_COLOR: Record<string, string> = { P0: "#ef4444", P1: "#f59e0b", P2: "#3b82f6", P3: "#94a3b8" };
const TYPE_COLOR: Record<string, string> = { Bug: "#ef4444", Task: "#3b82f6", Story: "#8b5cf6" };

type Ticket = { key: string; columnId: string; title: string; type: string; priority: string; assignee: string; status: string };

/* 卡片类型：展示 KanbanBoard renderCard 的扩展能力 */
const TASK_ITEMS = [
  { id: "TSK-1", columnId: "todo", title: "梳理接口文档", subtitle: "文档组" },
  { id: "TSK-2", columnId: "doing", title: "补充单元测试", subtitle: "覆盖率 60% → 80%" },
  { id: "TSK-3", columnId: "done", title: "升级依赖版本", subtitle: "已合并" },
];
const MILESTONE_ITEMS = [
  { id: "MS-1", columnId: "todo", title: "埋点方案评审", date: "08-21", progress: 0, tag: "设计" },
  { id: "MS-2", columnId: "doing", title: "核心逻辑落地", date: "08-24", progress: 62, tag: "开发" },
  { id: "MS-3", columnId: "verify", title: "回归与压测", date: "08-28", progress: 85, tag: "质量" },
  { id: "MS-4", columnId: "done", title: "灰度发布", date: "09-01", progress: 100, tag: "上线" },
];
const APPROVAL_ITEMS = [
  { id: "AP-1", columnId: "todo", title: "变更登录超时配置", requester: "Ben", status: "待审批" },
  { id: "AP-2", columnId: "todo", title: "新增重试参数", requester: "Ada", status: "待审批" },
  { id: "AP-3", columnId: "done", title: "日志脱敏规则", requester: "Cici", status: "已通过" },
];

function TaskCard(item: any, dnd: Record<string, unknown>) {
  return (
    <div {...dnd} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "9px 11px", cursor: "grab", boxShadow: "0 1px 2px var(--shadow)" }}>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{item.title}</div>
      {item.subtitle ? <div style={{ fontSize: 11.5, color: "var(--muted-foreground)", marginTop: 3 }}>{item.subtitle}</div> : null}
    </div>
  );
}
function MilestoneCard(item: any, dnd: Record<string, unknown>) {
  return (
    <div {...dnd} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "9px 11px", cursor: "grab", boxShadow: "0 1px 2px var(--shadow)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{item.title}</span>
        <span style={{ fontSize: 10.5, fontWeight: 700, padding: "0 6px", borderRadius: 4, background: "var(--muted)", color: "var(--muted-foreground)" }}>{item.tag}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, height: 6, borderRadius: 99, background: "var(--muted)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: item.progress + "%", background: "var(--primary)", borderRadius: 99 }} />
        </div>
        <span style={{ fontSize: 10.5, color: "var(--muted-foreground)" }}>{item.progress}%</span>
      </div>
      <div style={{ fontSize: 10.5, color: "var(--muted-foreground)", marginTop: 5 }}>里程碑 · {item.date}</div>
    </div>
  );
}
function ApprovalCard(item: any, dnd: Record<string, unknown>, onAction: (item: any, ok: boolean) => void) {
  return (
    <div {...dnd} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "9px 11px", cursor: "grab", boxShadow: "0 1px 2px var(--shadow)" }}>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{item.title}</div>
      <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 3 }}>{item.requester} · {item.status}</div>
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onAction(item, true); }}
          style={{ flex: 1, height: 24, border: 0, borderRadius: 6, background: "#22c55e", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
        >通过</button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onAction(item, false); }}
          style={{ flex: 1, height: 24, border: 0, borderRadius: 6, background: "var(--muted)", color: "var(--muted-foreground)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
        >驳回</button>
      </div>
    </div>
  );
}

function TicketCard(item: Ticket, dnd: Record<string, unknown>, onOpen: (t: Ticket) => void) {
  const priorityColor = PRIORITY_COLOR[item.priority] || "#94a3b8";
  const typeColor = TYPE_COLOR[item.type] || "#94a3b8";
  return (
    <div
      {...dnd}
      onClick={() => onOpen(item)}
      style={{
        background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10,
        padding: "9px 10px", cursor: "grab", boxShadow: "0 1px 2px var(--shadow)",
        borderLeft: "3px solid " + priorityColor, transition: "box-shadow .15s ease",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 4px 12px var(--shadow)")}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 1px 2px var(--shadow)")}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--muted-foreground)", fontFamily: "ui-monospace, monospace" }}>{item.key}</span>
        <span style={{ fontSize: 9.5, fontWeight: 700, padding: "0 5px", borderRadius: 4, background: typeColor, color: "#fff" }}>{item.type}</span>
        <span style={{ fontSize: 9.5, fontWeight: 700, padding: "0 5px", borderRadius: 4, border: "1px solid " + priorityColor, color: priorityColor }}>{item.priority}</span>
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.4 }}>{item.title}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 7 }}>
        <span style={{ fontSize: 10.5, color: "var(--muted-foreground)" }}>{item.status}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, color: "var(--muted-foreground)" }}>
          <i style={{ width: 14, height: 14, borderRadius: 99, background: typeColor, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 8.5, fontStyle: "normal" }}>
            {String(item.assignee).slice(0, 1)}
          </i>
          {item.assignee}
        </span>
      </div>
    </div>
  );
}

const MILESTONES = [
  { id: "m1", title: "开工", start: "2026-08-20", color: "#f59e0b", allDay: true },
  { id: "m2", title: "代码完成", start: "2026-08-22", color: "#3b82f6", allDay: true },
  { id: "m3", title: "回归", start: "2026-08-25", color: "#8b5cf6", allDay: true },
];

export default function Ui() {
  const { call } = useDashboardApi();
  const [before, setBefore] = useState("");
  const [after, setAfter] = useState("");
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [cases, setCases] = useState<TestCase[]>([]);
  const [tags, setTags] = useState<string[]>(["P0", "回归"]);
  const [tasks, setTasks] = useState<Ticket[]>(INITIAL_TASKS);
  const [taskItems, setTaskItems] = useState(TASK_ITEMS);
  const [milestoneItems, setMilestoneItems] = useState(MILESTONE_ITEMS);
  const [approvals, setApprovals] = useState(APPROVAL_ITEMS);
  const [cardType, setCardType] = useState<"jira" | "task" | "milestone" | "approval">("jira");
  const [selectedDate, setSelectedDate] = useState("2026-08-20");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [calEvents, setCalEvents] = useState(MILESTONES);
  const [config, setConfig] = useState<KV[]>([
    { key: "RETRY_TIMES", value: "3" },
    { key: "TIMEOUT_MS", value: "5000" },
  ]);
  const [savedAt, setSavedAt] = useState(0);
  const [stepOrientation, setStepOrientation] = useState<"vertical" | "horizontal">("vertical");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await call("get", {});
      setBefore(d.before);
      setAfter(d.after);
      setLogs(d.logs);
      setCases(d.cases);
      setSavedAt(d.savedAt || 0);
    } catch (e) {
      setError(String((e as Error)?.message || e));
    } finally {
      setLoading(false);
    }
  }, [call]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function save() {
    setError(null);
    try {
      const r = await call("save", { after });
      setSavedAt(r.savedAt || Date.now());
    } catch (e) {
      setError(String((e as Error)?.message || e));
    }
  }

  async function reset() {
    setError(null);
    try {
      await call("reset", {});
      await refresh();
    } catch (e) {
      setError(String((e as Error)?.message || e));
    }
  }

  async function copyDiff() {
    const unified =
      "--- 修复前\n+++ 修复后\n@@ -1," +
      before.split("\n").length +
      " +1," +
      after.split("\n").length +
      " @@\n" +
      before
        .split("\n")
        .map((l) => "-" + l)
        .join("\n") +
      "\n" +
      after
        .split("\n")
        .map((l) => "+" + l)
        .join("\n");
    const ok = await copyText(unified);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  const pass = cases.filter((c) => c.status === "PASS").length;
  const fail = cases.filter((c) => c.status === "FAIL").length;
  const blocked = cases.filter((c) => c.status === "BLOCKED").length;

  function handleMove(task: { itemId: string; fromColumnId: string; toColumnId: string }) {
    // key（Jira）/ id（其他类型）双匹配，按当前类型更新对应数据
    const upd = (items: any[]) =>
      items.map((t) => (t.key === task.itemId || t.id === task.itemId ? { ...t, columnId: task.toColumnId } : t));
    if (cardType === "jira") setTasks(upd(tasks));
    else if (cardType === "task") setTaskItems(upd(taskItems));
    else if (cardType === "milestone") setMilestoneItems(upd(milestoneItems));
    else setApprovals(upd(approvals));
    setLogs((prev) =>
      prev.concat([{ level: "info", text: `移动 ${task.itemId}：${task.fromColumnId} → ${task.toColumnId}` }])
    );
  }

  function openTicket(t: Ticket) {
    setSelectedTicket(t);
    setLogs((prev) => prev.concat([{ level: "info", text: `查看 ${t.key}：${t.title}（${t.assignee} / ${t.priority}）` }]));
  }

  return (
    <Stack gap={16} style={{ padding: 24, maxWidth: 1440, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
      <Inline style={{ justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <Text variant="h2">修复工坊</Text>
          <Text variant="muted" style={{ marginTop: 4 }}>
            编辑修复方案、实时 diff 对比、执行日志与用例结果
          </Text>
        </div>
        <Inline gap={8}>
          <Button size="sm" variant="outline" onClick={() => void copyDiff()}>
            {copied ? "已复制" : "复制 diff"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void reset()}>
            重置
          </Button>
          <Button size="sm" onClick={() => void save()}>
            保存修复
          </Button>
        </Inline>
      </Inline>

      <SummaryBar pass={pass} fail={fail} blocked={blocked} labels={{ pass: "通过", fail: "失败", blocked: "阻塞" }} />

      <Card>
        <CardHeader>
          <CardTitle>修复流程</CardTitle>
          <Inline style={{ justifyContent: "space-between" }}>
            <CardDescription>当前步骤：实施修复 · 可切横向/纵向</CardDescription>
            <Inline gap={6}>
              <Button size="sm" variant={stepOrientation === "vertical" ? "default" : "outline"} onClick={() => setStepOrientation("vertical")}>
                纵向
              </Button>
              <Button size="sm" variant={stepOrientation === "horizontal" ? "default" : "outline"} onClick={() => setStepOrientation("horizontal")}>
                横向
              </Button>
            </Inline>
          </Inline>
        </CardHeader>
        <CardContent>
          <Stepper
            steps={[
              { title: "复现问题", description: "跑一次失败用例" },
              { title: "定位根因", description: "缺少异常捕获与重试" },
              { title: "实施修复", description: "编辑修复方案" },
              { title: "回归验证", description: "用例 2/4 通过" },
            ]}
            active={2}
            orientation={stepOrientation}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>修复说明</CardTitle>
          <CardDescription>Markdown 渲染</CardDescription>
        </CardHeader>
        <CardContent>
          <Markdown text={FIX_NOTE} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>修复后代码</CardTitle>
          <CardDescription>在编辑器里修改，下方 diff 实时对比</CardDescription>
        </CardHeader>
        <CardContent>
          <Editor value={after} onChange={setAfter} language="js" height={300} placeholder="// 在这里写修复方案" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>修复前后对比</CardTitle>
          <CardDescription>红色为删除，绿色为新增</CardDescription>
        </CardHeader>
        <CardContent>
          <DiffView oldText={before} newText={after} language="js" maxHeight={360} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>修复前代码（只读）</CardTitle>
          <CardDescription>CodeBlock：原始版本</CardDescription>
        </CardHeader>
        <CardContent>
          <CodeBlock code={before} language="js" copyable maxHeight={220} />
        </CardContent>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
        <Card>
          <CardHeader>
            <CardTitle>修复配置</CardTitle>
            <CardDescription>KeyValueEditor：环境变量</CardDescription>
          </CardHeader>
          <CardContent>
            <KeyValueEditor value={config} onChange={setConfig} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>修复标签</CardTitle>
            <CardDescription>TagInput：回车添加，可建议</CardDescription>
          </CardHeader>
          <CardContent>
            <TagInput value={tags} onChange={setTags} suggestions={["P0", "P1", "回归", "冒烟", "性能", "安全"]} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>执行日志</CardTitle>
          <CardDescription>LogViewer · 保存时间：{fmtTime(savedAt)}</CardDescription>
        </CardHeader>
        <CardContent>
          <LogViewer lines={logs} maxHeight={180} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>用例结果</CardTitle>
          <CardDescription>DataGrid：点击表头排序，🔍 按列筛选，勾选后导出 CSV，点击行写日志</CardDescription>
        </CardHeader>
        <CardContent>
          <DataGrid
            columns={[
              { key: "id", label: "用例" },
              { key: "name", label: "名称", sortable: true },
              { key: "status", label: "状态", sortable: true },
              { key: "duration", label: "耗时(ms)", sortable: true },
            ]}
            data={cases}
            selectable
            exportable
            exportFilename="fixbench-cases.csv"
            onRowClick={(row) =>
              setLogs((prev) => prev.concat([{ level: row.status === "PASS" ? "info" : "warn", text: `点击查看：${row.id} ${row.name} → ${row.status}` }]))
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>修复任务看板</CardTitle>
          <CardDescription>KanbanBoard：拖拽流转 + 可切换卡片类型（展示 renderCard 扩展能力）</CardDescription>
        </CardHeader>
        <CardContent>
          <Inline gap={6} style={{ marginBottom: 10 }}>
            {([["jira", "Jira Ticket"], ["task", "任务"], ["milestone", "里程碑"], ["approval", "审批"]] as [string, string][]).map(([k, label]) => (
              <Button key={k} size="sm" variant={cardType === k ? "default" : "outline"} onClick={() => setCardType(k as any)}>{label}</Button>
            ))}
          </Inline>
          <KanbanBoard
            columns={KANBAN_COLUMNS}
            items={cardType === "jira" ? tasks : cardType === "milestone" ? milestoneItems : cardType === "approval" ? approvals : taskItems}
            idKey={cardType === "jira" ? "key" : "id"}
            onDragEnd={handleMove}
            renderCard={(item, _col, dnd) => {
              if (cardType === "milestone") return MilestoneCard(item, dnd);
              if (cardType === "approval") return ApprovalCard(item, dnd, (it, ok) => {
                setApprovals((prev) => prev.map((x) => (x.id === it.id ? { ...x, status: ok ? "已通过" : "已驳回" } : x)));
                setLogs((prev) => prev.concat([{ level: ok ? "success" : "warn", text: `审批 ${it.id}：${it.title} → ${ok ? "通过" : "驳回"}` }]));
              });
              if (cardType === "task") return TaskCard(item, dnd);
              return TicketCard(item, dnd, openTicket);
            }}
          />
        </CardContent>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
        <Card>
          <CardHeader>
            <CardTitle>修复排期</CardTitle>
            <CardDescription>Calendar：点选日期，圆点为里程碑</CardDescription>
          </CardHeader>
          <CardContent>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "start" }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 4 }}>单选（里程碑）</div>
                <Calendar value={selectedDate} onChange={setSelectedDate} events={calEvents} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 4 }}>范围（排期窗口）</div>
                <DateRangeInput defaultValue={{ start: "2026-08-17", end: "2026-08-21" }} />
                <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 6 }}>点击弹出日历，拖选日期范围</div>
              </div>
            </div>
            {selectedTicket ? (
            <div style={{ marginTop: 10, padding: 10, borderRadius: 10, border: "1px solid var(--border)", background: "var(--muted)", fontSize: 12, lineHeight: 1.7 }}>
              <b style={{ fontSize: 12.5 }}>{selectedTicket.key}</b>
              <span style={{ marginLeft: 8, opacity: 0.7 }}>{selectedTicket.title}</span>
              <div style={{ marginTop: 4, opacity: 0.75 }}>
                {selectedTicket.type} · {selectedTicket.priority} · {selectedTicket.assignee} · {selectedTicket.status}
              </div>
            </div>
          ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>导入修复方案</CardTitle>
            <CardDescription>FileInput：选择文件读取文本</CardDescription>
          </CardHeader>
          <CardContent>
            <FileInput
              accept=".js,.ts,.txt"
              multiple
              onFiles={(files) => {
                if (files.length) setAfter(files[0].text || after);
              }}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>修复日历（Full）</CardTitle>
          <CardDescription>FullCalendar：月/周/日视图；「+ 添加」事件提交给 onAddEvent 持久化；与 Mini 日历共用同一事件数据</CardDescription>
        </CardHeader>
        <CardContent>
          <FullCalendar
            value={selectedDate}
            onChange={setSelectedDate}
            events={calEvents}
            onAddEvent={(ev) => {
              setCalEvents((prev) =>
                prev.concat([{ id: "ev-" + Date.now(), ...ev }])
              );
              setLogs((prev) =>
                prev.concat([{ level: "info", text: `添加事件：${ev.title}（${ev.start}${ev.allDay ? " 全天" : ""}）` }])
              );
            }}
            onUpdateEvent={(ev) => {
              setCalEvents((prev) => prev.map((x) => (x.id === ev.id ? ev : x)));
              setLogs((prev) =>
                prev.concat([{ level: "info", text: `编辑事件：${ev.title}` }])
              );
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>排期窗口</CardTitle>
            <CardDescription>DateRangeInput / TimeRangeInput / DateTimeInput：发布计划输入</CardDescription>
          </CardHeader>
          <CardContent style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 3 }}>发布窗口（日期范围）</div>
              <DateRangeInput defaultValue={{ start: "2026-08-17", end: "2026-08-21" }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 3 }}>回归时间段</div>
              <TimeRangeInput defaultValue={{ start: "10:00", end: "11:30" }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 3 }}>发布时间</div>
              <DateTimeInput defaultValue="2026-08-21T18:00" />
            </div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
              点击输入框编辑发布计划（非受控 defaultValue，无需 state）
            </div>
          </CardContent>
        </Card>
      <Card>
        <CardHeader>
          <CardTitle>用例数据（JSON）</CardTitle>
          <CardDescription>JsonBlock：结构化查看 + 复制</CardDescription>
        </CardHeader>
        <CardContent>
          <JsonBlock data={{ savedAt, tags, config, cases }} maxHeight={240} />
        </CardContent>
      </Card>

      {error ? <Text style={{ color: "var(--destructive)" }}>{error}</Text> : null}
      {loading && !before ? <Text variant="muted">加载中…</Text> : null}
    </Stack>
  );
}
