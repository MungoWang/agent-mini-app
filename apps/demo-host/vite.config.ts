import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  base: "/demo/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // dev: compile the UI library's source globals.css (JIT) instead of the
      // static dist snapshot, so new classes in demo pages are picked up live.
      "@monkey-mini-app/ui/globals.css": path.resolve(
        __dirname,
        "../../packages/ui/src/styles/globals.css"
      ),
    },
    dedupe: ["react", "react-dom", "@tanstack/react-table"],
  },
  server: {
    port: 5173,
    strictPort: true,
    fs: { allow: [path.resolve(__dirname, "../..")] },
  },

})
