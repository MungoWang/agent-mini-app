/**
 * Type-check every skill template (`skills/monkey-mini-app/templates/**`).
 *
 * Templates import exactly one platform package — `@monkey-mini-app/sdk` — for both
 * sides (`useApp` + components in `ui.tsx`, `defineApp` in `main.api.ts`). Nothing is
 * virtual anymore: the SDK's real sources provide the types, so this script only maps
 * the workspace packages to source and runs `tsc` with a throwaway config under
 * `packages/dsh/.tpl-check/` (deleted in `finally`). Only diagnostics **inside the
 * templates** fail the gate — `packages/ui` internals (CDN `https://esm.sh/*` imports
 * by design) belong to their own build project and are reported as a note.
 *
 * Usage: `pnpm check:templates`
 *
 * Inputs:       skills/monkey-mini-app/templates/**, packages/{sdk,ui}/src
 * Writes:       packages/dsh/.tpl-check/ (removed in `finally`)
 * Side effects: temp directory only
 * Run as:       pnpm check:templates
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const tplDir = path.join(root, "skills/monkey-mini-app/templates");
const dshDir = path.join(root, "packages/dsh");
const uiSrc = path.join(root, "packages/ui/src");
const sdkSrc = path.join(root, "packages/sdk/src");

// Live inside the monorepo so tsc can resolve react + ui's deps via node_modules,
// but under a dot-dir that the script always deletes (finally).
const checkDir = path.join(dshDir, ".tpl-check");

rmSync(checkDir, { recursive: true, force: true });
mkdirSync(checkDir, { recursive: true });

try {
  // ui's on-demand CDN imports (CodeMirror / shiki via esm.sh) have no local types by
  // design; the shorthand ambient module keeps them `any` so the note list stays short.
  writeFileSync(
    path.join(checkDir, "cdn.d.ts"),
    `declare module "https://esm.sh/*";\n`,
  );

  const tsconfig = {
    compilerOptions: {
      target: "esnext",
      module: "esnext",
      moduleResolution: "bundler",
      jsx: "react-jsx",
      strict: true,
      noImplicitAny: false,
      skipLibCheck: true,
      noEmit: true,
      resolveJsonModule: true,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      types: [],
      baseUrl: ".",
      paths: {
        "@monkey-mini-app/sdk": [path.join(sdkSrc, "index.ts")],
        "@monkey-mini-app/sdk/*": [path.join(sdkSrc, "*")],
        "@monkey-mini-app/ui": [path.join(uiSrc, "index.ts")],
        "@monkey-mini-app/ui/*": [path.join(uiSrc, "*")],
      },
    },
    include: [
      path.join(tplDir, "**/*.ts"),
      path.join(tplDir, "**/*.tsx"),
      path.join(checkDir, "cdn.d.ts"),
    ],
  };
  writeFileSync(path.join(checkDir, "tsconfig.json"), JSON.stringify(tsconfig, null, 2));

  const res = spawnSync("pnpm", ["exec", "tsc", "-p", path.join(checkDir, "tsconfig.json"), "--pretty", "false"], {
    cwd: root,
    encoding: "utf8",
  });
  const out = `${res.stdout ?? ""}${res.stderr ?? ""}`;

  // The gate is about the **templates**. Type errors surfacing inside `packages/ui`
  // (CDN imports by design, etc.) are printed but must not make the check red —
  // those files have their own build project.
  // tsc writes: `path/to/file.tsx(12,34): error TS2339: message`
  const DIAG = /^(.*?\.(?:tsx?|jsx?|mjs|cjs))\((\d+),(\d+)\): (error|warning)\s+(.*)$/gm;
  const mine: string[] = [];
  const theirs: string[] = [];
  for (const m of out.matchAll(DIAG)) {
    const line = `${path.relative(root, m[1])}(${m[2]},${m[3]}): ${m[4]} ${m[5]}`;
    (path.resolve(m[1]).startsWith(tplDir + path.sep) ? mine : theirs).push(line);
  }

  // Never trust a silent pass: tsc failing to spawn, or dying on a bad config, must be loud.
  if (res.error) throw res.error;
  if (res.status !== 0 && !mine.length && !theirs.length) {
    throw new Error(`tsc exited ${res.status} without diagnostics:\n${out}`);
  }

  if (theirs.length) {
    console.log(`\n[check:templates] note — ${theirs.length} error(s) outside the templates (ui/sdk internals, not gated):`);
    for (const l of theirs.slice(0, 5)) console.log(`  ${l}`);
    if (theirs.length > 5) console.log(`  … ${theirs.length - 5} more`);
  }

  if (mine.length) {
    console.error(`\n[check:templates] ❌ ${mine.length} error(s) in the templates:`);
    for (const l of mine) console.error(`  ${l}`);
    process.exitCode = 1;
  } else {
    console.log("\n[check:templates] ✅ all templates type-check");
  }
} finally {
  rmSync(checkDir, { recursive: true, force: true });
}
