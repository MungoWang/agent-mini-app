import { defineDashboard } from "@monkeyagent/dashboard";

type TodoItem = { id: string; title: string; done: boolean; createdAt: number };
type Filter = "all" | "active" | "done";

function uid() {
  return "t_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ⭐ 关键：本地数据用 ctx.storage（单表 get/set）；多表用 ctx.storage.table(name)。
//         todo 用主表存"进行中的任务"，把已完成的归档到第二张表体现分表。
async function loadItems(ctx): Promise<TodoItem[]> {
  const items = await ctx.storage.get("items");
  return Array.isArray(items) ? items : [];
}
async function saveItems(ctx, items: TodoItem[]) {
  await ctx.storage.set("items", items);
}
function statsOf(items: TodoItem[]) {
  const done = items.filter((i) => i.done).length;
  return { total: items.length, active: items.length - done, done };
}

export default defineDashboard({
  name: "待办",
  description: "本地待办：CRUD + 状态筛选 + 归档到第二张表",
  api: {
    async list(ctx, args?: { filter?: Filter }) {
      const all = await loadItems(ctx);
      return {
        items: args?.filter === "active" ? all.filter((i) => !i.done) : args?.filter === "done" ? all.filter((i) => i.done) : all,
        stats: statsOf(all),
      };
    },
    async add(ctx, args?: { title?: string }) {
      const title = String(args?.title ?? "").trim();
      if (!title) throw new Error("请填写标题");
      const items = await loadItems(ctx);
      const item: TodoItem = { id: uid(), title, done: false, createdAt: Date.now() };
      items.unshift(item);
      await saveItems(ctx, items);
      return item;
    },
    async toggle(ctx, args?: { id?: string }) {
      const id = args?.id;
      if (!id) throw new Error("缺少 id");
      const items = await loadItems(ctx);
      let found = false;
      const next = items.map((it) => {
        if (it.id !== id) return it;
        found = true;
        return { ...it, done: !it.done };
      });
      if (!found) throw new Error("任务不存在");
      await saveItems(ctx, next);
      return next.find((it) => it.id === id);
    },
    async remove(ctx, args?: { id?: string }) {
      const items = await loadItems(ctx);
      const next = items.filter((it) => it.id !== args?.id);
      if (next.length === items.length) throw new Error("任务不存在");
      await saveItems(ctx, next);
      return { ok: true };
    },
    async clearDone(ctx) {
      const items = await loadItems(ctx);
      await saveItems(ctx, items.filter((i) => !i.done));
      return { ok: true };
    },
    // ⭐ 关键：ctx.storage.table("archive") 是另一张独立表 —— 演示多表。
    //         table() 返回与 storage 同样的 get/set/delete/clear。
    async archive(ctx) {
      const items = await loadItems(ctx);
      const done = items.filter((i) => i.done);
      if (!done.length) return { ok: true, archived: 0 };
      const archive = ctx.storage.table("archive");
      const prev = (await archive.get("done")) ?? [];
      await archive.set("done", [...prev, ...done]);
      await saveItems(ctx, items.filter((i) => !i.done));
      return { ok: true, archived: done.length };
    },
  },
});
