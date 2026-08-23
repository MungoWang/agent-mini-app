import { readFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as path from "node:path";

/**
 * Single source of truth: packages/dsh-plugin/skills/monkey-mini-app
 * This package only resolves + reads that tree (no second copy).
 */
function resolveSkillDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    // from agent-skills/src or dist → ../../dsh-plugin/skills/monkey-mini-app
    path.join(here, "..", "..", "dsh-plugin", "skills", "monkey-mini-app"),
    // from dsh-plugin/lib (bundled alias may land here relative)
    path.join(here, "..", "skills", "monkey-mini-app"),
    path.join(here, "..", "..", "skills", "monkey-mini-app"),
  ];
  for (const c of candidates) {
    if (existsSync(path.join(c, "SKILL.md"))) return c;
  }
  return candidates[0]!;
}

export function getSkillDir(): string {
  return resolveSkillDir();
}

export function getSkillMarkdown(): string {
  return readFileSync(path.join(resolveSkillDir(), "SKILL.md"), "utf8");
}

/** Load all files under a named template as path → content (relative to template root). */
export function getTemplateFiles(name: string): Record<string, string> {
  const base = path.join(resolveSkillDir(), "templates", name);
  if (!existsSync(base)) throw new Error(`template not found: ${name} under ${resolveSkillDir()}`);
  const out: Record<string, string> = {};
  const walk = (dir: string, prefix: string) => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full, rel);
      else out[rel] = readFileSync(full, "utf8");
    }
  };
  walk(base, "");
  return out;
}

export function getHelloTemplateFiles(): Record<string, string> {
  return getTemplateFiles("hello");
}
