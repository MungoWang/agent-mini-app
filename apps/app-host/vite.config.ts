import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // dev 直接指源码（panel-core exports 指向 src）
      "@monkey-mini-app/panel-core": path.resolve(__dirname, "../../packages/panel-core/src/index.ts"),
    },
  },
  server: { port: 5174, strictPort: true },
})
