# 结构化 JSON（`ctx.llm` / `ctx.agent` + `opts.schema`）

需要对象/数组时走这条，不要自己试各种「请只输出 JSON」。

## 契约（llm 与 agent 对齐）

| | 说明 |
|--|------|
| 入口 | `ctx.llm(prompt, { schema })` **或** `ctx.agent(goal, { schema })` |
| 返回 | **始终是 string**；给了 `schema` 时宿主会要求模型只回 JSON，并尽量剥掉 markdown/前言 |
| App 侧 | `JSON.parse(raw)`；失败就 throw，不要当业务文案展示 |
| 不是什么 | **不是**默认每次结构化；**不是** provider 原生 JSON mode / schema 校验重试（二期可加强） |

`schema` 用普通 JSON Schema 对象（至少 `type` + `properties` / `items`）。提示宜短：任务说清楚 + 把约束交给 `schema`，不必再堆「不要解释」。

## `ctx.llm` 例子

完整 RSS + `./lib` + schema 见 `templates/insights/`。

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
const digest = JSON.parse(raw);
```

## `ctx.agent` 例子

适合「多步工具/推理后再收成结构化结果」。仍返回 string。若还要过程时间线，同一调用加 `onEvent`（形状见 [ctx.md](ctx.md)）。

```ts
const INSIGHT_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    risks: { type: "array", items: { type: "string" } },
    nextStep: { type: "string" },
  },
  required: ["summary", "risks", "nextStep"],
};

const raw = await ctx.agent(
  "根据下面材料给出对独立开发者的洞察：风险列表 + 下一步建议。\n" + materials,
  { schema: INSIGHT_SCHEMA },
);
const insight = JSON.parse(raw);
await ctx.storage.set("insight", insight);
return insight;
```

与 llm 一样：`schema` 可选；自然语言最终句不必传 `schema`。

## 宿主实际做了什么（实现提示）

1. `withJsonInstruction`：把 schema 写进约束（llm → stream 的 `system`；agent → one-shot followup 文本）  
2. 模型生成  
3. `coerceSchemaJson`：去掉 \`\`\`json 围栏 / 前言，尽量抽出 `{…}` / `[…]`  
4. App `JSON.parse`

校验失败时 **不会**自动重试；该 throw 就 throw，让 UI 显示错误。
