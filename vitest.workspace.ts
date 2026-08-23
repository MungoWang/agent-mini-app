import { defineWorkspace } from "vitest/config";
import * as path from "node:path";

const root = path.resolve(__dirname);
const alias = (name: string) => path.join(root, "packages", name, "src/index.ts");

export default defineWorkspace([
  {
    resolve: {
      alias: {
        "@monkey-mini-app/runtime-core": alias("runtime-core"),
        "@monkey-mini-app/adapter-node": alias("adapter-node"),
        "@monkey-mini-app/adapter-dsh": alias("adapter-dsh"),
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
      },
    },
    test: {
      name: "unit",
      environment: "node",
      include: [
        "packages/**/src/**/*.test.ts",
        "packages/smoke-test/**/*.test.ts",
      ],
      testTimeout: 60_000,
    },
  },
]);
