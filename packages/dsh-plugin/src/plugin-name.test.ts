import { readFileSync } from "node:fs";
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
  const client = readFileSync(join(here, "client.ts"), "utf8");
  const runner = readFileSync(join(here, "index.ts"), "utf8");

  it("does not concatenate dock title inside a string literal", () => {
    expect(client).not.toMatch(/title=""\s*\+\s*\(state\.dock/);
    expect(client).toContain('side ? "铺满主区" : "钉到聊天右侧"');
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

  it("shows a centered boot illustration until React mounts", () => {
    expect(runner).toContain('id="root" class="boot"');
    expect(runner).toContain("#root.boot");
    expect(runner).toContain('rootEl.className = ""');
    expect(runner).toContain('rootEl.removeAttribute("role")');
    expect(runner).toContain("rootEl.replaceChildren()");
    expect(runner).not.toContain('<div id="root">loading');
    expect(client).toContain("#mma-host .mma-frame .mma-load");
  });

  it("opens from mini_app_open via pending-open poll", () => {
    expect(client).toContain("/api/pending-open");
    expect(runner).toContain("/api/pending-open");
    expect(runner).toContain("mini_app_call");
    expect(runner).toContain("asToolObject");
    expect(runner).toContain("handlers.mini_app_open");
    expect(runner).toContain("pendingOpen.current");
  });

  it("compiles backend TS with sucrase and streams llm", () => {
    expect(runner).toContain("sucrase");
    expect(runner).toContain("collectLlmStream");
    expect(runner).toContain("/api/host-config");
  });

  it("exposes ctx.http as a fetch client, not bash curl", () => {
    expect(runner).toContain("http: httpRequest");
    expect(runner).toContain('from "./ctx-http.js"');
  });

  it("invokes ctx.tool via the tool body, not (name, args) on the scheduler", () => {
    expect(runner).toContain("stubExec");
    expect(runner).toMatch(/\.execute\(payload, stubExec\)/);
    expect(runner).toContain("arguments: payload");
    expect(runner).not.toContain("tools.execute(resolved || name, payload)");
  });

  it("has a theme popover on the chrome and extra palettes in the runner", () => {
    const themes = readFileSync(join(here, "themes.ts"), "utf8");
    expect(client).toContain("mma-theme-pop");
    expect(client).toContain("data-palette");
    expect(client).toContain("PALETTES");
    expect(themes).toContain("海蓝");
    expect(themes).toContain("青紫");
    expect(themes).toContain("石墨");
    expect(themes).toContain("--accent:");
    expect(themes).toContain("--shadow:");
    expect(runner).toContain("data-palette");
    expect(runner).toContain("runnerThemeCss");
  });

  it("opens settings for host port and keeps pending-open before ack", () => {
    expect(client).toContain("mma-settings");
    expect(client).toContain("/api/host-config");
    expect(client).toContain("openDashboard();");
    expect(client.indexOf("openDashboard();")).toBeLessThan(
      client.indexOf("/api/pending-open/ack")
    );
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
