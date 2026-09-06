> Archived 2026-09-06 · original location: `TODO.md` (已排期 table, "motion 动画库") + `docs/rfcs/authoring-surface.md` §3.1

# motion as an iframe platform vendor

## Why it started

`TODO.md` parked motion behind "a real keyframes-collision case". One existed all along, in
the wild, on the same authoring model — it just was not in this repo:

- `~/.monkeyagent/dashboards/e8071996-…` declared `@keyframes aibrief-soft` **twice** with
  different bodies: `components/LoadingChrome.tsx:8` (`opacity 0.55 → 1`) and
  `components/DetailPanel.tsx:228` (`opacity .45 → 1`). Same document, same name — the
  last-mounted component silently wins, and the other one animates to values it never asked
  for.
- `92794a98-…/ui.tsx:1631` injected a bare `@keyframes spin`, which is also the name
  Tailwind v4 ships in `tailwindcss/index.css:453`. An app overriding a framework keyframe
  is the same bug with worse blast radius.
- `packages/ui-examples/src/paradigms/shared.tsx` hand-rolled `Reveal` out of
  `animate-in … fill-mode-both` + an inline `animationDelay`, and every one of the nine
  paradigms imported it. The demand signal the RFC predicted.

## What shipped

`motion@13.2.0` (`motion/react`) as `/mma/vendors/motion.js`, next to the existing
`/mma/vendors/lodash.js`. Authors write the package name they already type:

```tsx
import { motion, AnimatePresence } from "motion/react";
```

### The vendor table grew a `targets` axis

`packages/host/src/compile/platform-modules.ts` is now the single list of platform
libraries, and each row says **where** it resolves:

```ts
{ id: "lodash", specifiers: ["lodash", "lodash-es"], deepMember: true, targets: ["ui", "backend"] },
{ id: "motion", specifiers: ["motion", "motion/react"], targets: ["ui"] },
```

Before this, `apps-manager.ts` called `resolveVendorSpecifier(spec)` and then unconditionally
served `lodashEs` for **whatever** id came back. Adding a second vendor to that shape would
have made `import { motion } from "motion"` in `main.api.ts` hand the app the lodash
namespace — no error, just wrong values. `resolveVendorSpecifier(spec, target)` plus a
`BACKEND_VENDORS` map keyed by id closes it, and `findVendor()` exists only so a UI-only
vendor reports "motion is iframe-only (main.api.ts has no React)" instead of falling through
to "run `mini_app_install`", which is advice an agent would actually follow.

Four readers of that one table: the UI compiler (`vendorSpecifierFilter()`, replacing a
lodash-shaped regex), the backend loader, the gateway route, and `scripts/build/sdk.mjs` —
which fails the build if the table and its own build map disagree in either direction.

### One React, enforced at three places

- `scripts/build/sdk.mjs` externalises `react*` in the motion bundle **and** maps the kit's
  own `motion` import to `/mma/vendors/motion.js`, so `Reveal` and the app share one runtime
  instead of each carrying a copy.
- `app-packages.ts` denylist rejects `mini_app_install` of `motion` / `framer-motion`, with
  the working specifier in the error text.
- `resolveSdkDistDir()` now requires **every** `VENDOR_IDS` file, so a dist built before a
  vendor existed is rejected at resolution with a rebuild hint rather than resolving fine and
  then 404-per-request → blank frame, no cause.

### The types had to lie in the same direction as the runtime

npm's bare `motion` entry is the **vanilla** API: no `motion.div`. Our vendor file
re-exports `motion/react` under both spellings, so `paths` in `scripts/check/templates.mts`
and `skills/monkey-mini-app/tsconfig.json` point `motion` **and** `motion/react` at
`motion/dist/react.d.ts`. Verified load-bearing by removing the row and watching
`check:templates` go red with `Module '"motion"' has no exported member 'motion'`.

## Kit `Reveal`

`packages/ui/src/blocks/reveal.tsx`, family `Animation` (new in
`catalog-families.json` — the vocabulary is data, so an unknown `@family` fails generation).
Calls `useReducedMotion()`: OS reduce-motion means no travel and no stagger, just present.
The nine paradigms now re-export it instead of each carrying the `animate-in` version.

`useCountUp` stayed a paradigm helper — still no second caller, which was the stated bar.

## Verification

`pnpm verify` 12/12. Beyond the unit tests (vendor table, compiler externalisation, backend
rejection, gateway serving, denylist), the thing worth recording is that a unit test cannot
answer "did it animate": a throwaway host + Playwright against the **real iframe** at
`/app/:id` asserted

- the iframe's resource list is exactly `runtime.js` + `sdk.js` + `vendors/motion.js`;
- a driven `motion.div` produced **20 distinct computed widths and opacities** across rAF
  samples — interpolation is real, not a class toggle;
- kit `Reveal`'s host element reported `animationName: none` with a live `matrix(...)`
  transform — JS-driven, which is the whole point of not injecting keyframes;
- `AnimatePresence` kept the removed row mounted mid-exit at `opacity 0.707` before it left;
- zero app-injected `@keyframes`, zero console/page errors.

Two of those assertions were wrong on the first run and the *check* was fixed, not the code:
the entrance sample raced page setup (replaced with a state-driven transition), and
"app-injected keyframes" counted the host's own boot loader (`mma-dot`, from
`app-runner-html.ts`) as if the app had written it.

## The dormant test suite this surfaced

Answering "is there an animation test in dsh-host?" required counting what the suite
actually executes, and the answer was worse than "no":

`vitest.workspace.ts` declared **one** project, `unit`, with includes ending in
`.test.ts`. `packages/ui` has its own config (jsdom + testing-library + its own alias) and
24 `.test.tsx` component tests — and nothing ever ran it. No script and no CI step invokes
`pnpm --filter @monkey-mini-app/ui test`, and the root `vitest run` cannot see `.test.tsx`
through `unit`'s globs. Those tests type-checked and sat unread. Widening the `unit` glob
would not have fixed it either: they need jsdom and the kit's setup file.

Adding the `kit` project took the suite from ~330 to **673 tests**, and immediately produced
three failures:

- two were my own brand-new `reveal.test.tsx` assertions, wrong about how motion writes
  styles in jsdom (`translateY(24px)`, and `"none"` rather than `""` when reduced);
- one was `code-block.test.tsx`, which had **never once run** and could never have passed:
  it awaited `data-highlighted="true"` from shiki, but shiki is loaded from
  `https://esm.sh/shiki@4.4.3` (hard constraint #12: CDN, not bundled) and Node's loader
  rejects that with `ERR_UNSUPPORTED_ESM_URL_SCHEME`. Its own `waitFor` timeout (8000ms) was
  also longer than the default test timeout (5000ms), so it failed on timing before it could
  fail on substance. Rewritten to assert the contract that is real offline — **a failed
  highlight CDN must still render the code** — which is the failure mode that would actually
  cost a user something.

The 85% coverage thresholds cover host/panel/dsh only, so nothing flagged a whole package's
component tests going unrun. That gap is recorded in `TODO.md` rather than papered over.

## Canaries run (each was seen red before green)

- Vendor table vs build map drift: added a `zod` row with no build entry →
  `no build for [zod]`.
- `check:templates` motion path: removed the `paths` row → `Module "motion" has no exported
  member "motion"`.
- Keyframe fence: deleted the `keyframeFindings` call → 3 of 7 tests red.
- `reveal.test.tsx` reduce-motion: deleted the `useReducedMotion` branch → red.
- `motion-vendor.spec.ts`: swapped `Reveal` back to the old CSS-class implementation → all 3
  browser tests red.

The last one needed a second attempt and is worth writing down: the first three canaries
*passed*, which looked like a weak assertion but was a stale build. `@monkey-mini-app/ui`
resolves through the package `exports` to **`packages/ui/dist`**, not `src` (only
`globals.css` is aliased to source), so editing a component and re-running the e2e tests the
previous build. After `pnpm build:ui` it failed correctly. A canary that passes is not
automatically a failed canary — check that the code under test is the code you changed.

Two of my own assertions were also simply not discriminating, found the same way: the
browser reduce-motion test passed with the feature deleted (by the time Playwright observes
the nodes a 320ms entrance has settled, so "opacity is 1" holds in both modes) — that test
was removed rather than kept as theatre, and reduce-motion coverage stays in jsdom where the
initial values can be asserted.

## The two grid tests, and a claim in this file that was wrong

`apps/demo-host/e2e/smoke.spec.ts` had 2 failing tests. **Test bug, not a code bug:** the
app opens on `style-glass` (`useState<Section>("style-glass")`), the other five tests in the
file all click a `nav-*` button first, and these two did not. Every assertion they make is
correct against the real fixture data (6 runs, `pageSize={4}` → 4 rows; ascending name sort
→ `auth-spec` first; 6/4 → `2 /`). Fixed by adding the missing navigation, and canaried:
remove the click and that test fails again.

They were **broken on the day they were written** — `8230c88` introduced the spec and the
`style-glass` default in the same commit. They survived because nothing runs Playwright: not
`pnpm verify`, not `.github/workflows/ci.yml` (which runs lint, check:skill, generated-diff,
`tsc -b`, `pnpm test`, dsh build).

### The claim I retracted

This file originally said the failing `pnpm test:coverage` was pre-existing, "confirmed by
re-running at `3f74577`". **That check proved nothing**: a git checkout does not reinstall
`node_modules`, so I had re-run the broken command inside the tree I had already broken.

The truth: `pnpm test:coverage` — the gate AGENTS.md advertises for the 85% lines floor —
crashed with `TypeError: balanced is not a function`, and **I caused it**. `pnpm --filter
@monkey-mini-app/ui add motion` re-resolved a hoisted tree (`.npmrc`: `node-linker=hoisted`,
`shamefully-hoist=true`) and left `node_modules/brace-expansion` holding **2.1.4's code with
5.0.9's nested dependency** — `balanced-match@4.0.4`, whose exports are `{ balanced, range }`,
where 2.1.4 does `var balanced = require("balanced-match")` and calls it. Two versions of one
package fighting over the same hoisted path.

The lockfile was never wrong (`2.1.4 → 1.0.2`, `5.0.9 → 4.0.4`) and my commits did not touch
it; the installed tree simply disagreed with it, and `pnpm install --frozen-lockfile` did not
detect the mismatch. Only `rm -rf node_modules` + reinstall fixed it.

Lesson worth keeping: to prove something predates your change, check it out **and reinstall**,
or say you have not proven it. And with a hoisted linker, a filtered `pnpm add` can silently
correlate unrelated packages — verify the whole tree, not just the package you touched.

`pnpm test:coverage` now runs (497 tests) and the threshold is live — verified by canary:
raising `packages/host/src/**` to 99.9 fails with `Coverage for lines (86.97%) does not meet
"packages/host/src/**" threshold (99.9%)`.

### Why the workspace file had a type error nobody saw

`vitest.workspace.ts` was in no tsconfig `include`, so an editor checked it with an inferred
config and showed red while every CI check stayed green — the exact split AGENTS.md warns
about. The error was real: `coverage` is a **root-only** option, and once the workspace array
contains a string entry the remaining entries are typed `ProjectConfig`, which rejects it.
The duplicated block is gone; the live one stays in `vitest.config.ts`. Both config files are
now in the root tsconfig so this class of mistake cannot hide again.

## Not done here

Templates and paradigms still animate via the old path where they had it; §5 (templates
redo) is where they move onto the presets, and it is explicitly gated behind them.
