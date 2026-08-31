#!/usr/bin/env node
/**
 * Build @monkey-mini-app/ui for distribution + host embedding.
 *
 * Outputs packages/ui/dist/:
 *   index.js          — flattened NAMED re-export of every component file
 *                       (esbuild can tree-shake named re-exports, unlike `export *`)
 *   src/              — component source copied as-is (host per-app build compiles TSX)
 *   vendor/           — node_modules subtree actually imported by the library
 *                       (metafile-driven copy; CJS/ESM both fine — host esbuild converts)
 *   globals.css       — Tailwind 4 compiled stylesheet
 *   manifest.json     — { entry, vendorCount, sizeBytes }
 *
 * Usage: node scripts/build-ui.mjs [--watch]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { execFileSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const uiRoot = path.join(root, "packages/ui");
const srcRoot = path.join(uiRoot, "src");
const outRoot = path.join(uiRoot, "dist");

/** Files that export non-component utilities (kept in flat index, but not in catalog). */
const SKIP_EXPORT_FILES = new Set(["index", "cells", "column-meta", "jql-language"]);

const COMPONENT_DIRS = ["components", "composites", "products", "blocks"];

function listComponentFiles() {
  const files = [];
  for (const dir of COMPONENT_DIRS) {
    const abs = path.join(srcRoot, dir);
    if (!fs.existsSync(abs)) continue;
    for (const name of fs.readdirSync(abs)) {
      if (/\.(tsx|ts)$/.test(name) && !name.includes(".test.") && !name.endsWith(".d.ts")) {
        files.push({ dir, name, abs: path.join(abs, name) });
      }
    }
  }
  // extras that the flat index should also surface (i18n / hooks / utils)
  const extra = [
    "lib/utils",
    "lib/icons",
    "lib/illustrations",
    "i18n/context",
    "i18n/en",
    "i18n/zh",
    "hooks/use-mobile",
  ];
  for (const rel of extra) {
    const relTsx = rel + ".tsx";
    const absTsx = path.join(srcRoot, relTsx);
    const absTs = path.join(srcRoot, rel + ".ts");
    const abs = fs.existsSync(absTsx) ? absTsx : absTs;
    if (fs.existsSync(abs)) {
      files.push({ dir: path.dirname(rel), name: path.basename(abs), abs });
    }
  }
  return files;
}

/** Extract VALUE named exports of a module via TS AST (types are not runtime exports). */
function extractExports(fileAbs) {
  const src = fs.readFileSync(fileAbs, "utf8");
  const sf = ts.createSourceFile(fileAbs, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = new Set();
  for (const stmt of sf.statements) {
    const isExportDecl = ts.isExportDeclaration(stmt);
    const hasExportKw = stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (!isExportDecl && !hasExportKw) continue;
    if (stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)) continue;
    if (ts.isVariableStatement(stmt)) {
      for (const d of stmt.declarationList.declarations) {
        collectBindingNames(d.name, names);
      }
    } else if (ts.isFunctionDeclaration(stmt) && stmt.name) {
      names.add(stmt.name.text);
    } else if (
      (ts.isClassDeclaration(stmt) || ts.isEnumDeclaration(stmt)) &&
      stmt.name
    ) {
      names.add(stmt.name.text);
    } else if (ts.isExportDeclaration(stmt) && stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
      // named re-export without a source module: values defined in this file
      if (!stmt.moduleSpecifier && !stmt.isTypeOnly) {
        for (const el of stmt.exportClause.elements) {
          if (el.isTypeOnly) continue;
          names.add(el.name.text);
        }
      }
    }
  }
  return [...names];
}

function collectBindingNames(name, out) {
  if (ts.isIdentifier(name)) out.add(name.text);
  else if (ts.isObjectBindingPattern(name)) {
    for (const el of name.elements) collectBindingNames(el.name, out);
  } else if (ts.isArrayBindingPattern(name)) {
    for (const el of name.elements) collectBindingNames(el.name, out);
  }
}

/** Emit flat index.js: `export { a, b } from "./src/components/button.tsx"`. */
function buildFlatIndex(files) {
  const lines = [];
  const seen = new Set();
  for (const f of files) {
    if (SKIP_EXPORT_FILES.has(f.name.replace(/\.(tsx|ts)$/, ""))) continue;
    const names = extractExports(f.abs).filter((n) => !seen.has(n) && seen.add(n));
    if (!names.length) continue;
    const rel = "./src/" + path.join(f.dir, f.name);
    lines.push(`export { ${names.join(", ")} } from "${rel}"`);
  }
  const out = lines.join("\n") + "\n";
  fs.mkdirSync(outRoot, { recursive: true });
  fs.writeFileSync(path.join(outRoot, "index.js"), out);
  return { exports: lines.length, files: files.length };
}

/** (removed) vendor collection no longer used — see note above. */
const collectVendor = async () => ({ count: 0 });

function copySource() {
  const dest = path.join(outRoot, "src");
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(srcRoot, dest, {
    recursive: true,
    filter: (p) => !p.includes("/dist/") && !/\.test\.(ts|tsx)$/.test(p),
  });
  return { files: countFiles(dest) };
}

function countFiles(dir) {
  let n = 0;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else n++;
    }
  };
  walk(dir);
  return n;
}

function buildCss() {
  const cssIn = path.join(uiRoot, "src/styles/globals.css");
  const cssOut = path.join(outRoot, "globals.css");
  fs.mkdirSync(path.dirname(cssOut), { recursive: true });
  try {
    const cli = path.resolve(root, "node_modules/.bin/tailwindcss");
    execFileSync(cli, ["-i", cssIn, "-o", cssOut, "--minify"], { stdio: "pipe" });
    return { bytes: fs.statSync(cssOut).size };
  } catch (e) {
    console.warn("[build-ui] tailwindcss CLI failed:", String(e?.stderr || e?.message || e).slice(0, 300));
    // fallback: copy raw css so host has something to serve
    fs.copyFileSync(cssIn, cssOut);
    return { bytes: fs.statSync(cssOut).size, fallback: true };
  }
}

async function main() {
  const t0 = Date.now();
  fs.rmSync(outRoot, { recursive: true, force: true });
  fs.mkdirSync(outRoot, { recursive: true });

  const files = listComponentFiles();
  const flat = buildFlatIndex(files);
  // vendor collection removed — @monkey-mini-app/ui is consumed as a real npm
  // dependency (node resolves its deps natively at build time).
  const src = copySource();
  const css = buildCss();

  const manifest = {
    builtAt: new Date().toISOString(),
    entry: "index.js",
    flatExports: flat.exports,
    componentFiles: flat.files,
    srcFiles: src.files,
    css: css,
    bytes: countBytes(outRoot),
  };
  fs.writeFileSync(path.join(outRoot, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`[build-ui] dist ok in ${Date.now() - t0}ms · exports=${flat.exports} · css=${css.bytes}B · total=${(manifest.bytes / 1024).toFixed(0)}KB`);
}

function countBytes(dir) {
  let n = 0;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else n += fs.statSync(p).size;
    }
  };
  walk(dir);
  return n;
}

main().catch((e) => {
  console.error("[build-ui] FAIL", e);
  process.exit(1);
});
