# Loader

The host compiles on the fly, server side: the **backend** (`main.api.ts` + its relative imports) goes through sucrase; the **UI** (`ui.tsx` + its relative imports) is bundled to a single ESM file with esbuild (tree-shaken, so only the components you use are included).

## Layout

```
manifest.json
ui.tsx              UI entry
main.api.ts         backend entry
ui/                 components / hooks / view helpers — UI only
api/                backend helpers — backend only
shared/             pure isomorphic code — both sides
```

The three folders are the convention that keeps the two runtimes from reaching into each
other's code; a trivial app with no helpers needs none of them. **`ui/` and `api/` are
enforced at compile time**, not style advice:

- UI importing `./api/**` → compile error
- backend importing `./ui/**` → load error
- either side importing outside the app dir (`../…`) → error

Anything that both sides need belongs in `shared/` — which means pure code: no React, no
DOM, no `ctx`, no Node builtins.

## Backend (`main.api.ts`, `api/**`, `shared/**`)

- `import { defineApp } from "@monkey-mini-app/api"`; the host injects the runtime `defineApp` when it loads the file, so nothing React-ish is pulled into the backend
- `import { groupBy, debounce } from "lodash"` (or `lodash-es`) — full lodash, host-injected; same module as the UI vendor bundle
- A Node library this app genuinely needs: `mini_app_install({ appId, packages: [{ name: "exceljs" }] })` first, then `import ExcelJS from "exceljs"`. It lands in **this app's** `node_modules` (`--ignore-scripts`, lockfile committed, `node_modules` not). `package.json` in the app dir is owned by that tool — do not hand-write it. Anything outside the app's own `node_modules` (the plugin's, the repo's) is refused.
- `import { parseFeed } from "./api/feed"`, `import { SAMPLE } from "./shared/sample"` — any relative path inside the app dir; subfolder names beyond the convention above are up to you
- TypeScript freely (sucrase: parameter types, `{ title: string }`, `catch (e: any)` all fine)
- `export default defineApp(...)`
- In helper modules: `export function` / `export const` / `export async function`

## Frontend (`ui.tsx`, `ui/**`, `shared/**`)

- `import { useApp, Button, DataGrid, cn, ... } from "@monkey-mini-app/ui"` — components, `useApp`, `cn`, `Icon`, `Illu*` all come from here (icon/chart/editor dependencies are already inside; never add an npm import)
- `import { useState } from "react"` — React 19, injected by the host (`/mma/runtime.js`)
- `import { groupBy, debounce } from "lodash"` — platform vendor (`/mma/vendors/lodash.js`); not a kit re-export
- `import { fmt } from "./shared/format"` — app-relative, bundled with the UI
- Layout via Tailwind classes (`flex flex-col gap-3`, …)

UI: `@monkey-mini-app/ui` + `react` + `lodash`. Backend: `@monkey-mini-app/api` + `lodash` + packages installed by `mini_app_install`. Nothing else resolves — pre-unification names fail to compile. Rewrite them; do not work around them.

## Forbidden (compile error — do not work around it)

- npm packages: `recharts`, `lucide-react`, `rss-parser`, `openai`, `node-fetch`, `axios`, `ramda`, `dayjs`, … in `ui.tsx` (`lodash` is the exception — platform vendor, full API; backend-only libs go through `mini_app_install`)
- Node builtins: `fs`, `http`, `path`, …
- `../` escaping the app directory (both sides)
- UI ↔ `api/**`, backend ↔ `ui/**` (see Layout)
- UI importing `main.api.ts` (fetch data with `call`)

Fetch web content with `ctx.http("https://…", { timeout: 8000 })` and inspect `r.ok` / `r.text` / `r.json`; keep parsing in `api/`. Local machine commands use `ctx.bash`.

Editing `ui.tsx` / `main.api.ts` or any helper module under the app dir triggers a recompile by mtime. A full RSS + `shared/` example lives in `templates/radar/`.
