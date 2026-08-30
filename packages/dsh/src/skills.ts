import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Package-shipped skill tree: packages/dsh/skills/monkey-mini-app
 * Resolves next to this package (src/ or lib/).
 */
function resolveSkillDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
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
  const walk = (dir: string, prefix: string): void => {
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
