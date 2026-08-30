import { AppsManager } from "./apps/apps-manager.ts";
import { AppCssCompiler } from "./compile/app-css.ts";
import { UiCompiler } from "./compile/ui-compiler.ts";
import { parseHostConfig } from "./config/parse.ts";
import { HostEventBus } from "./events/host-events.ts";
import { GitHistory } from "./git/git-history.ts";
import { HttpGateway } from "./http/http-gateway.ts";
import { WorkspacePaths } from "./paths/workspace-paths.ts";
import { ToolFacade } from "./tools/tool-facade.ts";
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
  },
): Host {
  const config = parseHostConfig(options.config);
  const paths = new WorkspacePaths(config.runtimeRoot);
  const git = new GitHistory();
  const apps = new AppsManager(paths, capabilities, git, config);
  const events = new HostEventBus();
  const tools = new ToolFacade(apps, git, paths, events);
  const compiler = new UiCompiler(paths);
  apps.setUiCompiler(compiler);
  const css = new AppCssCompiler(paths);
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
  );
  const services: HostServices = { apps, git, tools, paths, config };
  return new Host(capabilities, lifecycle, paths, config, services, http);
}
