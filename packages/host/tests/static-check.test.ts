import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { checkAppSources, layerOfRel, staticCheckAvailable } from "@monkey-mini-app/host";

function app(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(tmpdir(), "mma-static-"));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, content, "utf8");
  }
  return dir;
}

async function errors(files: Record<string, string>): Promise<string[]> {
  const r = await checkAppSources(app(files));
  return r.findings.filter((f) => f.severity === "error").map((f) => f.reason);
}

describe("static-check availability", () => {
  it("reports whether the parser can load (reload degrades, never bricks)", async () => {
    expect(typeof (await staticCheckAvailable())).toBe("boolean");
  });
});

describe("static-check catches the class compile steps let through", () => {
  // Sucrase strips types and esbuild treats an unbound identifier as a global, so all of
  // these transpile green and throw ReferenceError in the browser.
  it("defined `greet`, called `greeting` — the bug from the dsh field report", async () => {
    const found = await errors({
      "ui.tsx": `
        function greet(n: number) { return "hi " + n; }
        export default function Ui() { return <b>{greeting(1)}</b>; }
      `,
    });
    expect(found.join("\n")).toMatch(/"greeting\(\)" is called but never defined or imported/);
  });

  it("suggests the closest declared name when it is a near miss", async () => {
    const found = await errors({
      "main.api.ts": `
        import { defineApp } from "@monkey-mini-app/api";
        function helper(ctx: unknown) { return ctx; }
        export default defineApp({ name: "a", description: "b", api: { async x(ctx) { return helpers(ctx); } } });
      `,
    });
    expect(found.join("\n")).toMatch(/did you mean "helper"/);
  });

  it("flags a JSX component that was never imported", async () => {
    const found = await errors({
      "ui.tsx": `
        import { useState } from "react";
        export default function Ui() { const [n] = useState(0); return <Widget x={n} />; }
      `,
    });
    expect(found.join("\n")).toMatch(/JSX component <Widget \/> is not defined or imported/);
  });

  it("flags a hook used without importing it", async () => {
    const found = await errors({
      "ui.tsx": `
        export default function Ui() { const [n, setN] = useState(0); return <button onClick={() => setN(n + 1)} />; }
      `,
    });
    expect(found.join("\n")).toMatch(/hook "useState" is called but not imported/);
  });

  it("flags `React.x` when React itself was not imported", async () => {
    const found = await errors({
      "ui.tsx": `
        export default function Ui() { const [n] = React.useState(0); return <b>{n}</b>; }
      `,
    });
    expect(found.join("\n")).toMatch(/"React" is used before being imported/);
  });

  it("reports inside backend helper trees too", async () => {
    const found = await errors({
      "main.api.ts": `
        import { defineApp } from "@monkey-mini-app/api";
        import { parse } from "./api/parse.js";
        export default defineApp({ name: "a", description: "b", api: { async x(ctx) { return parse(ctx); } } });
      `,
      "api/parse.ts": `export function parse(ctx: unknown) { return transform(ctx); }`,
    });
    expect(found.join("\n")).toMatch(/"transform\(\)" is called but never defined or imported/);
  });
});

describe("static-check must not block an app that works", () => {
  // Both of these produced false positives on the first implementation and would have
  // broken every existing mini-app on reload.
  it("does not veto an import statement because one specifier is `type`", async () => {
    const found = await errors({
      "ui.tsx": `
        import { type ColumnDef, DataGrid, StatusBadge } from "@monkey-mini-app/ui";
        const cols: ColumnDef<unknown>[] = [];
        export default function Ui() {
          return <div><DataGrid columns={cols} data={[]} /><StatusBadge status="ok" /></div>;
        }
      `,
    });
    expect(found).toEqual([]);
  });

  it("does not treat closing tags or intrinsic elements as references", async () => {
    const found = await errors({
      "ui.tsx": `
        export default function Ui() {
          return (
            <div className="flex flex-col gap-3">
              <span>a</span>
              <table><thead><tr><th>h</th></tr></thead><tbody><tr><td>c</td></tr></tbody></table>
              <svg viewBox="0 0 8 8"><path d="M0 0" /></svg>
            </div>
          );
        }
      `,
    });
    expect(found).toEqual([]);
  });

  it("accepts browser globals, DOM constructors and host-side Node globals", async () => {
    const found = await errors({
      "ui.tsx": `
        export default function Ui() {
          const r = new ResizeObserver(() => {});
          r.observe(document.getElementById("root") ?? document.body);
          const enc = new TextEncoder().encode("x");
          void fetch("/api/apps").then((res) => console.log(res.status, enc.length));
          localStorage.setItem("k", String(window.innerWidth));
          setTimeout(() => structuredClone(null), 0);
          return null;
        }
      `,
      "main.api.ts": `
        import { defineApp } from "@monkey-mini-app/api";
        export default defineApp({
          name: "a",
          description: "b",
          api: {
            async x(ctx) {
              console.warn("hi", process.cwd(), Buffer.from("x").length);
              const u = new URL("https://example.com");
              return { ctx, u, s: JSON.stringify({}), d: Date.now(), p: Promise.resolve(), m: Math.PI };
            },
          },
        });
      `,
    });
    expect(found).toEqual([]);
  });

  it("ignores type-only positions and re-exports", async () => {
    const found = await errors({
      "ui.tsx": `
        interface Shape { kind: "a" | "b" }
        type Alias = Shape["kind"];
        export { Helper } from "./helper.js";
        export default function Ui(p: { a: Alias }) { return <b>{String(p.a)}</b>; }
      `,
      "helper.tsx": `export function Helper() { return null; }`,
    });
    expect(found).toEqual([]);
  });

  it("does not report a name bound in another scope of the same file", async () => {
    const found = await errors({
      "ui.tsx": `
        const LABEL = "x";
        export default function Ui() {
          const { a = 1, b: c, ...rest } = { a: 1, b: 2 };
          const items = [1].map((n) => n * LABEL.length);
          try { void items; } catch (e) { void (e as unknown); }
          return <b>{String(c)}{JSON.stringify(rest)}{a}</b>;
        }
      `,
    });
    expect(found).toEqual([]);
  });
});

describe("static-check layering", () => {
  it("maps relative paths onto the documented errors[] prefixes", () => {
    expect(layerOfRel("ui.tsx")).toBe("ui");
    expect(layerOfRel(path.join("ui", "Card.tsx"))).toBe("ui");
    expect(layerOfRel("main.api.ts")).toBe("main.api");
    expect(layerOfRel(path.join("api", "parse.ts"))).toBe("main.api");
    expect(layerOfRel(path.join("shared", "fmt.ts"))).toBe("shared");
  });

  it("attributes each finding to its own layer", async () => {
    const r = await checkAppSources(
      app({
        "ui.tsx": `export default function Ui() { return <b>{nope()}</b>; }`,
        "main.api.ts": `export default { api: { async x() { return bad(); } } };`,
      }),
    );
    expect([...r.errorsByLayer.keys()].sort()).toEqual(["main.api", "ui"]);
  });

  it("skips generated and vendored trees", async () => {
    const found = await errors({
      "ui.tsx": `export default function Ui() { return null; }`,
      ".autogen/ui.css": `x`,
      "node_modules/left-pad/index.js": `export default nope();`,
    });
    expect(found).toEqual([]);
  });
});
