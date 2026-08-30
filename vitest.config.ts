import { defineConfig } from "vitest/config";
import * as path from "node:path";

const root = path.resolve(__dirname);
const alias = (name: string) => path.join(root, "packages", name, "src/index.ts");

export default defineConfig({
  resolve: {
    alias: {
      "@monkey-mini-app/host-core": alias("host-core"),
      "@monkey-mini-app/host": alias("host"),
      "@monkey-mini-app/panel-core": alias("panel-core"),
      "@monkey-mini-app/panel": alias("panel"),
      "@monkey-mini-app/dsh-mini-app": alias("dsh"),
    },
  },
  test: {
    environment: "node",
    include: [
      "packages/**/src/**/*.test.ts",
      "packages/**/tests/**/*.test.ts",
      "packages/smoke-test/**/*.test.ts",
    ],
    testTimeout: 60_000,
    coverage: {
      provider: "v8",
      include: [
        "packages/host/src/**/*.{ts,tsx}",
        "packages/panel/src/**/*.{ts,tsx}",
        "packages/dsh/src/**/*.{ts,tsx}",
      ],
      exclude: ["**/*.d.ts", "**/*.test.ts"],
      reporter: ["text", "json-summary"],
      thresholds: {
        "packages/host/src/**": { lines: 85 },
        "packages/panel/src/**": { lines: 85 },
        "packages/dsh/src/**": { lines: 85 },
      },
    },
  },
});
