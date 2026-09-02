# In-app agent (`ctx.agent`)

> Status: shipped as **one-shot → `Promise<string>`**, with optional **`opts.onEvent`** progress projection.
> Implementation: dsh `agent-one-shot` + host types in `packages/host/src/agent-events.ts`.
> Author contract: skill [`references/ctx.md`](../../skills/monkey-mini-app/references/ctx.md).

## Shape

```ts
ctx.agent(goal: string, opts?: {
  provider?, model?, system?, schema?, maxTokens?, signal?,
  maxIterations?, onEvent?, cwdType?, cwd?,
}): Promise<string>
```

- Return value is always the **final string** (not a stream handle).
- `onEvent` is observation only — it does not change the return type.
- Event union: `status` | `text-delta` | `tool` | `turn` | `error` | `done` (see host `AgentEvent`).

## Authoring notes

- Long jobs must honour `ctx.signal` and expose progress the UI can poll.
- Prefer `templates/agentrun/` for the working pattern.
- Do not invent MCP-style `{ input: "..." }` wrappers for tool args.

## Related

- Skill: `skills/monkey-mini-app/references/ctx.md`, `llm-json.md`
- Template: `skills/monkey-mini-app/templates/agentrun/`
