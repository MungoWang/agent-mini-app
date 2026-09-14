import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const root = path.resolve(__dirname, "../..");

export default defineConfig({
  clearScreen: false,
  plugins: [react()],
  server: {
    port: 1420,
    strictPort: true,
  },
  envPrefix: ["VITE_", "TAURI_"],
  resolve: {
    alias: {
      "@monkey-mini-app/panel": path.join(root, "packages/panel/src/index.ts"),
      "@monkey-mini-app/ui": path.join(root, "packages/ui/src/index.ts"),
    },
  },
  build: {
    target: "esnext",
    outDir: "dist",
    emptyOutDir: true,
  },
});
