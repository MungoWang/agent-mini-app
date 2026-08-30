import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@monkey-mini-app/panel": path.resolve(__dirname, "../../packages/panel/src/index.ts"),
      // dev: compile the UI library source globals.css (JIT) so panel styles land.
      "@monkey-mini-app/ui/globals.css": path.resolve(__dirname, "../../packages/ui/src/styles/globals.css"),
    },
    dedupe: ["react", "react-dom"],
  },
  server: { port: 5174, strictPort: true, fs: { allow: [path.resolve(__dirname, "../..")] } },
})
