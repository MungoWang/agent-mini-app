/**
 * First-boot helper: write a complete host.json if missing.
 * Runtime apply never invents these defaults — only this path (or an install script) does.
 */
import { mkdirSync } from "node:fs";

import { WorkspacePaths } from "../paths/workspace-paths.ts";
import type { HostConfigInitInput } from "../types.ts";
import { bootstrapHostConfig } from "./bootstrap.ts";
import { loadHostConfig } from "./load.ts";
import { writeHostConfig } from "./write.ts";

/** Write a full host.json when absent; leave a valid existing file alone. */
export function ensureHostConfig(
  input: HostConfigInitInput = {},
): { file: string; wrote: boolean } {
  const cfg = bootstrapHostConfig(input);
  mkdirSync(cfg.runtimeRoot, { recursive: true });
  const paths = new WorkspacePaths(cfg.runtimeRoot);
  mkdirSync(paths.appsDir(), { recursive: true });
  const file = paths.hostConfigFile();
  try {
    loadHostConfig(paths);
    return { file, wrote: false };
  } catch {
    writeHostConfig(paths, cfg);
    return { file, wrote: true };
  }
}