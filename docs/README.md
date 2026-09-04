# Docs index

**LLM / agent entry.** Read these rules before writing docs. Implementation contracts live in the skill + the live dirs below.

## Where to write

| Dir | For | When |
|-----|-----|------|
| [`architecture/`](./architecture/) | Live architecture (short, executable) | Layer / seam / install-path changes |
| [`contracts/`](./contracts/) | Long-lived behavior | `ctx.agent`, file tools, other public protocol |
| [`rfcs/`](./rfcs/) | Unshipped research | New ideas, host ports; fold into the two columns above after landing |
| [`archive/`](./archive/) | History, read-only | **Do not stack new design here** |
| [`assets/`](./assets/) | Previews / HTML / CSS samples | Non-contract material |

## Do not

1. Add long essays at repo root or `docs/` root (this `README.md` excepted).
2. Copy implementation detail into many markdown files; skill source of truth: `skills/monkey-mini-app/`.
3. Treat `archive/**` as “how we do it now”.
4. Use deleted package names as live paths: `host-core` / `panel-core` / `dsh-plugin` (git tag `archive/pre-cutover-legacy-2026-08-29` only).

## Live docs

- [architecture/overview.md](./architecture/overview.md) — platform packages and composition root (dsh is an adapter)
- [contracts/inapp-agent.md](./contracts/inapp-agent.md) — `ctx.agent` / one-shot
- [contracts/file-tools.md](./contracts/file-tools.md) — mini_app file tools
- [contracts/app-events.md](./contracts/app-events.md) — `ctx.push` → `useApp().on` SSE, per-app scoping, replay buffer
- [contracts/runtime-diagnostics.md](./contracts/runtime-diagnostics.md) — how a UI that compiled green still reports its own crash + DOM outline back to the agent
- [contracts/skill-sync.md](./contracts/skill-sync.md) — how the skill is generated, the `@family`/`componentType` taxonomy, prop-provenance rule, and what `pnpm check:skill` blocks
- [rfcs/pi-extension-port.md](./rfcs/pi-extension-port.md) — next host (pi / pi-web), **not implemented**
- [rfcs/authoring-protocol.md](./rfcs/authoring-protocol.md) — **landed**: one author package (`@monkey-mini-app/ui`), `defineApp`, `ui`/`api`/`shared` import bounds
- [rfcs/view-eval-metrics.md](./rfcs/view-eval-metrics.md) — **deferred**: observation metrics that must exist before reshaping `mini_app_view_eval` again
- [rfcs/scripts-layout.md](./rfcs/scripts-layout.md) — **proposal**: `scripts/` by lifecycle stage, naming rules, `check/scripts` gate

## Local development

[`LOCAL.md`](../LOCAL.md) and [`AGENTS.md`](../AGENTS.md). Repo automation: [`scripts/README.md`](../scripts/README.md).
