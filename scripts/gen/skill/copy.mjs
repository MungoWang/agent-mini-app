#!/usr/bin/env node
/**
 * Canonical skill: skills/monkey-mini-app/
 * Adapters get a real copy at packages/<adapter>/skills/monkey-mini-app for npm pack.
 *
 *   node scripts/gen/skill/copy.mjs dsh
 *   node scripts/gen/skill/copy.mjs clean dsh

 * Inputs:       argv: <adapter> [dsh], or `clean <adapter>`
 * Writes:       packages/<adapter>/skills/monkey-mini-app/
 * Side effects: repo scratch copy that exists only while packing
 * Run as:       npm lifecycle: `prepack` / `postpack` of @monkey-mini-app/dsh-mini-app
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// this file lives at scripts/gen/skill/copy.mjs → three levels up to the repo root
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const src = path.join(root, "skills", "monkey-mini-app");
const action = process.argv[2] === "clean" ? "clean" : "copy";
const adapter = action === "clean" ? process.argv[3] || "dsh" : process.argv[2] || "dsh";
const destRoot = path.join(root, "packages", adapter, "skills");
const dest = path.join(destRoot, "monkey-mini-app");

if (action === "clean") {
  fs.rmSync(destRoot, { recursive: true, force: true });
  console.log("[sync-skill] cleaned", destRoot);
  process.exit(0);
}

if (!fs.existsSync(path.join(src, "SKILL.md"))) {
  console.error("[sync-skill] missing", src);
  process.exit(1);
}

fs.mkdirSync(destRoot, { recursive: true });
fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true });
console.log("[sync-skill] copied", src, "→", dest);
