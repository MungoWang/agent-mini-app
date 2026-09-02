#!/usr/bin/env node
/**
 * Build @monkey-mini-app/api → packages/api/dist/index.js
 * Tiny identity defineApp + types; no React.
 *
 * Inputs:       packages/api/src/index.ts
 * Writes:       packages/api/dist/index.js
 * Run as:       pnpm --filter @monkey-mini-app/api build · also prepack
 */
import * as esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const pkg = path.join(root, "packages/api");
const outdir = path.join(pkg, "dist");

fs.mkdirSync(outdir, { recursive: true });
await esbuild.build({
  entryPoints: [path.join(pkg, "src/index.ts")],
  outfile: path.join(outdir, "index.js"),
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2022",
  logLevel: "info",
});
console.log("[build-api] dist/index.js ok");
