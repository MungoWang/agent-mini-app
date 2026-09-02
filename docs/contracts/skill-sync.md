# Skill ↔ code sync contract

> Scope: `skills/monkey-mini-app/` (the mini-app authoring skill) versus `packages/ui`, `packages/host`, `packages/dsh`.
> In one line: **anything in the skill that code can verify must not be hand-written.** Component contracts are generated, and drift is caught by `pnpm check:skill`.

## Who generates what

| Artifact | Source | Hand-edit? |
|---|---|---|
| `skills/monkey-mini-app/references/catalog.md` | `scripts/gen/skill/index.mjs` | ❌ |
| `skills/monkey-mini-app/references/contracts/*.md` | same (TypeScript AST + JSDoc) | ❌ |
| `packages/ui/ai/catalog.json` (machine-readable registry) | same | ❌ |
| `skills/monkey-mini-app/SKILL.md` + the other `references/*.md` | humans | ✅ |
| `packages/<adapter>/skills/**` (copy shipped in the npm tarball) | `scripts/gen/skill/copy.mjs` (prepack/postpack) | ❌ |

CI runs `pnpm gen:skill` then `git diff --exit-code skills packages/ui/ai`, so "changed a component without regenerating" goes red.

## Component metadata model

```
Accordion {
  componentType: "component",   // ← from the folder: components|blocks|composites|products → component|block|composite|product
  family: "Surface",            // ← `@family` in the component's own JSDoc (functional grouping, human-authored)
  primitive: true,              // ← componentType === "component" (the shadcn-style base layer; derived)
  when / example / props / parts
}
```

- **Folders are the engineering layer** and only feed `componentType`. **`family` is the functional taxonomy** and is how the catalog is grouped — an author searches by "what am I building", not by "which directory is it in".
- Family vocabulary: `packages/ui/catalog-families.json` (the single authority, carrying catalog order plus a one-line blurb). A component's `@family` must hit that vocabulary; **a missing or unknown family fails the generator (exit 1) and `check:skill`**. Adding a component requires no script change (directory scan + `index.ts` parsing).
- Compound components (`<Dialog>` + `DialogTrigger` + …) get **one contract per module** listing every part; part names must never be invented, and the contract says so.
- For an L1 module the family/description is declared on the **primary part** (the export matching the file name, otherwise the annotated part); the other parts inherit it.

## Props list only what a component declares itself

`propOrigin(decl)` classifies by **declaration site** — there is no hand-maintained name blacklist:

| Declaration site | Treatment |
|---|---|
| `packages/ui/src/**` (ours) | listed |
| Third-party component library (e.g. `@base-ui/react`'s `*.Props`) | listed — that *is* the real API |
| `typescript/lib/lib.*.d.ts` + `@types/react` | inherited HTML/ARIA: never listed row by row |
| A vendor type re-declaring "something every element already takes" | also not listed: the name set is derived by `indexReactAttributeBags()` walking React's own `HTMLAttributes` → `extends` chain |

The important nuance: that chain does **not** include element-specific bags like `InputHTMLAttributes`, so a vendor item's required `value` (and `disabled`, `placeholder`, …) stays documented; and our own redefinition of `title` (`EnvTable` heading) survives because it is declared by us. The inherited base is named once from the type node itself, e.g. `Extends \`Omit<React.ComponentProps<"div">, "children" | "title">\``.

Effect: `env-table.md` went from 332 prop rows (5 real, with `String.prototype` members marked **required**) to 3.

## Gate: `pnpm check:skill`

| Rule | What it prevents |
|---|---|
| `author-specifier` | The skill teaching a removed author specifier / API name (pre-unification `@monkeyagent/*`, the library package alias, `defineDashboard`, `useDashboardApi`) — the contract is `react` + `@monkey-mini-app/sdk` + in-app relative paths, with `defineApp` on the backend |
| `tool-name` / `tool-coverage` | Documenting a `mini_app_*` tool that does not exist; or a real tool never being mentioned |
| `ctx-member` | Documenting `ctx.x` that is not a key of `AppContext` (this is how `ctx.llm.stream` and `onMount` used to survive) |
| `ctx-mirror` | The SDK's author-facing `AppCtx` drifting from the host's `AppContext` — the backend takes its **types** from `@monkey-mini-app/sdk` but its runtime `defineApp` from the host injection, so the two key sets must be identical |
| `contract-size` / `contract-noise` / `contract-import` / `contract-when` | Inherited-prop dumps, legacy specifiers, missing `@when` |
| `taxonomy` / `taxonomy-empty` | Missing/unknown family, catalog grouping disagreeing with the registry |
| `md-table` | Merged table rows (one such row silently deleted two navigation entries) |
| `dead-link` / `catalog-orphan` / `catalog-dead` | Broken relative links, contracts unreachable from the catalog, index pointing at nothing |
| `jsdoc-stacked` | Two JSDoc blocks on one declaration — TypeScript keeps only the last, so annotations silently stop working |
| `doc-language` | Chinese prose in `docs/**`, `AGENTS.md`, `README.md` (sample copy inside code fences is allowed) |

`packages/smoke-test/catalog-consistency.test.ts` invokes the gate, so `pnpm test` covers it too.

`pnpm check:templates` is the other half: it type-checks every skill template against the
**real** SDK types (`packages/sdk/src`), so an example that would generate a broken app
cannot stay committed. Only diagnostics inside `templates/**` fail it; `packages/ui`
internals are reported as a note.

## Obligations when you touch a component

1. Every component needs `@family` (missing = generation fails); add `@when` (it becomes the catalog's "when" column) and, for compound components, an `@example` skeleton.
2. Public props changed → run `pnpm skill` (= gen + check).
3. Doc language is English. Only strings the **end user** would read — sample copy in `@example` blocks and in the templates — may be Chinese, because the shipped host defaults to that locale (the real bilingual surface is `packages/ui/src/i18n/{en,zh}.ts`).
4. Never write a host's install path into skill docs (dsh and pi land in different places) — use relative paths.

## Drift fixed in the 2026-09-02 skill review

| Symptom then | Now |
|---|---|
| `env-table.md` 332 prop rows, `String.prototype` members marked required | 3 rows + one inherited-base line; 72% of all prop rows were noise → 0 |
| 75/75 contracts plus `loader.md`, `icons.md`, `templates/README.md` taught the legacy specifier | everything teaches `@monkey-mini-app/sdk`; `author-specifier` blocks regressions |
| `ctx.md` documented `onMount` / `onUnmount`, which do not exist; `troubleshoot.md` told you to call `ctx.llm.stream` | rewritten against the real `AppContext`; `ctx-member` gate |
| L1 primitives (55 files) had zero documentation — props and part names were guesswork | 58 L1 contracts (parts + own props + skeleton), catalog grouped by family |
| `when` coverage 18/75 | 133/133 components have `@when` (`contract-when` = 0 warnings) |
| Catalog grouped by source folder | grouped by functional family, `type` as its own column; `ai/catalog.json` is a registry |
| One `||` merged row in the SKILL.md routing table | fixed + `md-table` gate |
| `SKILL.md` hardcoded `~/.dsh/skills/...` | "next to this SKILL.md" |
| `mini_app_validate` (deleted) still documented; `mini_app_get` never mentioned | tool decision table includes `mini_app_get`, dead name removed; `tool-coverage` gate |
| `Illu*` had one example, and the names are not guessable | all 10 listed; the smoke test cross-checks them against `illustrations.tsx` |
| Deleting an entire app had no legal path | SKILL.md states it is a user action in the panel (a `mini_app_unregister` tool remains an open platform decision) |
| `RichTextEditor` described as CDN-backed (tiptap) | corrected to the local contentEditable editor |
