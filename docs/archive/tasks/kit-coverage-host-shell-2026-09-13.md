# Kit coverage floor + host-shell coverage — done

> Archived: 2026-09-13
> Original location: `TODO.md` → P2 items (kit 覆盖率阈值 · host-shell.ts 覆盖)
> Status: **done**

## Kit (`packages/ui`) coverage floor

- `packages/ui/vitest.config.ts` now owns a `coverage` block (`include: src/**/*.{ts,tsx}`).
- Threshold **lines ≥ 40%** — a floor so a silent "kit project not running" fails the gate
  (baseline when added ~46%). Not a quality target for every file; most of the kit is still untested.
- Root `pnpm test:coverage` runs unit (host/panel/dsh ≥85%) **and** `pnpm --filter @monkey-mini-app/ui exec vitest run --coverage`.

## `host-shell.ts`

- Was ~79% lines / ~63% branches under the panel aggregate.
- Added tests: localStorage fallback, throwing storage, toggle, `app:open` / unknown id, storage
  notice, local `theme.css` → `__local__` env vars, host-port migrate via `config.save`.
- After: **~97% lines / ~83% branches** on `host-shell.ts` alone.
