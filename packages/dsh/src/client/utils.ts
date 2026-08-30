export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function clampCardStyle(v: unknown): "stamp" | "etch" | "hero" | "list" {
  return v === "hero" || v === "etch" || v === "list" ? v : "stamp";
}

export function css(el: HTMLElement, obj: Record<string, string>): void {
  for (const [k, v] of Object.entries(obj)) {
    (el.style as unknown as Record<string, string>)[k] = v;
  }
}

/** 计算颜色亮度（rgba 转 0-1；透明/不可解析返回 null）。 */
export function luminanceOf(color: string): number | null {
  const m = String(color || "").match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!m) return null;
  const a = m[4] == null ? 1 : Number(m[4]);
  if (a < 0.5) return null;
  return (Number(m[1]) * 0.2126 + Number(m[2]) * 0.7152 + Number(m[3]) * 0.0722) / 255;
}

export function escapeHtml(s: unknown): string {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return c;
    }
  });
}

export function fmtTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
