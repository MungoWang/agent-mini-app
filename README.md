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
| `panel-core` | Pure React panel UI (zero host) |
| `host-core` | Agent-agnostic host: createHost, runtime, git, tools, bridge, ports |
| `ui` | Component library |
| `dsh-plugin` | DeepSeek Harness bundle + skill path helpers |
| `smoke-test` | Integration tests |

## Examples

- `examples/com.example.hello`
- `examples/com.example.counter`
- `apps/demo-host/` — @monkey-mini-app/ui component gallery (vite dev / host /demo)
