# `@monkey-mini-app/pi-mini-app`

pi **Agent Client** for monkey-mini-app (does **not** `createHost`).

## Caps drivers (official SDK path)

| Cap | Implementation |
|-----|----------------|
| `llm` | `ModelRuntime.complete` via `createPiSdkAiDriver` |
| `agent` | **Ephemeral** `createAgentSession` + `SessionManager.inMemory()` + `session.prompt` |
| `tool` / `listTools` / `mcp` | Long-lived in-memory AgentSession tool registry (`createPiSdkEnvDriver`) |
| `credentials` | `{}` |
| `config` | omitted → Host `publicAppConfig(host.json)` |

### Session isolation

Mini-app `ctx.llm` / `ctx.agent` **must not** write into the user’s interactive chat JSONL.

Each AI call opens an **in-memory** AgentSession, runs, then `dispose()`s. Env tool execution uses a separate in-memory session for `getToolDefinition` / `execute`.

## Install

```bash
pi install npm:@monkey-mini-app/pi-mini-app
# or path-link during monorepo dev
```

Requires a configured pi ModelRuntime (`~/.pi/agent/auth.json` / provider keys).

## With Shell

1. Start this extension (serves `/v1/caps/*`, writes `agent-capabilities.json`).
2. Start Shell Host (`packages/shell` / Tauri) which `connect`s those caps.
3. On `session_start`, tools bind to Host via HTTP ToolClient.
