# Structured JSON (`ctx.llm` / `ctx.agent` + `opts.schema`)

When you need an object or an array, use this path — do not experiment with "please output JSON only" phrasings.

## Contract (identical for llm and agent)

| | |
|--|--|
| Entry | `ctx.llm(prompt, { schema })` **or** `ctx.agent(goal, { schema })` |
| Returns | **Always a string that `JSON.parse` accepts** — the host asks for JSON only, strips fences/preambles, retries what a retry can fix, and raises if nothing parses |
| In your app | `JSON.parse(raw)`; it is not a question of *whether* the text is JSON, only of whether the fields match — validate those yourself |
| It is not | Provider-native JSON mode, and **not** full schema validation: the host checks that the answer *parses*, plus nothing about your `required` / `type` / enum shape |

`schema` is a plain JSON Schema object (at least `type` + `properties` / `items`). Keep the prompt short: state the task, put the constraints in `schema` instead of stacking "no explanation" lines.

## `ctx.llm` example

Full RSS + `./lib` + schema in `templates/radar/`.

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

## What the host guarantees, and what it costs

- `ctx.llm` tries up to **`retryTimes`** times (default 3 total). A retry happens only for
  something retrying can fix: the call failed / answered nothing, or the answer did not parse.
- From the second try on, the model is shown *why* the previous answer was rejected, including the
  start of it — a blind re-roll just reproduces the same truncated object.
- If nothing parses, you get `HostError` `code: "LLM_JSON_INVALID"` (or `LLM_RETRY_EXHAUSTED` if
  the model never answered at all). Its message lists every attempt; `err.attempts` carries them
  structured (`kind`, `error`, `bytes`, `head`). Nothing about the model's output is hidden — the
  rejected samples are in there, which is what lets you fix the prompt instead of guessing.
- Output is capped at **`maxTokens` (default 4096)**. A schema asking for many items can still be
  truncated at the ceiling, so for wide arrays set it yourself rather than widening the schema.
- `ctx.agent` defaults to **1 attempt**, because a turn may already have posted a comment or pushed
  a build — replaying it repeats that. Pass `retryTimes` only when your steps are idempotent.
