#!/usr/bin/env node
/**
 * One-shot post-refactor gate: build → skill → templates → lint → tsc → tests.
 * Fail-fast; prints which step broke.
 *
 * Inputs:       monorepo (needs network once if iframe React bundle is cold)
 * Writes:       packages/ui/dist, packages/api/dist; skill contracts if gen runs
 * Side effects: repo build output + may rewrite skills/.../references (gen:skill)
 * Run as:       pnpm verify
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** @type {{ name: string, cmd: string, args: string[] }[]} */
const STEPS = [
  { name: "build:ui", cmd: "pnpm", args: ["build:ui"] },
  { name: "build:sdk", cmd: "pnpm", args: ["build:sdk"] },
  { name: "build:api", cmd: "pnpm", args: ["build:api"] },
  { name: "skill (gen + check)", cmd: "pnpm", args: ["skill"] },
  { name: "check:templates", cmd: "pnpm", args: ["check:templates"] },
  { name: "lint", cmd: "pnpm", args: ["lint"] },
  { name: "typecheck (tsc -b)", cmd: "pnpm", args: ["typecheck"] },
  {
    name: "typecheck skill templates",
    cmd: "pnpm",
    args: ["exec", "tsc", "-p", "skills/monkey-mini-app", "--pretty", "false"],
  },
  { name: "test", cmd: "pnpm", args: ["test"] },
  {
    name: "dsh build",
    cmd: "pnpm",
    args: ["--filter", "@monkey-mini-app/dsh-mini-app", "build"],
  },
];

if (process.argv.includes("--coverage")) {
  STEPS.push({ name: "test:coverage", cmd: "pnpm", args: ["test:coverage"] });
}

const t0 = Date.now();
const results = [];

console.log(`\nverify — ${STEPS.length} steps (cwd ${root})\n`);

for (let i = 0; i < STEPS.length; i++) {
  const step = STEPS[i];
  const label = `[${i + 1}/${STEPS.length}] ${step.name}`;
  console.log(`\n▸ ${label}\n`);
  const started = Date.now();
  const res = spawnSync(step.cmd, step.args, {
    cwd: root,
    stdio: "inherit",
    env: process.env,
    shell: false,
  });
  const ms = Date.now() - started;
  if (res.error) {
    console.error(`\n✗ ${label} — spawn failed: ${res.error.message}\n`);
    process.exit(1);
  }
  if (res.status !== 0) {
    console.error(`\n✗ ${label} — exit ${res.status} (${(ms / 1000).toFixed(1)}s)`);
    console.error(`  re-run: ${step.cmd} ${step.args.join(" ")}\n`);
    process.exit(res.status ?? 1);
  }
  results.push({ name: step.name, ms });
  console.log(`\n✓ ${label} (${(ms / 1000).toFixed(1)}s)`);
}

const total = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`\nverify ok — ${results.length} steps in ${total}s\n`);
for (const r of results) {
  console.log(`  ✓ ${r.name.padEnd(28)} ${(r.ms / 1000).toFixed(1)}s`);
}
console.log("");
