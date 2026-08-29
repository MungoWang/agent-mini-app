/** dsh-plugin server：app 元数据（自定义主题/manifest 元数据/storage/acronym）。 */
import * as fs from "node:fs";
import * as path from "node:path";
import { clampMode, parseThemeCss, themeLabelFromCss, cssVars, type TokenSet } from "@monkey-mini-app/panel-core";
import { pinyin } from "pinyin-pro";
import { gitCommitCount } from "./git.js";

export type CustomPalette = {
  id: string;
  label: string;
  swatch: string;
  custom: true;
  tokens: { light: TokenSet; dark: TokenSet };
};

export function customThemesDir(runtimeRoot: string): string {
  return path.join(path.resolve(runtimeRoot, ".."), "themes");
}

export function loadCustomPalettes(runtimeRoot: string): CustomPalette[] {
  const dir = customThemesDir(runtimeRoot);
  const out: CustomPalette[] = [];
  try {
    if (!fs.existsSync(dir)) return out;
    const names = fs.readdirSync(dir).filter((n) => /^theme-.+\.css$/.test(n));
    for (const n of names) {
      const id = n.replace(/^theme-/, "").replace(/\.css$/, "");
      const css = fs.readFileSync(path.join(dir, n), "utf8");
      const tokens = parseThemeCss(css, id);
      if (!tokens) continue;
      out.push({
        id,
        label: themeLabelFromCss(css, id),
        swatch: tokens.dark.primary,
        custom: true,
        tokens,
      });
    }
  } catch {
    /* noop */
  }
  return out;
}

/** iframe runner 用的自定义 palette CSS（一份含 light/dark 两模式） */
export function customPaletteCss(runtimeRoot: string): string {
  return loadCustomPalettes(runtimeRoot)
    .map((c) => {
      return (
        `html[data-theme="light"][data-palette="${c.id}"]{${cssVars(c.tokens.light)}}` +
        `html[data-theme="dark"][data-palette="${c.id}"]{${cssVars(c.tokens.dark)}}`
      );
    })
    .join("\n  ");
}

/* —— per-app 主题（存到 app 自己的 theme.json，null = 跟随全局） —— */
export function appThemeFile(dir: string): string {
  return path.join(dir, "theme.json");
}
export function readAppTheme(dir: string): { theme: string; palette: string } | null {
  try {
    const j = JSON.parse(fs.readFileSync(appThemeFile(dir), "utf8")) as { theme?: unknown; palette?: unknown };
    if (!j.theme) return null;
    return { theme: clampMode(j.theme), palette: typeof j.palette === "string" ? j.palette : "default" };
  } catch {
    return null;
  }
}
export function writeAppTheme(
  dir: string,
  val: { theme: string; palette: string } | null
): { theme: string; palette: string } | null {
  if (!val) {
    try {
      fs.unlinkSync(appThemeFile(dir));
    } catch {
      /* noop */
    }
    return null;
  }
  const next = { theme: clampMode(val.theme), palette: typeof val.palette === "string" ? val.palette : "default" };
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(appThemeFile(dir), JSON.stringify(next, null, 2));
  return next;
}

/* handleApps 的元数据组装：manifest acronym（校验 2 位）+ git commits 数 + per-app theme */
export async function enrichAppMeta(
  app: { id: string; name?: string },
  dir: string
): Promise<Record<string, unknown>> {
  const man = (() => {
    try {
      return JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8")) as { acronym?: unknown };
    } catch {
      return {};
    }
  })();
  const manifestAcronym =
    typeof man.acronym === "string" && /^[a-zA-Z0-9]{2}$/.test(man.acronym)
      ? man.acronym.toUpperCase()
      : "";
  const commits = await gitCommitCount(dir);
  return { ...app, acronym: acronymOf(app.name, manifestAcronym), commits, theme: readAppTheme(dir) };
}

/* storage 浏览：枚举 tables（按更新时间倒序，只 .json） */
export function listStorageTables(dir: string): { name: string; size: number; updatedAt: string }[] {
  try {
    const names = fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => n.endsWith(".json")) : [];
    return names
      .map((n) => {
        const fp = path.join(dir, n);
        const st = fs.statSync(fp);
        return { name: n.replace(/\.json$/, ""), size: st.size, updatedAt: st.mtime.toISOString() };
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

/* storage table 文件路径：basename 防目录穿越，追加 .json 后缀 */
export function storageTablePath(dir: string, table: string): string {
  return path.join(dir, path.basename(String(table ?? "")) + ".json");
}

/** 中文名 → 双字母缩写：前两个汉字拼音声母（大写）。英文名回退取前两个字母字符。 */
export function acronymOf(name: unknown, manifestAcronym: string): string {  if (manifestAcronym && /^[a-zA-Z0-9]{2}$/.test(manifestAcronym)) {
    return manifestAcronym.toUpperCase();
  }
  const s = String(name ?? "");
  if (!s) return "";
  const arr = pinyin(s, { pattern: "first", toneType: "none", type: "array" });
  return arr
    .join("")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 2)
    .toUpperCase();
}
