import { defineApp } from "@monkey-mini-app/api";

// ⭐ key: ctx.agent is the entry point for "have the model do one multi-step job"; it returns the final string.
//         Progress events are observed via onEvent (status/tool/turn/text-delta/done), written into storage for the UI to poll.
//         Cancellation: a module-level AbortController (the app module loads once, so a var can hold it); no wasted runs when the page is hidden/stopped.
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

export default defineApp({
  name: "任务执行器",
  description: "让模型干一个多步活，实时展示过程，可取消",
  api: {
    async runStatus(ctx) {
      return (await ctx.storage.get("run")) || { goal: "", status: "idle", steps: [], result: "", startedAt: 0 };
    },

    // start: returns immediately, the agent runs in background; progress via storage + UI polling
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
          // ⭐ key: onEvent only observes progress, the return value is still the final string. Here every event is persisted to storage.
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
