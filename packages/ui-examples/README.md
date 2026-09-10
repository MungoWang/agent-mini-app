# @monkey-mini-app/ui-examples

Runnable, **mini-app-portable** examples for `@monkey-mini-app/ui`. One source feeds
three consumers: the demo-host gallery, dsh e2e fixtures, and (Phase 2) the authoring skill.

## The one rule

Every example imports **only**:

- `react`
- the **bare** `@monkey-mini-app/ui` (never `@monkey-mini-app/ui/components/button`, never `lucide-react` / `react-day-picker` / other npm)
- in-package relatives (`../shared/...`)

…so it can be copied verbatim into a mini-app `lib/` (where those are the only resolvable
specifiers) or into the skill. Enforced by `no-restricted-imports` in the repo eslint config —
runs inside `pnpm lint`, no separate command.

Use `Icon` from the UI package for icons, and rely on types the UI package re-exports
(e.g. `DateRange`, `ColumnDef`).

## Layout

```
src/
  areas/<area>.tsx             group showcases (Forms / Data / Dates / …)
  components/<Name>/<name>-NN.tsx   per-component canonical examples
  looks/                        live Look fixtures (catalog.json is the skill source)
  shared/                       Example wrapper + sample data (import-safe)
  index.ts                      barrel for demo-host
```

Folder is **category**, not identity. The component↔example link is the JSDoc tag:

```tsx
/**
 * @exampleOf DataGrid          ← must match a real @monkey-mini-app/ui export
 * @title Virtualized rows
 */
```

Files without `@exampleOf` (layouts) carry `@group <slug>` instead and roll up
to `references/examples/<group>.md` in the skill.

## Consumers

| Who | How |
|---|---|
| demo-host | imports `@monkey-mini-app/ui-examples` barrel |
| dsh e2e (`com.example.kit`) | (Phase 2) copy selected files into the fixture `lib/` — no import rewrite needed |
| skill | (Phase 2) `gen/skill` copies to `references/examples/`, links from each `contracts/<slug>.md` |
