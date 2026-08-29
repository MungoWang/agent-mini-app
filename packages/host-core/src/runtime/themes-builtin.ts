/** Runtime theme token packs (folded from theme-light / theme-dark). */

export const themeLight = {
  id: "light",
  label: "Light",
  getTokens(): Record<string, string> {
    return {
      "color-background": "#ffffff",
      "color-foreground": "#0a0a0a",
      "color-primary": "#2563eb",
      "color-primary-foreground": "#ffffff",
      "color-muted": "#f4f4f5",
      "color-muted-foreground": "#71717a",
      "color-border": "#e4e4e7",
      "color-destructive": "#dc2626",
      "radius-sm": "4px",
      "radius-md": "8px",
      "radius-lg": "12px",
      "space-1": "4px",
      "space-2": "8px",
      "space-3": "12px",
      "space-4": "16px",
      "font-sans": "ui-sans-serif, system-ui, sans-serif",
      "font-mono": "ui-monospace, monospace",
    };
  },
};

export const themeDark = {
  id: "dark",
  label: "Dark",
  getTokens(): Record<string, string> {
    return {
      "color-background": "#0a0a0a",
      "color-foreground": "#fafafa",
      "color-primary": "#3b82f6",
      "color-primary-foreground": "#ffffff",
      "color-muted": "#27272a",
      "color-muted-foreground": "#a1a1aa",
      "color-border": "#3f3f46",
      "color-destructive": "#ef4444",
      "radius-sm": "4px",
      "radius-md": "8px",
      "radius-lg": "12px",
      "space-1": "4px",
      "space-2": "8px",
      "space-3": "12px",
      "space-4": "16px",
      "font-sans": "ui-sans-serif, system-ui, sans-serif",
      "font-mono": "ui-monospace, monospace",
    };
  },
};
