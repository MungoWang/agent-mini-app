import { EV, type Payload, type Progress } from "../shared/events";
import { SAMPLE_ITEMS } from "../shared/sample";

const DIGEST_SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string" },
    bullets: { type: "array", items: { type: "string" } },
  },
  required: ["headline", "bullets"],
};

function parseDigest(raw: string): { headline: string; bullets: string[] } {
  let value: { headline?: unknown; bullets?: unknown };
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("模型没有返回 JSON：" + String(raw).slice(0, 180));
  }
  const headline = String(value?.headline ?? "").trim();
  const bullets = Array.isArray(value.bullets)
    ? value.bullets.map((b) => String(b).trim()).filter(Boolean).slice(0, 3)
    : [];
  if (!headline || bullets.length !== 3) throw new Error("摘要格式不对");
  return { headline, bullets };
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal?.aborted) return resolve();
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        resolve();
      },
      { once: true },
    );
  });
}

// ⭐ key: long job lives in api/ (backend only). UI must not import this file.
export async function runRefresh(ctx): Promise<Payload> {
  const items = SAMPLE_ITEMS.slice(0, 8);
  const report = async (partial: Partial<Progress>) => {
    const next: Progress = { running: true, step: "refresh", done: 0, total: 3, ...partial };
    await ctx.storage.set("progress", next);
    ctx.push(EV.progress, next);
  };
  try {
    await report({ step: "fetch·sample 8/8", done: 1 });
    if (ctx.signal?.aborted) throw new Error("cancelled");
    await sleep(300, ctx.signal);

    await report({ step: "summarize#1/1", done: 2 });
    const raw = await ctx.llm(
      "根据这些标题写一条中文 headline，以及恰好 3 条中文 bullets。不要前言：\n" +
        items.map((i) => "- " + i.title).join("\n"),
      { schema: DIGEST_SCHEMA },
    );
    if (ctx.signal?.aborted) throw new Error("cancelled");
    const digest = parseDigest(raw);

    const payload: Payload = { items, digest, at: Date.now() };
    await ctx.storage.set("latest", payload);
    const done: Progress = { running: false, step: "done", done: 3, total: 3 };
    await ctx.storage.set("progress", done);
    ctx.push(EV.progress, done);
    ctx.push(EV.latest, payload);
    return payload;
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    const failed: Progress = { running: false, step: "failed", done: 0, total: 3, error: message };
    await ctx.storage.set("progress", failed);
    ctx.push(EV.progress, failed);
    throw new Error("摘要失败：" + message);
  }
}
