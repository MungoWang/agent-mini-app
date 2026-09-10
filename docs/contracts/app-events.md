# App events (backend → UI push)

Status: implemented · `packages/host/src/events/host-events.ts`, `HttpGateway`, `packages/ui/src/sdk/use-app.ts`

One-way server push from a mini-app's backend to **its own** UI. Before this, the
only feedback channel was an author-written `api` method, so a background job had to
be polled (`runStatus` every few hundred ms). `ctx.push` is the push path; storage is
still where durable state lives.

## Wire

`GET /api/app/:appId/events` — `text/event-stream`, served by `HttpGateway`.

| frame | when | payload (`data:` JSON) |
|---|---|---|
| `retry: 2000` | on open | — |
| `event: app:event` | every `ctx.push(name, params)` | `{ name, data, seq }` |
| `event: app:gap` | reconnect whose `Last-Event-ID` is older than the buffer | `{ appId, since }` |
| `: ping` | every 25s | keeps idle proxies from closing the stream |

Rules:

- **Scoping is server-side.** The route filters by `appId` before writing to the
  socket. A UI must never be able to read another mini-app's events — the global
  `/api/events` stream stays a host/shell channel (`app:open`), not an author one.
- `id:` is the **per-app** sequence, so `EventSource` reconnect replay is per app.
- Buffer: last `APP_EVENT_BUFFER` (200) events **per app**. Evicted history is
  reported as `app:gap` rather than silently skipped: the UI refetches a snapshot.
- `params` must be JSON-serialisable. An unsuitable payload is dropped with a host
  warning and `pushApp` returns `false` — a UI event never fails the API call that
  emitted it.
- No auth token: same-origin iframe against its own host, matching the other
  `/api/app/:appId/*` routes.

## Author API

```ts
// main.api.ts — fire and forget, safe from background jobs and onEvent handlers
ctx.push("progress", { done: 3, total: 8 });

// agent progress without hand-writing a bridge
await ctx.agent(goal, { streamTo: "agent", maxIterations: 12 });
```

```tsx
// ui.tsx — one snapshot on mount, then events. No setInterval.
const { call, on, onAny } = useApp();
useEffect(() => on("progress", (data) => setProgress(data as Progress)), [on]);
```

`useApp()` surface:

| member | notes |
|---|---|
| `on(name, cb)` | one channel; `"*"` matches every channel. Returns unsubscribe. |
| `onAny(cb)` | every event as `{ name, data }`; a replay gap arrives as `{ name: "*", data: { gap: true } }`. |

One `EventSource` per app id, shared by all subscribers and closed when the last one
unsubscribes. If the engine has no `EventSource` the hooks are inert, so a UI still
renders without a live stream.

## Wiring

`createHost` injects the `push` capability itself (`caps.push → bus.pushApp(ctx.appId, …)`),
so **adapters implement nothing** — `HostCapabilities` stays bash/llm/agent/tool/mcp, and
no host other than the bus owner knows events exist. `bindCapsToContext` exposes
`ctx.push` and implements the `streamTo` bridge, which keeps a throwing caller `onEvent`
from aborting the run.

## Working examples

`skills/monkey-mini-app/templates/runner` (agent + `streamTo`) and
`templates/radar` (long job + explicit `ctx.push`).

## Related

- `docs/contracts/inapp-agent.md` — what `streamTo` mirrors
- `docs/architecture/overview.md` — composition root and seams
