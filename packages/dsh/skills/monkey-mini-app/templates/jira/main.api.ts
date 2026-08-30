import { defineDashboard } from "@monkeyagent/dashboard";

// ⭐ 关键：列表/看板数据项的"key"字段很重要 —— 拖拽/更新都用它定位（还记得 idKey="key" 的坑）。
//         Jira 仿真：改状态/负责人/优先级、加评论、AI 记工时。
export type Issue = {
  key: string;                       // 例如 "BUG-104"
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

const SEED: Issue[] = [
  { key: "BUG-104", type: "Bug", summary: "看板拖拽到列后状态未持久化", status: "In Progress", priority: "P0", assignee: "陈", reporter: "李", points: 3, comments: [{ author: "陈", text: "复现：跨列拖拽后刷新丢失", at: Date.now() - 864e5 }], createdAt: Date.now() - 3 * 864e5, updatedAt: Date.now() - 3600e3 },
  { key: "STORY-21", type: "Story", summary: "支持按负责人筛选看板", status: "To Do", priority: "P1", assignee: "王", reporter: "陈", points: 5, comments: [], createdAt: Date.now() - 2 * 864e5, updatedAt: Date.now() - 2 * 864e5 },
  { key: "TASK-88", type: "Task", summary: "表格视图增加优先级排序", status: "Done", priority: "P2", assignee: "李", reporter: "王", points: 2, comments: [], createdAt: Date.now() - 6 * 864e5, updatedAt: Date.now() - 8 * 3600e3 },
  { key: "BUG-77", type: "Bug", summary: "详情弹层评论不刷新最新一条", status: "Blocked", priority: "P1", assignee: "陈", reporter: "李", points: 3, comments: [], createdAt: Date.now() - 5 * 864e5, updatedAt: Date.now() - 864e5 },
  { key: "STORY-9", type: "Story", summary: "状态汇总色板支持自定义主题", status: "In Progress", priority: "P1", assignee: "王", reporter: "陈", points: 8, comments: [], createdAt: Date.now() - 1 * 864e5, updatedAt: Date.now() - 3600e3 },
  { key: "TASK-5", type: "Task", summary: "AI 工时记录入口", status: "To Do", priority: "P0", assignee: "陈", reporter: "李", points: 2, comments: [], createdAt: Date.now() - 864e5, updatedAt: Date.now() - 864e5 },
];

async function load(ctx): Promise<Issue[]> {
  const issues = await ctx.storage.table("issues").get("all");
  return Array.isArray(issues) ? issues : SEED;
}
async function save(ctx, issues: Issue[]) {
  await ctx.storage.table("issues").set("all", issues);
}
function touch(i: Issue): Issue {
  return { ...i, updatedAt: Date.now() };
}

export default defineDashboard({
  name: "Jira 看板",
  description: "看板/表格双视图 · 状态与评论编辑 · AI 记工时",
  api: {
    async list(ctx) {
      const issues = await load(ctx);
      return { issues };
    },
    // ⭐ 关键：乐观更新 + 持久化 —— 拖拽/改字段先改内存再落库；UI 拿 key 定位
    async update(ctx, args?: { key?: string; patch?: Partial<Issue> }) {
      const key = args?.key;
      if (!key) throw new Error("缺少 key");
      const issues = await load(ctx);
      let found = false;
      const next = issues.map((i) => {
        if (i.key !== key) return i;
        found = true;
        return touch({ ...i, ...(args?.patch ?? {}) });
      });
      if (!found) throw new Error("issue 不存在：" + key);
      await save(ctx, next);
      return next.find((i) => i.key === key);
    },
    async comment(ctx, args?: { key?: string; text?: string }) {
      const text = String(args?.text ?? "").trim();
      if (!text) throw new Error("评论不能为空");
      const key = args?.key;
      const issues = await load(ctx);
      let found = false;
      const next = issues.map((i) => {
        if (i.key !== key) return i;
        found = true;
        return touch({ ...i, comments: [...i.comments, { author: "我", text, at: Date.now() }] });
      });
      if (!found) throw new Error("issue 不存在");
      await save(ctx, next);
      return next.find((i) => i.key === key);
    },
    // 状态汇总：按 status 计数（简约色板用）
    async summary(ctx) {
      const issues = await load(ctx);
      const byStatus: Record<string, number> = {};
      for (const i of issues) byStatus[i.status] = (byStatus[i.status] || 0) + 1;
      return { byStatus, total: issues.length };
    },
    // ⭐ 关键：AI 记工时 —— 用 ctx.llm(schema) 把 issue 的近期变动生成一条 worklog 草稿，用户确认后再存
    async worklogDraft(ctx, args?: { key?: string }) {
      const key = args?.key;
      const issues = await load(ctx);
      const issue = issues.find((i) => i.key === key);
      if (!issue) throw new Error("issue 不存在");
      const activity = issue.comments.map((c) => `${c.author}: ${c.text}`).join("；") || "（无评论）";
      const raw = await ctx.llm(
        `为 Jira ${issue.key}「${issue.summary}」写一条简洁中文 worklog（当天在做什么、进展、下一步）。状态: ${issue.status}。近期动态: ${activity}`,
        { schema: { type: "object", properties: { note: { type: "string" } }, required: ["note"] } },
      );
      const parsed = JSON.parse(raw) as { note?: string };
      return { note: String(parsed.note ?? "").trim() || issue.summary };
    },
    // 确认后存成一条评论（worklog 前缀）
    async logWork(ctx, args?: { key?: string; note?: string; minutes?: number }) {
      const key = args?.key;
      const minutes = Number(args?.minutes ?? 0) || 0;
      const note = String(args?.note ?? "").trim();
      const issues = await load(ctx);
      let found = false;
      const next = issues.map((i) => {
        if (i.key !== key) return i;
        found = true;
        return touch({ ...i, comments: [...i.comments, { author: "我", text: `[worklog] ${minutes}min · ${note}`, at: Date.now() }] });
      });
      if (!found) throw new Error("issue 不存在");
      await save(ctx, next);
      return next.find((i) => i.key === key);
    },
  },
});
