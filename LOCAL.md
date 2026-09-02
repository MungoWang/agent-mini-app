# Local development

Day-to-day on the **platform** (host / panel / iframe): **`pnpm dev:host`** (Vite `:5174`, demo host `:17900`). No dsh involved.

dsh is the current adapter; pi is not wired yet. You do not need dsh to change UI.

## Link into local dsh web (dev machine)

```bash
bash scripts/setup/install-dsh-plugin.sh
dsh web --no-open # http://127.0.0.1:3080 ; apps host :17880
```

This is **not** the user install path (users run `dsh plugin add @monkey-mini-app/dsh-mini-app`). The script builds then path-links repo packages into `~/.dsh/profiles/web`.

Rewrite config only:

```bash
pnpm exec tsx scripts/setup/host-config.mts
```

## Edit loop

```bash
# after host / panel / dsh source changes
pnpm --filter @monkey-mini-app/dsh-mini-app build
# restart dsh web, hard-refresh the browser

# UI kit / SDK
node scripts/build/ui.mjs && node scripts/build/sdk.mjs
pnpm skill # gen:skill + check:skill
```

## Test

```bash
pnpm lint
pnpm skill
pnpm test
pnpm exec tsc -b
```

Pre-publish install gate (real npm packages + real dsh web; slow; use `pnpm dev:host` daily):

```bash
pnpm dsh-host # :3088
pnpm test:dsh
pnpm publish:packages # runs test:dsh first; emergency --skip-e2e
```

## Docs

Index: [`docs/README.md`](./docs/README.md). Do not add long essays at the repo root.

## FAQ

1. **Missing host.json** — run `scripts/setup/install-dsh-plugin.sh` or `scripts/setup/host-config.mts`.
2. **Theme lost on refresh** — confirm the apps host got `POST /api/host-config`; hard-refresh.
3. **Old package names** — `dsh-plugin` / `host-core` / `panel-core` are gone; see tag `archive/pre-cutover-legacy-2026-08-29`.
