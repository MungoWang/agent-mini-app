import { writeFileSync } from "node:fs";

import type { WorkspacePaths } from "../paths/workspace-paths.ts";
import type { HostConfig } from "../types.ts";

/** Persist a complete HostConfig to host.json (pretty-printed). */
export function writeHostConfig(paths: WorkspacePaths, config: HostConfig): void {
  const payload = {
    runtimeRoot: config.runtimeRoot,
    hostPort: config.hostPort,
    theme: config.theme,
    palette: config.palette,
    locale: config.locale,
    chatLanguage: config.chatLanguage,
    llm: config.llm,
  };
  writeFileSync(paths.hostConfigFile(), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}
