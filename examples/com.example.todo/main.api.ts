import { defineDashboard } from "@monkeyagent/dashboard";

function uid() {
  return "t_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export default defineDashboard({
  name: "Todo",
  description: "Local todo list persisted in main.storage.json",
  api: {
    async list(ctx, args) {
      const items = (await ctx.storage.get("items")) || [];
      const filter = args && args.filter;
      if (filter === "active") return items.filter((i) => !i.done);
      if (filter === "done") return items.filter((i) => i.done);
      return items;
    },
    async stats(ctx) {
      const items = (await ctx.storage.get("items")) || [];
      return {
        total: items.length,
        active: items.filter((i) => !i.done).length,
        done: items.filter((i) => i.done).length,
      };
    },
    async add(ctx, args) {
      const title = String((args && args.title) || "").trim();
      if (!title) throw new Error("title required");
      const items = (await ctx.storage.get("items")) || [];
      const item = { id: uid(), title, done: false, createdAt: Date.now() };
      items.unshift(item);
      await ctx.storage.set("items", items);
      return item;
    },
    async toggle(ctx, args) {
      const id = args && args.id;
      const items = (await ctx.storage.get("items")) || [];
      const next = items.map((i) => (i.id === id ? { ...i, done: !i.done } : i));
      await ctx.storage.set("items", next);
      return next.find((i) => i.id === id) || null;
    },
    async remove(ctx, args) {
      const id = args && args.id;
      const items = (await ctx.storage.get("items")) || [];
      const next = items.filter((i) => i.id !== id);
      await ctx.storage.set("items", next);
      return { ok: true };
    },
    async clearDone(ctx) {
      const items = (await ctx.storage.get("items")) || [];
      const next = items.filter((i) => !i.done);
      await ctx.storage.set("items", next);
      return { ok: true, remaining: next.length };
    },
  },
});
