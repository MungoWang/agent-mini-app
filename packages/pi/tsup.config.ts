import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm"],
  target: "node20",
  platform: "node",
  outDir: "dist",
  clean: true,
  dts: true,
  sourcemap: false,
  treeshake: true,
  external: [
    "@monkey-mini-app/host",
    "@monkey-mini-app/shell",
    "@earendil-works/pi-coding-agent",
    "@earendil-works/pi-ai",
    "node:*",
  ],
});

