import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig, type Options } from "tsup";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const pkgId = "@monkey-mini-app/dsh-mini-app";

const shared: Options = {
  outDir: "lib",
  clean: false,
  treeshake: false,
  dts: false,
  sourcemap: false,
  outExtension() {
    return { js: ".js" };
  },
};

export default defineConfig([
  {
    ...shared,
    entry: { index: "src/index.ts" },
    format: ["esm"],
    target: "node20",
    platform: "node",
    esbuildOptions(options) {
      options.alias = {
        "@monkey-mini-app/host": path.join(root, "host", "src/index.ts"),
        // Server must not load panel's React entry; bundle pure themes only.
        "@monkey-mini-app/panel/themes": path.join(root, "panel", "src/themes.ts"),
      };
    },
    external: [
      "isomorphic-git",
      "esbuild-wasm",
      "esbuild",
      "hono",
      "@hono/node-server",
      "@monkey-mini-app/ui",
      "@monkey-mini-app/panel",
      "@deepseek-ai/dsh-session",
      "@deepseek-ai/dsh-llm",
      "@deepseek-ai/dsh-subagent",
      "@deepseek-ai/dsh-tools",
    ],
    noExternal: ["@monkey-mini-app/host", "@monkey-mini-app/panel/themes", "sucrase", "i18next"],
  },
  {
    ...shared,
    entry: { client: "src/client/index.ts" },
    format: ["cjs"],
    target: "es2020",
    platform: "browser",
    splitting: false,
    cjsInterop: false,
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    noExternal: ["@monkey-mini-app/panel", "lucide-react", "i18next"],
    esbuildOptions(options) {
      options.alias = {
        "@monkey-mini-app/panel": path.join(root, "panel", "src/index.ts"),
      };
    },
    banner: {
      js: `window.__ModuleLoader__.load({id:${JSON.stringify(pkgId)},factory:function(require){var module={exports:{}};var exports=module.exports;`,
    },
    footer: {
      js: "return module.exports;}});",
    },
  },
]);
