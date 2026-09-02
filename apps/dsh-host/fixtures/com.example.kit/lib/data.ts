import type { CalendarEvent, KanbanCard, SortableItem, TreeNode } from "@monkey-mini-app/sdk";

export type SectionId =
  | "overview"
  | "forms"
  | "dates"
  | "data"
  | "editors"
  | "boards"
  | "charts";

export const SECTIONS: { id: SectionId; label: string; hint: string }[] = [
  { id: "overview", label: "概览", hint: "布局与状态" },
  { id: "forms", label: "表单", hint: "输入与选择" },
  { id: "dates", label: "日期时间", hint: "日历与时长" },
  { id: "data", label: "数据", hint: "表格与列表" },
  { id: "editors", label: "编辑器", hint: "代码与文档" },
  { id: "boards", label: "看板日历", hint: "流程与排期" },
  { id: "charts", label: "图表指标", hint: "可视化" },
];

export type Run = { id: string; name: string; owner: string; duration: string; status: string };

export const RUNS: Run[] = [
  { id: "1", name: "login-spec", owner: "Ada", duration: "1.2s", status: "pass" },
  { id: "2", name: "checkout-spec", owner: "Lin", duration: "4.8s", status: "fail" },
  { id: "3", name: "search-spec", owner: "Ada", duration: "0.9s", status: "pass" },
  { id: "4", name: "upload-spec", owner: "Kai", duration: "12.0s", status: "blocked" },
  { id: "5", name: "grid-spec", owner: "Lin", duration: "3.1s", status: "flaky" },
  { id: "6", name: "auth-spec", owner: "Kai", duration: "2.0s", status: "running" },
];

export const TREE: TreeNode[] = [
  {
    id: "src",
    label: "src",
    children: [
      { id: "ui", label: "ui.tsx" },
      { id: "api", label: "main.api.ts" },
      { id: "lib", label: "lib", children: [{ id: "data", label: "data.ts" }] },
    ],
  },
];

export const SORTABLES: SortableItem[] = [
  { id: "1", label: "Alpha" },
  { id: "2", label: "Bravo" },
  { id: "3", label: "Charlie" },
];

export const KANBAN_CARDS: KanbanCard[] = [
  {
    id: "c1",
    key: "KIT-1",
    title: "Forms section",
    columnId: "todo",
    type: "Story",
    status: "running",
    priority: "P1",
    assignee: "Ada",
  },
  {
    id: "c2",
    key: "KIT-2",
    title: "Calendar port",
    columnId: "doing",
    type: "Task",
    status: "pass",
    priority: "P2",
    assignee: "Lin",
  },
  {
    id: "c3",
    key: "KIT-3",
    title: "Chart polish",
    columnId: "done",
    type: "Task",
    status: "pass",
    priority: "P3",
    assignee: "Kai",
  },
];

export const KANBAN_COLUMNS = [
  { id: "todo", title: "Todo" },
  { id: "doing", title: "Doing" },
  { id: "done", title: "Done" },
];

const calUser = { id: "u1", name: "Ada", picturePath: null as string | null };

export const CAL_EVENTS: CalendarEvent[] = [
  {
    id: 1,
    title: "Standup",
    startDate: "2026-08-26T09:00:00",
    endDate: "2026-08-26T09:30:00",
    color: "blue",
    description: "daily",
    user: calUser,
  },
  {
    id: 2,
    title: "Oncall",
    startDate: "2026-08-26T00:00:00",
    endDate: "2026-08-28T00:00:00",
    color: "green",
    description: "coverage",
    user: calUser,
  },
  {
    id: 3,
    title: "Design review",
    startDate: "2026-08-27T14:00:00",
    endDate: "2026-08-27T15:00:00",
    color: "purple",
    description: "",
    user: calUser,
  },
];

export const SAMPLE_CODE = `export function greet(name: string) {
  return \`hello, \${name}\`;
}
`;

export const SAMPLE_MD = `# Kit showcase

- Sidebar sections
- Card groups inside each section
- No waterfall scroll of everything
`;
