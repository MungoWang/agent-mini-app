# CI gate parity with local verify

> Archived 2026-09-08 · original location: `TODO.md` → P0 (1 CI type-checked with `tsc -b`, 2 no gate ran Playwright, 3 CI was missing two gates)

## What was actually true (checked 2026-09-08)

- `.github/workflows/ci.yml` ran `pnpm exec tsc -b --pretty false`, i.e. the root aggregate
  only, while `AGENTS.md` → Gates says "Before claiming types are clean, run `pnpm typecheck`
  (not `tsc -b` alone)". CI was violating its own rule. This is the hole that historically
  missed `packages/ui` (in no CI config at all) and 64 × ts(6059) in `dsh` (red in the editor,
  green in CLI).
- `check:format` and `check:templates` passed locally and ran in `verify.mjs`, but were absent
  from CI, so a formatting-only or template-breaking PR merged.
- Playwright: `apps/demo-host/e2e/{smoke,calendar-drag,motion-vendor}.spec.ts` = **12 tests, all
  green locally** (12 passed / 12 s). Neither `verify.mjs` nor CI invoked them; `pnpm test:dsh`
  runs only inside `publish:packages`. The earlier TODO claim ("two tests red since the day they
  were written") was stale.
- Simulated a clean checkout by moving every `dist` aside: `pnpm typecheck` went red at
  `packages/dsh/src/theme-resource.ts(15,8): Cannot find module '@monkey-mini-app/panel/themes'`
  — package **subpath exports** resolve through `dist`. Adding a host + panel build first made
  all 12 configs green. `check:skill`, the generated-drift diff, `check:format` and
  `check:templates` are `dist`-free (only `check:templates` reads
  `node_modules/motion/dist/react.d.ts`, which exists after install).

## What shipped

1. CI: `tsc -b` → `pnpm typecheck`, with a `pnpm --filter @monkey-mini-app/host --filter
   @monkey-mini-app/panel build` step before it and a comment naming the reason.
2. CI: added `pnpm check:format` and `pnpm check:templates`.
3. Playwright stays **local acceptance only** by owner decision: a comment in `ci.yml` points at
   `AGENTS.md`, and `AGENTS.md` → Gates now states exactly what CI runs and that
   `apps/demo-host/e2e/**` plus `pnpm test:dsh` are not CI evidence.

## Standing rule that came out of this

CI step list == `verify.mjs` step list minus the build-only steps. If e2e ever moves into CI, the
`AGENTS.md` paragraph changes in the same commit — the two must never disagree.
