import { existsSync, mkdtempSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  bootstrapHostConfig,
  createHost,
  findTailwind,
  type Host,
  type HostCapabilities,
  type HostConfig,
  type HostLifecycle,
  type HostServices,
} from "@monkey-mini-app/host";

/**
 * The per-app Tailwind build must follow the app's sources.
 *
 * `AppCssCompiler` documented itself as "cached by comparing the app's source mtimes against the
 * compiled ui.css mtime", but the in-memory `Map` was consulted *before* any freshness check, so
 * the mtime rule only ever guarded the disk path. One compiler instance lives per host process
 * (`create-host.ts`), which meant: ask the agent for a new width class after the panel had loaded
 * once, and the class was compiled into nothing at all — silently, for the rest of the process's
 * life. Layout then falls back on whatever the kit base stylesheet happens to provide, so the app
 * looks styled and is simply wrong.
 */

let host: Host | undefined;

afterEach(async () => {
  if (host) {
    await host.stop();
    host = undefined;
  }
});

const APP = "com.example.appcss";

function uiWith(width: string): string {
  return `export default function Ui() {
  return <div className="${width}">styled-box</div>;
}
`;
}

const api = `import { defineApp } from "@monkey-mini-app/api";
export default defineApp({
  name: "AppCss",
  description: "css freshness",
  api: { ping: async () => "pong" },
});
`;

async function start(): Promise<HostServices> {
  const config: HostConfig = bootstrapHostConfig({
    runtimeRoot: mkdtempSync(path.join(tmpdir(), "mma-appcss-")),
    hostPort: 0,
  });
  let services: HostServices | undefined;
  const lifecycle: HostLifecycle = {
    attach: (_ctx, s) => {
      services = s;
    },
  };
  const capabilities: HostCapabilities = {
    bash: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
    listTools: () => [],
  };
  host = createHost(capabilities, lifecycle, { config });
  await host.apply();
  if (!services) throw new Error("lifecycle.attach did not receive HostServices");
  return services;
}

async function css(): Promise<string> {
  const res = await fetch(`http://127.0.0.1:${host!.port}/api/app/${APP}/ui.css`);
  expect(res.status).toBe(200);
  return res.text();
}

describe("findTailwind", () => {
  it("resolves the v4 CLI from the ui / host install", () => {
    const tw = findTailwind();
    expect(existsSync(tw.bin), `CLI path missing: ${tw.bin}`).toBe(true);
  });

  it("throws when no CLI is reachable", () => {
    const empty = mkdtempSync(path.join(tmpdir(), "mma-no-tw-"));
    expect(() => findTailwind({ requireFrom: [], walkFrom: [empty] })).toThrow(
      /tailwindcss CLI not found/,
    );
  });
});

describe("app ui.css compilation", () => {
  it("emits the app's own utility, writes .autogen, and picks up a class added after the first build", async () => {
    const services = await start();
    await services.apps.register(APP, {
      "manifest.json": JSON.stringify({
        id: APP,
        name: "AppCss",
        version: "0.1.0",
        entry: "ui.tsx",
      }),
      "ui.tsx": uiWith("w-[437px]"),
      "main.api.ts": api,
    });
    const uiFile = services.apps.dirOf(APP);

    const first = await css();
    expect(first).toContain("437px");
    const autogen = path.join(uiFile, ".autogen", "ui.css");
    expect(existsSync(autogen), "successful compile must write .autogen/ui.css").toBe(true);
    expect(readFileSync(autogen, "utf8")).toContain("437px");

    // A later edit by the agent: new class in the source, so the compiled css must change too.
    writeFileSync(path.join(uiFile, "ui.tsx"), uiWith("w-[612px]"), "utf8");
    // Push the mtime past the built css regardless of filesystem timestamp granularity.
    const t = new Date(Date.now() + 5_000);
    utimesSync(path.join(uiFile, "ui.tsx"), t, t);

    const second = await css();
    expect(second, "ui.css served a stale build after the source changed").toContain("612px");
    expect(second).not.toContain("437px");
    expect(readFileSync(autogen, "utf8")).toContain("612px");
  });
});
