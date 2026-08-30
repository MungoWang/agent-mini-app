import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const skill = path.join(here, "..", "dsh", "skills", "monkey-mini-app");

describe("S6 · skill artifacts stay in sync with the UI lib", () => {
  it("ships a catalog + contracts for every skill component", () => {
    const catalog = readFileSync(path.join(skill, "references", "catalog.md"), "utf8");
    expect(catalog).toContain("AppShell");
    expect(catalog).toContain("Kanban");
    const contractsDir = path.join(skill, "references", "contracts");
    expect(readdirSync(contractsDir).length).toBeGreaterThan(50);
    // key contracts the flagship template needs must exist
    for (const c of ["app-shell.md", "page-header.md", "kanban.md", "data-grid.md", "filter-bar.md", "detail-panel.md"]) {
      expect(readFileSync(path.join(contractsDir, c), "utf8").length).toBeGreaterThan(100);
    }
  });

  it("references the templates README + all 7 templates", () => {
    const templates = readdirSync(path.join(skill, "templates")).filter((n) => !n.endsWith(".md") && !n.startsWith("."));
    expect(templates.sort()).toEqual(["agentrun", "insights", "jira", "minimal", "monitor", "review", "todo"]);
    const readme = readFileSync(path.join(skill, "templates", "README.md"), "utf8");
    for (const t of templates) expect(readme).toContain(`./${t}/`);
  });

  it("documents the Icon namespace + Illu illustrations reachable from the ui lib", () => {
    const iconRef = readFileSync(path.join(skill, "references", "icons.md"), "utf8");
    expect(iconRef).toContain("import { Icon } from \"@monkey-mini-app/ui\"");
    expect(iconRef).toContain("lucide");
  });
});
