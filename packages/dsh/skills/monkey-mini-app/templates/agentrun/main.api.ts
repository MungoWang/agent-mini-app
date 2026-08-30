import { defineDashboard } from "@monkeyagent/dashboard";

// ⭐ 关键：ctx.agent 是「让模型干一个多步活」的入口，返回最终 string。
//         过程事件经 onEvent 观测（status/tool/turn/text-delta/done），写进 storage 让 UI 轮询。
//         取消：用模块级 AbortController（app 模块只加载一次，var 可存）；页面隐藏/停止时不空跑。
type Step = { phase: string; name?: string; turn?: number; text?: string; at: number };

let currentAbort: AbortController | null = null;

function pushStep(ctx, step: Step) {
  void ctx.storage.set("step", step);
}
async function addStep(ctx, step: Step) {
  const run = (await ctx.storage.get("run")) || { goal: "", status: "idle", steps: [], result: "", startedAt: 0 };
  run.steps = [...(run.steps || []), step];
  await ctx.storage.set("run", run);
}

export default defineDashboard({
  name: "任务执行器",
  description: "让模型干一个多步活，实时展示过程，可取消",
  api: {
    async runStatus(ctx) {
      return (await ctx.storage.get("run")) || { goal: "", status: "idle", steps: [], result: "", startedAt: 0 };
    },

    // 启动：立即返回，后台跑 agent；progress 靠 storage + UI 轮询
    async start(ctx, args?: { goal?: string }) {
      const goal = String(args?.goal ?? "").trim();
      if (!goal) throw new Error("请输入目标");
      currentAbort?.abort();
      const ac = new AbortController();
      currentAbort = ac;
      const run = { goal, status: "running", steps: [], result: "", startedAt: Date.now() };
      await ctx.storage.set("run", run);
      await ctx.storage.set("step", { phase: "status", text: "running", at: Date.now() });

      void ctx.agent(goal, {
        signal: ac.signal,
        maxIterations: 12,
        onEvent: (ev) => {
          // ⭐ 关键：onEvent 只是观测过程，返回值仍是最终 string。这里把每个事件落 storage。
          if (ev.type === "tool") void addStep(ctx, { phase: "tool", name: ev.name, at: Date.now() });
          else if (ev.type === "turn") void addStep(ctx, { phase: "turn", turn: ev.turn, at: Date.now() });
          else if (ev.type === "text-delta") setText(ctx, ev.text);
          else if (ev.type === "done") void addStep(ctx, { phase: "done", at: Date.now() });
          else if (ev.type === "error") void addStep(ctx, { phase: "error", text: ev.message, at: Date.now() });
        },
      })
        .then(async (text) => {
          const cur = (await ctx.storage.get("run")) || run;
          await ctx.storage.set("run", { ...cur, status: "done", result: text.slice(-4000), steps: cur.steps || [] });
          if (currentAbort === ac) currentAbort = null;
        })
        .catch(async (cause) => {
          const msg = String((cause as Error)?.message || cause);
          const cur = (await ctx.storage.get("run")) || run;
          await ctx.storage.set("run", { ...cur, status: "error", result: msg, steps: cur.steps || [] });
          if (currentAbort === ac) currentAbort = null;
        });
      return { ok: true, started: true };
    },

    async cancel(ctx) {
      currentAbort?.abort();
      currentAbort = null;
      const cur = (await ctx.storage.get("run")) || { goal: "", status: "idle", steps: [], result: "", startedAt: 0 };
      await ctx.storage.set("run", { ...cur, status: "cancelled" });
      return { ok: true };
    },
  },
});

async function setText(ctx, delta: string) {
  const cur = (await ctx.storage.get("run")) || { goal: "", status: "running", steps: [], result: "", startedAt: Date.now() };
  cur.result = (cur.result || "") + delta;
  await ctx.storage.set("run", { ...cur, steps: cur.steps || [] });
}
