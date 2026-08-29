import { defineConfig } from "vitest/config";
import * as path from "node:path";

const root = path.resolve(__dirname);
const alias = (name: string) => path.join(root, "packages", name, "src/index.ts");

export default defineConfig({
  resolve: {
    alias: {
      "@monkey-mini-app/host-core": alias("host-core"),
      "@monkey-mini-app/panel-core": alias("panel-core"),
    },
  },
  test: {
    environment: "node",
    include: [
      "packages/**/src/**/*.test.ts",
      "packages/smoke-test/**/*.test.ts",
    ],
    testTimeout: 60_000,
  },
});
