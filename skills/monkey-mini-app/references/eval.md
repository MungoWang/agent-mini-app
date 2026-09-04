# Asking the rendered view (`mini_app_view_eval`)

`mini_app_errors` tells you an app crashed. This tells you **what it drew** — which is the
question left over once the build is green and the panel shows something, just not the thing
you meant.

You send JavaScript; it runs inside the app's rendered iframe; you get text back. Nothing is
pre-decided about what to look at, so there is no "the tool doesn't support that" case.

## When to ask, and when not to

| Situation | Do this instead |
|---|---|
| It compiled and the panel is blank / errored | `mini_app_errors` — cheaper, and a crash is already reported to you |
| "Did this Tailwind class / theme token actually apply?" | ask the view (below) |
| "Is this node zero-size / hidden / not in the tree?" | ask the view |
| "Is this centred? Does it look good?" | **do not ask the view** — there are no pixels here. Describe the change and let the user judge |
| Backend returned the wrong thing | `mini_app_call` — no browser involved |

It needs a **live iframe**: `mini_app_open({ appId })` first. If nothing is rendering the app
you get `view: "not-open"`, not an empty answer.

## The three names you get

```js
mma.$(sel, root?)     // Element | null
mma.$$(sel, root?)    // Array<Element>  — a real array, so .map() / .filter() / [0] work
mma.selector(el)      // a CSS string you can hand straight back to mma.$()
```

Everything else is standard DOM (`textContent`, `dataset`, `getBoundingClientRect`,
`classList`, `closest`, `children`). Host-side data is one same-origin `fetch` away:

```js
const r = await fetch("/api/app/com.example.todo/errors");
return (await r.json()).errors.map((e) => e.message);
```

`code` is an **async function body**, so it must `return`. Omit it for the default, which is
`return mma.$("#root")` — a shallow tree, and the cheapest way to see what you drew.

## Recipes

```js
// 1. Did the class land? (compare the two colours, do not eyeball the name)
const el = mma.$("button.btn");
const cs = getComputedStyle(el);
return { class: el.className, bg: cs.backgroundColor, color: cs.color };

// 2. Which nodes rendered to nothing? (a class that never compiled, or a false condition)
return mma.$$("#root *").filter((n) => n.getBoundingClientRect().width === 0 && n.children.length === 0)
  .map((n) => mma.selector(n) + " " + n.className);

// 3. Something is off-screen — find it by geometry, not by guessing the layout
return mma.$$("#root *").filter((n) => { const b = n.getBoundingClientRect();
  return b.right > innerWidth + 1 || b.bottom > innerHeight + 1; }).map(mma.selector);

// 4. Walk deeper than the default 2 levels: return the node itself
return mma.$(".toolbar");

// 5. Is a hidden branch the reason?
return mma.$$(".notes").map((n) => ({ sel: mma.selector(n), display: getComputedStyle(n).display }));
```

Pattern: **`$$` to find, `selector` to name, `$` to go back in.** A list of elements comes
back as one line each without children — that is a locator, and it is deliberately cheap;
return one of those nodes to see its subtree.

## Reading the answer

```
# 6 lines shown of 6 in subtree · 1 query hit · depth 2 · coords: viewport px (scrolls with page) · viewport 1024x768 · 0.3KB · 4ms
div#root.panel.flex  x=16 y=64 w=380 h=812  (2 children)
  h2.title  x=16 y=64 w=200 h=24  "Panel"
  aside.notes  x=16 y=564 w=380 h=212  (1 child)  display:none
    +2 deeper levels not shown — return that node to go on
```

* Containers report `(N children)`, never their whole text — a panel's text is the page.
* `x= y= w= h=` are **viewport pixels** (they move with scroll), stated in the header.
* `display:none` / `visibility:hidden` / `opacity:0` / `detached` are flags, not bugs. An
  element with no box has no geometry to complain about.
* The header states how much you got. If it says `STOPPED by bytes`, the rest is missing.

## When it fails, `view` says whose fault it is

| `view` | Meaning | Next step |
|---|---|---|
| `live` + `ok: false` | your JavaScript failed — `error.kind` is `syntax` or `runtime`, with `line`/`source`/`caret` into **your** code | fix the query |
| `not-open` | nothing is rendering this app | `mini_app_open`, then retry |
| `runner-not-booted` | the iframe exists but its script never ran | the bundle or the page is broken → `mini_app_errors`, then `mini_app_open` |
| `stuck` | the script ran and then stopped answering | the main thread is blocked (an app loop, or one of yours) — **no tool fixes this**: ask the user to reload the tab |

The distinction between the last three matters: only `not-open` is fixed by opening, and only
`stuck` means something is running that never ends — which needs a human, not another tool call.

## Limits, stated plainly

* **A synchronous infinite loop freezes more than the query.** The executor never gets the
  thread back, so nothing can interrupt it — and the wedged iframe blocks the whole panel
  page with it, which means no tool call can recover it. If you send a loop that does not
  terminate, tell the user to reload the tab. Prefer `mma.$$` + `.filter` / `.map` over
  hand-rolled walks; they are shorter and they terminate.
* The reply is capped at `min(maxBytes, 6144)` — about 1.5 k tokens. If you need more, ask a
  narrower question rather than raising the cap; four small queries beat one big dump.
* Not a screenshot. No pixels, no "is this pretty", no cross-origin frames (an `<iframe>` in
  your app is a different document — its subtree is reported as one node).
* It reads the **live** DOM, so an app that loads data on mount answers differently before and
  after its fetch settles. If a query comes back emptier than expected, ask again.
