# Structured JSON (`ctx.llm` / `ctx.agent` + `opts.schema`)

When you need an object or an array, use this path — do not experiment with "please output JSON only" phrasings.

## Contract (identical for llm and agent)

| | |
|--|--|
| Entry | `ctx.llm(prompt, { schema })` **or** `ctx.agent(goal, { schema })` |
| Returns | **Always a string**; with `schema` the host asks the model for JSON only and strips markdown/preambles as best it can |
| In your app | `JSON.parse(raw)`; on failure throw — never render it as copy |
| It is not | On by default per call; **not** provider-native JSON mode and **not** schema validation with retry (phase 2 may add that) |

`schema` is a plain JSON Schema object (at least `type` + `properties` / `items`). Keep the prompt short: state the task, put the constraints in `schema` instead of stacking "no explanation" lines.

## `ctx.llm` example

Full RSS + `./lib` + schema in `templates/insights/`.

```ts
const SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string" },
    bullets: { type: "array", items: { type: "string" } },
  },
  required: ["headline", "bullets"],
};

const raw = await ctx.llm("One headline and exactly 3 bullets, in the user's language. No preamble.", {
  schema: SCHEMA,
});
const digest = JSON.parse(raw);
```

## `ctx.agent` example

For "reason / use tools over several steps, then return a structured result". Still a string. Need the process timeline too? Add `onEvent` to the same call (shapes in [ctx.md](ctx.md)).

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
  "From the material below, give insights for an independent developer: risks + a next step.\n" + materials,
  { schema: INSIGHT_SCHEMA },
);
const insight = JSON.parse(raw);
await ctx.storage.set("insight", insight);
return insight;
```

Same as llm: `schema` is optional, and for a natural-language final answer you do not pass one.

## What the host actually does

1. `withJsonInstruction`: writes the schema into the constraints (llm → the stream's `system`; agent → the one-shot follow-up text)
2. The model generates
3. `coerceSchemaJson`: drops ```` ```json ```` fences / preambles and extracts `{…}` / `[…]` as well as it can
4. Your app calls `JSON.parse`

On invalid JSON there is **no automatic retry** — throw, and let the UI show the error.
