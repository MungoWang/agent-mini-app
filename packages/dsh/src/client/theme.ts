import { luminanceOf } from "./utils.ts";

export function isDarkFromProbes(colors: string[]): boolean {
  for (const c of colors) {
    const l = luminanceOf(c);
    if (l != null) return l < 0.45;
  }
  return false;
}

export function dshIsDark(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const probes: string[] = [];
    const side = document.querySelector("aside, nav, [class*='sidebar'], [class*='Sidebar']");
    if (side) probes.push(getComputedStyle(side).backgroundColor);
    const ns = document.querySelector("button");
    if (ns) probes.push(getComputedStyle(ns).backgroundColor);
    probes.push(getComputedStyle(document.body).backgroundColor);
    probes.push(getComputedStyle(document.documentElement).backgroundColor);
    const fromEls = isDarkFromProbes(probes);
    if (probes.some((c) => luminanceOf(c) != null)) return fromEls;
    const cs = getComputedStyle(document.documentElement);
    const token = cs.getPropertyValue("--dsw-alias-bg-layer-1") || cs.getPropertyValue("--dsw-alias-bg");
    const tl = luminanceOf(token);
    if (tl != null) return tl < 0.45;
  } catch {
    /* ignore */
  }
  return false;
}

export function readStoredMode(storage: Pick<Storage, "getItem"> | null): "light" | "dark" | null {
  if (!storage) return null;
  try {
    const m = storage.getItem("mma-theme-mode");
    return m === "light" || m === "dark" ? m : null;
  } catch {
    return null;
  }
}

export function readStoredPalette(storage: Pick<Storage, "getItem"> | null): string | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem("mma-palette");
    return typeof raw === "string" && raw ? raw : null;
  } catch {
    return null;
  }
}
