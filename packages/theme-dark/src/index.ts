export const id = "dark";
export const label = "Dark";

export function getTokens(): Record<string, string> {
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
}
