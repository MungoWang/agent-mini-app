import { describe, expect, it } from "vitest";

import { startHost } from "./fixture.ts";
import type { ToolDefinition } from "@monkey-mini-app/host";

function tool(services: { tools: { definitions(): ToolDefinition[] } }, name: string) {
  const t = services.tools.definitions().find((x) => x.name === name);
  if (!t) throw new Error(`tool not found: ${name}`);
  return t.execute.bind(t);
}

// 用一个最小 app：read → edit（唯一 oldText）→ reload（编译校验 + 自动提交）
const files = {
  "manifest.json": JSON.stringify({ id: "com.smoke.tool", name: "Tool", version: "1.0.0", entry: "ui.tsx" }),
  "ui.tsx": `export default function Ui(){ return <div>v1</div>; }`,
  "main.api.ts": `import { defineDashboard } from "@monkeyagent/dashboard";\nexport default defineDashboard({ name: "T", description: "t", api: { ping: async () => ({ ok: true }) } });\n`,
};

describe("S3 · model-view tool loop (mini_app_*)", () => {
  it("register → read → edit(unique) → reload returns the model-facing contracts", async () => {
    const { host, services } = await startHost(0);
    const origin = `http://127.0.0.1:${host.port}`;
    try {
      // register → returns an object with the app id (NOT a string; these are model tools)
      const reg = (await tool(services, "mini_app_register")({ appId: "com.smoke.tool", files })) as { app: { id: string }; ok: boolean };
      expect(reg.ok).toBe(true);
      expect(reg.app.id).toBe("com.smoke.tool");

      // read the file back
      const read = (await tool(services, "mini_app_read")({ appId: "com.smoke.tool", path: "ui.tsx" })) as { content: string };
      expect(read.content).toContain("<div>v1</div>");

      // edit with an oldText that is NOT unique → returns ok:false + an EDIT_FAILED error (not a throw)
      const bad = (await tool(services, "mini_app_edit")({
        appId: "com.smoke.tool",
        path: "ui.tsx",
        edits: [{ oldText: "div", newText: "span" }], // "div" appears twice → not unique
      })) as { ok: boolean; error?: string; code?: string };
      expect(bad.ok).toBe(false);
      expect(bad.code).toBe("EDIT_FAILED");
      expect(bad.error ?? "").toMatch(/unique|not unique|multiple|occurrences/i);

      // edit with a unique oldText → succeeds
      const edit = await tool(services, "mini_app_edit")({
        appId: "com.smoke.tool",
        path: "ui.tsx",
        edits: [{ oldText: "<div>v1</div>", newText: "<span>v2</span>" }],
      });
      expect(edit).toBeTruthy();

      // reload → sync-compiles main.api + ui; returns ok (no compile errors)
      const reload = (await tool(services, "mini_app_reload")({ appId: "com.smoke.tool" })) as Record<string, unknown>;
      expect(reload).toMatchObject({ ok: true });

      // list has the app
      const list = (await tool(services, "mini_app_list")({})) as { apps: { id: string }[] };
      expect(list.apps.some((a) => a.id === "com.smoke.tool")).toBe(true);
    } finally {
      await host.stop();
    }
  }, 60_000);
});
