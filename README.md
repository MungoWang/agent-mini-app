# monkey-mini-app

AI-friendly local Host runtime for many React mini-apps (manifest + App.tsx + optional storage / history).

## Quick start (local)

See **[LOCAL.md](./LOCAL.md)**.

```bash
chmod +x scripts/*.sh
bash scripts/setup.sh          # install dsh + link plugin
bash scripts/run-demo.sh       # Host UI → http://127.0.0.1:8080
dsh web --no-open --port 3080  # dsh + plugin → http://127.0.0.1:3080
```

## Packages

| Package | Role |
|---------|------|
| `runtime-core` | App registry, bridge, storage, theme |
| `agent-core` | Tool handlers
| `dsh-plugin/skills` | SKILL.md + templates（AI 生成契约，唯一源）
| `agent-skills` | 仅 resolve skill 路径，无第二份正文 |
| `dsh-plugin` | DeepSeek Harness bundle (link into web profile) |
| `ui-core` | Multi-tab state |
| `app-history-git` | Single-branch commit tree via isomorphic-git |

## Examples

- `examples/com.example.hello`
- `examples/com.example.counter`
- `apps/demo-host/` — @monkey-mini-app/ui component gallery (vite dev / host /demo)
