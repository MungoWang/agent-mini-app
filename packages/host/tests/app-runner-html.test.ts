import { describe, expect, it } from "vitest";

import { appRunnerHtml } from "@monkey-mini-app/host";

describe("appRunnerHtml", () => {
  it("escapes title special characters and JSON-encodes the app id", () => {
    const html = appRunnerHtml(`a&b<"'>`);
    expect(html).toContain("<title>a&amp;b&lt;&quot;&#39;&gt;</title>");
    expect(html).toContain("const APP_ID = ");
    expect(html).toContain("/ui.css");
    expect(html).toContain("/mma/runtime.js");
    expect(html).toContain("/mma/sdk.js");
    expect(html).toContain("importmap");
    expect(html).toContain("mma-set-env");
  });

  it("injects ThemeResource runner CSS into the style block", () => {
    const html = appRunnerHtml(
      "com.example.todo",
      'html[data-theme="dark"]{--background:#111}',
    );
    expect(html).toContain('html[data-theme="dark"]{--background:#111}');
  });

  // A string-interpolated IIFE is invisible to tsc: one misplaced quote produced
  // `var APP_ID = ""com.x""`, every `includes` assertion still passed, and the whole
  // diagnostics script silently failed to parse in the browser. So parse it for real.
  it("emits classic scripts that actually parse", () => {
    const html = appRunnerHtml("com.example.todo");
    const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
      (m) => m[1],
    );
    expect(blocks.length).toBeGreaterThanOrEqual(2);
    for (const [i, js] of blocks.entries()) {
      expect(
        () => new Function(js),
        `script block ${i} is not valid JS`,
      ).not.toThrow();
    }
  });

  it("embeds the app id in every injected script as one valid literal", () => {
    const html = appRunnerHtml(`com.exa"mple`);
    const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
      (m) => m[1],
    );
    const diagnostics = blocks.find((b) => b.includes("var APP_ID = "))!;
    const embedded = /var APP_ID = (.*?);$/m.exec(diagnostics);
    expect(embedded).not.toBeNull();
    // Evaluating the literal is the only honest check: the doubled-quote bug parsed as two
    // tokens, and the module script kept working, so string matching alone missed it.
    const value = new Function(`return (${embedded![1]});`)();
    expect(value).toBe(`com.exa"mple`);
    // The view runtime receives the id the same way — a broken one answers no query.
    expect(blocks.some((b) => b.includes(JSON.stringify(`com.exa"mple`)))).toBe(
      true,
    );
  });

  it("wires the error channel and the view query runtime", () => {
    const html = appRunnerHtml("com.example.todo");
    expect(html).toContain("/errors");
    expect(html).toContain("unhandledrejection");
    // The view runtime, not a push snapshot: pull-based queries plus the liveness beat.
    expect(html).toContain("mma-view-eval");
    expect(html).toContain("/view/eval");
    expect(html).toContain("/alive");
    expect(html).not.toContain("/snapshot");
    // A module-load crash names the app + stage instead of dumping a bare stack.
    expect(html).toContain("mma-crash");
    expect(html).toContain("mini_app_errors");
  });

  it("ships the view runtime with its caps substituted", () => {
    const html = appRunnerHtml("com.example.todo");
    // Placeholders left behind would mean the runtime silently runs against 0-byte budgets.
    expect(html).not.toMatch(/__CAP__|__MAX_NODES__|__APP_ID__/);
    expect(html).toContain('"cap":6144');
  });
});

it("bakes initialVars into the bootstrap apply() so first paint is not near-white", () => {
  const html = appRunnerHtml("com.example.today", "", {
    "--background": "#6e91c9",
    "--primary": "#2f4fad",
  });
  expect(html).toContain('var initialVars = {"--background":"#6e91c9"');
  expect(html).toContain(
    'apply(concrete(q.get("theme") || "light"), q.get("palette") || "default", q.get("dock") || "fill", initialVars)',
  );
  // Still parses as classic JS.
  const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
    (m) => m[1],
  );
  const boot = blocks.find((b) => b.includes("var initialVars = "))!;
  expect(() => new Function(boot)).not.toThrow();
});
