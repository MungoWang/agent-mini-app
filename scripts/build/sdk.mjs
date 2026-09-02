#!/usr/bin/env node
/**
 * Build the iframe platform:
 *   dist/runtime.js — complete React ESM (vendored from esm.sh, then bundled)
 *   dist/sdk.js     — UI kit + useApp; react* is external → /mma/runtime.js
 *
 * We do not convert CJS ourselves and we do not list React APIs.
 * esm.sh already emits named ESM exports (memo, useLayoutEffect, …).
 *
 * Requires packages/ui/dist (run build-ui.mjs first). Needs network once per version.

 * Inputs:       packages/ui/dist (run build:ui first), packages/sdk/src, esm.sh over the network
 * Writes:       packages/sdk/dist/{runtime.js,sdk.js}
 * Side effects: repo build output + one network fetch per React version
 * Run as:       pnpm build:sdk — also `prepack` of @monkey-mini-app/sdk
 */
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..");
const sdkRoot = path.join(root, "packages/sdk");
const uiDist = path.join(root, "packages/ui/dist");
const distDir = path.join(sdkRoot, "dist");
const vendorDir = path.join(distDir, ".esm");
const RUNTIME_HREF = "/mma/runtime.js";
const ESM_ORIGIN = "https://esm.sh";

function reactVersion() {
  const req = createRequire(path.join(sdkRoot, "package.json"));
  return req("react/package.json").version;
}

function esmUrl(spec) {
  if (spec.startsWith("http://") || spec.startsWith("https://")) return spec;
  if (spec.startsWith("/")) return ESM_ORIGIN + spec;
  throw new Error(`[build-sdk] unexpected esm specifier: ${spec}`);
}

function localName(url) {
  const u = new URL(url);
  const safe = (u.pathname + u.search).replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return `${safe || "mod"}.js`;
}

async function fetchText(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`[build-sdk] GET ${url} → ${res.status}`);
  return res.text();
}

function isStub(text) {
  return text.length < 800 && /export\s+\*\s+from\s+["']/.test(text);
}

function importedSpecifiers(text) {
  const out = [];
  for (const re of [/\bfrom\s*["']([^"']+)["']/g, /\bimport\s*["']([^"']+)["']/g]) {
    for (const m of text.matchAll(re)) {
      const spec = m[1];
      if (
        spec.startsWith("/") ||
        spec.startsWith("./") ||
        spec.startsWith("../") ||
        spec.startsWith("https://esm.sh")
      ) {
        out.push(spec);
      }
    }
  }
  return [...new Set(out)];
}

async function vendorEsm(entryUrls) {
  fs.rmSync(vendorDir, { recursive: true, force: true });
  fs.mkdirSync(vendorDir, { recursive: true });
  const saved = new Map(); // absUrl -> basename

  async function visit(url) {
    if (saved.has(url)) return saved.get(url);
    let text = await fetchText(url);
    if (isStub(text)) {
      const m = text.match(/export\s+\*\s+from\s*["']([^"']+)["']/);
      if (!m) throw new Error(`[build-sdk] stub without target: ${url}`);
      return visit(esmUrl(m[1]));
    }
    const base = localName(url);
    saved.set(url, base);
    for (const spec of importedSpecifiers(text)) {
      const childUrl = spec.startsWith(".") ? new URL(spec, url).href : esmUrl(spec);
      const childBase = await visit(childUrl);
      text = text.split(`"${spec}"`).join(`"./${childBase}"`);
      text = text.split(`'${spec}'`).join(`'./${childBase}'`);
    }
    fs.writeFileSync(path.join(vendorDir, base), text);
    return base;
  }

  const entryFiles = [];
  for (const url of entryUrls) entryFiles.push(await visit(url));
  return entryFiles;
}

function uiSubpathPlugin() {
  return {
    name: "ui-subpath",
    setup(build) {
      build.onResolve({ filter: /^react($|\/)/ }, () => ({
        path: RUNTIME_HREF,
        external: true,
      }));
      build.onResolve({ filter: /^react-dom($|\/)/ }, () => ({
        path: RUNTIME_HREF,
        external: true,
      }));
      build.onResolve({ filter: /^@monkey-mini-app\/ui$/ }, () => ({
        path: path.join(uiDist, "index.js"),
      }));
      build.onResolve({ filter: /^@monkey-mini-app\/ui\// }, (args) => {
        const rel = args.path.slice("@monkey-mini-app/ui/".length);
        for (const ext of [".tsx", ".ts", ".jsx", ".js"]) {
          const c = path.join(uiDist, "src", rel + ext);
          if (fs.existsSync(c)) return { path: c };
        }
        for (const idx of ["index.tsx", "index.ts", "index.js"]) {
          const c = path.join(uiDist, "src", rel, idx);
          if (fs.existsSync(c)) return { path: c };
        }
        return { errors: [{ text: `could not resolve ${args.path}` }] };
      });
    },
  };
}

async function buildRuntime(esbuild, ver) {
  const entries = await vendorEsm([
    `${ESM_ORIGIN}/react@${ver}?target=es2022`,
    `${ESM_ORIGIN}/react-dom@${ver}?target=es2022`,
    `${ESM_ORIGIN}/react-dom@${ver}/client?target=es2022`,
    `${ESM_ORIGIN}/react@${ver}/jsx-runtime?target=es2022`,
  ]);
  // export * from both react and jsx-runtime drops `Fragment` (duplicate). Compose packages instead.
  const [reactFile, domFile, clientFile, jsxFile] = entries;
  const barrel =
    `export * from ${JSON.stringify("./" + reactFile)};\n` +
    `export { default } from ${JSON.stringify("./" + reactFile)};\n` +
    `export * from ${JSON.stringify("./" + domFile)};\n` +
    `export { createRoot, hydrateRoot } from ${JSON.stringify("./" + clientFile)};\n` +
    `export { jsx, jsxs } from ${JSON.stringify("./" + jsxFile)};\n`;
  const barrelPath = path.join(vendorDir, "_entry.js");
  fs.writeFileSync(barrelPath, barrel);
  const outfile = path.join(distDir, "runtime.js");
  await esbuild.build({
    entryPoints: [barrelPath],
    outfile,
    absWorkingDir: vendorDir,
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2020",
    write: true,
    minify: true,
    legalComments: "none",
    logLevel: "warning",
  });
  fs.rmSync(vendorDir, { recursive: true, force: true });
  const js = fs.readFileSync(outfile, "utf8");
  for (const name of ["memo", "useLayoutEffect", "useState", "createRoot", "jsx"]) {
    const exported =
      js.includes(`as ${name}`) ||
      new RegExp(`\\b${name}\\s*,`).test(js) ||
      js.includes(`${name} as`) ||
      new RegExp(`export\\{[^}]*\\b${name}\\b`).test(js);
    if (!exported && !js.includes(name)) {
      throw new Error(`[build-sdk] runtime.js missing ${name}`);
    }
  }
  // Must be real ESM named exports, not just the identifier in CJS body
  if (!/export\{/.test(js) && !/export \{/.test(js) && !/as memo/.test(js)) {
    throw new Error("[build-sdk] runtime.js has no ESM export block");
  }
  // esbuild `export *` sometimes drops React's `version`. @tiptap/react imports it.
  let out = js;
  if (!/\bas version\b/.test(out) && !/export\{[^}]*\bversion\b/.test(out)) {
    const lit = JSON.stringify(ver);
    if (!/export\{([^}]+)\};?\s*$/.test(out)) {
      throw new Error("[build-sdk] runtime.js export block not at EOF; cannot inject version");
    }
    out = out.replace(/export\{([^}]+)\};?\s*$/, (_, names) => {
      return `var __mmaReactVersion=${lit};export{${names},__mmaReactVersion as version};
`;
    });
    fs.writeFileSync(outfile, out);
  }
  return fs.statSync(outfile).size;
}

async function buildSdk(esbuild) {
  const outfile = path.join(distDir, "sdk.js");
  await esbuild.build({
    entryPoints: [path.join(sdkRoot, "src/index.ts")],
    outfile,
    absWorkingDir: sdkRoot,
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2020",
    write: true,
    minify: true,
    legalComments: "none",
    logLevel: "warning",
    jsx: "automatic",
    loader: { ".tsx": "tsx", ".ts": "ts", ".jsx": "jsx", ".js": "js" },
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [uiSubpathPlugin()],
    // CJS deps (recharts etc.) emit require("/mma/runtime.js"). Provide it from the ESM runtime.
    banner: {
      js:
        `import * as __MMA_RT from ${JSON.stringify(RUNTIME_HREF)};` +
        `function require(n){if(n===${JSON.stringify(RUNTIME_HREF)})return __MMA_RT.default??__MMA_RT;throw Error("Dynamic require of "+n+" is not supported")}`,
    },
  });
  const js = fs.readFileSync(outfile, "utf8");
  if (!js.includes("useApp") || !js.includes(RUNTIME_HREF)) {
    throw new Error("[build-sdk] sdk.js missing useApp or runtime import");
  }
  return fs.statSync(outfile).size;
}

async function main() {
  if (!fs.existsSync(path.join(uiDist, "index.js"))) {
    throw new Error("[build-sdk] packages/ui/dist missing — run: node scripts/build/ui.mjs");
  }
  fs.mkdirSync(distDir, { recursive: true });
  const ver = reactVersion();
  const esbuild = await import("esbuild");
  const t0 = Date.now();
  const runtimeBytes = await buildRuntime(esbuild, ver);
  const sdkBytes = await buildSdk(esbuild);
  console.log(
    `[build-sdk] react@${ver} runtime.js ${(runtimeBytes / 1024 / 1024).toFixed(2)}MB · sdk.js ${(sdkBytes / 1024 / 1024).toFixed(2)}MB in ${Date.now() - t0}ms`,
  );
}

main().catch((e) => {
  console.error("[build-sdk] FAIL", e);
  process.exit(1);
});
