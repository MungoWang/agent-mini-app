export const id = "light";
export const label = "Light";

export function getTokens(): Record<string, string> {
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
}
