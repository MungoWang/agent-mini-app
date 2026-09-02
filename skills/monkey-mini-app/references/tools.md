# `ctx.tool` — what can be called

**Do not treat this file as a catalogue.** The tool set changes with the dsh profile, plugins and MCP servers.

Only when you are writing or changing a `main.api.ts` **that really uses `ctx.tool`**:

1. Call the chat tool `mini_app_list_ctx_tools` (no arguments)
2. For human debugging only: `curl -s http://127.0.0.1:17880/api/ctx-tools`

Result: `{ count, tools: [{ name, description, schema }] }`.
`name` is the first argument of `ctx.tool(name, args)`; `schema` describes the parameters (may be called parameters / inputSchema).

`args` must be a plain JSON object (`{}` is fine). Never `{ input: "..." }`, `Date`, functions or `AbortSignal`. Pass `{}` for tools that take nothing.

## Priority when writing an app

1. `ctx.storage` / `ctx.http` / `ctx.bash` / `ctx.llm` / `ctx.system.metrics`
2. `ctx.tool` only when you clearly want to reuse an existing host tool (reading workspace files, etc.)
3. MCP via `ctx.mcp("server__tool", args)` — never wrapped in `{ input }`

`ctx.listTools()` in the backend returns the same snapshot.
