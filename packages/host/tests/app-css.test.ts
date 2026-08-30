import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { bootstrapHostConfig, createHost, type HostServices } from "@monkey-mini-app/host";

const api = `import { defineDashboard } from "@monkeyagent/dashboard";
export default defineDashboard({ name: "P", description: "p", api: { ping: async () => ({ ok: true }) } });
`;

const ui = `export default function Ui() {
  return <div className="gap-2.5 w-[320px] py-2.5 h-screen grid-cols-3 col-span-2">x</div>;
}`;

let host: ReturnType<typeof createHost> | undefined;

afterEach(async () => {
  if (host) {
    await host.stop();
    host = undefined;
  }
});

async function startHost(): Promise<HostServices> {
  const root = mkdtempSync(path.join(tmpdir(), "mma-css-"));
  let services: HostServices | undefined;
  host = createHost({ listTools: () => [] }, { attach: (_c, s) => { services = s; } }, { config: bootstrapHostConfig({ runtimeRoot: root, hostPort: 0 }) });
  await host.apply();
  if (!services) throw new Error("no services");
  await services.apps.register("com.css.demo", {
    "manifest.json": JSON.stringify({ id: "com.css.demo", name: "CSS", version: "1.0.0", entry: "ui.tsx" }),
    "ui.tsx": ui,
    "main.api.ts": api,
  });
  return services;
}

describe("per-app Tailwind CSS", () => {
  it("compiles classes that never appear in the repo into the app stylesheet", async () => {
    await startHost();
    const res = await fetch(`http://127.0.0.1:${host!.port}/api/app/com.css.demo/ui.css`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/css/);
    const css = await res.text();
    // These utilities exist nowhere in packages/ui or apps — the whole point of P9.
    for (const sel of [".gap-2\\.5", ".w-\\[320px\\]", ".py-2\\.5", ".h-screen", ".grid-cols-3", ".col-span-2"]) {
      expect(css).toContain(sel);
    }
    // theme tokens must survive so dark/light + palette still work
    expect(css).toContain("--background");
  }, 60_000);

  it("falls back to the shared /ui.css when the app has no ui.tsx", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "mma-css2-"));
    let services: HostServices | undefined;
    host = createHost({ listTools: () => [] }, { attach: (_c, s) => { services = s; } }, { config: bootstrapHostConfig({ runtimeRoot: root, hostPort: 0 }) });
    await host.apply();
    const res = await fetch(`http://127.0.0.1:${host!.port}/ui.css`);
    expect(res.status).toBe(200);
    expect((await res.text()).includes("--background")).toBe(true);
  }, 60_000);
});
