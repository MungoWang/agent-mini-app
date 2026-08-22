import { defineConfig } from "tsup";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const alias = (name: string) => path.join(root, name, "src/index.ts");

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  outDir: "lib",
  clean: true,
  target: "node20",
  platform: "node",
  esbuildOptions(options) {
    options.alias = {
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
  },
  noExternal: [/^@monkey-mini-app\//, "isomorphic-git"],
});
