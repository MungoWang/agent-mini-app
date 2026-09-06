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

## Not done here

Templates and paradigms still animate via the old path where they had it; §5 (templates
redo) is where they move onto the presets, and it is explicitly gated behind them.
