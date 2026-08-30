# Host 冒烟调试（人类用）

这是 **Host `:17880` 调试**，不是小程序里的 `ctx.http`。

冒烟请用聊天工具 **`mini_app_call({ appId, method, args })`**，不要 bash/curl。

Base: `http://127.0.0.1:17880`（插件 apply 时已 listen，打开小程序面板会预热）。仅在人类调试时用 curl。

| 方法 | 路径 | Body | 结果 |
|------|------|------|------|
| GET | `/api/apps` | | `{ apps: [{ id, name, version }] }` |
| GET | `/api/ctx-tools` | | `{ count, tools: [{ name, description, schema }] }` |
| POST | `/api/call` | `{ appId, method, args }` | `{ ok: true, value }` 或 `{ ok: false, error }` |
| GET | `/app/:id` | | runner HTML |
| GET | `/api/app/:id/ui/entry.js` | | per-app UI bundle（编译缓存） |
| GET | `/ui.css` | | @monkey-mini-app/ui 全局样式 |
| DELETE | `/api/app/:id` | | `{ ok, appId }` |
| GET/POST | `/api/host-config` | POST `{ hostPort, theme, palette, … }` | Host 设置 |
| GET/POST | `/api/llm-config` | POST `{ provider, model }` | 写入 `runtime/llm.json` |

```bash
curl -s http://127.0.0.1:17880/api/apps
curl -s http://127.0.0.1:17880/api/call \
  -H 'content-type: application/json' \
  -d '{"appId":"com.example.todo","method":"list","args":{"filter":"all"}}'
```

CORS 已开。改 `main.api.ts` 后直接再 curl，不必开浏览器。

小程序后端抓外网 API：用 `ctx.http`，见 [ctx.md](ctx.md)。
