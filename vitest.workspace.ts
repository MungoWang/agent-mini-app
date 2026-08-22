import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
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
