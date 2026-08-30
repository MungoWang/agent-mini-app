import { defineDashboard } from "@monkeyagent/dashboard";

type TodoItem = { id: string; title: string; done: boolean; createdAt: number };
type Filter = "all" | "active" | "done";

function uid() {
  return "t_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

async function loadItems(ctx): Promise<TodoItem[]> {
  const items = await ctx.storage.get("items");
  return Array.isArray(items) ? items : [];
}

function applyFilter(items: TodoItem[], filter?: string): TodoItem[] {
  if (filter === "active") return items.filter((item) => !item.done);
  if (filter === "done") return items.filter((item) => item.done);
  return items;
}

function statsOf(items: TodoItem[]) {
  const done = items.filter((item) => item.done).length;
  return { total: items.length, active: items.length - done, done };
}

export default defineDashboard({
  name: "待办",
  description: "本地待办，存在这台机器上",
  api: {
    async list(ctx, args?: { filter?: Filter }) {
      const all = await loadItems(ctx);
      return { items: applyFilter(all, args?.filter), stats: statsOf(all) };
    },
    async add(ctx, args?: { title?: string }) {
      const title = String(args?.title ?? "").trim();
      if (!title) throw new Error("请填写标题");
      const items = await loadItems(ctx);
      const item: TodoItem = { id: uid(), title, done: false, createdAt: Date.now() };
      items.unshift(item);
      await ctx.storage.set("items", items);
      return item;
    },
    async toggle(ctx, args?: { id?: string }) {
      const id = args?.id;
      if (!id) throw new Error("缺少 id");
      const items = await loadItems(ctx);
      let found = false;
      const next = items.map((item) => {
        if (item.id !== id) return item;
        found = true;
        return { ...item, done: !item.done };
      });
      if (!found) throw new Error("任务不存在");
      await ctx.storage.set("items", next);
      return next.find((item) => item.id === id);
    },
    async remove(ctx, args?: { id?: string }) {
      const id = args?.id;
      if (!id) throw new Error("缺少 id");
      const items = await loadItems(ctx);
      const next = items.filter((item) => item.id !== id);
      if (next.length === items.length) throw new Error("任务不存在");
      await ctx.storage.set("items", next);
      return { ok: true };
    },
    async clearDone(ctx) {
      const next = (await loadItems(ctx)).filter((item) => !item.done);
      await ctx.storage.set("items", next);
      return { ok: true, remaining: next.length };
    },
  },
});
