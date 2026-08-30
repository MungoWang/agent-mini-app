# @monkey-mini-app/ui

`react` component library for mini-apps. **It's a reference / convenience, not a spec** —
use it to save reimplementing common components (tables, forms, charts, dialogs, editors),
but you're free to build custom UI with raw HTML elements + Tailwind classes instead
(and the two mix freely). It's the **only** UI **package** a mini-app may import.

## Install

```bash
pnpm add @monkey-mini-app/ui
```

## The base stylesheet

The Tailwind theme, tokens and component styles live in a single `globals.css` subpath
export. It is the app/base stylesheet served by the host:

```css
@import "@monkey-mini-app/ui/globals.css";
```

It carries the `@theme` tokens (`--primary`, `--background`, …), the `dark` custom
variant, Geist/TW-Animate/shadcn layers and the repo-scanned utilities. Theme tokens
survive so light/dark + palettes keep working.

## What it exports

- **Components** — shadcn-style primitives (`Button`, `Card`, `Dialog`, `DataGrid`, …) in
  `components/`, `composites/` and `products/`.
- **Blocks** — higher-level page blocks (`StatCard`, `RadarChart`, `PageHeader`,
  `ActivityFeed`, `Terminal`, …) in `blocks/`.
- **`Icon`** — namespace re-export of `lucide-react`, so you write
  `import { Icon } from "@monkey-mini-app/ui"` then `<Icon.HelpCircle />`. Do **not**
  import `lucide-react` directly.
- **`Illu*`** — empty-state / illustration SVG scenes (`IlluEmpty`, `IlluAccessDenied`,
  …). Accent and grayscale are tokenized (`--primary`, `--muted`) — no hard-coded hex.
- **`cn`** — the `clsx` + `tailwind-merge` classname helper (`lib/utils`).

## Build & contract

```bash
node scripts/build-ui.mjs   # → dist (flat named re-exports + compiled globals.css)
pnpm skill:gen              # sync the component contract into the ui skill
```

Constraints:

- The dist `index.js` must stay a **flat named re-export** (the ui-compiler only
  understands these). Rebuild after changing export names.
- Mini-apps may only import `react`, `@monkey-mini-app/ui`, `@monkey-agent/host` and
  relative `./lib`. No other npm packages (there is no `node_modules` in a runtime app).
