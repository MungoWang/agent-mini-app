# Layout presets — six page shapes, all landed

> Archived: 2026-09-10
> Original location: `TODO.md` → P1-1 (workstream 2 of `docs/rfcs/authoring-surface.md` §4)
> Status: **done** — six presets, each with a component, a contract test, one gallery example,
> and `pnpm gen:skill` run. The RFC's own acceptance rule was "it must kill a bug agents
> demonstrably get wrong, not just save typing"; the four bullets under each entry below are the
> bug, not a feature list.

## What landed

| Preset           | Scenario | The bug it kills                                                                                                                                                                                               |
| ---------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ListDetail`     | S1, S6   | A flex child with no `min-h-0` grows to fit its content: the whole page scrolls, the toolbar slides away, the two panes were never independent. Below `md`, the detail pane squashed instead of collapsing.    |
| `TablePage`      | S2       | A `DataGrid` in a plain column: page scrolls, pagination falls below the fold, and the bulk bar reflows the rows on every selection.                                                                           |
| `DashboardShell` | S3       | `overflow-auto` on the outermost div, so the first scroll takes the header **and the KPI row** off screen — a dashboard whose numbers scroll away is not a dashboard.                                          |
| `SettingsSplit`  | S4, S8   | `href="#hook"` beside `id="hooks"` (the highlight just never moves); nav scrolling out with the content it navigates; save bar below the fold.                                                                 |
| `WizardShell`    | S5       | A footer inside the scrolling column jumps to a new height every step, so the user chases Next; and Next is enabled into an invalid step because validity lives in the form while the button lives outside it. |
| `FormSheet`      | S6       | Header/footer scroll off with the fields; Enter in a field submits nothing (no `<form>` around the inputs); Escape drops unsaved edits.                                                                        |

Files: `packages/ui/src/blocks/{list-detail,table-page,dashboard-shell,settings-split,wizard-shell,form-sheet}.tsx`

- same-name `.test.tsx`. Examples: `packages/ui-examples/src/components/<preset>/<preset>-01.tsx`,
  registered in `src/areas/*.tsx` (the dsh-host gallery is built from that registry, not by
  scanning the folder — a new example missing there is silently absent).

## Rules each one follows (§4.3, unchanged)

Built from existing kit pieces, no second layout engine. Takes `className`, renders semantic
HTML, no `Stack`/`Text`/`Box`. Never fetches, stores, or routes: slots are `ReactNode`, the app
owns state. Responsive collapse is the preset's job. Chrome strings through `useLabels` with
`en.ts` + `zh.ts` in the same change.

`SettingsSplit` and `WizardShell` take a structured `steps` / `sections` array rather than bare
nodes — the one deliberate exception, because both presets exist to _wire_ ids and disabled state,
and a preset cannot wire what it cannot see. Content inside each section/step is still the app's node.

## Tests are contracts, not snapshots

Each test asserts the property the preset exists for ("exactly one of body/main scrolls", "the
footer is inside the form but outside the scroller"), and every assertion was canary-verified by
re-introducing its bug:

- `TablePage`: band loses `overflow-y-auto` → red; bulk bar back in flow → red; bar loses
  `pointer-events-auto` → red.
- `DashboardShell`: header made scrollable → red; rail's own scroller removed → red; nested
  scroller added to `main` while narrow → red.
- `SettingsSplit`: `id` dropped from the section → red; `footer` moved inside the scroller → red;
  narrow nav's `overflow-x-auto` swapped to `overflow-y-auto` → red.
- `WizardShell`: band loses `overflow-y-auto` → red; `canAdvance` hardcoded `true` → red; Finish
  routed to `onNext` → red.
- `FormSheet`: dirty guard bypassed → red; footer moved after `</form>` → red; `preventDefault`
  dropped → red.

Two process lessons from the canaries, both worth keeping:

1. A canary whose text anchor silently fails to match **passes while proving nothing**. The
   `FormSheet` "footer outside form" canary did exactly that on the first run (prettier had
   reflowed the JSX). Canary scripts now assert the file bytes changed before they run the suite,
   and mutate by structure rather than by breaking syntax — an earlier attempt produced
   "no tests", which is not a caught bug.
2. Two `render()` calls in one jsdom test leave both trees mounted unless the first is
   `unmount()`ed or each result is queried separately. That looked like a component bug
   ("Found multiple elements") and was not one.

## Bugs fixed on the way

- `components/resizable.tsx` `@example` taught `direction="horizontal"` while the installed
  react-resizable-panels v4 prop is `orientation` — the generated contract had been telling
  agents to write a property that does not exist.
- `hooks/use-mobile.ts` threw where there is no `matchMedia` (SSR, bare jsdom); it now reports
  "unknown means wide".
- `packages/ui/vitest.setup.ts` stubbed `ResizeObserver` but not `IntersectionObserver`, so any
  kit test rendering `Scrollspy` died before asserting anything. The example harness had been
  stubbing it locally; the kit harness now does too, typed to the interface instead of cast.

## Facade swap: done for one, declined for the other

The plan said "presets first, then re-skin the facades: `sheets` → `TablePage`, `watch` →
`DashboardShell`".

- `watch` → `DashboardShell`: **done.** It is the S3 shape exactly — hostname row + KPI band
  pinned, sparklines and process table as the single scroller. Verified in a real browser in both
  modes.
- `sheets` → `TablePage`: **declined, with a reason.** `sheets` is S1 (report list on the left,
  workbook on the right), so its grid already lives inside `ListDetail`'s detail pane, which owns
  that pane's scroller. Wrapping it in `TablePage` puts a second scroller inside the first —
  nested scrollers steal the wheel, which is the failure class this whole workstream exists to
  remove. `TablePage` has no facade user yet and that is fine: §4.0 withdrew the "must first be
  used by a real template" gate, and the gallery example plus the contract is the validation.

Consequence worth remembering: `TablePage`, `SettingsSplit`, `WizardShell` and `FormSheet` are
currently used by **no** facade. They are available to agents through the skill catalog and
contracts; if one of them is ever wrong in a way only real use shows, that is when to retrofit it.
