# Host smoke debugging

This is **host `:17880` debugging**, not `ctx.http` inside a mini-app.

For smoke tests use the chat tool **`mini_app_call({ appId, method, args })`** — not bash, not curl.

Base: `http://127.0.0.1:17880` (the host listens when the plugin applies; opening the mini-app panel warms it). Use curl only when a human is debugging.

| Method | Path | Body | Result |
|------|------|------|------|
| GET | `/api/apps` | | `{ apps: [{ id, name, version }] }` |
| GET | `/api/ctx-tools` | | `{ count, tools: [{ name, description, schema }] }` |
| POST | `/api/call` | `{ appId, method, args }` | `{ ok: true, value }` or `{ ok: false, error }` |
| GET | `/app/:id` | | runner HTML |
| GET | `/api/app/:id/ui/entry.js` | | Per-app UI bundle (compile cache) |
| GET | `/ui.css` | | Component-library global CSS (injected by the host; never import it from an app) |
| DELETE | `/api/app/:id` | | `{ ok, appId }` |
| GET/POST | `/api/host-config` | POST `{ hostPort, theme, palette, … }` | Host settings |
| GET/POST | `/api/llm-config` | POST `{ provider, model }` | Writes `runtime/llm.json` |

```bash
curl -s http://127.0.0.1:17880/api/apps
curl -s http://127.0.0.1:17880/api/call \
  -H 'content-type: application/json' \
  -d '{"appId":"com.example.todo","method":"list","args":{"filter":"all"}}'
```

CORS is open. After editing `main.api.ts` just curl again — no browser needed.

To fetch an external API from a mini-app backend, use `ctx.http` — see [ctx.md](ctx.md).
