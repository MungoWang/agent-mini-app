import { describe, expect, it } from "vitest";

import { startHost } from "./fixture.ts";

const files = {
  "manifest.json": JSON.stringify({ id: "com.smoke.git", name: "Git", version: "1.0.0", entry: "ui.tsx" }),
  "ui.tsx": `export default function Ui(){ return <div>v1</div>; }`,
  "main.api.ts": `import { defineDashboard } from "@monkeyagent/dashboard";\nexport default defineDashboard({ name: "G", description: "g", api: { ping: async () => ({ ok: true }) } });\n`,
};

describe("S4 · real git journey → history route (提交历史面板)", () => {
  it("register auto-commits → edit auto-commits → history shows commits + per-commit files + diff", async () => {
    const { host, services } = await startHost(0);
    const origin = `http://127.0.0.1:${host.port}`;
    try {
      await services.apps.register("com.smoke.git", files);
      // edit a file → auto-commit
      await services.apps.writeFile("com.smoke.git", "ui.tsx", `export default function Ui(){ return <div>v2</div>; }`);

      // history: ≥2 commits, each with files
      const history = (await (await fetch(`${origin}/api/apps/com.smoke.git/history`)).json()) as {
        ok: boolean;
        commits: { id: string; message?: string; files: { path?: string }[] }[];
      };
      expect(history.ok).toBe(true);
      expect(history.commits.length).toBeGreaterThanOrEqual(2);
      const newest = history.commits[0];
      expect(newest.files.some((f) => f.path?.endsWith("ui.tsx"))).toBe(true);

      // a commit's file preview reflects the edit
      const detail = (await (await fetch(`${origin}/api/apps/com.smoke.git/history/${newest.id}`)).json()) as {
        ok: boolean;
        commit: { files: { path?: string; preview?: string }[] };
      };
      expect(detail.ok).toBe(true);
      const uiPreview = (detail.commit.files.find((f) => f.path?.endsWith("ui.tsx"))?.preview ?? "") + "";
      expect(uiPreview).toContain("v2");
    } finally {
      await host.stop();
    }
  }, 60_000);
});
