/**
 * CLI: write a complete host.json via ensureHostConfig when missing.
 * Runtime apply never invents these defaults.
 *
 * Inputs:       env / default workspace paths
 * Writes:       runtime/host.json (full config, never patched at boot)
 * Side effects: runtime directory
 * Run as:       manual: pnpm exec tsx scripts/setup/host-config.mts
 */
import { ensureHostConfig } from "@monkey-mini-app/host";

const result = ensureHostConfig({});
console.log(
  result.wrote ? `[host-config] wrote ${result.file}` : `[host-config] exists ${result.file}`,
);
