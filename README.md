# monkey-mini-app

AI-friendly local Host runtime for many React mini-apps (`manifest.json` + `ui.tsx` + `main.api.ts`).

## Quick start

See **[LOCAL.md](./LOCAL.md)**.

```bash
bash scripts/install-dsh-mini-app.sh
dsh web --no-open          # http://127.0.0.1:3080
# apps host default :17880
```

## Packages

| Package | Role |
|---------|------|
| `host` | Agent-agnostic host: AppsManager, git, Hono, UI compile, tools |
| `panel` | Pure React panel UI (`PanelHost`) |
| `dsh` | DeepSeek Harness plugin (`@monkey-mini-app/dsh-mini-app`) + skills |
| `ui` | Component library |
| `smoke-test` | Integration tests |

## Docs

Start at **[docs/README.md](./docs/README.md)**. Agents: **[AGENTS.md](./AGENTS.md)**.

## Examples

- Skill templates: `packages/dsh/skills/monkey-mini-app/templates/`
- `apps/demo-host/` — `@monkey-mini-app/ui` gallery (`pnpm --filter demo-host dev`)

## Legacy

Pre-cutover packages (`host-core` / `panel-core` / `dsh-plugin`) live only on tag
`archive/pre-cutover-legacy-2026-08-29` and under `docs/archive/`.
