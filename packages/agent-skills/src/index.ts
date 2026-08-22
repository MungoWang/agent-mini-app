import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as path from "node:path";

function resolveSkillDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    // agent-skills package layout: dist/ or src/ → ../skills
    path.join(here, "..", "skills", "monkey-mini-app"),
    // bundled into dsh-plugin/lib → ../skills
    path.join(here, "..", "skills", "monkey-mini-app"),
    // monorepo sibling from dsh-plugin/lib
    path.join(here, "..", "..", "agent-skills", "skills", "monkey-mini-app"),
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

export function getHelloTemplateFiles(): Record<string, string> {
  const base = path.join(resolveSkillDir(), "templates", "hello");
  return {
    "manifest.json": readFileSync(path.join(base, "manifest.json"), "utf8"),
    "App.tsx": readFileSync(path.join(base, "App.tsx"), "utf8"),
  };
}
