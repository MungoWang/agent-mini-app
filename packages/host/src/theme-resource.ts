/** Custom palette row for GET /api/palettes (builtins stay in panel). */
export type CustomThemePalette = {
  id: string;
  label: string;
  swatch: string;
  custom: true;
  /** Opaque token bags; panel maps them when applying. */
  tokens?: {
    light: Record<string, string>;
    dark: Record<string, string>;
  };
};

/**
 * ThemeResource — host consumes; the shell (dsh) implements.
 * Parallel to HostCapabilities / HostLifecycle (not a bare CSS string callback).
 */
export interface ThemeResource {
  /** Full CSS injected into the iframe runner `<style>` (builtin + custom blocks). */
  runnerCss(): string;

  /** Optional custom themes for `/api/palettes`. Default empty. */
  listCustomPalettes?(): CustomThemePalette[] | Promise<CustomThemePalette[]>;
}

/** Empty resource used when the shell does not supply themes. */
export const EMPTY_THEME_RESOURCE: ThemeResource = {
  runnerCss: () => "",
};
