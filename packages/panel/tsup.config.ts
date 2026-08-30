import { defineConfig } from "tsup";

// `@monkey-mini-app/panel` is the browser React panel (bundled for the client).
// `./themes` is imported by the dsh *server* (theme tokens), so keep ESM+CJS + d.ts.
export default defineConfig({
  entry: {
    index: "src/index.ts",
    themes: "src/themes.ts",
  },
  format: ["esm", "cjs"],
  platform: "browser",
  target: "es2020",
  outDir: "dist",
  clean: true,
  dts: true,
  sourcemap: false,
  treeshake: true,
  external: ["react", "react-dom", "lucide-react", "i18next"],
});
