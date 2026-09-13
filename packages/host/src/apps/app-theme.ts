/** Per-app theme.json (null = follow host global). */
import fs from "node:fs";
import path from "node:path";

export type AppTheme = { theme: string; palette: string };

/** Per-app override may follow the OS, same as the host preference. */
function clampMode(theme: unknown): "light" | "dark" | "system" {
  if (theme === "dark" || theme === "system") return theme;
  return "light";
}

export function appThemeFile(dir: string): string {
  return path.join(dir, "theme.json");
}

export function readAppTheme(dir: string): AppTheme | null {
  try {
    const j = JSON.parse(fs.readFileSync(appThemeFile(dir), "utf8")) as {
      theme?: unknown;
      palette?: unknown;
    };
    if (!j.theme) return null;
    return {
      theme: clampMode(j.theme),
      palette: typeof j.palette === "string" ? j.palette : "default",
    };
  } catch {
    return null;
  }
}

export function writeAppTheme(
  dir: string,
  val: AppTheme | null,
): AppTheme | null {
  if (!val) {
    try {
      fs.unlinkSync(appThemeFile(dir));
    } catch {
      /* missing ok */
    }
    return null;
  }
  const next: AppTheme = {
    theme: clampMode(val.theme),
    palette: typeof val.palette === "string" ? val.palette : "default",
  };
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(appThemeFile(dir), JSON.stringify(next, null, 2));
  return next;
}

/** Short keys written by an app's `theme.css` (same list as the panel's parseThemeCss). */
const THEME_CSS_KEYS = [
  "bg",
  "fg",
  "surface",
  "surface-fg",
  "border",
  "muted",
  "muted-fg",
  "primary",
  "primary-fg",
  "secondary",
  "secondary-fg",
  "accent",
  "accent-fg",
  "destructive",
  "destructive-fg",
  "ring",
  "input",
  "radius",
  "shadow",
] as const;

/**
 * Map a `theme.css` short-key bag onto the CSS custom properties the kit actually reads
 * (`--background`, `--card`, …). The runner HTML used to wait for the panel's `mma-set-env`
 * postMessage to do this — first paint was always the kit default (near-white), and a direct
 * `/app/:id` open never got the look's palette at all.
 */
export function localThemeCssVars(
  css: string,
  mode: "light" | "dark",
): Record<string, string> | null {
  const block = new RegExp(
    `:root\\[data-mode="${mode}"\\]\\s*\\{([^}]*)\\}`,
  ).exec(String(css || ""));
  if (!block) return null;
  const short: Record<string, string> = {};
  for (const key of THEME_CSS_KEYS) {
    const m = new RegExp(`--${key}\\s*:\\s*([^;\\n]+)`).exec(block[1]);
    if (m) short[key] = m[1].trim();
  }
  // A look palette without the three primaries is not a palette.
  if (!short.bg || !short.fg || !short.primary) return null;
  const surface = short.surface || short.bg;
  const surfaceFg = short["surface-fg"] || short.fg;
  const muted = short.muted || short.bg;
  return {
    "--background": short.bg,
    "--foreground": short.fg,
    "--card": surface,
    "--card-foreground": surfaceFg,
    "--primary": short.primary,
    "--primary-foreground": short["primary-fg"] || "#ffffff",
    "--secondary": short.secondary || muted,
    "--secondary-foreground": short["secondary-fg"] || short.fg,
    "--muted": muted,
    "--muted-foreground": short["muted-fg"] || short.fg,
    "--accent": short.accent || muted,
    "--accent-foreground": short["accent-fg"] || short.fg,
    "--border": short.border || muted,
    "--input": short.input || short.border || muted,
    "--ring": short.ring || short.primary,
    "--destructive": short.destructive || "#dc2626",
    "--destructive-foreground": short["destructive-fg"] || "#ffffff",
    "--radius": short.radius || "12px",
    "--shadow": short.shadow || "rgba(15, 23, 42, 0.1)",
  };
}
