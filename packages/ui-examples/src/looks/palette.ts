import * as React from "react";

import auroraBento from "./themes/aurora-bento.css?raw";
import deskSplit from "./themes/desk-split.css?raw";
import editorial from "./themes/editorial.css?raw";
import glassIsland from "./themes/glass-island.css?raw";
import signage from "./themes/signage.css?raw";
import terminal from "./themes/terminal.css?raw";

/**
 * Look fixtures are rendered by the demo host, which paints them with **the host palette**.
 * Hue-dependent looks carry their own `theme.css` because their identity IS the colour (the
 * island's sky, the desk's walnut, phosphor green, the aurora, newsprint) — shown under the default 黑白 they collapse into "a page with
 * big text", which is exactly the misreading a monochrome fixture must not teach.
 *
 * So the fixture applies the look's own palette, read from the same file a facade would ship.
 * The `.css` stays the single source; this only renames the keys.
 */
const SOURCES: Record<string, string> = {
  "aurora-bento": auroraBento,
  "desk-split": deskSplit,
  editorial,
  "glass-island": glassIsland,
  signage,
  terminal,
};

/** Short theme-file keys → mini-app tokens (the mapping `packages/panel`'s `cssVars` applies). */
const TOKEN: Record<string, string> = {
  bg: "--background",
  fg: "--foreground",
  surface: "--card",
  "surface-fg": "--card-foreground",
  border: "--border",
  muted: "--muted",
  "muted-fg": "--muted-foreground",
  primary: "--primary",
  "primary-fg": "--primary-foreground",
  secondary: "--secondary",
  "secondary-fg": "--secondary-foreground",
  accent: "--accent",
  "accent-fg": "--accent-foreground",
  destructive: "--destructive",
  "destructive-fg": "--destructive-foreground",
  ring: "--ring",
  input: "--input",
  radius: "--radius",
  shadow: "--shadow",
};

function varsFor(css: string, mode: "light" | "dark"): React.CSSProperties {
  const block = new RegExp(`:root\\[data-mode="${mode}"\\]\\s*\\{([^}]*)\\}`).exec(css);
  const style: Record<string, string> = {};
  for (const m of (block?.[1] ?? "").matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+)/g)) {
    const token = TOKEN[m[1]];
    if (token) style[token] = m[2].trim();
  }
  return style as React.CSSProperties;
}

/** True when the host is in dark mode, live — the demo host toggles a class, not a re-render. */
function useHostDark(): boolean {
  const read = () => document.documentElement.classList.contains("dark");
  const [dark, setDark] = React.useState(read);
  React.useEffect(() => {
    const mo = new MutationObserver(() => setDark(read()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);
  return dark;
}

/**
 * Inline style carrying the look's palette, or `{}` for a look that deliberately follows the
 * host. Spread onto the fixture root; every token below it inherits.
 */
export function useLookPalette(id: string): React.CSSProperties {
  const dark = useHostDark();
  const css = SOURCES[id];
  if (!css) return {};
  return varsFor(css, dark ? "dark" : "light");
}
