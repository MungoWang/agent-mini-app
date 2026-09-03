import { defineApp } from "@monkey-mini-app/api";

// ⭐ key: ctx.agent is the entry point for "have the model do one multi-step job"; it returns the final string.
//         Progress reaches the UI over `ctx.push(...)` (SSE) — no polling. `streamTo` mirrors the agent's own
//         events onto one channel; lifecycle changes are pushed explicitly.
//         The run is ALSO persisted, so reopening the app shows the last run instead of a blank screen.
//         Cancellation: a module-level AbortController (the app module loads once, so a var can hold it).
type Step = { phase: string; name?: string; turn?: number; text?: string; at: number };
type Run = { goal: string; status: string; steps: Step[]; result: string; startedAt: number };

const EMPTY: Run = { goal: "", status: "idle", steps: [], result: "", startedAt: 0 };

let currentAbort: AbortController | null = null;

async function load(ctx: { storage: { get(k: string): Promise<unknown> } }): Promise<Run> {
  return ((await ctx.storage.get("run")) as Run) || EMPTY;
}

/** Persist + stream one change. Storage is the snapshot, `push` is the live feed. */
async function save(ctx, run: Run, patch?: Partial<Run>) {
  const next: Run = { ...run, ...(patch || {}) };
  await ctx.storage.set("run", next);
  ctx.push("run", next);
  return next;
}

export default defineApp({
  name: "任务执行器",
  description: "让模型干一个多步活，实时展示过程，可取消",
  api: {
    /** Snapshot for first paint: fetch once on mount, then live-update from events. */
    async runStatus(ctx) {
      return load(ctx);
    },

    // start returns immediately; the agent runs in the background and pushes as it goes
    async start(ctx, args?: { goal?: string }) {
      const goal = String(args?.goal ?? "").trim();
      if (!goal) throw new Error("请输入目标");
      currentAbort?.abort();
      const ac = new AbortController();
      currentAbort = ac;

      let run = await save(ctx, { ...EMPTY, goal, startedAt: Date.now() }, { status: "running" });

      void ctx
        .agent(goal, {
          signal: ac.signal,
          maxIterations: 12,
          // ⭐ every text-delta / tool / turn event is mirrored to the UI as ctx.push("agent", event)
          streamTo: "agent",
          onEvent: async (ev) => {
            // onEvent still runs — use it to keep the durable snapshot, not to feed the UI
            if (ev.type !== "tool" && ev.type !== "turn" && ev.type !== "done" && ev.type !== "error") {
              return;
            }
            const step: Step =
              ev.type === "tool"
                ? { phase: "tool", name: ev.name, at: Date.now() }
                : ev.type === "turn"
                  ? { phase: "turn", turn: ev.turn, at: Date.now() }
                  : ev.type === "done"
                    ? { phase: "done", at: Date.now() }
                    : { phase: "error", text: ev.message, at: Date.now() };
            run = { ...run, steps: [...run.steps, step] };
            await ctx.storage.set("run", run);
          },
        })
        .then(async (text) => {
          const cur = await load(ctx);
          await save(ctx, cur, { status: "done", result: text.slice(-4000) });
          if (currentAbort === ac) currentAbort = null;
        })
        .catch(async (cause) => {
          const msg = String((cause as Error)?.message || cause);
          const cur = await load(ctx);
          await save(ctx, cur, { status: "error", result: msg });
          if (currentAbort === ac) currentAbort = null;
        });

      return { ok: true, started: true };
    },

    async cancel(ctx) {
      currentAbort?.abort();
      currentAbort = null;
      await save(ctx, await load(ctx), { status: "cancelled" });
      return { ok: true };
    },
  },
});
