/**
 * Mini-app source file CUD helpers (list/read/write/edit/delete).
 * Edit semantics come from ./edit-diff.ts (Pi MIT port).
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import { asAppId, type AbsolutePath, type AppId } from "../brand.ts";
import { HostError } from "../errors.ts";
import type { WorkspacePaths } from "../paths/workspace-paths.ts";
import { parseManifest } from "./manifest.ts";
import {
  applyEditsToNormalizedContent,
  detectLineEnding,
  generateDiffString,
  normalizeToLF,
  restoreLineEndings,
  type Edit,
} from "./edit-diff.ts";

const SKIP_DIRS = new Set([".git", "node_modules", "storage", ".ui-build", ".ui-cache"]);

export type ListedFile = { path: string; size: number };

/** 1-indexed inclusive line window. Omit both → whole file. */
export type ReadFileRange = {
  startLine?: number;
  endLine?: number;
  /**
   * Prefix each returned line with `N|` (1-indexed absolute line numbers).
   * Default false — raw text is better for copying into mini_app_edit oldText.
   */
  numbered?: boolean;
};

export type ReadFileResult = {
  path: string;
  /** Sliced file text (raw, or numbered when numbered:true). */
  content: string;
  bytes: number;
  totalLines: number;
  /** Actual 1-indexed inclusive window returned. */
  startLine: number;
  endLine: number;
  /** True when a safety cap truncated the response (caller should page with startLine). */
  truncated?: boolean;
};

export type MutateFileResult = {
  path: string;
  bytes: number;
  diff?: string;
  created?: boolean;
};

/** Soft cap when reading without an explicit endLine (mini-apps are usually small). */
export const READ_DEFAULT_MAX_LINES = 2000;

function splitLines(text: string): string[] {
  if (text.length === 0) return [];
  const parts = text.split("\n");
  // Keep a trailing empty only when the file does not end with \n? split always
  // yields a trailing "" when text ends with \n — drop it so line count matches editors.
  if (parts.length > 0 && parts[parts.length - 1] === "" && text.endsWith("\n")) {
    parts.pop();
  }
  return parts;
}

function formatNumbered(lines: string[], startLine: number): string {
  const width = String(startLine + lines.length - 1).length;
  return lines
    .map((line, i) => `${String(startLine + i).padStart(width, " ")}|${line}`)
    .join("\n");
}

function resolveLineWindow(
  totalLines: number,
  range: ReadFileRange | undefined,
): { start: number; end: number; truncated: boolean } {
  if (totalLines === 0) {
    return { start: 1, end: 0, truncated: false };
  }

  let start = range?.startLine;
  let end = range?.endLine;

  if (start !== undefined) {
    if (!Number.isInteger(start) || start < 1) {
      throw new HostError("INVALID_RANGE", `startLine must be an integer >= 1 (got ${start})`);
    }
  }
  if (end !== undefined) {
    if (!Number.isInteger(end) || end < 1) {
      throw new HostError("INVALID_RANGE", `endLine must be an integer >= 1 (got ${end})`);
    }
  }

  if (start === undefined && end === undefined) {
    start = 1;
    end = totalLines;
  } else if (start === undefined) {
    start = 1;
  } else if (end === undefined) {
    end = totalLines;
  }

  if (start > totalLines) {
    throw new HostError(
      "INVALID_RANGE",
      `startLine ${start} is beyond end of file (${totalLines} lines)`,
    );
  }
  if (end! < start!) {
    throw new HostError(
      "INVALID_RANGE",
      `endLine ${end} must be >= startLine ${start}`,
    );
  }

  let truncated = false;
  // Safety cap only when caller did not pin an explicit endLine.
  if (range?.endLine === undefined && end! - start! + 1 > READ_DEFAULT_MAX_LINES) {
    end = start! + READ_DEFAULT_MAX_LINES - 1;
    truncated = true;
  }
  if (end! > totalLines) end = totalLines;

  return { start: start!, end: end!, truncated };
}

function stripBom(raw: string): { bom: string; text: string } {
  if (raw.charCodeAt(0) === 0xfeff) {
    return { bom: "\uFEFF", text: raw.slice(1) };
  }
  return { bom: "", text: raw };
}

function assertSafeRel(rel: string): string {
  const cleaned = rel.replace(/\\/g, "/").replace(/^\.\//, "");
  if (!cleaned || cleaned.includes("..") || path.isAbsolute(cleaned) || cleaned.startsWith("/")) {
    throw new HostError("PATH_ESCAPE", `unsafe relative path: ${rel}`);
  }
  return cleaned;
}

function walkFiles(dir: string, base: string, out: ListedFile[]): void {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of names) {
    if (SKIP_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    const rel = path.relative(base, full).split(path.sep).join("/");
    if (st.isDirectory()) {
      walkFiles(full, base, out);
    } else if (st.isFile()) {
      out.push({ path: rel, size: st.size });
    }
  }
}

export function listAppFiles(paths: WorkspacePaths, appId: string): ListedFile[] {
  const id = asAppId(appId);
  const dir = paths.appDir(id);
  if (!existsSync(dir)) {
    throw new HostError("APP_NOT_FOUND", `app not found: ${id}`);
  }
  const out: ListedFile[] = [];
  walkFiles(dir, dir, out);
  out.sort((a, b) => a.path.localeCompare(b.path));
  return out;
}

export function readAppFile(
  paths: WorkspacePaths,
  appId: string,
  relPath: string,
  range?: ReadFileRange,
): ReadFileResult {
  const id = asAppId(appId);
  const rel = assertSafeRel(relPath);
  const full = paths.appFile(id, rel);
  if (!existsSync(full)) {
    throw new HostError("FILE_NOT_FOUND", `file not found: ${rel}`);
  }
  const raw = readFileSync(full, "utf8");
  const { text } = stripBom(raw);
  const allLines = splitLines(text);
  const totalLines = allLines.length;
  const { start, end, truncated } = resolveLineWindow(totalLines, range);

  const wholeFile =
    totalLines === 0 ||
    (start === 1 && end === totalLines && !truncated && !range?.numbered);

  let content: string;
  if (wholeFile) {
    content = text;
  } else if (totalLines === 0) {
    content = "";
  } else {
    const slice = allLines.slice(start - 1, end);
    content = range?.numbered ? formatNumbered(slice, start) : slice.join("\n");
  }

  return {
    path: rel,
    content,
    bytes: Buffer.byteLength(content, "utf8"),
    totalLines,
    startLine: totalLines === 0 ? 1 : start,
    endLine: end,
    ...(truncated ? { truncated: true } : {}),
  };
}

export function writeAppFile(
  paths: WorkspacePaths,
  appId: string,
  relPath: string,
  content: string,
): MutateFileResult {
  const id = asAppId(appId);
  const rel = assertSafeRel(relPath);
  if (rel === "manifest.json" || rel.endsWith("/manifest.json")) {
    parseManifest(content);
  }
  const full = paths.appFile(id, rel);
  const created = !existsSync(full);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, content, "utf8");
  return { path: rel, bytes: Buffer.byteLength(content, "utf8"), created };
}

export function editAppFile(
  paths: WorkspacePaths,
  appId: string,
  relPath: string,
  edits: Edit[],
): MutateFileResult {
  const id = asAppId(appId);
  const rel = assertSafeRel(relPath);
  if (!edits.length) {
    throw new HostError("INVALID_EDIT", "edits must contain at least one replacement");
  }
  const full = paths.appFile(id, rel);
  if (!existsSync(full)) {
    throw new HostError("FILE_NOT_FOUND", `file not found: ${rel}`);
  }
  const raw = readFileSync(full, "utf8");
  const { bom, text } = stripBom(raw);
  const ending = detectLineEnding(text);
  const normalized = normalizeToLF(text);
  let applied;
  try {
    applied = applyEditsToNormalizedContent(normalized, edits, rel);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    throw new HostError("EDIT_FAILED", message, { cause });
  }
  const restored = restoreLineEndings(applied.newContent, ending);
  const next = bom + restored;
  if (rel === "manifest.json" || rel.endsWith("/manifest.json")) {
    parseManifest(next);
  }
  writeFileSync(full, next, "utf8");
  const { diff } = generateDiffString(applied.baseContent, applied.newContent);
  return { path: rel, bytes: Buffer.byteLength(next, "utf8"), diff };
}

export function deleteAppFile(paths: WorkspacePaths, appId: string, relPath: string): { path: string } {
  const id = asAppId(appId);
  const rel = assertSafeRel(relPath);
  if (rel === "manifest.json") {
    throw new HostError("FORBIDDEN", "cannot delete manifest.json; remove the app instead");
  }
  const full = paths.appFile(id, rel);
  if (!existsSync(full)) {
    throw new HostError("FILE_NOT_FOUND", `file not found: ${rel}`);
  }
  unlinkSync(full);
  return { path: rel };
}

export type { AbsolutePath, AppId, Edit };
