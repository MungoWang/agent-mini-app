import { describe, expect, it } from "vitest";

import { startHost, readTemplate, templateId } from "./fixture.ts";

const api = `import { defineDashboard } from "@monkeyagent/dashboard";
export default defineDashboard({ name: "P", description: "p", api: { ping: async (_c, a) => ({ ok: true, args: a }) } });
`;
const ui = `import { Icon } from "@monkey-mini-app/ui";
export default function Ui(){ return <div className="p-4"><Icon.Check size={16} />hi</div>; }
`;
const manifest = JSON.stringify({ id: "com.smoke.http", name: "HTTP", version: "1.0.0", entry: "ui.tsx" });

describe("S2 · real HTTP socket end-to-end", () => {
  it("serves health, apps list, call, iframe shell, ui bundle, css, and theme round-trip", async () => {
    const { host, services } = await startHost(0);
    const origin = `http://127.0.0.1:${host.port}`;
    try {
      await services.apps.register("com.smoke.http", { "manifest.json": manifest, "ui.tsx": ui, "main.api.ts": api });

      // /health
      const health = await (await fetch(`${origin}/health`)).json();
      expect(health.ok).toBe(true);

      // `/` serves an app index (links to each app id)
      const index = await (await fetch(`${origin}/`)).text();
      expect(index).toContain("com.smoke.http");
      expect(index).toContain('href="/app/com.smoke.http"');

      // /api/apps lists the app
      const appsRes = (await (await fetch(`${origin}/api/apps`)).json()) as { apps: { id: string }[] };
      expect(appsRes.apps.some((a) => a.id === "com.smoke.http")).toBe(true);

      // /api/call → apps.call path
      const call = (await (await fetch(`${origin}/api/call`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ appId: "com.smoke.http", method: "ping", args: { n: 1 } }),
      })).json()) as { ok: boolean; value: { args?: unknown } };
      expect(call.ok).toBe(true);
      expect(call.value).toMatchObject({ args: { n: 1 } });

      // /app/:id → iframe shell HTML (module script loads the compiled entry)
      const html = await (await fetch(`${origin}/app/com.smoke.http`)).text();
      expect(html).toContain('id="root" class="boot"');
      expect(html).toContain("/api/app/\" + encodeURIComponent(APP_ID) + \"/ui/entry.js");
      // the app shell loads its per-app stylesheet (shared base + app utilities)
      expect(html).toContain('href = "/api/app/" + encodeURIComponent(APP_ID) + "/ui.css"');

      // /api/app/:id/ui/entry.js compiles
      const entry = await (await fetch(`${origin}/api/app/com.smoke.http/ui/entry.js`)).text();
      expect(entry.startsWith('{"error"')).toBe(false);
      expect(entry.length).toBeGreaterThan(2000);

      // per-app stylesheet carries the theme tokens + the app's own utility classes
      const appCss = await (await fetch(`${origin}/api/app/com.smoke.http/ui.css`)).text();
      expect(appCss).toContain("--background");
      expect(appCss).toContain(".p-4");

      // shared stylesheet still serves the repo-wide Tailwind base
      const css = await (await fetch(`${origin}/ui.css`)).text();
      expect(css).toContain("--background");

      // theme set (POST) → read back (GET) → clear (POST null → follow global)
      const setTheme = (await (await fetch(`${origin}/api/apps/com.smoke.http/theme`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ theme: "dark", palette: "ocean" }),
      })).json()) as { theme?: { theme: string; palette: string } };
      expect(setTheme.theme).toMatchObject({ theme: "dark", palette: "ocean" });
      const getTheme = (await (await fetch(`${origin}/api/apps/com.smoke.http/theme`)).json()) as { theme?: { theme: string; palette: string } | null };
      expect(getTheme.theme).toMatchObject({ theme: "dark", palette: "ocean" });

      // clear back to follow-global
      await fetch(`${origin}/api/apps/com.smoke.http/theme`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reset: true }),
      });
      const cleared = (await (await fetch(`${origin}/api/apps/com.smoke.http/theme`)).json()) as { theme: unknown };
      expect(cleared.theme).toBeNull();
    } finally {
      await host.stop();
    }
  }, 60_000);
});
