import * as fs from "node:fs";
import * as path from "node:path";
import { clampMode, clampPalette, type ModeId, type PaletteId } from "@monkey-mini-app/panel-core";

export type HostConfig = {
  hostPort: number;
  theme: ModeId;
  palette: PaletteId;
  chatLanguage: "zh" | "en";
  llm: { provider: string; model: string };
};

export const DEFAULT_HOST_CONFIG: HostConfig = {
  hostPort: 17880,
  theme: "light",
  palette: "default",
  chatLanguage: "zh",
  llm: { provider: "deepseek-official", model: "deepseek-v4-flash" },
};

export function clampPort(n: unknown): number {
  const p = Number(n);
  if (!Number.isInteger(p) || p < 1024 || p > 65535) {
    throw new Error("hostPort must be an integer 1024–65535");
  }
  return p;
}

function readJson(fp: string): Record<string, unknown> {
  try {
    return JSON.parse(fs.readFileSync(fp, "utf8"));
  } catch {
    return {};
  }
}

export function readHostConfig(runtimeRoot: string): HostConfig {
  const host = readJson(path.join(runtimeRoot, "host.json"));
  const llmFile = readJson(path.join(runtimeRoot, "llm.json"));
  const theme = clampMode(host.theme);
  const palette = clampPalette(host.palette);
  const chatLanguage = host.chatLanguage === "en" ? "en" : "zh";
  let hostPort = DEFAULT_HOST_CONFIG.hostPort;
  try {
    if (host.hostPort != null) hostPort = clampPort(host.hostPort);
    else if (process.env.MONKEY_MINI_APP_HOST_PORT) {
      hostPort = clampPort(process.env.MONKEY_MINI_APP_HOST_PORT);
    }
  } catch {
    hostPort = DEFAULT_HOST_CONFIG.hostPort;
  }
  const provider =
    (typeof llmFile.provider === "string" && llmFile.provider) ||
    (typeof host.provider === "string" && host.provider) ||
    DEFAULT_HOST_CONFIG.llm.provider;
  const model =
    (typeof llmFile.model === "string" && llmFile.model) ||
    (typeof host.model === "string" && host.model) ||
    DEFAULT_HOST_CONFIG.llm.model;
  return { hostPort, theme, palette, chatLanguage, llm: { provider, model } };
}

export function writeHostConfig(runtimeRoot: string, next: HostConfig): HostConfig {
  const cfg: HostConfig = {
    hostPort: clampPort(next.hostPort),
    theme: clampMode(next.theme),
    palette: clampPalette(next.palette),
    chatLanguage: next.chatLanguage === "en" ? "en" : "zh",
    llm: {
      provider: String(next.llm?.provider || DEFAULT_HOST_CONFIG.llm.provider),
      model: String(next.llm?.model || DEFAULT_HOST_CONFIG.llm.model),
    },
  };
  fs.mkdirSync(runtimeRoot, { recursive: true });
  fs.writeFileSync(path.join(runtimeRoot, "host.json"), JSON.stringify(cfg, null, 2));
  fs.writeFileSync(
    path.join(runtimeRoot, "llm.json"),
    JSON.stringify(cfg.llm, null, 2)
  );
  return cfg;
}

/** What `ctx.config` exposes — only our runtime, never the dsh settings dump. */
export function publicAppConfig(cfg: HostConfig, boundPort: number): Record<string, unknown> {
  return {
    theme: cfg.theme,
    palette: cfg.palette,
    chatLanguage: cfg.chatLanguage,
    hostPort: boundPort,
    llm: { provider: cfg.llm.provider, model: cfg.llm.model },
  };
}
