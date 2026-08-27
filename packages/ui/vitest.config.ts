import path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@monkey-mini-app/ui": path.resolve(__dirname, "./src"),
      "@monkey-mini-app/ui/": path.resolve(__dirname, "./src/") + "/",
    },
  },
})
