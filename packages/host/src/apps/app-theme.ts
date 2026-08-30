/** Per-app theme.json (null = follow host global). */
import fs from "node:fs";
import path from "node:path";

export type AppTheme = { theme: string; palette: string };

function clampMode(theme: unknown): "light" | "dark" {
  return theme === "dark" ? "dark" : "light";
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

export function writeAppTheme(dir: string, val: AppTheme | null): AppTheme | null {
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
