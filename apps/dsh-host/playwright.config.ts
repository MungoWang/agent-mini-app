import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:3088",
    headless: true,
    screenshot: "only-on-failure",
    trace: "off",
  },
  webServer: {
    command: "pnpm start",
    url: "http://127.0.0.1:3088",
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
