# Styling a mini-app

Two things are decided for you and cannot be changed: **Tailwind is compiled per app at
reload time** (the installed host must ship the runtime CLI), and **colours come from theme
tokens**. Everything below follows from that.

**Reload ↔ CSS contract:** every `mini_app_reload` drops the in-memory app CSS memo
(`caches.appCss: "dropped"`). The tool also defaults to `cleanCaches: true`, which deletes
`.autogen/ui.css` so a stale sheet cannot survive on disk either. You do not need a second
"clear CSS" step — if a class is missing after a green reload, the class was never in source
(dynamic string) or the panel never re-fetched (`caches.views`).

## Tailwind is real JIT over your own source — not a fixed safelist

The host runs Tailwind v4 against the app directory on every compile
(`@import "tailwindcss" source(none)` + `@source` globs over your `.ts`/`.tsx`), and serves
the result as the app's own stylesheet next to the shared kit base at `/ui.css`. **Installed
hosts need the runtime CLI** (`@tailwindcss/cli` + `tailwindcss`, shipped as dependencies of
`@monkey-mini-app/ui` and `@monkey-mini-app/host` from 0.1.11). Without it the app endpoint
returns **500** and `.autogen/` is never written — only kit classes from `/ui.css` apply.
Arbitrary values do **not** "always work" on an older / broken install. So the answer to
"is this class available?" is:

| You write | Works? | Why |
|---|---|---|
| `hover:bg-muted` `group-hover:opacity-100` `focus-visible:ring-2` | ✅ | variants are generated from your source |
| `md:grid-cols-3` `dark:border` | ✅ | responsive + the host's `dark` class |
| `bg-rose-500` `text-emerald-300` | ✅ | the default palette is emitted with the sheet |
| `w-[437px]` `grid-cols-[1fr_auto]` `top-[7px]` | ✅ if CLI compiled | arbitrary values need a successful per-app compile (`.autogen/ui.css`) |
| `bg-card text-muted-foreground` | ✅ | semantic tokens → [theme.md](theme.md) |
| `bg-card/60` `backdrop-blur-md` | ⚠️ | token opacity + blur often fail against the host skin — see below |
| `` className={`bg-${c}-500`} `` | ❌ **silently** | see below |

**The one real trap: class names must appear as complete literals in your source.**
Tailwind reads source text, it does not evaluate your template strings. A composed name
produces no CSS and no error — the element just renders unstyled, which is how "my class
did not work" usually turns out to be a build-time string problem.

```tsx
// ✗ no CSS is generated for the composed names
<span className={`bg-${tone}-100 text-${tone}-700`} />

// ✓ literal, one branch per case
const map = {
  ok: "bg-emerald-100 text-emerald-700",
  warn: "bg-amber-100 text-amber-700",
  bad: "bg-rose-100 text-rose-700",
} as const;
<span className={map[tone]} />
```

Because of this, **do not fall back to inline `style` "to be safe"** for layout or
variants. That is strictly worse: you lose hover/dark and you gain nothing — **when the
runtime CLI compiled the app sheet**, arbitrary values and variants already work. The
exceptions below (token opacity, backdrop-blur vs the skin) are the only places `style` +
`color-mix` is the workaround, not a precaution.

## Token opacity and backdrop-blur vs the host skin

`bg-card/60` (and any `token/opacity`) is compiled as `color-mix` against `--color-card`,
which is itself `var(--card)`. The host skin rewrites `--card` under `<html>`; that extra
indirection often makes the opacity utility a no-op (transparent or solid, never 60%).
`backdrop-blur-*` is an **app-compiled** utility — it is not in the kit sheet — and blur
over the iframe/skin is unreliable even when it compiled.

Write the mix yourself on the token the skin actually sets:

```tsx
// ✓ follows the palette, including opacity
<div style={{ backgroundColor: "color-mix(in oklch, var(--card) 60%, transparent)" }} />

// ✗ often compiles to nothing useful against a rewritten --card
<div className="bg-card/60 backdrop-blur-md" />
```

Same pattern for a wash / glass edge: `color-mix(in oklch, var(--primary) 28%, transparent)`
on `background` / `border`, not `bg-primary/28`. Looks that need glass already do this
(`references/looks/glass-island.md`).

## The UI build does not typecheck

`mini_app_reload`'s UI step (sucrase + esbuild) **strips types**. It does not run `tsc`.
A wrong key on a typed helper — `useStore({ items })` when the store is `{ rows }`, a
mistyped `call("lisst")`, an extra prop the component does not have — compiles green and
throws `TypeError` at render. `mini_app_errors` is the only signal; the static check only
catches unbound identifiers, not bad keys. Prove the object shape from the contract /
catalog, do not trust the compile.

## Colour: tokens, not literals

Never hardcode hex. The user picks a palette in the panel and the host rewrites the token
values under `<html>`; a literal colour sits outside that system and looks broken in dark
mode. Full table → **[theme.md](theme.md)** (generated from the real stylesheet).

```tsx
// ✗ follows no palette
<div style={{ background: "#0b1220", color: "#e2e8f0" }}>

// ✓ adapts to mode and palette
<div className="bg-card text-card-foreground">
```

Raw `var(--token)` is correct only where a utility cannot reach: SVG `fill`/`stroke`,
gradients, `color-mix()`, or a colour you hand to a chart component.

```tsx
<svg><path fill="var(--primary)" /></svg>
```

The accent colour for SVG is `--primary`; `Illu*` illustrations already map themselves.

## Layout

There is no `Stack` / `Text` / `Box` component — layout is Tailwind classes on plain
elements or on a component's `className` (every component takes `className` and `style`).

```tsx
<div className="flex flex-col gap-3 p-4 w-full">
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">…</div>
</div>
```

The iframe fills its panel and the app scrolls inside it, so size against the viewport
(`h-full`, `min-h-0`, `overflow-auto`) rather than a fixed pixel height.

## Custom host theme (only when the user asks)

Do **not** put hex in `ui.tsx`. If the user wants a named / branded palette, write a
**host-global** file — contract and skeleton are generated in [theme.md](theme.md)
(*Custom host theme file*). `mini_app_edit` cannot write it (outside the app dir).

Light and dark are a **pair**, not two independent palettes. Worked example:
`docs/assets/themes/theme-crimson.css` (same hue family, not an invert).

1. **One hue family, two densities.** Do not invert (`#f7f2f1` → a cold `#080d0e`).
2. **Contrast first.** `fg` on `bg`, `surface-fg` on `surface`, `primary-fg` on `primary`,
   `muted-fg` on both `muted` and `bg` must all read.
3. **Dark is not dimmer light.** Drop `bg` / `surface` to a near-black of the same hue;
   **lift** `primary` chroma (`crimson` light `#c0392b` → dark `#ff5c4d`). `primary-fg`
   flips with the new primary.
4. **Elevation.** `surface` a step above `bg`; `border` visible on both; `shadow` stronger in dark.
5. **Destructive stays a distinct red** even if the brand hue is already red.
6. **Monochrome / graphite.** `primary` is a mid grey, not blue. Do not ship only
   `#000` / `#fff` — `muted` / `border` / `surface` need room.
7. **No second accent hue** unless asked. `accent` is a wash of `primary`.
8. **Verify both modes** in the panel theme pop after writing. A file that only looks right in dark has failed.

## Animation

The platform ships [motion](https://motion.dev) in the iframe — one build at
`/mma/vendors/motion.js`, sharing the same React as the kit. It is not an npm install and
not a kit re-export; you write the package name you already know:

```tsx
import { motion, AnimatePresence } from "motion/react";
```

Pick by how much you actually need:

| You want | Use |
|---|---|
| A hover / press / colour change on one property | Tailwind `transition duration-200 ease-out` — no motion |
| A card or row **entering** (fade + rise, staggered) | `<Reveal delay={i * 60}>` from the kit |
| Exit animation, or a list where rows come and go | `AnimatePresence` + `motion.div` with `initial` / `animate` / `exit` |
| Something that moves to a new position (layout shift) | `motion.div layout` |
| A looping decorative effect (shimmer, pulse) | Tailwind `animate-pulse` / `animate-spin` first; `motion` `animate={{ … , transition: { repeat: Infinity } }}` if that is not enough |

```tsx
// rows that leave without popping out of existence
<AnimatePresence initial={false}>
  {items.map((it, i) => (
    <motion.div
      key={it.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ delay: i * 0.04 }}
    >
      <Card>{it.title}</Card>
    </motion.div>
  ))}
</AnimatePresence>
```

Rules that keep this from breaking:

- **Keyframe names are global inside one app document.** Each mini-app runs in its own
  iframe, so your keyframes cannot affect another app — but two of *your* components can
  fight over one name, and whichever mounts last wins for both. That is a real, silent bug:
  one dashboard declared `@keyframes soft-pulse` twice with different opacity values, and
  whichever panel opened later changed the other's animation.
- **Prefer a name the platform does not already use.** The host's own sheet defines
  `spin`, `ping`, `pulse`, `enter`, `exit`, `accordion-down`, `accordion-up`,
  `scroll-fade-reveal-*`, `tw-shimmer` and `mma-dot`. Declaring one of those overrides it
  for the whole app. The reload check reports a clash as a **notice** and the app still
  loads — overriding deliberately is allowed, being unaware of it is what gets you.
- **Don't mix** an injected `animation` with `animate-in` / `fill-mode-both` on the same
  element — they fight over `opacity`.
- `motion` is **UI only**. `main.api.ts` has no React, so `import … from "motion"` there
  fails with `BACKEND_IMPORT`.
- Respect the OS setting: `useReducedMotion()` from `motion/react` before animating
  position. (Kit `Reveal` already does this.)
- Colour still comes from tokens. Animate `opacity` / `transform`, and use theme vars
  (`var(--primary)`) rather than hex inside a keyframe. → [theme.md](theme.md)
- Do not `mini_app_install` `motion` or `framer-motion` — the host rejects them, because a
  second copy means a second React.

```tsx
/* ✓ your own name, so nothing else in this document is sharing it */
<style>{`@keyframes ledger-row-in { from { opacity: 0; transform: translateY(6px) } }`}</style>

/* ✗ silently redefines Tailwind's spin for every animate-spin in the app */
<style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
```

## What is actually on disk

`.autogen/` inside an app holds the generated Tailwind output. A successful compile always
writes `.autogen/ui.css`. It is overwritten on the next compile — never edit it, and never
import from it. If the directory is missing after a reload, the CLI never ran — check the
host log and `GET /api/app/<id>/ui.css` (must not be the same bytes as `/ui.css`).

## Checklist

- [ ] every class name is a complete literal in the source (no `` `bg-${x}-500` ``)
- [ ] `/api/app/<id>/ui.css` is 200 and `.autogen/ui.css` exists (runtime CLI installed)
- [ ] no `bg-card/60` / `backdrop-blur-*` against the skin — `color-mix` on `var(--card)`
- [ ] no hex / rgb literals for themeable colour — tokens only
- [ ] sized against the viewport, not a fixed height
- [ ] animations use `motion` / kit `Reveal`, or a Tailwind transition — and any custom
      `@keyframes` has a name the platform sheet does not already define → *Animation*
- [ ] ask the live view what won: `mini_app_view_eval({ appId, code: 'const cs = getComputedStyle(mma.$(".your-class")); return { color: cs.color, bg: cs.backgroundColor };' })` → [eval.md](eval.md)
