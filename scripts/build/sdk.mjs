#!/usr/bin/env node
/**
 * Build the iframe platform into packages/ui/dist:
 *   runtime.js — complete React ESM (vendored from esm.sh, then bundled)
 *   sdk.js     — UI kit + useApp; react* is external → /mma/runtime.js
 *   (served as /mma/runtime.js and /mma/sdk.js — href names kept for stability)
 *
 * Requires packages/ui/dist/index.js (run build:ui first). esm.sh is fetched **once per
 * React version** and kept in a persistent cache, so rebuilds and `npm publish` work
 * offline; a content fingerprint of the built kit skips the whole step when nothing moved.
 *
 * Flags:        --force    rebuild even when the fingerprint matches (still cached)
 *               --refresh  also ignore the cache and re-download from esm.sh
 *               --offline  never touch the network; fail if something is uncached
 *
 * Inputs:       packages/ui/dist (flat kit + src), esm.sh (cached)
 * Writes:       packages/ui/dist/{runtime.js,sdk.js},
 *               node_modules/.cache/monkey-mini-app/{esm.sh/**,iframe-stamp.json}
 * Run as:       pnpm build:sdk — also part of @monkey-mini-app/ui prepack
 */
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "..");
const uiRoot = path.join(root, "packages/ui");
const uiDist = path.join(uiRoot, "dist");
const distDir = uiDist; // iframe bundles live next to the kit flat export
const vendorDir = path.join(distDir, ".esm"); // scratch copy of this build's modules
const cacheDir = path.join(root, "node_modules/.cache/monkey-mini-app/esm.sh"); // persistent
const stampFile = path.join(root, "node_modules/.cache/monkey-mini-app/iframe-stamp.json");
const RUNTIME_HREF = "/mma/runtime.js";
const ESM_ORIGIN = "https://esm.sh";

const flags = new Set(process.argv.slice(2));
const FORCE = flags.has("--force");
const REFRESH = flags.has("--refresh");
const OFFLINE = flags.has("--offline");

function reactVersion() {
  const req = createRequire(path.join(uiRoot, "package.json"));
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

let cacheHits = 0;
let cacheMisses = 0;

function cacheFile(url) {
  return path.join(cacheDir, localName(url));
}

/** Transient CDN/proxy blips must not kill a publish: back off and retry. */
async function fetchText(url) {
  const cf = cacheFile(url);
  if (!REFRESH && fs.existsSync(cf)) {
    cacheHits++;
    return fs.readFileSync(cf, "utf8");
  }
  if (OFFLINE) {
    throw new Error(
      `[build-sdk] --offline and ${url} is not cached\n` +
        `  warm the cache once on a networked machine: pnpm build:sdk --force`,
    );
  }
  cacheMisses++;
  let last;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      fs.mkdirSync(cacheDir, { recursive: true });
      fs.writeFileSync(cf, text);
      return text;
    } catch (cause) {
      last = cause;
      const wait = 500 * 2 ** attempt;
      console.warn(`[build-sdk] GET ${url} attempt ${attempt}/3 failed (${cause.cause?.code || cause.message}); retrying in ${wait}ms`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw new Error(`[build-sdk] GET ${url} failed after 3 attempts: ${last?.cause?.code || last?.message || last}`);
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
    entryPoints: [path.join(uiDist, "index.js")],
    outfile,
    absWorkingDir: uiRoot,
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

/** Everything that can change the iframe output: the built kit barrel + its sources. */
function fingerprint() {
  const h = crypto.createHash("sha256");
  h.update(fs.readFileSync(path.join(uiDist, "index.js")));
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else {
        h.update(ent.name);
        h.update(fs.readFileSync(full));
      }
    }
  };
  const srcDir = path.join(uiDist, "src");
  if (fs.existsSync(srcDir)) walk(srcDir);
  return h.digest("hex");
}

function stampIsCurrent(fp, ver) {
  if (FORCE) return false;
  if (!fs.existsSync(path.join(distDir, "runtime.js")) || !fs.existsSync(path.join(distDir, "sdk.js"))) return false;
  try {
    const s = JSON.parse(fs.readFileSync(stampFile, "utf8"));
    return s.fingerprint === fp && s.reactVersion === ver;
  } catch {
    return false;
  }
}

async function main() {
  if (!fs.existsSync(path.join(uiDist, "index.js"))) {
    throw new Error("[build-sdk] packages/ui/dist missing — run: node scripts/build/ui.mjs");
  }
  fs.mkdirSync(distDir, { recursive: true });
  const ver = reactVersion();
  if (REFRESH) {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    console.log("[build-sdk] --refresh: esm.sh cache cleared");
  }

  const fp = fingerprint();
  if (stampIsCurrent(fp, ver)) {
    const kb = (f) => (fs.statSync(path.join(distDir, f)).size / 1024).toFixed(0);
    console.log(
      `[build-sdk] up to date (react@${ver}, ${kb("runtime.js")}KB + ${kb("sdk.js")}KB) — skipped; --force to rebuild`,
    );
    return;
  }
  const esbuild = await import("esbuild");
  const t0 = Date.now();
  const runtimeBytes = await buildRuntime(esbuild, ver);
  const sdkBytes = await buildSdk(esbuild);
  fs.mkdirSync(path.dirname(stampFile), { recursive: true });
  fs.writeFileSync(
    stampFile,
    JSON.stringify({ fingerprint: fp, reactVersion: ver, builtAt: new Date().toISOString() }, null, 2) + "\n",
  );
  console.log(
    `[build-sdk] react@${ver} runtime.js ${(runtimeBytes / 1024 / 1024).toFixed(2)}MB · sdk.js ${(sdkBytes / 1024 / 1024).toFixed(2)}MB in ${Date.now() - t0}ms` +
      ` · esm.sh ${cacheHits} cached / ${cacheMisses} fetched`,
  );
}

main().catch((e) => {
  console.error("[build-sdk] FAIL", e);
  process.exit(1);
});
