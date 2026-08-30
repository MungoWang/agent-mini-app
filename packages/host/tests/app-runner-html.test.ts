import { describe, expect, it } from "vitest";

import { appRunnerHtml } from "@monkey-mini-app/host";

describe("appRunnerHtml", () => {
  it("escapes title special characters and JSON-encodes the app id", () => {
    const html = appRunnerHtml(`a&b<"'>`);
    expect(html).toContain("<title>a&amp;b&lt;&quot;&#39;&gt;</title>");
    expect(html).toContain("const APP_ID = ");
    expect(html).toContain("/ui.css");
    expect(html).toContain("mma-set-env");
  });

  it("injects ThemeResource runner CSS into the style block", () => {
    const html = appRunnerHtml("com.example.todo", 'html[data-theme="dark"]{--background:#111}');
    expect(html).toContain('html[data-theme="dark"]{--background:#111}');
  });
});
