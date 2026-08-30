import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { bootstrapHostConfig, createHost, type HostServices, type Host } from "@monkey-mini-app/host";

export type TemplateFiles = Record<string, string>;

export function templateDir(name: string): string {
  return path.join("packages/dsh/skills/monkey-mini-app/templates", name);
}

export function readTemplate(name: string): TemplateFiles {
  const base = templateDir(name);
  const files: TemplateFiles = {};
  const walk = (d: string, pre: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      const rel = pre ? `${pre}/${e.name}` : e.name;
      if (e.isDirectory()) walk(full, rel);
      else files[rel] = readFileSync(full, "utf8");
    }
  };
  walk(base, "");
  return files;
}

export const TEMPLATES = ["minimal", "todo", "monitor", "review", "insights", "agentrun", "jira"] as const;

export function templateId(name: string): string {
  const m = JSON.parse(readFileSync(path.join(templateDir(name), "manifest.json"), "utf8"));
  return m.id as string;
}

export async function startHost(port = 0): Promise<{ host: Host; root: string; services: HostServices }> {
  const root = mkdtempSync(path.join(tmpdir(), "mma-smoke-"));
  let services: HostServices | undefined;
  const host = createHost({ listTools: () => [] }, { attach: (_c, s) => { services = s; } }, {
    config: bootstrapHostConfig({ runtimeRoot: root, hostPort: port }),
  });
  await host.apply();
  if (!services) throw new Error("attach did not provide services");
  return { host, root, services };
}
