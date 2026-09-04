# Runtime diagnostics (app iframe → host → agent)

Status: implemented · `packages/host/src/events/host-events.ts`, `HttpGateway`, `http/app-runner-html.ts`, `packages/ui/src/sdk/app-error-boundary.tsx`

Closes the gap that `mini_app_reload` cannot: a mini-app that **compiles green and then
fails in the browser**. Before this the only witness was a human reading the console, so
the agent's debug loop was asynchronous on the user.

## Why the iframe reports, not the panel observes

The app iframe is served by the **host** (`http://127.0.0.1:17880/app/:id`) while the panel
embedding it runs on the **adapter's** origin (dsh web). They are cross-origin, so the panel
cannot read the iframe's DOM or console, and the host server cannot reach into a browser at
all. The only direction that works from both sides is:

```
app iframe ──POST (same-origin)──▶ host ring buffer ──tool──▶ agent
```

Everything below follows from that. It also means the data is **as fresh as the last
render**: an app that is not open reports nothing. Tools say so instead of returning an
empty result that reads as "no bugs".

## Channels

| Route | Direction | Purpose |
|---|---|---|
| `POST /api/app/:appId/errors` | iframe → host | report one failure (always `204`) |
| `GET /api/app/:appId/errors?since=` | host → caller | retained errors |
| `POST /api/app/:appId/snapshot` | iframe → host | latest DOM outline |
| `GET /api/app/:appId/snapshot` | host → caller | retained snapshot |

Both POSTs answer `204` unconditionally — including on malformed JSON, an unknown `kind`, a
bad appId or an oversized payload. A diagnostic endpoint that returns an error adds a second
failure to a page that is already broken.

## Error capture: three lanes, because they fail differently

| Lane | Captured by | `kind` | Notes |
|---|---|---|---|
| React render / effect | `AppErrorBoundary` | `render` | Adds `componentStack`, which names the **app's own** component (`at Ui (…)`) once the bundle keeps names; frames inside the prebuilt `sdk.js` stay minified |
| Bundle load / module evaluation | `try { await import(entry.js) }` in the runner | `module` | Never reaches `window.onerror`, so it reports explicitly |
| Anything else | `window.onerror`, `unhandledrejection` | `uncaught`, `async` | Resource-load errors are filtered out (no message, pure noise) |

`AppErrorBoundary` is **injected by the host's compiled wrapper**, not written by the
author — an agent should not have to remember a crash guard, and one that does not
rendered a blank panel because the boot art had already been cleared.

The UI bundle is compiled with esbuild `keepNames: true`. Plain `minify` rewrote every
component to `e`/`Pye`, which threw away the most useful field of a render error; the extra
bytes buy back a `componentStack` that actually points at the author's component.

Retention: `APP_ERROR_BUFFER` (50) per app, each entry carrying a global monotonic `seq`.
`dropped` is measured against a **per-app** total — the cursor is global, so subtracting a
ring length from it would let one app's errors look like another app's evictions.

`mini_app_reload` clears the ring, so anything you read afterwards came from the build you
just produced.

## DOM outline

Collected inside the iframe (`getComputedStyle` + geometry) at 300/1200/3000 ms after
`load`, because the app fetches on mount; the host keeps the newest. Node keys are compact
(`t/i/c/r/al/x/ph/w/h/s/k`) and the tool returns the legend with every answer.

Deliberately **not a screenshot**: the platform has no headless browser and adding
puppeteer/playwright to the host would contradict both the seam discipline and constraint
#10. What an agent actually asks — "did this class/token apply, what colour won, did that
node render to nothing" — is answerable from computed style. `ui_snapshot` is left
unclaimed for a real pixel capture if a host ever wants one.

Caps: `APP_SNAPSHOT_BYTES` (60 KB) rejected whole rather than truncated in storage, and the
outline carries `truncated` so the reader knows it is partial.

## Freshness: `app:reload`

A successful reload changes the bytes on disk. Previously nothing told the browser, and
`FrameController.mount()` only assigns `iframe.src` when the record is created — so
`edit → reload → open` on an already-open app kept showing the **old** bundle, which is what
"if it still errors, refresh" was really covering for.

- `HostEvent` gained `{ type: "app:reload", appId }`, emitted by `AppsManager.reload()` on success.
- `panel/rest.ts` exports `subscribeHostEvents(origin, { onOpen, onReload })` so hosts share the semantics; `createHostShell` uses it.
- The dsh client already held one `EventSource`, so it handles `app:reload` there rather than opening a second.
- `mount()` is **not** allowed to reload: it is also the tab-switch path, and refreshing on every tab click would throw away app state.

## Author-facing tools

| Tool | Notes |
|---|---|
| `mini_app_errors({ appId, since?, clear? })` | `{ errors, lastSeq, dropped, emptyHint? }` |
| `mini_app_dom_snapshot({ appId, depth?, textOnly? })` | `{ dom, keys, viewport, ageMs, truncated }` |
| `mini_app_open({ appId })` | now returns `panel: "notified" \| "no-panel-connected"` from `HostEventBus.listenerCount()` |

## Related

- `docs/contracts/app-events.md` — the **author** push channel (`ctx.push`); diagnostics are host-internal and must not mix into it
- `skills/monkey-mini-app/references/troubleshoot.md` — the same failure modes from the agent's side
