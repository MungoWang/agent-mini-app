import { defineConfig, type Options } from "tsup";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const alias = (name: string) => path.join(root, name, "src/index.ts");
const pkgId = "@monkey-mini-app/dsh-monkey-mini-app";

const nodeAliases = {
  "@monkey-mini-app/runtime-core": alias("runtime-core"),
  "@monkey-mini-app/adapter-node": alias("adapter-node"),
  "@monkey-mini-app/app-history": alias("app-history"),
  "@monkey-mini-app/app-history-git": alias("app-history-git"),
  "@monkey-mini-app/agent-core": alias("agent-core"),
  "@monkey-mini-app/ui-core": alias("ui-core"),
  "@monkey-mini-app/agent-skills": alias("agent-skills"),
  "@monkey-mini-app/host-port": alias("host-port"),
  "@monkey-mini-app/bridge-protocol": alias("bridge-protocol"),
  "@monkey-mini-app/api-client": alias("api-client"),
  "@monkey-mini-app/theme-light": alias("theme-light"),
  "@monkey-mini-app/theme-dark": alias("theme-dark"),
};

const shared: Options = {
  outDir: "lib",
  clean: false,
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
      options.alias = nodeAliases;
    },
    external: ["isomorphic-git"],
    noExternal: [/^@monkey-mini-app\//, "sucrase"],
  },
  {
    ...shared,
    entry: { client: "src/client.ts" },
    format: ["cjs"],
    target: "es2020",
    platform: "browser",
    splitting: false,
    cjsInterop: false,
    // dsh ModuleLoader supplies require("react") at runtime
    external: ["react"],
    banner: {
      js: `window.__ModuleLoader__.load({id:${JSON.stringify(pkgId)},factory:function(require){var module={exports:{}};var exports=module.exports;`,
    },
    footer: {
      js: "return module.exports;}});",
    },
  },
  {
    ...shared,
    entry: { "ui-kit": "src/ui-kit.ts" },
    format: ["esm"],
    target: "es2020",
    platform: "browser",
    splitting: false,
    minify: true,
    // iframe 无 node_modules：CodeMirror/lezer/TanStack 必须打进 bundle
    noExternal: [/@codemirror/, /@lezer/, /@tanstack/],
  },
]);
