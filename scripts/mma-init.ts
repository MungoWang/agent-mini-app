/**
 * Install/init: write a complete host.json via bootstrapHostConfig.
 * Runtime apply never invents these defaults.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

import {
  WorkspacePaths,
  bootstrapHostConfig,
  loadHostConfig,
  type HostConfigInitInput,
} from "@monkey-mini-app/host";

export function writeHostConfig(input: HostConfigInitInput = {}): { file: string; wrote: boolean } {
  const cfg = bootstrapHostConfig(input);
  mkdirSync(cfg.runtimeRoot, { recursive: true });
  const paths = new WorkspacePaths(cfg.runtimeRoot);
  mkdirSync(paths.appsDir(), { recursive: true });
  const file = paths.hostConfigFile();
  try {
    loadHostConfig(paths);
    return { file, wrote: false };
  } catch {
    writeFileSync(file, `${JSON.stringify(cfg, null, 2)}\n`);
    return { file, wrote: true };
  }
}

const isMain = process.argv[1]?.includes("mma-init");
if (isMain) {
  const result = writeHostConfig({});
  console.log(result.wrote ? `[mma-init] wrote ${result.file}` : `[mma-init] host.json exists ${result.file}`);
}
