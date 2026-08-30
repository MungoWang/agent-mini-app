import { readFileSync } from "node:fs";

import { HostConfigError } from "../errors.ts";
import type { WorkspacePaths } from "../paths/workspace-paths.ts";
import type { HostConfig } from "../types.ts";
import { parseHostConfig } from "./parse.ts";

/** Read host.json from WorkspacePaths. Fail loud; no defaults. */
export function loadHostConfig(paths: WorkspacePaths): HostConfig {
  const file = paths.hostConfigFile();
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (cause) {
    throw new HostConfigError(`host config not found: ${file}`, {
      code: "HOST_CONFIG_NOT_FOUND",
      cause,
    });
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch (cause) {
    throw new HostConfigError(`host config is not valid JSON: ${file}`, {
      cause,
    });
  }
  return parseHostConfig(raw);
}
