import { defineDashboard } from "@monkeyagent/dashboard";
import { parseFeed } from "./lib/parseFeed";

type Digest = { headline: string; bullets: string[] };
type Payload = { items: ReturnType<typeof parseFeed>; digest: Digest | null; at: number };

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
    ? value.bullets.map((line) => String(line).trim()).filter(Boolean).slice(0, 3)
    : [];
  if (!headline || bullets.length !== 3) throw new Error("摘要格式不对");
  return { headline, bullets };
}

export default defineDashboard({
  name: "今日摘要",
  description: "拉取公开头条，整理成三条要点",
  api: {
    async refresh(ctx) {
      const r = await ctx.http("https://news.ycombinator.com/rss", { timeout: 8000 });
      if (!r.ok) throw new Error("拉取失败 HTTP " + r.status);
      const items = parseFeed(r.text).slice(0, 12);
      if (!items.length) throw new Error("没有解析到标题");
      const digest = parseDigest(
        await ctx.llm(
          "根据这些标题写一条中文 headline，以及恰好 3 条中文 bullets。不要前言：\n" +
            items.map((item) => "- " + item.title).join("\n"),
          { schema: DIGEST_SCHEMA }
        )
      );
      const payload: Payload = { items, digest, at: Date.now() };
      await ctx.storage.set("latest", payload);
      return payload;
    },
    async latest(ctx): Promise<Payload> {
      return (await ctx.storage.get("latest")) || { items: [], digest: null, at: 0 };
    },
  },
});
