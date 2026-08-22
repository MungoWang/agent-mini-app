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
| `agent-core` / `agent-skills` | Tool handlers + SKILL.md (AI generation contract) |
| `dsh-plugin` | DeepSeek Harness bundle (link into web profile) |
| `ui-core` | Multi-tab state |
| `app-history-git` | Single-branch commit tree via isomorphic-git |

## Examples

- `examples/com.example.hello`
- `examples/com.example.counter`
- `demo/server.mjs` — visual Host without full React toolchain
