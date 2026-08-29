import { defineConfig, type Options } from "tsup";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const pkgId = "@monkey-mini-app/dsh-monkey-mini-app";

const shared: Options = {
  outDir: "lib",
  clean: false,
  treeshake: false,
  dts: false,
  sourcemap: false,
  // package.json is "type": "module"; without this, CJS client becomes .cjs
  // and dsh still loads ./lib/client.js.
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
        "@monkey-mini-app/host-core": path.join(root, "host-core", "src/index.ts"),
      };
    },
    external: ["isomorphic-git", "esbuild-wasm", "esbuild"],
    noExternal: [
      "@monkey-mini-app/host-core",
      "@monkey-mini-app/panel-core",
      "@monkey-mini-app/ui",
      "sucrase",
    ],
  },
  {
    ...shared,
    entry: { client: "src/client/index.ts" },
    format: ["cjs"],
    target: "es2020",
    platform: "browser",
    splitting: false,
    cjsInterop: false,
    // dsh ModuleLoader supplies require("react") at runtime
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    noExternal: ["@monkey-mini-app/panel-core", "lucide-react"],
    banner: {
      js: `window.__ModuleLoader__.load({id:${JSON.stringify(pkgId)},factory:function(require){var module={exports:{}};var exports=module.exports;`,
    },
    footer: {
      js: "return module.exports;}});",
    },
  },
]);
