#!/usr/bin/env node
/**
 * Typecheck every TypeScript **project configuration in the repo**, not just the one CI
 * happened to use.
 *
 * Why this exists: `pnpm typecheck` used to be a bare `tsc -b`, which resolves to the root
 * `tsconfig.json` — a single aggregate project with its own `lib`/`rootDir` and a
 * hand-maintained `include` list. Every package also carries its own `tsconfig.json`, and
 * that is what an editor's TS server picks when you open a file. The two disagreed silently:
 *
 *   - `packages/host` had no `DOM` lib while the aggregate did → a jsdom test was red in the
 *     editor and green in CI
 *   - `packages/dsh` left `rootDir` unspecified → the TS server inferred `packages/dsh`, and
 *     `tsconfig.base.json`'s `paths` mapping `@monkey-mini-app/*` to sibling **source** pulled
 *     `packages/panel/src` outside it: 64 × ts(6059) in the editor, 0 in CLI (which infers
 *     rootDir from the resolved file set)
 *   - `packages/ui` was in neither the aggregate `include` nor `eslint`'s paths, so nothing
 *     typechecked it at all: 86 latent errors
 *   - `apps/*` were in no config either, and `apps/demo-host/tsconfig.json` is a **solution**
 *     file (`files: []` + `references`) — running `tsc -p` on it checks nothing and exits 0
 *
 * So: walk the tree, expand solution configs into their references, and run each result with
 * the options its own users get. A new package/app with a tsconfig is covered without anyone
 * remembering — that is why this walks instead of repeating a list.
 *
 * Inputs:       the root tsconfig.json, plus every packages/<name>, apps/<name> and
 *               skills/<name> that owns one (solution configs are expanded, never trusted)
 * Writes:       nothing
 * Side effects: none — exit 1 means some config disagrees
 * Run as:       pnpm typecheck (and inside `pnpm verify`)
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * tsconfig accepts comments and trailing commas, so `JSON.parse` alone cannot read one. This
 * strips both outside string literals — enough for the keys we inspect, with no dependency.
 */
function readJsonc(file) {
  const text = readFileSync(file, "utf8");
  let out = "";
  let inString = false;
  let inLine = false;
  let inBlock = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inLine) {
      if (ch === "\n") inLine = false;
      continue;
    }
    if (inBlock) {
      if (ch === "*" && next === "/") {
        inBlock = false;
        i++;
      }
      continue;
    }
    if (inString) {
      if (ch === "\\") {
        out += ch + (next ?? "");
        i++;
      } else {
        if (ch === '"') inString = false;
        out += ch;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === "/" && next === "/") {
      inLine = true;
      continue;
    }
    if (ch === "/" && next === "*") {
      inBlock = true;
      continue;
    }
    out += ch;
  }
  return JSON.parse(out.replace(/,\s*([}\]])/g, "$1"));
}

/** @type {{ label: string, project: string, build?: boolean }[]} */
const projects = [{ label: "root (aggregate)", project: ".", build: true }];

/**
 * Register one directory's config. A solution file contributes **its references**, never
 * itself: `tsc -p` on a solution config is a silent pass, and a green row that checked nothing
 * is worse than no row.
 */
function collect(dirRel, seen) {
  const cfgAbs = path.join(root, dirRel, "tsconfig.json");
  if (!existsSync(cfgAbs)) return;

  let cfg;
  try {
    cfg = readJsonc(cfgAbs);
  } catch (e) {
    // Unreadable still has to be attempted by tsc itself, which will report the real error.
    projects.push({ label: `${dirRel} (unparseable: ${e.message})`, project: dirRel });
    return;
  }

  const refs = Array.isArray(cfg.references) ? cfg.references : [];
  const ownsFiles = (cfg.files?.length ?? 0) > 0 || (cfg.include?.length ?? 0) > 0;
  if (ownsFiles) {
    projects.push({ label: dirRel, project: dirRel });
    return;
  }
  for (const ref of refs) {
    const target = path.normalize(path.join(dirRel, ref.path));
    if (seen.has(target)) continue;
    seen.add(target);
    projects.push({ label: target, project: target });
  }
}

const seen = new Set();
for (const dir of ["packages", "apps", "skills"]) {
  const base = path.join(root, dir);
  if (!existsSync(base)) continue;
  for (const name of readdirSync(base).sort()) {
    if (!statSync(path.join(base, name)).isDirectory()) continue;
    collect(path.join(dir, name), seen);
  }
}

const t0 = Date.now();
const failed = [];

console.log(`\ntypecheck — ${projects.length} configs (each with its own options)\n`);

for (const [i, p] of projects.entries()) {
  const started = Date.now();
  // The aggregate keeps `tsc -b` so its incremental build-info behaviour is unchanged.
  const args = p.build
    ? ["exec", "tsc", "-b", "--pretty", "false"]
    : ["exec", "tsc", "-p", p.project, "--noEmit", "--pretty", "false"];
  const res = spawnSync("pnpm", args, { cwd: root, encoding: "utf8" });
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  const errors = (res.stdout || "").split("\n").filter((l) => l.includes("error TS"));
  const label = `[${i + 1}/${projects.length}] ${p.label}`;

  if (res.status !== 0 || errors.length) {
    failed.push({ label: p.label, errors, tail: (res.stderr || "").trim() });
    console.log(`  ✗ ${label} — ${errors.length || "?"} errors (${secs}s)`);
  } else {
    console.log(`  ✓ ${label} (${secs}s)`);
  }
}

for (const f of failed) {
  console.log(`\n── ${f.label} ──`);
  for (const line of f.errors.slice(0, 40)) console.log(line);
  if (f.errors.length > 40) console.log(`… ${f.errors.length - 40} more`);
  if (f.tail) console.log(f.tail);
}

const total = ((Date.now() - t0) / 1000).toFixed(1);
if (failed.length) {
  console.log(
    `\ntypecheck FAILED — ${failed.length}/${projects.length} config(s) disagree (${total}s)`,
  );
  console.log(
    "each config is what an editor's TS server uses for those files; fix the config or the code, not this gate",
  );
  process.exit(1);
}
console.log(`\ntypecheck ok — ${projects.length} configs in ${total}s`);
