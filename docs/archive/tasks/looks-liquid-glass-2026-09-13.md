# Looks material pass + liquid glass — done

> Archived: 2026-09-13
> Original location: in-progress looks/facades redesign (TODO + session work after layout presets)
> Status: **done** — eight Looks, seven facades, per-app `theme.css`, liquid glass on `today` /
> `glass-island`, host first-paint bake for local palettes. Remaining open item is **Look PNGs only**
> (stays in `TODO.md` P1).

## What landed

- Looks catalog + fixtures: `packages/ui-examples/src/looks/`
- Facades: `skills/monkey-mini-app/templates/{minimal,today,board,radar,sheets,runner,chores,watch}/`
- Architecture: [`docs/architecture/looks-and-templates.md`](../architecture/looks-and-templates.md)
- Layout presets (separate archive): [`layout-presets-2026-09-10.md`](./layout-presets-2026-09-10.md)
- `watch` → `DashboardShell`; `sheets` stays `ListDetail` (no nested `TablePage`)

## Liquid glass (`glass-island` / `today`)

Not frost. Recipe (user-picked lab **B**):

- SVG filter `#mma-liquid`: `feTurbulence` → `feGaussianBlur` → `feDisplacementMap` (scale ~45, yChannel=B)
- `backdrop-filter: blur(2px) saturate(160%) url(#mma-liquid)` (Chromium; frost fallback otherwise)
- Light: haze `#d5e0ed` + white + whisper primary, **large floating orbs** + grain
- Dark: deep indigo (left as preferred)
- Radius `28px` on the style object (class `rounded-3xl` was defined and never applied — hard edges)
- **Only the island cluster is liquid**; working set is soft card `WORK` so sky still frames the cluster

Labs (review artifacts, kept under `docs/assets/`):

- [`liquid-glass-refraction-lab.html`](../assets/liquid-glass-refraction-lab.html) — proves `blur()+url()` is kept; smooth ground shows no bend
- [`liquid-glass-rim-lab.html`](../assets/liquid-glass-rim-lab.html) — B vs rim-only; **B won**

## Host first-paint palette

`/app/:id` with `theme.css` + local palette used to flash kit near-white until panel `mma-set-env`.

- `localThemeCssVars(css, mode)` in `packages/host/src/apps/app-theme.ts`
- `appRunnerHtml(..., initialVars)` bakes vars into the bootstrap IIFE
- Gateway reads app `theme.css` when `palette=__local__` or bare open

## Not in this archive (still open)

- Look light/dark PNGs (`TODO.md` P1)
- Facades adopting `TablePage` / `SettingsSplit` / `WizardShell` / `FormSheet` (none required)
- P2 quality items and trigger-gated RFCs
