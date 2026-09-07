import { AppsManager } from "./apps/apps-manager.ts";
import { AppCssCompiler } from "./compile/app-css.ts";
import { UiCompiler } from "./compile/ui-compiler.ts";
import { parseHostConfig } from "./config/parse.ts";
import { HostEventBus } from "./events/host-events.ts";
import { GitHistory } from "./git/git-history.ts";
import { HttpGateway } from "./http/http-gateway.ts";
import { WorkspacePaths } from "./paths/workspace-paths.ts";
import { ToolFacade } from "./tools/tool-facade.ts";
import type { HostAboutMeta } from "./about.ts";
import type { AppCallContext } from "./app-runtime.ts";
import type { HostCapabilities } from "./capabilities.ts";
import { Host } from "./host.ts";
import type { HostLifecycle, HostServices } from "./lifecycle.ts";
import { EMPTY_THEME_RESOURCE, type ThemeResource } from "./theme-resource.ts";
import type { HostConfig } from "./types.ts";

/** Assemble a Host. `options.config` must already be parsed (`parseHostConfig` / bootstrap). */
export function createHost(
  capabilities: HostCapabilities,
  lifecycle: HostLifecycle,
  options: {
    config: HostConfig;
    /** Theme resource port — shell implements; host only consumes the interface. */
    themes?: ThemeResource;
    /** Adapter identity for GET /api/about (+ /api/updates) in the panel Settings. */
    about?: HostAboutMeta;
  },
): Host {
  const config = parseHostConfig(options.config);
  const paths = new WorkspacePaths(config.runtimeRoot);
  const git = new GitHistory();
  const events = new HostEventBus();
  // ctx.push is host-internal: bound to the event bus here so adapters keep
  // implementing only what is genuinely theirs (bash / llm / agent / tool / mcp).
  //
  // ⚠ Do **not** build this with `{ ...capabilities }`. Adapters pass class instances
  // (e.g. dsh's `DshCapabilities`), whose methods live on the **prototype**, and object
  // spread copies own enumerable properties only — every capability would silently vanish
  // and every `ctx.*` call would fail with "host capability not available". A plain object
  // literal (tests, react-host) hides that, which is why this regressed once already.
  // Object.create keeps the prototype chain and shadows only `push`.
  const caps = Object.create(capabilities, {
    push: {
      value: (ctx: AppCallContext, name: string, data?: unknown): void => {
        events.pushApp(ctx.appId, name, data);
      },
      enumerable: true,
      writable: true,
    },
  }) as HostCapabilities;
  // Same bus the HTTP gateway fans out on — without this, app:reload / storage notices
  // from AppsManager would go to a private bus the panel never sees.
  const apps = new AppsManager(paths, caps, git, config, events);
  const tools = new ToolFacade(apps, git, paths, events);
  const compiler = new UiCompiler(paths);
  apps.setUiCompiler(compiler);
  const css = new AppCssCompiler(paths);
  // A reload must be able to drop the css memo too: without this the compiled stylesheet stayed
  // reachable from the process even after every source change.
  apps.setCssCompiler(css);
  const themes = options.themes ?? EMPTY_THEME_RESOURCE;
  const http = new HttpGateway(
    apps,
    config,
    paths,
    compiler,
    css,
    git,
    themes,
    events,
    (port) => lifecycle.onHostPortChanged?.(port),
    options.about ?? { adapter: "host" },
  );
  const services: HostServices = { apps, git, tools, paths, config, events };
  return new Host(caps, lifecycle, paths, config, services, http);
}
