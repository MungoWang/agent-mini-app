import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  bootstrapHostConfig,
  createHost,
  type HostServices,
} from "@monkey-mini-app/host";

describe("smoke: createHost register → call → tools", () => {
  it("end-to-end without depending on deleted host-core APIs", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "mma-smoke-"));
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
    expect(services).toBeTruthy();
    const { apps, tools } = services!;

    await apps.register("com.smoke.demo", {
      "manifest.json": JSON.stringify({
        id: "com.smoke.demo",
        name: "Smoke",
        version: "1.0.0",
        entry: "ui.tsx",
      }),
      "ui.tsx": "export default function Ui(){ return <div>ok</div>; }",
      "main.api.ts": `import { defineDashboard } from "@monkeyagent/dashboard";
export default defineDashboard({
  name: "Smoke",
  description: "smoke",
  api: {
    ping: async (_ctx, args) => ({ ok: true, args }),
  },
});
`,
    });

    const list = await apps.list();
    expect(list.some((a) => a.id === "com.smoke.demo")).toBe(true);
    await expect(apps.call("com.smoke.demo", "ping", { n: 1 })).resolves.toEqual({
      ok: true,
      args: { n: 1 },
    });

    const names = tools.definitions().map((t) => t.name);
    expect(names).toContain("mini_app_list");
    expect(names).toContain("mini_app_register");
    expect(names).toContain("mini_app_reload");

    // ensure runtime layout exists
    expect(path.isAbsolute(services!.paths.appDir("com.smoke.demo"))).toBe(true);

    await host.stop();
  }, 30_000);
});
