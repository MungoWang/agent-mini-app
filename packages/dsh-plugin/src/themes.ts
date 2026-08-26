export type PaletteId =
  | "default"
  | "tokyo"
  | "forest"
  | "matcha"
  | "yellow"
  | "zoro"
  | "hokage"
  | "slate";
export type ModeId = "light" | "dark";

/** Full token bag for Host chrome + iframe apps (shadcn-compatible). */
export type TokenSet = {
  bg: string;
  fg: string;
  surface: string;
  surfaceFg: string;
  border: string;
  muted: string;
  mutedFg: string;
  primary: string;
  primaryFg: string;
  secondary: string;
  secondaryFg: string;
  accent: string;
  accentFg: string;
  destructive: string;
  destructiveFg: string;
  ring: string;
  input: string;
  radius: string;
  /** soft overlay / card elevation tint */
  shadow: string;
};

export const PALETTES: { id: PaletteId; label: string; swatch: string }[] = [
  { id: "default", label: "默认", swatch: "#2563eb" },
  { id: "tokyo", label: "东京夜", swatch: "#7aa2f7" },
  { id: "forest", label: "苔原", swatch: "#a7c080" },
  { id: "matcha", label: "草莓抹茶", swatch: "#ee9aa6" },
  { id: "yellow", label: "药丸黄", swatch: "#facc15" },
  { id: "zoro", label: "三刀流", swatch: "#4ade80" },
  { id: "hokage", label: "火影黎明", swatch: "#f59e0b" },
  { id: "slate", label: "石墨", swatch: "#3f3f46" },
];

/**
 * 配色参考（2026-08 由 VSCode 主题移植）：
 * - tokyo   Tokyo Night（dark #1a1b26 / light #d5d6db）
 * - forest  Everforest（dark #2d353b / light #fdf6e3）
 * - matcha  Strawberry Matcha（草莓粉 × 抹茶绿）
 * - yellow  Yellow Pill（药丸黄）
 * - zoro    Anime 三刀流（深苔绿 × 金属金）
 * - hokage  Naruto Hokage Dawn（暖橙黎明）
 */
const TOKENS: Record<PaletteId, Record<ModeId, TokenSet>> = {
  default: {
    light: {
      bg: "#f7f7f8",
      fg: "#111111",
      surface: "#ffffff",
      surfaceFg: "#111111",
      border: "#e5e7eb",
      muted: "#f3f4f6",
      mutedFg: "#6b7280",
      primary: "#2563eb",
      primaryFg: "#ffffff",
      secondary: "#f3f4f6",
      secondaryFg: "#111111",
      accent: "#eff6ff",
      accentFg: "#1e3a8a",
      destructive: "#dc2626",
      destructiveFg: "#ffffff",
      ring: "#2563eb",
      input: "#e5e7eb",
      radius: "10px",
      shadow: "rgba(15, 23, 42, 0.08)",
    },
    dark: {
      bg: "#0b0b0c",
      fg: "#f4f4f5",
      surface: "#171717",
      surfaceFg: "#f4f4f5",
      border: "#2a2a2c",
      muted: "#27272a",
      mutedFg: "#a1a1aa",
      primary: "#3b82f6",
      primaryFg: "#ffffff",
      secondary: "#27272a",
      secondaryFg: "#f4f4f5",
      accent: "#172554",
      accentFg: "#bfdbfe",
      destructive: "#ef4444",
      destructiveFg: "#ffffff",
      ring: "#3b82f6",
      input: "#2a2a2c",
      radius: "10px",
      shadow: "rgba(0, 0, 0, 0.45)",
    },
  },
  tokyo: {
    light: {
      bg: "#d5d6db",
      fg: "#343b59",
      surface: "#f2f3f8",
      surfaceFg: "#343b59",
      border: "#c9ccd9",
      muted: "#e9eaf2",
      mutedFg: "#7c82a4",
      primary: "#2e7de9",
      primaryFg: "#ffffff",
      secondary: "#e3e5ef",
      secondaryFg: "#343b59",
      accent: "#dfe6f6",
      accentFg: "#274a94",
      destructive: "#db4b4b",
      destructiveFg: "#ffffff",
      ring: "#2e7de9",
      input: "#e8eaf2",
      radius: "10px",
      shadow: "rgba(30, 40, 90, 0.12)",
    },
    dark: {
      bg: "#1a1b26",
      fg: "#a9b1d6",
      surface: "#16161e",
      surfaceFg: "#a9b1d6",
      border: "#2b2e3d",
      muted: "#1f2230",
      mutedFg: "#787c99",
      primary: "#7aa2f7",
      primaryFg: "#1a1b26",
      secondary: "#202330",
      secondaryFg: "#a9b1d6",
      accent: "#33467c",
      accentFg: "#c0caf5",
      destructive: "#f7768e",
      destructiveFg: "#1a1b26",
      ring: "#7aa2f7",
      input: "#14141b",
      radius: "10px",
      shadow: "rgba(0, 0, 0, 0.5)",
    },
  },
  forest: {
    light: {
      bg: "#fdf6e3",
      fg: "#5c6a72",
      surface: "#fefaf0",
      surfaceFg: "#5c6a72",
      border: "#e3ddc9",
      muted: "#f2ecdb",
      mutedFg: "#859289",
      primary: "#93b259",
      primaryFg: "#fdf6e3",
      secondary: "#eae4d2",
      secondaryFg: "#5c6a72",
      accent: "#e0e6c8",
      accentFg: "#4d6a3d",
      destructive: "#e67e80",
      destructiveFg: "#fdf6e3",
      ring: "#93b259",
      input: "#f7f1e0",
      radius: "12px",
      shadow: "rgba(70, 90, 60, 0.12)",
    },
    dark: {
      bg: "#2d353b",
      fg: "#d3c6aa",
      surface: "#333c43",
      surfaceFg: "#d3c6aa",
      border: "#414c52",
      muted: "#3d484d",
      mutedFg: "#859289",
      primary: "#a7c080",
      primaryFg: "#2d353b",
      secondary: "#3d484d",
      secondaryFg: "#d3c6aa",
      accent: "#475258",
      accentFg: "#d3c6aa",
      destructive: "#e67e80",
      destructiveFg: "#2d353b",
      ring: "#a7c080",
      input: "#272e33",
      radius: "12px",
      shadow: "rgba(0, 0, 0, 0.4)",
    },
  },
  matcha: {
    light: {
      bg: "#faf5f3",
      fg: "#4c4147",
      surface: "#ffffff",
      surfaceFg: "#4c4147",
      border: "#eadcd8",
      muted: "#f3eae6",
      mutedFg: "#98857f",
      primary: "#e08a9c",
      primaryFg: "#ffffff",
      secondary: "#f0e4df",
      secondaryFg: "#4c4147",
      accent: "#e8f0da",
      accentFg: "#5a7a3f",
      destructive: "#d95f7f",
      destructiveFg: "#ffffff",
      ring: "#e08a9c",
      input: "#f8f1ee",
      radius: "14px",
      shadow: "rgba(180, 90, 110, 0.12)",
    },
    dark: {
      bg: "#28242b",
      fg: "#e9d8d2",
      surface: "#302b33",
      surfaceFg: "#e9d8d2",
      border: "#443a44",
      muted: "#38313a",
      mutedFg: "#b3a09f",
      primary: "#ee9aa6",
      primaryFg: "#28242b",
      secondary: "#38313a",
      secondaryFg: "#e9d8d2",
      accent: "#3f4a38",
      accentFg: "#c8e3b2",
      destructive: "#e06c8a",
      destructiveFg: "#28242b",
      ring: "#ee9aa6",
      input: "#231f26",
      radius: "14px",
      shadow: "rgba(0, 0, 0, 0.45)",
    },
  },
  yellow: {
    light: {
      bg: "#faf6ef",
      fg: "#3d3326",
      surface: "#ffffff",
      surfaceFg: "#3d3326",
      border: "#e8dfcd",
      muted: "#f2ecdf",
      mutedFg: "#9a8a6f",
      primary: "#a37b16",
      primaryFg: "#ffffff",
      secondary: "#ede5d3",
      secondaryFg: "#3d3326",
      accent: "#f7edcb",
      accentFg: "#6b4e0a",
      destructive: "#dc2626",
      destructiveFg: "#ffffff",
      ring: "#a37b16",
      input: "#f7f1e4",
      radius: "12px",
      shadow: "rgba(140, 110, 40, 0.12)",
    },
    dark: {
      bg: "#1c1917",
      fg: "#f5f0e6",
      surface: "#242019",
      surfaceFg: "#f5f0e6",
      border: "#3a332a",
      muted: "#2a2520",
      mutedFg: "#b3a68f",
      primary: "#facc15",
      primaryFg: "#1c1917",
      secondary: "#2a2520",
      secondaryFg: "#f5f0e6",
      accent: "#3f3518",
      accentFg: "#fde68a",
      destructive: "#f87171",
      destructiveFg: "#1c1917",
      ring: "#facc15",
      input: "#211d18",
      radius: "12px",
      shadow: "rgba(0, 0, 0, 0.5)",
    },
  },
  zoro: {
    light: {
      bg: "#f2f6f0",
      fg: "#24302a",
      surface: "#ffffff",
      surfaceFg: "#24302a",
      border: "#d8e4d6",
      muted: "#e9efe6",
      mutedFg: "#7d907e",
      primary: "#15803d",
      primaryFg: "#ffffff",
      secondary: "#e3ecdf",
      secondaryFg: "#24302a",
      accent: "#dcf2e2",
      accentFg: "#166534",
      destructive: "#dc2626",
      destructiveFg: "#ffffff",
      ring: "#15803d",
      input: "#f4f8f2",
      radius: "12px",
      shadow: "rgba(30, 80, 50, 0.1)",
    },
    dark: {
      bg: "#101512",
      fg: "#d8e0d4",
      surface: "#18211b",
      surfaceFg: "#d8e0d4",
      border: "#2c3a30",
      muted: "#1d2720",
      mutedFg: "#93a393",
      primary: "#4ade80",
      primaryFg: "#101512",
      secondary: "#1d2720",
      secondaryFg: "#d8e0d4",
      accent: "#14532d",
      accentFg: "#bbf7d0",
      destructive: "#f87171",
      destructiveFg: "#101512",
      ring: "#4ade80",
      input: "#141b16",
      radius: "12px",
      shadow: "rgba(0, 0, 0, 0.5)",
    },
  },
  hokage: {
    light: {
      bg: "#faf3ea",
      fg: "#4a3a2c",
      surface: "#ffffff",
      surfaceFg: "#4a3a2c",
      border: "#eadcc8",
      muted: "#f3e9db",
      mutedFg: "#a0886a",
      primary: "#c2660f",
      primaryFg: "#ffffff",
      secondary: "#efe2d0",
      secondaryFg: "#4a3a2c",
      accent: "#fbe6c8",
      accentFg: "#7c4a10",
      destructive: "#dc2626",
      destructiveFg: "#ffffff",
      ring: "#c2660f",
      input: "#f8f0e4",
      radius: "12px",
      shadow: "rgba(150, 90, 30, 0.12)",
    },
    dark: {
      bg: "#241a17",
      fg: "#f0e3d8",
      surface: "#2e211c",
      surfaceFg: "#f0e3d8",
      border: "#45372e",
      muted: "#33251f",
      mutedFg: "#b59f8c",
      primary: "#f59e0b",
      primaryFg: "#241a17",
      secondary: "#33251f",
      secondaryFg: "#f0e3d8",
      accent: "#4a3024",
      accentFg: "#fcd9b6",
      destructive: "#ef4444",
      destructiveFg: "#241a17",
      ring: "#f59e0b",
      input: "#201612",
      radius: "12px",
      shadow: "rgba(0, 0, 0, 0.5)",
    },
  },
  slate: {
    light: {
      bg: "#ececee",
      fg: "#09090b",
      surface: "#ffffff",
      surfaceFg: "#09090b",
      border: "#c8c8ce",
      muted: "#e0e0e5",
      mutedFg: "#52525b",
      primary: "#27272a",
      primaryFg: "#fafafa",
      secondary: "#e0e0e5",
      secondaryFg: "#09090b",
      accent: "#d4d4d8",
      accentFg: "#18181b",
      destructive: "#dc2626",
      destructiveFg: "#ffffff",
      ring: "#27272a",
      input: "#c8c8ce",
      radius: "8px",
      shadow: "rgba(24, 24, 27, 0.12)",
    },
    dark: {
      bg: "#050506",
      fg: "#fafafa",
      surface: "#141416",
      surfaceFg: "#fafafa",
      border: "#3f3f46",
      muted: "#1f1f23",
      mutedFg: "#a1a1aa",
      primary: "#e4e4e7",
      primaryFg: "#09090b",
      secondary: "#1f1f23",
      secondaryFg: "#fafafa",
      accent: "#27272a",
      accentFg: "#f4f4f5",
      destructive: "#f87171",
      destructiveFg: "#09090b",
      ring: "#e4e4e7",
      input: "#3f3f46",
      radius: "8px",
      shadow: "rgba(0, 0, 0, 0.6)",
    },
  },
};

/* —— 自定义主题（~/.monkey-mini-app/themes/theme-<id>.css，一份文件含 light/dark 两模式） —— */
const THEME_VAR_KEYS = [
  "bg", "fg", "surface", "surface-fg", "border", "muted", "muted-fg",
  "primary", "primary-fg", "secondary", "secondary-fg", "accent", "accent-fg",
  "destructive", "destructive-fg", "ring", "input", "radius", "shadow",
] as const;

function kebabToCamel(k: string): string {
  return k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * 解析 theme-<id>.css → { light, dark } 两套 TokenSet。
 * 格式：`:root[data-mode="light"]{ --bg:#fff; --fg:#111; ... }` 与 dark 同构。
 * 缺失的次要变量用默认补齐，必须提供 bg/fg/primary 才认。
 */
export function parseThemeCss(
  css: string,
  id: string
): { light: TokenSet; dark: TokenSet } | null {
  const out: { light?: Record<string, string>; dark?: Record<string, string> } = {};
  const blockRe = /:root\[data-mode="(light|dark)"\]\s*\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(String(css || "")))) {
    const mode = m[1] as "light" | "dark";
    const vars: Record<string, string> = {};
    for (const key of THEME_VAR_KEYS) {
      const vm = new RegExp(`--${key}\\s*:\\s*([^;\\n]+)`).exec(m[2]);
      if (vm) vars[kebabToCamel(key)] = vm[1].trim();
    }
    if (vars.bg && vars.fg && vars.primary) out[mode] = vars;
  }
  if (!out.light || !out.dark) return null;
  const base = {
    surfaceFg: out.light.fg!,
    secondary: out.light.muted!,
    secondaryFg: out.light.fg!,
    destructiveFg: "#ffffff",
    radius: "12px",
    shadow: "rgba(15, 23, 42, 0.1)",
  };
  const fill = (v: Record<string, string>): TokenSet =>
    Object.assign({}, base, v) as TokenSet;
  return { light: fill(out.light), dark: fill(out.dark) };
}

/** 从主题 css 提取名称注释（`/* name: xxx *\/`） */
export function themeLabelFromCss(css: string, fallback: string): string {
  const m = /\/\*\s*name\s*:\s*([^*]+)\*\//.exec(String(css || ""));
  return (m && m[1].trim()) || fallback;
}

/** Accept current ids and migrate removed palettes (ocean/violet → new families). */
export function clampPalette(value: unknown): PaletteId {
  if (
    value === "tokyo" ||
    value === "forest" ||
    value === "matcha" ||
    value === "yellow" ||
    value === "zoro" ||
    value === "hokage" ||
    value === "slate" ||
    value === "default"
  ) {
    return value;
  }
  if (value === "ocean" || value === "mist") return "tokyo"; // 海蓝 → 东京夜（蓝调）
  if (value === "violet" || value === "ink") return "matcha"; // 青紫 → 草莓抹茶
  if (value === "paper" || value === "noir") return "slate"; // 极简黑 → 石墨（黑白同族）
  return "default";
}

export function clampMode(value: unknown): ModeId {
  return value === "dark" ? "dark" : "light";
}

export function tokensOf(palette: PaletteId, mode: ModeId): TokenSet {
  return TOKENS[clampPalette(palette)][clampMode(mode)];
}

export function cssVars(t: TokenSet): string {
  return [
    `--background:${t.bg}`,
    `--foreground:${t.fg}`,
    `--card:${t.surface}`,
    `--card-foreground:${t.surfaceFg}`,
    `--primary:${t.primary}`,
    `--primary-foreground:${t.primaryFg}`,
    `--secondary:${t.secondary}`,
    `--secondary-foreground:${t.secondaryFg}`,
    `--muted:${t.muted}`,
    `--muted-foreground:${t.mutedFg}`,
    `--accent:${t.accent}`,
    `--accent-foreground:${t.accentFg}`,
    `--destructive:${t.destructive}`,
    `--destructive-foreground:${t.destructiveFg}`,
    `--border:${t.border}`,
    `--input:${t.input}`,
    `--ring:${t.ring}`,
    `--radius:${t.radius}`,
    `--shadow:${t.shadow}`,
    `--color-background:var(--background)`,
    `--color-surface:var(--card)`,
    `--color-foreground:var(--foreground)`,
    `--color-primary:var(--primary)`,
    `--color-primary-foreground:var(--primary-foreground)`,
    `--color-muted:var(--muted)`,
    `--color-muted-foreground:var(--muted-foreground)`,
    `--color-border:var(--border)`,
    `--radius-md:var(--radius)`,
    `--space-4:16px`,
    `--font-sans:ui-sans-serif,system-ui,-apple-system,sans-serif`,
  ].join(";");
}

/** CSS for the iframe runner: default + 5 palettes, each light/dark. */
export function runnerThemeCss(): string {
  const blocks = [
    `:root,html[data-theme="light"]:not([data-palette]),html[data-theme="light"][data-palette="default"]{${cssVars(TOKENS.default.light)}}`,
    `html[data-theme="dark"]:not([data-palette]),html[data-theme="dark"][data-palette="default"]{${cssVars(TOKENS.default.dark)}}`,
  ];
  (["tokyo", "forest", "matcha", "yellow", "zoro", "hokage", "slate"] as PaletteId[]).forEach((id) => {
    blocks.push(`html[data-theme="light"][data-palette="${id}"]{${cssVars(TOKENS[id].light)}}`);
    blocks.push(`html[data-theme="dark"][data-palette="${id}"]{${cssVars(TOKENS[id].dark)}}`);
  });
  blocks.push(`html[data-theme="dark"] input[type="date"],html[data-theme="dark"] input[type="time"],html[data-theme="dark"] input[type="datetime-local"],html[data-theme="dark"] input[type="month"],html[data-theme="dark"] input[type="week"]{color-scheme:dark}`);
  blocks.push(`html[data-theme="light"] input[type="date"],html[data-theme="light"] input[type="time"],html[data-theme="light"] input[type="datetime-local"],html[data-theme="light"] input[type="month"],html[data-theme="light"] input[type="week"]{color-scheme:light}`);
  return blocks.join("\n  ");
}
