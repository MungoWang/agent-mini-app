import type { AppItem, Commit, Palette, StorageTable } from "@monkey-mini-app/panel";

import { isRecord } from "./utils.ts";

export async function readJson(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<unknown>;
}

function parseAppTheme(raw: unknown): AppItem["theme"] {
  if (raw === null) return null;
  if (!isRecord(raw)) return undefined;
  const theme = typeof raw.theme === "string" ? raw.theme : "";
  const palette = typeof raw.palette === "string" ? raw.palette : "";
  if (!theme && !palette) return null;
  return { theme, palette };
}

export function parseAppsResponse(raw: unknown): AppItem[] {
  if (!isRecord(raw) || !Array.isArray(raw.apps)) return [];
  const out: AppItem[] = [];
  for (const item of raw.apps) {
    if (!isRecord(item) || typeof item.id !== "string") continue;
    out.push({
      id: item.id,
      name: typeof item.name === "string" ? item.name : item.id,
      description: typeof item.description === "string" ? item.description : undefined,
      acronym: typeof item.acronym === "string" ? item.acronym : undefined,
      commits: typeof item.commits === "number" ? item.commits : undefined,
      version: typeof item.version === "string" ? item.version : undefined,
      theme: parseAppTheme(item.theme),
    });
  }
  return out;
}

export function hostConfigToForm(raw: unknown, cardStyle: string): Record<string, string> {
  const rec = isRecord(raw) ? raw : {};
  const llm = isRecord(rec.llm) ? rec.llm : null;
  const locale = typeof rec.locale === "string" ? rec.locale : "";
  const chatLanguage = typeof rec.chatLanguage === "string" ? rec.chatLanguage : "";
  return {
    hostPort: rec.hostPort != null ? String(rec.hostPort) : "",
    locale: locale || chatLanguage,
    chatLanguage: chatLanguage || locale,
    theme: typeof rec.theme === "string" ? rec.theme : "",
    palette: typeof rec.palette === "string" ? rec.palette : "",
    cardStyle,
    provider: llm && typeof llm.provider === "string" ? llm.provider : "",
    model: llm && typeof llm.model === "string" ? llm.model : "",
  };
}

export function formToHostConfigBody(form: Record<string, string>): Record<string, unknown> {
  const provider = (form.provider ?? "").trim();
  const model = (form.model ?? "").trim();
  const locale = form.locale || form.chatLanguage;
  const body: Record<string, unknown> = {
    locale,
    chatLanguage: form.chatLanguage || locale,
    theme: form.theme,
    palette: form.palette,
  };
  const port = Number(form.hostPort);
  if (Number.isInteger(port) && port >= 0 && port <= 65535) {
    body.hostPort = port;
  }
  if (provider && model) body.llm = { provider, model };
  else if (!provider && !model) body.llm = null;
  return body;
}

function asCommit(raw: unknown): Commit | null {
  if (!isRecord(raw) || typeof raw.id !== "string") return null;
  const files = Array.isArray(raw.files)
    ? raw.files.flatMap((f) => {
        if (!isRecord(f) || typeof f.path !== "string") return [];
        return [
          {
            path: f.path,
            add: typeof f.add === "number" ? f.add : undefined,
            del: typeof f.del === "number" ? f.del : undefined,
            preview: typeof f.preview === "string" ? f.preview : undefined,
          },
        ];
      })
    : undefined;
  return {
    id: raw.id,
    message: typeof raw.message === "string" ? raw.message : "",
    time: typeof raw.time === "string" ? raw.time : "",
    files,
  };
}

export function parseCommitList(raw: unknown): Commit[] {
  const rec = isRecord(raw) ? raw : {};
  const list = Array.isArray(rec.commits)
    ? rec.commits
    : Array.isArray(rec.nodes)
      ? rec.nodes
      : [];
  const out: Commit[] = [];
  for (const item of list) {
    const c = asCommit(item);
    if (c) out.push(c);
  }
  return out;
}

export function parseCommitDetail(raw: unknown, id: string): Commit {
  const rec = isRecord(raw) ? raw : {};
  const inner = isRecord(rec.commit) ? rec.commit : rec;
  return asCommit(inner) ?? { id, message: "", time: "", files: [] };
}

export function parseStorageTables(raw: unknown): StorageTable[] {
  const rec = isRecord(raw) ? raw : {};
  const list = Array.isArray(rec.tables) ? rec.tables : [];
  const out: StorageTable[] = [];
  for (const item of list) {
    if (!isRecord(item) || typeof item.name !== "string") continue;
    out.push({
      name: item.name,
      size: typeof item.size === "number" ? item.size : undefined,
      updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : undefined,
    });
  }
  return out;
}

export function parsePalettes(raw: unknown): Palette[] {
  const rec = isRecord(raw) ? raw : {};
  const list = Array.isArray(rec.palettes) ? rec.palettes : [];
  const out: Palette[] = [];
  for (const item of list) {
    if (!isRecord(item) || typeof item.id !== "string") continue;
    if (item.custom === false) continue;
    out.push({
      id: item.id,
      label: typeof item.label === "string" ? item.label : item.id,
      swatch: typeof item.swatch === "string" ? item.swatch : "#888",
      tokens: isRecord(item.tokens) ? (item.tokens as Palette["tokens"]) : undefined,
    });
  }
  return out;
}
