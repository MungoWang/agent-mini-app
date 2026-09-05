import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { asAbsolutePath, UiCompiler, WorkspacePaths } from "@monkey-mini-app/host";

function makeApp(
  ui: string,
  extra: Record<string, string> = {},
): { compiler: UiCompiler; appDir: string } {
  const root = mkdtempSync(path.join(tmpdir(), "mma-uic-"));
  const appDir = path.join(root, "apps", "com.example.todo");
  mkdirSync(appDir, { recursive: true });
  writeFileSync(
    path.join(appDir, "manifest.json"),
    JSON.stringify({ id: "com.example.todo", name: "Todo", version: "0.1.0", entry: "ui.tsx" }),
  );
  writeFileSync(path.join(appDir, "ui.tsx"), ui);
  for (const [rel, text] of Object.entries(extra)) {
    const full = path.join(appDir, rel);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, text);
  }
  return { compiler: new UiCompiler(new WorkspacePaths(asAbsolutePath(root))), appDir };
}

function entryJs(files: Array<{ name: string; contents: Uint8Array }>): string {
  const entry = files.find((f) => f.name === "entry.js");
  if (!entry) throw new Error("missing entry.js");
  return new TextDecoder().decode(entry.contents);
}

describe("UiCompiler", () => {
  it("compiles instance code against /mma/sdk.js and does not inline react-is", async () => {
    const { compiler, appDir } = makeApp(`
import { useState } from "react";
import { Card } from "@monkey-mini-app/ui";
export default function Ui() {
  const [n] = useState(1);
  return <Card>hello-sdk {n}</Card>;
}
`);
    const files = await compiler.compile(appDir, { locale: "zh-CN" });
    const js = entryJs(files);
    expect(js).toContain("/mma/runtime.js");
    expect(js).toContain("/mma/sdk.js");
    expect(js).toContain("hello-sdk");
    expect(js).not.toMatch(/react-is/);
  });

  it("compiles in-app relative imports from ui/ and shared/", async () => {
    const { compiler, appDir } = makeApp(
      `
import { Card } from "@monkey-mini-app/ui";
import { Label } from "./ui/Label";
import { tag } from "./shared/tag";
export default function Ui() {
  return <Card>{tag}<Label /></Card>;
}
`,
      {
        "ui/Label.tsx": `export function Label() { return <span>label</span>; }\n`,
        "shared/tag.ts": `export const tag = "shared-ok";\n`,
      },
    );
    const js = entryJs(await compiler.compile(appDir, { locale: "zh-CN" }));
    expect(js).toContain("shared-ok");
    expect(js).toContain("label");
  });

  it("rejects a relative import that escapes the app dir", async () => {
    const { compiler, appDir } = makeApp(`import { s } from "../sneak/x";\nexport default function Ui() { return <div>{s}</div>; }\n`);
    const root = path.dirname(appDir);
    mkdirSync(path.join(root, "sneak"), { recursive: true });
    writeFileSync(path.join(root, "sneak", "x.ts"), `export const s = "leak";\n`);
    await expect(compiler.compile(appDir, { locale: "zh-CN" })).rejects.toThrow(/escapes the app dir/);
  });

  it("rejects UI imports of the backend tree (api/**)", async () => {
    const { compiler, appDir } = makeApp(
      `import { helper } from "./api/helper";\nexport default function Ui() { return <div>{helper}</div>; }\n`,
      { "api/helper.ts": `export const helper = "nope";\n` },
    );
    await expect(compiler.compile(appDir, { locale: "zh-CN" })).rejects.toThrow(/cannot import api/);
  });

  it("no longer resolves the pre-unification / wrong-side specifiers", async () => {
    // UI may only externalise @monkey-mini-app/ui (+ react/lucide) and lodash.
    // sdk is gone; api is backend-only and must not resolve in the UI compile.
    for (const spec of ["@monkeyagent/host", "@monkey-mini-app/sdk", "@monkey-mini-app/api"]) {
      const { compiler, appDir } = makeApp(
        `import { Card } from "${spec}";\nexport default function Ui() { return <Card />; }\n`,
      );
      await expect(compiler.compile(appDir, { locale: "zh-CN" })).rejects.toThrow(/Could not resolve/);
    }
  });

  it("externalises lodash to /mma/vendors/lodash.js", async () => {
    const { compiler, appDir } = makeApp(`
import { groupBy } from "lodash";
export default function Ui() {
  return <div>{Object.keys(groupBy([{ k: 1 }], "k")).join(",")}</div>;
}
`);
    const js = entryJs(await compiler.compile(appDir, { locale: "zh-CN" }));
    expect(js).toContain("/mma/vendors/lodash.js");
    expect(js).not.toMatch(/from\s*["']axios["']/);
  });

  it("rewrites lodash/groupBy to a default export of the vendor file", async () => {
    const { compiler, appDir } = makeApp(`
import groupBy from "lodash/groupBy";
export default function Ui() {
  return <div>{typeof groupBy}</div>;
}
`);
    const js = entryJs(await compiler.compile(appDir, { locale: "zh-CN" }));
    expect(js).toContain("/mma/vendors/lodash.js");
  });
});
