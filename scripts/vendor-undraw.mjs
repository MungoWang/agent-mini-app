// Vendor a curated set of unDraw illustrations (MIT/free, balazser/undraw-svg-collection)
// into token-driven React components. Replaces the fixed unDraw palette with theme
// tokens so empty states follow --primary/--foreground/--muted in light + dark.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const RAW = "https://raw.githubusercontent.com/balazser/undraw-svg-collection/main/svgs";
const OUT = path.resolve("packages/ui/src/lib/illustrations.tsx");

const SCENES = [
  ["server-status", true],
  ["access-denied", true],
  ["page-not-found", true],
  ["search", false],
  ["data-processing", true],
  ["bug-fixing", true],
  ["empty", false],
  ["data-empty", false],
  ["network", true],
  ["no-data", false],
  ["loading", false],
  ["code-review", false],
];

const PALETTE = [
  ["var(--primary-svg-color)", "var(--primary)"],
  ["#2f2e41", "var(--foreground)"],
  ["#3f3d56", "var(--muted-foreground)"],
  ["#433d5c", "var(--muted-foreground)"],
  ["#444053", "var(--muted-foreground)"],
  ["#454b69", "var(--muted-foreground)"],
  ["#9f616a", "var(--primary)"],
  ["#a0616a", "var(--primary)"],
  ["#9e616a", "var(--primary)"],
  ["#9F616A", "var(--primary)"],
  ["#ff6584", "var(--primary)"],
  ["#8ccf4d", "var(--primary)"],
  ["#8CCF4D", "var(--primary)"],
  ["#af83dc", "color-mix(in oklch, var(--primary) 55%, var(--card))"],
  ["#e6e6e6", "var(--muted)"],
  ["#e5e5e5", "var(--muted)"],
  ["#e4e4e4", "var(--muted)"],
  ["#f0f0f0", "var(--muted)"],
  ["#f2f2f2", "var(--muted)"],
  ["#f5f5f5", "var(--muted)"],
  ["#d0d0d0", "var(--border)"],
  ["#d0d2d5", "var(--border)"],
  ["#c9c9c9", "var(--border)"],
  ["#cacaca", "var(--border)"],
  ["#cbcbcb", "var(--border)"],
  ["#cccccc", "var(--border)"],
  ["#b3b3b3", "var(--muted-foreground)"],
  ["#a9a9a9", "var(--muted-foreground)"],
  ["#ffffff", "var(--card)"],
  ["#fff", "var(--card)"],
  ["#FAFAFA", "var(--card)"],
  ["#fafafa", "var(--card)"],  ["#ffb8b8", "color-mix(in oklch, var(--primary) 30%, var(--card))"],
  ["#ffb7b7", "color-mix(in oklch, var(--primary) 30%, var(--card))"],
  ["#ffb6b6", "color-mix(in oklch, var(--primary) 30%, var(--card))"],
  ["#fbbebe", "color-mix(in oklch, var(--primary) 30%, var(--card))"],
  ["#fa5959", "color-mix(in oklch, var(--primary) 30%, var(--card))"],
  ["#fed253", "color-mix(in oklch, var(--primary) 30%, var(--card))"],
];

function tokenize(svg) {
  let out = svg;
  for (const [from, to] of PALETTE) out = out.split(from).join(to);
  return out;
}

function toName(slug) {
  // Neutral prefix so the name doesn't bind to a specific illustration source
  // (unDraw today; swap the vendored SVGs and the name stays meaningful).
  return "Illu" + slug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join("");
}

async function fetchScene(slug) {
  const res = await fetch(`${RAW}/${slug}.svg`);
  if (!res.ok) throw new Error(`404 ${slug}`);
  return res.text();
}

const lines = [
  "/**",
  " * Curated unDraw illustrations (free / MIT via balazser/undraw-svg-collection).",
  " * Palette is tokenized at vendor time: accent → --primary, navy → --foreground,",
  " * grays → --muted/--border, white → --card — so they follow light/dark and theme.",
  " * Regenerate: node scripts/vendor-undraw.mjs",
  " */",
  'import type { SVGProps } from "react";',
  "",
];

for (const [slug] of SCENES) {
  try {
    const raw = await fetchScene(slug);
    const m = raw.match(/<svg\b[^>]*viewBox="([^"]+)"[^>]*>([\s\S]*)<\/svg>/i);
    if (!m) {
      console.warn("skip (no viewBox):", slug);
      continue;
    }
    const [, viewBox, inner] = m;
    const name = toName(slug);
    lines.push(
      `export function ${name}(props: SVGProps<SVGSVGElement>) {`,
      "  return (",
      `    <svg viewBox="${viewBox}" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>`,
      tokenize(inner).replace(/^/gm, "      "),
      "    </svg>",
      "  );",
      "}",
      "",
    );
    console.log("vendored", name);
  } catch (e) {
    console.warn("skip (fetch):", slug, e.message);
  }
}

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, lines.join("\n"));
console.log("wrote", OUT);
