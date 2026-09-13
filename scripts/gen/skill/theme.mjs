/**
 * Generate `skills/monkey-mini-app/references/theme.md` from the real stylesheet.
 *
 * The token list is the single most-guessed thing in a generated mini-app: agents reverse
 * engineer `--foreground` / `--muted` / `--border` from template samples because nothing
 * states them. Hand-writing that table guarantees it drifts, and a stale token table is
 * worse than none — the agent trusts it. So it is read out of `packages/ui/src/styles/globals.css`
 * on every `pnpm gen:skill`, and `scripts/check/skill.mjs` re-verifies every var named in
 * the doc still exists there.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const cssPath = path.join(root, "packages/ui/src/styles/globals.css");
const themesTsPath = path.join(root, "packages/panel/src/themes.ts");
const outPath = path.join(root, "skills/monkey-mini-app/references/theme.md");

/** Must match `parseThemeCss`: a file without these in both modes is ignored. */
export const REQUIRED_THEME_FILE_KEYS = ["bg", "fg", "primary"];

/** File keys from `THEME_VAR_KEYS` in packages/panel/src/themes.ts. */
export function readThemeFileKeys() {
  if (!fs.existsSync(themesTsPath)) {
    throw new Error(`[gen-theme] missing ${themesTsPath}`);
  }
  const src = fs.readFileSync(themesTsPath, "utf8");
  const m = src.match(/const THEME_VAR_KEYS = \[([\s\S]*?)\] as const/);
  if (!m) throw new Error("[gen-theme] THEME_VAR_KEYS not found in themes.ts");
  const keys = [...m[1].matchAll(/"([a-z0-9-]+)"/g)].map((x) => x[1]);
  if (keys.length < 8) throw new Error("[gen-theme] THEME_VAR_KEYS too small");
  return keys;
}

/** Category order in the doc, first match wins. */
const CATEGORIES = [
  ["Surface", /^--(background|card|popover|sidebar(-[a-z]+)?|input)$/],
  ["Text", /-foreground$/],
  ["Brand & status", /^--(primary|secondary|accent|muted|destructive)$/],
  ["Lines & focus", /^--(border|ring)$/],
  ["Chart", /^--chart-\d+$/],
  ["Radius, font & shadow", /^--(radius|font|shadow)/],
];

/** Tailwind utilities a token is reachable through, so the doc says "use the class". */
const CLASS_HINT = {
  background: "bg-background",
  card: "bg-card",
  popover: "bg-popover",
  primary: "bg-primary · text-primary",
  secondary: "bg-secondary · text-secondary",
  muted: "bg-muted · text-muted",
  accent: "bg-accent · text-accent",
  destructive: "bg-destructive · text-destructive",
  border: "border-border",
  input: "border-input",
  ring: "ring-ring",
  sidebar: "bg-sidebar",
};

function readBlock(src, selector) {
  const at = src.indexOf(selector);
  if (at < 0) return {};
  const open = src.indexOf("{", at);
  if (open < 0) return {};
  let depth = 0;
  let close = -1;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) {
        close = i;
        break;
      }
    }
  }
  if (close < 0) return {};
  const body = src.slice(open + 1, close);
  const vars = {};
  for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    vars[m[1]] = m[2].trim();
  }
  return vars;
}

function shorten(value, max = 34) {
  const v = value.replace(/\s+/g, " ");
  return v.length > max ? `${v.slice(0, max - 1)}…` : v;
}

/**
 * `@theme inline { --color-x: var(--y) }` is what makes `bg-x` / `text-x` exist.
 * Returns the set of token stems that have a Tailwind colour utility.
 */
function utilityStems(themeInline) {
  const out = new Set();
  for (const token of Object.keys(themeInline)) {
    const m = /^--color-([a-z0-9-]+)$/.exec(token);
    if (m) out.add(m[1]);
  }
  return out;
}

function categoryOf(name) {
  for (const [label, re] of CATEGORIES) if (re.test(name)) return label;
  return "Other";
}

function appendCustomThemeFileDoc(lines, fileKeys) {
  const required = new Set(REQUIRED_THEME_FILE_KEYS);
  const decls = fileKeys.map((k) => "  --" + k + ": ;").join("\n");
  const fence = "`".repeat(3);
  lines.push("## Custom host theme file");
  lines.push("");
  lines.push(
    "Only write this when the user **asks** for a named / branded palette. Default: pick a builtin in the panel theme pop and put **no hex** in the mini-app."
  );
  lines.push("");
  lines.push(
    "A custom theme is a **host-global** CSS file (every app can select it). mini_app_edit cannot write it — it lives outside the app dir. Use the host file tools."
  );
  lines.push("");
  lines.push(fence);
  lines.push("<dirname(runtimeRoot)>/themes/theme-<id>.css");
  lines.push(fence);
  lines.push("");
  lines.push(
    "runtimeRoot comes from mini_app_list. id is [a-z0-9-]+. Create the directory if needed. Header comment name: is the label in the picker."
  );
  lines.push("");
  lines.push(
    "This file uses **short keys** (--bg), **not** the mini-app tokens above (--background). Copying the table into the file is silently ignored. Both light and dark :root[data-mode] blocks are required; missing bg / fg / primary in either mode means the file is skipped."
  );
  lines.push("");
  lines.push(
    "Pairing rules (light/dark as one family, not an invert) -> [styling.md](styling.md). Worked example: docs/assets/themes/theme-crimson.css (do not paste its hex here). Reopen the panel theme pop after writing — it re-reads /api/palettes."
  );
  lines.push("");
  lines.push("| File variable | Required (both modes) |");
  lines.push("|---|---|");
  for (const key of fileKeys) {
    lines.push("| `--" + key + "` | " + (required.has(key) ? "yes" : "no (filled from defaults)") + " |");
  }
  lines.push("");
  lines.push("Skeleton (fill values; do not ship this empty file):");
  lines.push("");
  lines.push(fence + "css");
  lines.push("/* name: Display name */");
  lines.push(':root[data-mode="light"] {');
  lines.push(decls);
  lines.push("}");
  lines.push(':root[data-mode="dark"] {');
  lines.push(decls);
  lines.push("}");
  lines.push(fence);
  lines.push("");
}

/**
 * The app-local file is the *same contract* as the host-global one, so it is documented from the
 * same key list — two tables that must agree would drift the first time a key is added.
 */
function appendAppLocalThemeDoc(lines) {
  lines.push("## App-local palette (theme.css)");
  lines.push("");
  lines.push(
    "A mini-app may ship its own palette: `theme.css` **in the app directory** (unlike the host-global file above, `mini_app_edit` / `mini_app_write` can write it)."
  );
  lines.push("");
  lines.push(
    "**Only when the style depends on the hue** — a look the app carries (a neon signage surface, a glass island whose sky is part of the layout). A plain CRUD / table / settings app must NOT ship one: it should follow whatever palette the user picked. The manifest has no theme block; the file's presence is the whole decision."
  );
  lines.push("");
  lines.push(
    "Same contract as the host-global file: short keys, both `:root[data-mode]` blocks, a `/* name: … *\/` header. ui.tsx still never contains a colour literal."
  );
  lines.push("");
  lines.push("Behaviour in the panel:");
  lines.push("");
  lines.push(
    "- With the file present the app uses it by default; the theme pop lists it under the current app, tagged **`本应用`**."
  );
  lines.push(
    "- The user can pick a host palette (or **`跟随全局`**) for that app; that is stored per app and does not delete the file."
  );
  lines.push("- Light / dark still follows the host — the file carries both densities.");
  lines.push(
    "- **First paint:** the host bakes the file's tokens into the app runner HTML when the request uses the local palette (`palette=__local__` or a bare `/app/:id` open). The panel's `mma-set-env` can still override later; without the bake, the first frame is the kit default near-white."
  );
  lines.push("");
  lines.push(
    "Reuse the skeleton from *Custom host theme file* above verbatim — same keys, same two blocks — and write it to `<appDir>/theme.css`."
  );
  lines.push("");
}

export function generateThemeDoc() {
  if (!fs.existsSync(cssPath)) {
    console.error(`[gen-theme] missing stylesheet: ${cssPath}`);
    process.exitCode = 1;
    return;
  }
  const css = fs.readFileSync(cssPath, "utf8");
  const light = readBlock(css, ":root");
  const dark = readBlock(css, ".dark {");
  const themeInline = readBlock(css, "@theme inline");
  const colorToVar = utilityStems(themeInline);

  const names = [...new Set([...Object.keys(light), ...Object.keys(dark)])].sort();
  if (names.length === 0) {
    console.error("[gen-theme] no CSS variables parsed — the stylesheet changed shape");
    process.exitCode = 1;
    return;
  }

  const byCategory = new Map();
  for (const name of names) {
    const cat = categoryOf(name);
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat).push(name);
  }

  const order = [...CATEGORIES.map(([label]) => label), "Other"];
  const lines = [];
  const fileKeys = readThemeFileKeys();
  lines.push("<!-- GENERATED by scripts/gen/skill/theme.mjs — do not hand-edit.");
  lines.push("     Source: packages/ui/src/styles/globals.css + packages/panel/src/themes.ts THEME_VAR_KEYS.");
  lines.push("     Refresh with `pnpm gen:skill`. -->");
  lines.push("");
  lines.push("# Theme tokens");
  lines.push("");
  lines.push(
    "Every mini-app renders inside the host theme, so ** colours come from tokens, never from literals**. Hardcoded hex does not follow the palette the user picked and is the fastest way to make a generated app look wrong in dark mode."
  );
  lines.push("");
  lines.push("## Reach for a Tailwind class first");
  lines.push("");
  lines.push(
    "The tokens below are exposed as Tailwind semantic utilities, which is what you should write:"
  );
  lines.push("");
  lines.push("```tsx");
  lines.push('<div className="bg-card text-card-foreground border-border ring-ring">');
  lines.push('  <span className="text-muted-foreground">…</span>');
  lines.push('  <button className="bg-primary text-primary-foreground">…</button>');
  lines.push("</div>");
  lines.push("```");
  lines.push("");
  lines.push(
    "Use the raw `var(--token)` only where a utility cannot reach: `style={{ … }}`, SVG `fill`/`stroke`, gradients, `color-mix()`, or a value you hand to a chart component."
  );
  lines.push("");
  lines.push("## Tokens");
  lines.push("");

  for (const cat of order) {
    const list = byCategory.get(cat);
    if (!list?.length) continue;
    lines.push("");
    lines.push(`### ${cat}`);
    lines.push("");
    lines.push("| Token | Tailwind | Light | Dark |");
    lines.push("|---|---|---|---|");
    for (const name of list) {
      const bare = name.replace(/^--/, "");
      // No nested backticks: a `…` inside a table cell's code span breaks the row.
      const cls =
        CLASS_HINT[bare] ??
        (bare === "foreground" || bare.endsWith("-foreground")
          ? `text-${bare}`
          : colorToVar.has(bare)
            ? `bg-${bare} · text-${bare}`
            : "—");
      lines.push(
        `| \`${name}\` | \`${cls}\` | \`${shorten(light[name] ?? "inherits")}\` | \`${shorten(dark[name] ?? "inherits")}\` |`
      );
    }
  }

  lines.push("");
  lines.push("## Notes");
  lines.push("");
  lines.push(
    "- Light and dark are **the same token names**; only the values change. Never branch on the mode yourself — `<html class=\"dark\">` is set by the host."
  );
  lines.push(
    "- The host also ships named palettes (`data-palette` + `data-theme`). They override the tokens above, which is exactly why literal colours must not appear in a mini-app."
  );
  lines.push(
    "- Illustrations (`Illu*`) already map their accent to `--primary` and their greys to `--muted` / `--card`; do not restyle them."
  );
  lines.push(
    "- Radius comes from `--radius` (`--radius-sm` … `--radius-4xl` are derived), so prefer `rounded-lg` / `rounded-xl` over a fixed `px`."
  );
  lines.push("");
  lines.push(
    `${names.length} tokens read from \`packages/ui/src/styles/globals.css\`.`
  );
  lines.push("");
  appendCustomThemeFileDoc(lines, fileKeys);
  appendAppLocalThemeDoc(lines);

  fs.writeFileSync(outPath, lines.join("\n"), "utf8");
  return names.length;
}

// Also runnable on its own while iterating on the doc.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`monkey-mini-app skill: theme.md → ${generateThemeDoc()} tokens from globals.css`);
}
