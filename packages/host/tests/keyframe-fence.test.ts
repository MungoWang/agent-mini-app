import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  checkAppSources,
  keyframeNamesIn,
  platformKeyframeNames,
  RUNNER_INLINE_CSS,
} from "@monkey-mini-app/host";

function appWith(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(tmpdir(), "mma-kf-"));
  for (const [name, contents] of Object.entries(files)) {
    writeFileSync(path.join(dir, name), contents);
  }
  return dir;
}

const manifest = (id: string) =>
  JSON.stringify({ id, name: "KF", version: "1.0.0", entry: "ui.tsx" });

describe("platform keyframe names", () => {
  it("extracts names from unquoted, quoted and dashed declarations", () => {
    expect(
      keyframeNamesIn(
        `@keyframes a{} @keyframes "b c"{} @keyframes 'd'{} @keyframes my-anim-2{}`,
      ),
    ).toEqual(["a", "b c", "d", "my-anim-2"]);
  });

  it("is derived from the CSS the app document actually receives, not a hand-written list", () => {
    const names = platformKeyframeNames();
    // The runner's own boot spinner is injected inline into every app document.
    expect(names.has("mma-dot")).toBe(true);
    expect(keyframeNamesIn(RUNNER_INLINE_CSS)).toContain("mma-dot");
    // The kit sheet's names come from the built globals.css, so they appear only if the
    // derivation really read that file. `spin` is Tailwind's, not ours: if this ever goes
    // false, the fence has quietly stopped comparing against anything.
    expect(names.has("spin")).toBe(true);
    expect(names.size).toBeGreaterThanOrEqual(10);
  });

  it("does not claim a name the platform never declares", () => {
    // The fence must not grow teeth: an app-namespace name has to stay unremarkable,
    // or "warn instead of forbid" degrades back into a ban.
    expect(platformKeyframeNames().has("my-shimmer")).toBe(false);
    expect(platformKeyframeNames().has("ledger-row-in")).toBe(false);
    expect(platformKeyframeNames().has("aibrief-soft")).toBe(false);
  });
});

describe("keyframe notices", () => {
  it("flags a platform name with an actionable rename, and does not block the reload", async () => {
    const dir = appWith({
      "manifest.json": manifest("com.test.kf1"),
      "ui.tsx": `export default function Ui() {
  return (
    <div>
      <style>{\`@keyframes spin { to { transform: rotate(360deg); } }\`}</style>
    </div>
  );
}
`,
    });
    const res = await checkAppSources(dir);
    const hit = res.findings.find((f) => f.name === "spin");
    expect(hit?.severity).toBe("notice");
    expect(hit?.reason).toMatch(/platform stylesheet/i);
    expect(hit?.reason).toMatch(/spin-app/);
    // The whole point of "warn, do not forbid": nothing lands in the blocking set.
    expect(res.errorsByLayer.size).toBe(0);
    expect(res.findings.filter((f) => f.severity === "error")).toEqual([]);
  });

  it("flags the same name declared twice inside one app", async () => {
    const dir = appWith({
      "manifest.json": manifest("com.test.kf2"),
      "ui.tsx": `export default function Ui() { return <div><style>{\`@keyframes soft-pulse{0%{opacity:.2}50%{opacity:1}}\`}</style></div>; }
`,
      "shared.ts": `export const CSS = \`@keyframes soft-pulse { 0% { opacity: .45 } 50% { opacity: 1 } }\`;
`,
    });
    const res = await checkAppSources(dir);
    const dup = res.findings.filter((f) => f.name === "soft-pulse");
    expect(dup).toHaveLength(1);
    expect(dup[0]!.severity).toBe("notice");
    expect(dup[0]!.reason).toMatch(/declared twice/);
    // One finding, on the later declaration, pointing back at the first one — enough for
    // the agent to decide which of the two bodies is the one it actually wants.
    expect(dup[0]!.file).toBe("ui.tsx");
    expect(dup[0]!.reason).toMatch(/shared\.ts:\d+/);
    expect(dup[0]!.reason).toMatch(/whichever mounts last wins/);
  });

  it("leaves a uniquely named custom keyframe completely alone", async () => {
    const dir = appWith({
      "manifest.json": manifest("com.test.kf3"),
      "ui.tsx": `export default function Ui() {
  return (
    <div>
      <style>{\`@keyframes ledger-row-in { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }\`}</style>
      <span style={{ animation: "ledger-row-in 300ms ease-out" }} />
    </div>
  );
}
`,
    });
    const res = await checkAppSources(dir);
    expect(res.findings).toEqual([]);
    expect(res.errorsByLayer.size).toBe(0);
  });

  it("reports the offending file and line, not just the name", async () => {
    const dir = appWith({
      "manifest.json": manifest("com.test.kf4"),
      "ui.tsx": `export default function Ui() { return <div />; }
`,
      "styles.css": `/* app stylesheet */
@keyframes pulse { from { opacity: 0 } }
`,
    });
    const res = await checkAppSources(dir);
    const hit = res.findings.find((f) => f.name === "pulse");
    expect(hit?.file).toBe("styles.css");
    expect(hit?.line).toBe(2);
  });
});
