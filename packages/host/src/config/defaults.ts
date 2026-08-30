import type { HostConfigSeed } from "../types.ts";

/** Bootstrap-only defaults. Runtime load/parse must not read this module. */
export const DEFAULT_HOST_CONFIG_SEED: HostConfigSeed = Object.freeze({
  runtimeRoot: "~/.monkey-mini-app/runtime",
  hostPort: 17880,
  theme: "light",
  palette: "default",
  locale: "zh-CN",
  chatLanguage: "zh-CN",
  llm: null,
});
