import { defineApp } from "@monkey-mini-app/api";

import { type FeedItem, SAMPLE_ITEMS } from "./shared/sample";

type Digest = { headline: string; bullets: string[] };
type Payload = { items: FeedItem[]; digest: Digest | null; at: number };
type Progress = { running: boolean; step: string; done: number; total: number; error?: string };

const DIGEST_SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string" },
    bullets: { type: "array", items: { type: "string" } },
  },
  required: ["headline", "bullets"],
};

function parseDigest(raw: string): Digest {
  let value: { headline?: unknown; bullets?: unknown };
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("模型没有返回 JSON：" + String(raw).slice(0, 180));
  }
  const headline = String(value?.headline ?? "").trim();
  const bullets = Array.isArray(value?.bullets)
    ? value.bullets.map((b) => String(b).trim()).filter(Boolean).slice(0, 3)
    : [];
  if (!headline || bullets.length !== 3) throw new Error("摘要格式不对");
  return { headline, bullets };
}

// ⭐ key: long-running task — run a sample to prove the full pipeline (first 8 items here), cap the batch,
//         and check ctx.signal between steps (hitting Stop aborts). Progress is exposed via storage for the UI to poll.
async function runRefresh(ctx): Promise<Payload> {
  const items = SAMPLE_ITEMS.slice(0, 8);
  const report = async (partial: Partial<Progress>) => {
    await ctx.storage.set("progress", { running: true, step: "refresh", done: 0, total: 3, ...partial });
  };
  try {
    // 1) sample fetch (built-in samples here; in real use swap in ctx.http pulling RSS)
    await report({ step: "fetch·sample 8/8", done: 1 });
    // ⭐ key: check the cancel signal between steps
    if (ctx.signal?.aborted) throw new Error("cancelled");
    await sleep(300, ctx.signal);

    // 2) model summary (schema softly constrains "JSON only"; the return is still a string, then JSON.parse)
    await report({ step: "summarize#1/1", done: 2 });
    const raw = await ctx.llm(
      "根据这些标题写一条中文 headline，以及恰好 3 条中文 bullets。不要前言：\n" + items.map((i) => "- " + i.title).join("\n"),
      { schema: DIGEST_SCHEMA },
    );
    if (ctx.signal?.aborted) throw new Error("cancelled");
    const digest = parseDigest(raw);

    const payload: Payload = { items, digest, at: Date.now() };
    await ctx.storage.set("latest", payload);
    await ctx.storage.set("progress", { running: false, step: "done", done: 3, total: 3 });
    return payload;
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    await ctx.storage.set("progress", { running: false, step: "failed", done: 0, total: 3, error: message });
    throw new Error("摘要失败：" + message);
  }
}

export default defineApp({
  name: "今日摘要",
  description: "拉取公开头条，整理成三条要点",
  api: {
    async latest(ctx): Promise<Payload> {
      return (await ctx.storage.get("latest")) || { items: SAMPLE_ITEMS, digest: null, at: 0 };
    },

    // fire-and-forget: returns "started" immediately, the actual work runs in background, UI polls scanStatus
    async scan(ctx) {
      void runRefresh(ctx);
      return { ok: true };
    },

    async scanStatus(ctx): Promise<Progress> {
      return (await ctx.storage.get("progress")) || { running: false, step: "idle", done: 0, total: 3 };
    },

    // can also be awaited directly (no background polling)
    async refresh(ctx) {
      return runRefresh(ctx);
    },
  },
});

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal?.aborted) return resolve();
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      resolve();
    }, { once: true });
  });
}
