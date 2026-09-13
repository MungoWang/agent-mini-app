import type { HostConfigSeed } from "../types.ts";

/**
 * Bootstrap-only defaults. Runtime load/parse must not read this module.
 * `locale` / `chatLanguage` here are last-resort static fallbacks; `bootstrapHostConfig`
 * replaces them with the dsh locale preference (else OS locale) when the caller does not pass them.
 */
export const DEFAULT_HOST_CONFIG_SEED: HostConfigSeed = Object.freeze({
  runtimeRoot: "~/.monkey-mini-app/runtime",
  hostPort: 17880,
  theme: "light",
  palette: "default",
  locale: "zh-CN",
  chatLanguage: "zh-CN",
  llm: null,
});
