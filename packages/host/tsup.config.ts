import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm"],
  target: "node20",
  platform: "node",
  outDir: "dist",
  clean: true,
  dts: true, // emit dist/index.d.ts
  sourcemap: false,
  treeshake: true,
  external: [
    "node:*",
    "@hono/node-server",
    "@monkey-mini-app/ui",
    "@tailwindcss/cli",
    "diff",
    "esbuild",
    "esbuild-wasm",
    "hono",
    "i18next",
    "isomorphic-git",
    "lodash-es",
    "sucrase",
    "tailwindcss",
  ],
});
