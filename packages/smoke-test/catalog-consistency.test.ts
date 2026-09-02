import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..", "..");
// Canonical skill — `packages/<adapter>/skills/**` is a copy that only exists
// between prepack/postpack, so it must not be the thing we assert on.
const skill = path.join(root, "skills", "monkey-mini-app");
const contracts = path.join(skill, "references", "contracts");
const catalog = path.join(skill, "references", "catalog.md");

describe("S6 · skill artifacts stay in sync with the UI lib", () => {
  it("uses the canonical skill dir", () => {
    expect(existsSync(path.join(skill, "SKILL.md"))).toBe(true);
  });

  it("ships a catalog + contracts for every skill component", () => {
    const text = readFileSync(catalog, "utf8");
    for (const name of ["AppShell", "Kanban", "DataGrid", "Button", "Dialog"]) {
      expect(text).toContain(name);
    }
    const files = readdirSync(contracts).filter((f) => f.endsWith(".md"));
    // 75 blocks/composites/products + one doc per L1 primitive module
    expect(files.length).toBeGreaterThan(100);
    // key contracts the flagship template needs must exist and be non-trivial
    for (const c of [
      "app-shell.md",
      "page-header.md",
      "kanban.md",
      "data-grid.md",
      "filter-bar.md",
      "detail-panel.md",
    ]) {
      expect(readFileSync(path.join(contracts, c), "utf8").length).toBeGreaterThan(100);
    }
  });

  it("groups the catalog by functional family from the ui vocabulary", () => {
    const vocab: { families: { name: string }[] } = JSON.parse(
      readFileSync(path.join(root, "packages/ui/catalog-families.json"), "utf8")
    );
    const registry: { components: Record<string, { family: string }> } = JSON.parse(
      readFileSync(path.join(root, "packages/ui/ai/catalog.json"), "utf8")
    );
    const names = vocab.families.map((f) => f.name);
    const entries = Object.entries(registry.components);
    expect(entries.length).toBeGreaterThan(100);
    for (const [component, meta] of entries) {
      expect(names, `${component} has an unknown family`).toContain(meta.family);
    }
    const text = readFileSync(catalog, "utf8");
    const sections = [...text.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim());
    for (const family of names) expect(sections, `catalog lost "${family}"`).toContain(family);
    expect(sections).not.toContain("⚠ Unclassified");
  });

  it("documents the Icon namespace + Illu illustrations reachable from the SDK", () => {
    const iconRef = readFileSync(path.join(skill, "references", "icons.md"), "utf8");
    expect(iconRef).toContain('import { Icon } from "@monkey-mini-app/sdk"');
    expect(iconRef).toContain("lucide");
    // Illu* names are not guessable — the full set must be listed
    const illos = [...iconRef.matchAll(/`Illu([A-Za-z]+)`/g)].map((m) => `Illu${m[1]}`);
    const source = readFileSync(path.join(root, "packages/ui/src/lib/illustrations.tsx"), "utf8");
    const real = [...source.matchAll(/export function (Illu[A-Za-z]+)/g)].map((m) => m[1]).sort();
    expect([...new Set(illos)].sort()).toEqual(real);
  });

  it("references the templates README + all 7 templates", () => {
    const templates = readdirSync(path.join(skill, "templates"))
      .filter((n) => !n.endsWith(".md") && !n.startsWith("."));
    expect(templates.sort()).toEqual([
      "agentrun",
      "insights",
      "jira",
      "minimal",
      "monitor",
      "review",
      "todo",
    ]);
    const readme = readFileSync(path.join(skill, "templates", "README.md"), "utf8");
    for (const t of templates) expect(readme).toContain(`./${t}/`);
  });

  it("passes the skill gate (specifiers, ctx.*, tool names, tables, taxonomy)", () => {
    // scripts/check/skill.mjs is the single source of truth for these rules.
    expect(() =>
      execFileSync(process.execPath, ["scripts/check/skill.mjs"], {
        cwd: root,
        stdio: "pipe",
      })
    ).not.toThrow();
  });
});
