import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Kit harness (jsdom). Coverage lives here — not on the root unit project — because the
 * workspace ProjectConfig type does not accept a coverage block, and a root-only include of
 * packages/ui would still report 0% whenever the kit suite is not the one that ran.
 *
 * Threshold is a *floor for "the suite still runs"*, not a quality target for every file:
 * most of packages/ui has no tests yet. Current baseline is ~46% lines; 40% fails only if
 * the kit project stops executing (the silent hole this config was written to catch).
 */
export default defineConfig({
  test: {
    name: "kit",
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "**/*.{test,spec}.{ts,tsx}",
        "**/index.ts",
        "src/components/ui/**",
      ],
      reporter: ["text", "json-summary"],
      thresholds: {
        lines: 40,
      },
    },
  },
  resolve: {
    alias: {
      "@monkey-mini-app/ui": path.resolve(__dirname, "./src"),
      "@monkey-mini-app/ui/": path.resolve(__dirname, "./src/") + "/",
    },
  },
});
