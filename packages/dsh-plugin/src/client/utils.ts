// @ts-nocheck — client shell is loosely typed against dsh DOM; track proper typing separately
/** dsh-plugin client 纯工具（无状态，可复用）。 */

/** 面板可见性哈希（app 卡片色相）。 */
export function hue(id: string): number {
  let h = 0;
  const s = String(id || "");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}

/** 卡片方案合法化（非法回退默认）。 */
export function clampCardStyle(v: unknown): string {
  return v === "hero" || v === "etch" ? String(v) : "stamp";
}

/** app monogram（manifest acronym 优先）。 */
export function monoOf(a: { acronym?: string } | null): string {
  return (a && a.acronym) || "AP";
}

/** 内联 style 批量设置。 */
export function css(el: HTMLElement, obj: Record<string, string>): void {
  Object.keys(obj).forEach((k) => {
    (el.style as unknown as Record<string, string>)[k] = obj[k];
  });
}

/** 计算颜色亮度（rgba 转 0-1；透明/不可解析返回 null）。 */
export function luminanceOf(color: string): number | null {
  const m = String(color || "").match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!m) return null;
  const a = m[4] == null ? 1 : Number(m[4]);
  if (a < 0.5) return null;
  return (Number(m[1]) * 0.2126 + Number(m[2]) * 0.7152 + Number(m[3]) * 0.0722) / 255;
}

/** HTML 转义（iframe title 等）。 */
export function escapeHtml(s: unknown): string {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c;
  });
}

/** ISO 时间 → "YYYY-MM-DD HH:mm"。 */
export function fmtTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => (n < 10 ? "0" + n : String(n));
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
}
