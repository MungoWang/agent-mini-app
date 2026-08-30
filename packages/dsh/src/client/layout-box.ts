export type DockId = "fill" | "side";

export function sideWidthPx(innerWidth: number): number {
  return Math.round(Math.min(440, innerWidth * 0.42));
}

export function layoutBox(
  dock: DockId,
  viewportWidth: number,
  railLeft: number,
): { left: number; width: number } {
  if (dock === "side") {
    const w = sideWidthPx(viewportWidth);
    return { left: viewportWidth - w, width: w };
  }
  return { left: railLeft, width: Math.max(0, viewportWidth - railLeft) };
}

export const DOCK_EASE = "cubic-bezier(.22,.8,.24,1)";
export const DOCK_ANIM_MS = 320;
