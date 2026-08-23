# 结构化 JSON（`ctx.llm` + `opts.schema`）

需要对象/数组时走这条，不要自己试各种「请只输出 JSON」。

`ctx.llm` **始终返回 string**。给了 `opts.schema` 时宿主会要求模型只回 JSON；你再 `JSON.parse`。

```ts
const SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string" },
    bullets: { type: "array", items: { type: "string" } },
  },
  required: ["headline", "bullets"],
};

const raw = await ctx.llm("写一条中文 headline，以及恰好 3 条中文 bullets。不要前言。", {
  schema: SCHEMA,
});
const digest = JSON.parse(raw); // 失败就 throw，不要当摘要展示
```

完整 RSS + `./lib` + schema 见 `templates/news/`。
