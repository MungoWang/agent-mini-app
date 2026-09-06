/**
 * Which `@keyframes` names the platform already occupies inside a mini-app document.
 *
 * Every mini-app gets its **own iframe, and so its own document**
 * (`packages/panel/src/frame.ts` — `iframe.src = urlOf(appId)`). That single fact bounds
 * the whole problem: an app's keyframes cannot reach another app, ever. Two things can
 * still collide, both inside one app's document:
 *
 * 1. the app reusing a name the platform sheet already defines;
 * 2. two components of the same app declaring the same name — the last one mounted wins,
 *    which is a real bug we have seen (`@keyframes aibrief-soft` declared twice in one
 *    dashboard with different opacity values, so whichever panel opened later silently
 *    changed the other's pulse).
 *
 * Neither is a reason to forbid app-authored keyframes. A uniquely named one simply works.
 * So this list exists to make (1) **visible** to the author, not to gate it — the static
 * check reports these as `notice` and reload proceeds.
 *
 * The names are derived from the two things that actually inject CSS into the app document
 * (`/ui.css` = the kit's `globals.css`, and the runner's inline boot CSS). There is no
 * hand-maintained list to drift: add a keyframe to either source and it is reserved here
 * on the next reload.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { RUNNER_INLINE_CSS } from "./runner-inline-css.ts";
import { resolveUiDistDir } from "./ui-compiler.ts";

const KEYFRAMES = /@keyframes\s+(?:"([^"]+)"|'([^']+)'|([\w-]+))/g;

function namesIn(css: string): string[] {
  const out: string[] = [];
  for (const m of css.matchAll(KEYFRAMES)) {
    const name = m[1] ?? m[2] ?? m[3];
    if (name) out.push(name);
  }
  return out;
}

let cached: ReadonlySet<string> | null = null;

/**
 * Reserved keyframe names, computed once per host process.
 *
 * Best-effort by construction: if the kit stylesheet cannot be read, the runner names are
 * still returned rather than throwing — a missing optional lint input must never break an
 * app reload.
 */
export function platformKeyframeNames(): ReadonlySet<string> {
  if (cached) return cached;
  const names = new Set<string>(namesIn(RUNNER_INLINE_CSS));
  try {
    const globals = readFileSync(path.join(resolveUiDistDir(), "globals.css"), "utf8");
    for (const n of namesIn(globals)) names.add(n);
  } catch {
    // No kit CSS to read: report only what we know from the runner. Notices get weaker,
    // nothing gets blocked and nothing throws.
  }
  cached = names;
  return names;
}

/** Test seam: the derivation is pure per-source, so the regex itself can be pinned. */
export function keyframeNamesIn(css: string): string[] {
  return namesIn(css);
}

/** For tests only — drop the memo so a rebuilt stylesheet is picked up. */
export function __resetPlatformKeyframeNames(): void {
  cached = null;
}
