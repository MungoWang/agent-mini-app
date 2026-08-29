import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Same shortening as dsh Settings → Plugin list
 * (`@deepseek-ai/dsh-client-ui-settings-plugin-inventory` `moduleShortName`).
 */
function moduleShortName(moduleName: string): string {
  return (moduleName.startsWith("@")
    ? moduleName.slice(moduleName.indexOf("/") + 1)
    : moduleName)
    .replace(/^cordis:/, "")
    .replace(/^cordis-plugin-/, "")
    .replace(/^dsh-(?:host-|client-)?/, "");
}

describe("dsh plugin list display name", () => {
  it("shortens the bundle specifier to monkey-mini-app, not plugin", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(join(here, "..", "package.json"), "utf8")) as {
      name: string;
    };
    expect(moduleShortName("@monkey-mini-app/dsh-plugin")).toBe("plugin");
    expect(moduleShortName(pkg.name)).toBe("monkey-mini-app");
  });
});

describe("host dashboard chrome", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  // client 拆分为 client/ 目录多模块；测试拼接全部模块源码断言
  const client = readdirSync(join(here, "client"))
    .filter((f) => f.endsWith(".ts"))
    .map((f) => readFileSync(join(here, "client", f), "utf8"))
    .join("\n");
  // runner/路由已抽至 host-core；拼接断言
  const hostCoreSrc = (f: string) => readFileSync(join(here, "..", "..", "host-core", "src", f), "utf8");
  const runner =
    readFileSync(join(here, "index.ts"), "utf8") +
    readFileSync(join(here, "dsh-adapter.ts"), "utf8") +
    hostCoreSrc("runner.ts") +
    hostCoreSrc("host.ts") +
    hostCoreSrc("tools.ts") +
    hostCoreSrc("apps.ts");

  it("does not concatenate dock title inside a string literal", () => {
    expect(client).not.toMatch(/title=""\s*\+\s*\(state\.dock/);
    const ui = readFileSync(join(here, "..", "..", "panel-core", "src", "components", "Toolbar.tsx"), "utf8");
    expect(client).not.toMatch(/title=""\s*\+\s*\(state\.dock/);
    expect(ui).toContain('side ? "铺满主区" : "钉到聊天右侧"');
  });

  it("animates fill/side dock with numeric left+width and pads the chat column", () => {
    expect(client).toContain("mma-anim-dock");
    expect(client).toContain("mma-dock-side");
    expect(client).toContain("--mma-side-w");
    expect(client).toContain("left: vw - w");
  });

  it("keeps iframes across tab switches and follows dsh theme via postMessage", () => {
    expect(client).toContain("frameMap");
    expect(client).toContain("mma-set-env");
    expect(client).toContain("dshIsDark");
    expect(runner).toContain('d.type !== "mma-set-env"');
  });

  it("toggles from the footer and closes on Escape", () => {
    expect(client).toContain("toggleDashboard");
    expect(client).toContain('e.key === "Escape"');
  });

  it("animates host open/close instead of snapping display", () => {
    expect(client).toContain('translateX(16px)');
    expect(client).toContain('host.style.opacity = "0"');
    expect(client).toContain("lockLayout");
    expect(client).toContain("_closing");
    expect(client.indexOf("armDockAnim()")).toBeLessThan(client.lastIndexOf('display = "none"'));
    expect(client).toMatch(/_visTimer = setTimeout/);
  });

  it("runner HTML is browser JS, not TypeScript", () => {
    expect(runner).not.toMatch(/ev\.data as \{/);
  });

  it("shows a centered boot illustration until the UI bundle mounts", () => {
    expect(runner).toContain('id="root" class="boot"');
    expect(runner).toContain("#root.boot");
    expect(runner).not.toContain('<div id="root">loading');
    expect(runner).toContain('/ui/entry.js');
    expect(client).toContain("#mma-host .mma-frame .mma-load");
  });

  it("opens from mini_app_open via SSE app:open event", () => {
    expect(client).toContain("/api/events");
    expect(client).toContain('addEventListener("app:open"');
    expect(runner).toContain("app:open");
    expect(runner).toContain('tools.on("after", "mini_app_open"');
    expect(runner).toContain("EventSource");
  });

  it("compiles UI host-side with esbuild-wasm and streams llm", () => {
    expect(runner).toContain("compileUiBundle");
    expect(runner).toContain("collectLlmStream");
    expect(runner).toContain("/api/host-config");
  });

  it("exposes ctx.http as a fetch client, not bash curl", () => {
    expect(runner).toContain("httpRequest(url, { ...opts, signal");
    expect(runner).toContain('httpRequest');
  });

  it("invokes agent tools via the tool body (invokeAgentTool), not the scheduler", () => {
    expect(runner).toContain("invokeAgentTool");
    expect(runner).toContain("registerTools");
    expect(runner).toContain("toolDef.execute");
  });

  it("has a theme popover on the chrome and extra palettes in the runner", () => {
    const themes = readFileSync(join(here, "..", "..", "panel-core", "src", "themes.ts"), "utf8");
    const ui = readFileSync(join(here, "..", "..", "panel-core", "src", "components", "ThemePop.tsx"), "utf8");
    expect(ui).toContain("mma-theme-pop");
    expect(ui).toContain("data-palette");
    expect(themes).toContain("海蓝");
    expect(themes).toContain("青紫");
    expect(themes).toContain("石墨");
    expect(themes).toContain("--accent:");
    expect(themes).toContain("--shadow:");
    expect(runner).toContain("data-palette");
    expect(runner).toContain("runnerThemeCss");
  });

  it("opens settings for host port", () => {
    expect(client).toContain("mma-settings");
    expect(client).toContain("/api/host-config");
    expect(client).toContain("openDashboard();");
  });

  it("exports ModuleLoader surface from TypeScript (name/inject/apply/FooterButton)", () => {
    expect(client).toMatch(/export const name/);
    expect(client).toMatch(/export const inject/);
    expect(client).toMatch(/export function apply/);
    expect(client).toMatch(/export function FooterButton/);
  });
});

describe("tsup client wrap", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const tsup = readFileSync(join(here, "..", "tsup.config.ts"), "utf8");

  it("wraps the browser client in dsh ModuleLoader CJS factory", () => {
    expect(tsup).toContain("window.__ModuleLoader__.load");
    expect(tsup).toContain("@monkey-mini-app/dsh-monkey-mini-app");
    expect(tsup).toContain("return module.exports;");
    expect(tsup).toContain('outExtension()');
  });

  it("emits lib/client.js as a ModuleLoader factory after build", () => {
    let lib: string;
    try {
      lib = readFileSync(join(here, "..", "lib", "client.js"), "utf8");
    } catch {
      return; // build not run yet; install/CI runs tsup first
    }
    expect(lib).toContain("window.__ModuleLoader__.load");
    expect(lib).toContain("@monkey-mini-app/dsh-monkey-mini-app");
    expect(lib).toContain("return module.exports");
    expect(lib).toMatch(/exports\.(apply|FooterButton)|apply:/);
  });
});
