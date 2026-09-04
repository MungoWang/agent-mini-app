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
 *     `packages/panel/src` outside it: 64 × ts(6059) in the editor, 0 in CI
 *   - `packages/ui` was in neither the aggregate `include` nor `eslint`'s paths, so nothing
 *     at all typechecked it: 86 latent errors (mostly jest-dom matchers, whose augmentation
 *     lands on an interface vitest 2.x only re-exports)
 *
 * So: run each config with the settings its own users get. A new package with a
 * `tsconfig.json` is picked up automatically — that is the point, and it is why this walks the
 * tree instead of repeating a list.
 *
 * Inputs:       the root tsconfig.json, plus every packages/<name>/tsconfig.json and
 *               skills/<name>/tsconfig.json that exists
 * Writes:       nothing
 * Side effects: none — exit 1 means some config disagrees
 * Run as:       pnpm typecheck (and inside `pnpm verify`)
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** @type {{ label: string, project: string, build?: boolean }[]} */
const projects = [{ label: "root (aggregate)", project: ".", build: true }];

for (const dir of ["packages", "skills"]) {
  const base = path.join(root, dir);
  for (const name of readdirSync(base).sort()) {
    const rel = path.join(dir, name);
    if (!statSync(path.join(base, name)).isDirectory()) continue;
    if (!existsSync(path.join(root, rel, "tsconfig.json"))) continue;
    projects.push({ label: rel, project: rel });
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
  console.log("each config is what an editor's TS server uses for those files; fix the config or the code, not this gate");
  process.exit(1);
}
console.log(`\ntypecheck ok — ${projects.length} configs in ${total}s`);
