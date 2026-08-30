import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  bootstrapHostConfig,
  createHost,
  type HostServices,
} from "@monkey-mini-app/host";

function skillRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.join(here, "..", "dsh", "skills", "monkey-mini-app");
}

function readTemplateFiles(name: string): Record<string, string> {
  const base = path.join(skillRoot(), "templates", name);
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

describe("headless skill templates", () => {
  it("registers minimal + todo templates via AppsManager", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "mma-samples-"));
    let services: HostServices | undefined;
    const host = createHost(
      { listTools: () => [] },
      {
        attach: (_c, s) => {
          services = s;
        },
      },
      { config: bootstrapHostConfig({ runtimeRoot: root, hostPort: 0 }) },
    );
    await host.apply();
    const { apps, tools } = services!;

    const skillMarkdown = readFileSync(path.join(skillRoot(), "SKILL.md"), "utf8");
    expect(skillMarkdown).toContain("monkey-mini-app");
    expect(tools.definitions().length).toBeGreaterThan(5);

    await apps.register("com.example.minimal", readTemplateFiles("minimal"));
    await apps.register("com.example.todo", readTemplateFiles("todo"));

    const list = await apps.list();
    expect(list.map((a) => a.id).sort()).toEqual([
      "com.example.minimal",
      "com.example.todo",
    ]);

    // minimal exposes its own api keys — call the real one and assert a shape
    const ping = (await apps.call("com.example.minimal", "ping", {})) as { appId?: string; theme?: string };
    expect(ping.appId).toBe("com.example.minimal");
    expect(typeof ping.theme).toBe("string");

    await host.stop();
  }, 60_000);
});
