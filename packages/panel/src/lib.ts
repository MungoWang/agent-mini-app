/** Pure panel helpers. */
import type { AppItem } from "./types.ts";

export function hue(id: string): number {
  let h = 0;
  const s = String(id || "");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

export function appBlurb(a: AppItem): string {
  return String(a.description || a.id || "");
}

export function monoOf(a: AppItem): string {
  return String(a.acronym || (a.name || "?").slice(0, 2) || "?");
}
