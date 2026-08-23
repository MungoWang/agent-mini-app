export type PaletteId = "default" | "ocean" | "violet" | "slate";
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
  { id: "ocean", label: "海蓝", swatch: "#1d4ed8" },
  { id: "violet", label: "青紫", swatch: "#7c3aed" },
  { id: "slate", label: "石墨", swatch: "#3f3f46" },
];

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
  ocean: {
    light: {
      bg: "#e8f1fb",
      fg: "#0f1c2e",
      surface: "#f7fbff",
      surfaceFg: "#0f1c2e",
      border: "#b7cce6",
      muted: "#d5e5f6",
      mutedFg: "#3f5878",
      primary: "#1d4ed8",
      primaryFg: "#ffffff",
      secondary: "#d5e5f6",
      secondaryFg: "#0f1c2e",
      accent: "#c5dbf5",
      accentFg: "#1e3a8a",
      destructive: "#dc2626",
      destructiveFg: "#ffffff",
      ring: "#1d4ed8",
      input: "#b7cce6",
      radius: "12px",
      shadow: "rgba(29, 78, 216, 0.14)",
    },
    dark: {
      bg: "#07101c",
      fg: "#e7f0fb",
      surface: "#101b2c",
      surfaceFg: "#e7f0fb",
      border: "#243b5c",
      muted: "#162336",
      mutedFg: "#8eabc9",
      primary: "#60a5fa",
      primaryFg: "#07101c",
      secondary: "#162336",
      secondaryFg: "#e7f0fb",
      accent: "#1e3a5f",
      accentFg: "#bfdbfe",
      destructive: "#f87171",
      destructiveFg: "#07101c",
      ring: "#60a5fa",
      input: "#243b5c",
      radius: "12px",
      shadow: "rgba(2, 8, 23, 0.55)",
    },
  },
  violet: {
    light: {
      bg: "#f1ecfb",
      fg: "#1a1230",
      surface: "#fbf8ff",
      surfaceFg: "#1a1230",
      border: "#cfc0ea",
      muted: "#e6dcf7",
      mutedFg: "#56457a",
      primary: "#7c3aed",
      primaryFg: "#ffffff",
      secondary: "#e6dcf7",
      secondaryFg: "#1a1230",
      accent: "#ddd0f5",
      accentFg: "#4c1d95",
      destructive: "#dc2626",
      destructiveFg: "#ffffff",
      ring: "#7c3aed",
      input: "#cfc0ea",
      radius: "14px",
      shadow: "rgba(124, 58, 237, 0.14)",
    },
    dark: {
      bg: "#0e0a18",
      fg: "#f0e9ff",
      surface: "#181226",
      surfaceFg: "#f0e9ff",
      border: "#35284f",
      muted: "#221832",
      mutedFg: "#b4a2d6",
      primary: "#a78bfa",
      primaryFg: "#0e0a18",
      secondary: "#221832",
      secondaryFg: "#f0e9ff",
      accent: "#2c1f48",
      accentFg: "#ddd6fe",
      destructive: "#f87171",
      destructiveFg: "#0e0a18",
      ring: "#a78bfa",
      input: "#35284f",
      radius: "14px",
      shadow: "rgba(8, 4, 18, 0.55)",
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

/** Accept current ids and migrate the first-pass palette names. */
export function clampPalette(value: unknown): PaletteId {
  if (value === "ocean" || value === "violet" || value === "slate" || value === "default") return value;
  if (value === "mist") return "ocean";
  if (value === "paper") return "slate";
  if (value === "ink") return "violet";
  return "default";
}

export function clampMode(value: unknown): ModeId {
  return value === "dark" ? "dark" : "light";
}

export function tokensOf(palette: PaletteId, mode: ModeId): TokenSet {
  return TOKENS[clampPalette(palette)][clampMode(mode)];
}

function cssVars(t: TokenSet): string {
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

/** CSS for the iframe runner: default + 3 palettes, each light/dark. */
export function runnerThemeCss(): string {
  const blocks = [
    `:root,html[data-theme="light"]:not([data-palette]),html[data-theme="light"][data-palette="default"]{${cssVars(TOKENS.default.light)}}`,
    `html[data-theme="dark"]:not([data-palette]),html[data-theme="dark"][data-palette="default"]{${cssVars(TOKENS.default.dark)}}`,
  ];
  (["ocean", "violet", "slate"] as PaletteId[]).forEach((id) => {
    blocks.push(`html[data-theme="light"][data-palette="${id}"]{${cssVars(TOKENS[id].light)}}`);
    blocks.push(`html[data-theme="dark"][data-palette="${id}"]{${cssVars(TOKENS[id].dark)}}`);
  });
  return blocks.join("\n  ");
}
