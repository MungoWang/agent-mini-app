# Runtime diagnostics (app iframe → host → agent)

Status: implemented · `packages/host/src/events/host-events.ts`, `HttpGateway`, `http/app-runner-html.ts`, `http/app-view-eval.ts`, `packages/ui/src/sdk/app-error-boundary.tsx`

Closes the gap that `mini_app_reload` cannot: a mini-app that **compiles green and then
fails or renders wrongly in the browser**. Before this the only witness was a human reading
the console, so the agent's debug loop was asynchronous on the user.

## Why the iframe reports, not the panel observes

The app iframe is served by the **host** (`http://127.0.0.1:17880/app/:id`) while the panel
embedding it runs on the **adapter's** origin (dsh web). They are cross-origin, so the panel
cannot read the iframe's DOM or console, and the host server cannot reach into a browser at
all. Two directions work, and they are used for different things:

```
crash      app iframe ──POST (same origin)──▶ host ring buffer ──tool──▶ agent
question   agent ──tool──▶ host ──/api/events──▶ shell ──postMessage──▶ iframe
                                                                      │ (runs JS)
                               host  ◀──POST /view/eval (same origin)─┘
```

A **crash stays push**: a page that died cannot be polled afterwards. A **question is pull**:
any snapshot shape designed in advance is a guess at what the agent will ask, and the agent
can already write JavaScript. So the shipped runtime executes its code instead of pre-deciding
what to report.

## Channels

| Route | Direction | Purpose |
|---|---|---|
| `POST /api/app/:appId/errors` | iframe → host | report one failure (always `204`) |
| `GET /api/app/:appId/errors?since=` | host → caller | retained errors |
| `POST /api/app/:appId/alive` | iframe → host | "this document's script executed" (`204`) |
| `POST /api/app/:appId/view/eval` | iframe → host | one query's answer, matched by `requestId` |

Every POST answers `204` unconditionally — including on malformed JSON, an unknown `kind`, a
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

## View queries: `mini_app_view_eval`

`packages/host/src/http/app-view-eval.ts` holds the runtime as a real TypeScript function
and ships its **source string** into the runner document (`viewEvalClient.toString()`). That
buys two things an injected string blob cannot: the runtime is type-checked and linted, and
it is unit-tested under jsdom by executing the exact source the browser gets. The one rule
that makes this work is that `viewEvalClient` is **self-contained** — no imports, no
closures over module scope; the app id and the caps arrive as arguments.

### Injected surface: three names, no fourth

```
mma.$(sel, root?)     → Element | null
mma.$$(sel, root?)    → Array<Element>     (a plain array — not a jQuery object)
mma.selector(el)      → a CSS selector that resolves back through mma.$()
```

`selector` is the only one the platform owns: its format must have a single source, or the
"copy this address back into `$()`" path silently breaks. `$` / `$$` exist because the model
already knows them — they buy spelling, not capability. Nothing is wrapped around host-side
data: same-origin `fetch('/api/app/<id>/errors')` is the general escape hatch, and every
extra name is another thing competing for the model's attention.

`code` is an **async function body**, so it must `return`. Omitting it runs
`return mma.$("#root")` — a shallow tree, the cheapest useful first look.

### Guards are in the execution layer

Every return value passes through one serializer, and four limits are checked at every push.
First one to fire wins and is reported as `stoppedBy`; truncation is always visible in the
text as well as in the envelope.

| Gate | Why it must exist on its own |
|---|---|
| bytes `min(maxBytes, 6144)` | accumulated **while** emitting (`bytes` in the envelope), never a post-hoc slice |
| elements walked (`VIEW_EVAL_MAX_NODES`) | byte cost is only known after a line is built; counting stops `mma.$$("*")` before the first string exists |
| recursion depth (`VIEW_EVAL_MAX_DEPTH`) | the agent can return a self-referential structure; cycles also render as `[Circular]` |
| wall clock (`VIEW_EVAL_SELF_TIMEOUT_MS`, 1.2 s view-side under the host's 1.5 s) | a slow answer should still arrive, as a partial one, rather than be reported as a dead view |

**Not guarded**: a synchronous infinite loop. The thread never returns to the executor, so
nothing here can interrupt it — and measured in Chrome, the blocked iframe takes the
**panel page** down with it (the tab stops responding to CDP entirely), so no host-side
action recovers it either. `mini_app_reload` will recompile and re-emit `app:reload`, but the
wedged frame never runs the handler. The only exit is a human reloading the tab, and the
`stuck` hint says exactly that rather than promising a tool call that cannot work.

### Liveness: four `view` states, because four need different next steps

A query that returns nothing is ambiguous, so the host distinguishes how it got there:

| `view` | Established by | Agent's next step |
|---|---|---|
| `live` | the iframe answered (its `ok` may still be false — the agent's JS failed) | fix the code |
| `not-open` | no `/api/events` subscriber, **or** the shell holds no frame for the app and says so immediately | `mini_app_open` |
| `runner-not-booted` | the query timed out and the app never POSTed `/alive` since its last reload | read `mini_app_errors` — the document is not executing |
| `stuck` | the query timed out although `/alive` was seen | the page is wedged — see the limit below |

The liveness marker is deliberately a timestamp and not a heartbeat: a frame that exists but
whose script never ran is a failure mode this project has actually been bitten by (a template
placeholder produced `var APP_ID = ""com.x""`, the script failed to parse, and every
string-matching test still passed). `mini_app_reload` clears it via `forgetView()`, because
the old document must not vouch for the new one.

### Trust boundaries

* The query travels on the browser's **existing** `/api/events` stream — the iframe opens no
  second one. `requestId` is issued by the host, bound to one `appId`, and **consumed on the
  first answer**: a late, duplicated or wrong-app reply cannot settle a live query.
* The iframe accepts `mma-view-eval` only from `ev.source === window.parent`, and only from
  the origin that first spoke to it (the shell's `mma-set-env` always precedes a query).
* The shell posts with an explicit `targetOrigin` (the host origin, derived from the frame
  URL) — this also replaced the `"*"` that `postEnv` used to send theme variables to.
* Replies are re-bounded on the way in (`VIEW_EVAL_BYTE_CAP × 2`) rather than trusted.

### Output shape

Meaning travels with the answer: anything that would need a legend is either spelled in
notation the model already reads from CSS (`display:none`, `w=`, `.class`) or declared once
in the header line — including the coordinate space, which is the one fact not inferable
from a number.

```
# 6 lines shown of 6 in subtree · 1 query hit · depth 2 · coords: viewport px (scrolls with page) · viewport 1024x768 · 0.3KB · 4ms
div#root.panel.flex  x=16 y=64 w=380 h=812  (2 children)
  div.head  x=16 y=64 w=380 h=48  (2 children)
    h2.title  x=16 y=64 w=200 h=24  "Panel"
  aside.notes  x=16 y=564 w=380 h=212  (1 child)  display:none
    +2 deeper levels not shown — return that node to go on
```

Containers report a child count and never `textContent`; leaves quote their own text.
Geometry is labelled (`x=`, `w=`) because a bare `16,64` reads as a size. Detached and
non-rendering nodes are flagged rather than reported as zero-size, so nobody debugs a layout
bug that is not there. Indentation is two spaces — tree-drawing glyphs would cost a token or
two per line to say what indentation already says.

## Freshness: `app:reload`

A successful reload changes the bytes on disk. Previously nothing told the browser, and
`FrameController.mount()` only assigns `iframe.src` when the record is created — so
`edit → reload → open` on an already-open app kept showing the **old** bundle, which is what
"if it still errors, refresh" was really covering for.

- `HostEvent` gained `{ type: "app:reload", appId }`, emitted by `AppsManager.reload()` on success.
- `panel/rest.ts` exports `subscribeHostEvents(origin, { onOpen, onReload, onEval })` so hosts share the semantics; `createHostShell` uses it.
- The dsh client already held one `EventSource`, so it handles `app:reload` and `app:eval` there rather than opening a second.
- `mount()` is **not** allowed to reload: it is also the tab-switch path, and refreshing on every tab click would throw away app state.

## Author-facing tools

| Tool | Notes |
|---|---|
| `mini_app_errors({ appId, since?, clear? })` | `{ errors, lastSeq, dropped, emptyHint? }` |
| `mini_app_view_eval({ appId, code?, maxBytes? })` | `{ result, view, tookMs, bytes, truncated, stoppedBy, visited, matched, dropped?, error?, hint? }` |
| `mini_app_open({ appId })` | returns `panel: "notified" \| "no-panel-connected"` from `HostEventBus.listenerCount()` |

## Related

- `docs/contracts/app-events.md` — the **author** push channel (`ctx.push`); diagnostics are host-internal and must not mix into it
- `skills/monkey-mini-app/references/eval.md` — the same tool from the agent's side: when to ask the view, and what each `view` state means
- `skills/monkey-mini-app/references/troubleshoot.md` — failure modes across the whole loop
