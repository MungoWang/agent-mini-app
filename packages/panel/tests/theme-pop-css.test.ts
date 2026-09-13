import { describe, expect, it } from "vitest";

import { panelCssText } from "../src/styles.ts";

describe("theme pop CSS", () => {
  it("keeps the side-dock pop inside the host instead of clipping left", () => {
    const css = panelCssText();
    expect(css).toContain("#mma-host[data-dock='side'] .mma-theme-wrap{position:static;}");
    expect(css).toContain(
      "#mma-host[data-dock='side'] .mma-pop{top:46px;left:10px;right:10px;width:auto;}",
    );
    expect(css).toMatch(/#mma-host\{[^}]*position:relative/);
  });
});
