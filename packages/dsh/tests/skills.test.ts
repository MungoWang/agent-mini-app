import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { getSkeletonTemplateFiles, getSkillDir, getSkillMarkdown } from "../src/skills.ts";

describe("skills path", () => {
  it("resolves SKILL.md (repo skills/ or packaged copy)", () => {
    const dir = getSkillDir();
    expect(existsSync(path.join(dir, "SKILL.md"))).toBe(true);
    expect(dir.replace(/\\/g, "/")).toMatch(/skills\/monkey-mini-app$/);
    expect(getSkillMarkdown()).toContain("mini_app_register");
  });

  it("loads the minimal skeleton template files", () => {
    const files = getSkeletonTemplateFiles();
    expect(files["manifest.json"]).toBeTruthy();
    expect(files["ui.tsx"]).toBeTruthy();
    expect(files["main.api.ts"]).toBeTruthy();
    expect(JSON.parse(files["manifest.json"] as string)).toHaveProperty("id");
  });

  it("package.json files field includes skills", () => {
    const pkg = JSON.parse(
      readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "package.json"), "utf8"),
    ) as { files: string[] };
    expect(pkg.files).toContain("skills");
    expect(pkg.files).toContain("lib");
  });
});
