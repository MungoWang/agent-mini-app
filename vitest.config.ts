import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "packages/**/src/**/*.test.ts",
      "packages/smoke-test/**/*.test.ts",
    ],
    testTimeout: 60_000,
  },
});
