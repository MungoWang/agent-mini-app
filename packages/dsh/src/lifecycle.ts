import { cpSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

import type { HostLifecycle, HostServices, LogLevel, ToolDefinition } from "@monkey-mini-app/host";

import { type DshCtx,isRecord, toolsOf } from "./ctx.ts";
import { getSkillDir, getSkillMarkdown } from "./skills.ts";

type DefineTool = (opts: Record<string, unknown>) => unknown;

/**
 * Tool accepted by {@link registerTools}.
 *
 * `execute` is optional here on purpose: host's `ToolDefinition` requires it, but
 * this dsh seam defends against definitions that lack it and registers an executor
 * returning `{ ok: false, error: "no execute" }`. Widening the type at the seam keeps
 * that runtime contract expressible instead of forcing callers to fake an executor.
 */
export type RegisterableTool = Omit<ToolDefinition, "execute"> & { execute?: ToolDefinition["execute"] };

export type DshLifecycleOptions = {
  skillDest?: string;
};

function snapshotDshTools(tools: unknown): Array<Record<string, unknown>> {
  if (!tools) return [];
  const rows: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();
  const push = (raw: unknown, fallbackName?: string): void => {
    const t = isRecord(raw) ? raw : {};
    const name = String(t.name || t.title || t.id || fallbackName || "");
    if (!name || seen.has(name)) return;
    seen.add(name);
    rows.push({ name, description: String(t.description || "") });
  };
  const listed = isRecord(tools) && typeof tools.list === "function" ? tools.list() : undefined;
  if (Array.isArray(listed)) {
    for (const item of listed) push(item);
  } else if (isRecord(tools)) {
    for (const key of Object.keys(tools)) {
      push(tools[key], key);
    }
  }
  return rows;
}

async function loadDefineTool(): Promise<DefineTool | null> {
  try {
    const mod = await import(/* @vite-ignore */ "@deepseek-ai/dsh-tools");
    return typeof mod.defineTool === "function" ? mod.defineTool : null;
  } catch {
    return null;
  }
}

/**
 * Convert a JSON Schema node into the dsh-tools value-schema DSL.
 * - object: boolean `additionalProperties` required; nested `required` is per-property `required: true`
 * - array: recursive `items`
 * - top-level parameter `required: true` is applied by the caller (omit when optional)
 */
function toDshValueSchema(field: Record<string, unknown>, fallbackDesc?: string): Record<string, unknown> {
  const type = typeof field.type === "string" ? field.type : "string";
  const description =
    typeof field.description === "string"
      ? field.description
      : fallbackDesc !== undefined
        ? fallbackDesc
        : undefined;
  if (type === "object") {
    const props = isRecord(field.properties) ? field.properties : {};
    const req = new Set(Array.isArray(field.required) ? field.required.map(String) : []);
    const properties: Record<string, unknown> = {};
    for (const [k, raw] of Object.entries(props)) {
      const child = toDshValueSchema(isRecord(raw) ? raw : {}, k);
      if (req.has(k)) child.required = true;
      properties[k] = child;
    }
    const out: Record<string, unknown> = {
      type: "object",
      additionalProperties:
        typeof field.additionalProperties === "boolean" ? field.additionalProperties : true,
    };
    if (description) out.description = description;
    if (Object.keys(properties).length > 0) out.properties = properties;
    return out;
  }
  if (type === "array") {
    const out: Record<string, unknown> = {
      type: "array",
      items: isRecord(field.items) ? toDshValueSchema(field.items) : { type: "string" },
    };
    if (description) out.description = description;
    return out;
  }
  const out: Record<string, unknown> = { type };
  if (description) out.description = description;
  if (Array.isArray(field.enum)) out.enum = field.enum;
  return out;
}

/** Convert ToolDefinition.inputSchema → dsh-tools `parameters` map. */
function toolParameters(toolDef: RegisterableTool): Record<string, unknown> {
  const schema = isRecord(toolDef.inputSchema) ? toolDef.inputSchema : {};
  const props = isRecord(schema.properties) ? schema.properties : {};
  const required = new Set(Array.isArray(schema.required) ? schema.required.map(String) : []);
  const parameters: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(props)) {
    const field = isRecord(raw) ? raw : {};
    const param = toDshValueSchema(field, key);
    // dsh-tools: `required` may only be `true` when present — omit for optional fields.
    if (required.has(key)) param.required = true;
    parameters[key] = param;
  }
  return parameters;
}

export function registerTools(
  ctx: DshCtx,
  tools: RegisterableTool[],
  defineTool: DefineTool | null,
): Array<() => void> {
  const disposers: Array<() => void> = [];
  const toolsSvc = toolsOf(ctx);
  if (!toolsSvc?.register) {
    console.warn("[monkey-mini-app] ctx.tools missing; inject=['tools'] required for model-facing tools");
    return disposers;
  }
  for (const toolDef of tools) {
    const parameters = toolParameters(toolDef);
    const execute = async (args: Record<string, unknown>, toolCtx?: { signal?: AbortSignal }) => {
      return toolDef.execute ? await toolDef.execute(args ?? {}, toolCtx?.signal) : { ok: false, error: "no execute" };
    };
    const built = defineTool
      ? defineTool({
          name: toolDef.name,
          description: toolDef.description,
          parameters,
          output: {
            schema: { type: "object", additionalProperties: true },
            render: (_a: unknown, v: unknown) => [
              { type: "text", text: typeof v === "string" ? v : JSON.stringify(v, null, 2) },
            ],
          },
          execute,
        })
      : {
          name: toolDef.name,
          description: toolDef.description,
          parameters,
          output: {
            schema: { type: "object", additionalProperties: true },
            render: (_a: unknown, v: unknown) => [
              { type: "text", text: typeof v === "string" ? v : JSON.stringify(v, null, 2) },
            ],
          },
          execute,
        };
    try {
      const ret = toolsSvc.register(built);
      if (typeof ret === "function") disposers.push(ret);
    } catch (e) {
      console.warn(`[monkey-mini-app] tools.register failed for ${toolDef.name}:`, e);
    }
  }
  return disposers;
}

export function registerListCtxTools(
  ctx: DshCtx,
  defineTool: DefineTool | null = null,
): (() => void) | null {
  const toolsSvc = toolsOf(ctx);
  if (!toolsSvc?.register) return null;
  try {
    // Must go through defineTool so empty parameters compile to JSON Schema
    // `{ type: "object", … }` — raw `parameters: {}` becomes `type: null` on the wire.
    const def = {
      name: "mini_app_list_ctx_tools",
      description:
        "List live dsh tools for ctx.tool(name, args) inside main.api.ts. Call ONLY when the app will use ctx.tool. Skip for storage/bash/llm-only apps.",
      parameters: {},
      output: {
        schema: { type: "object", additionalProperties: true },
        render: (_a: unknown, v: unknown) => [
          { type: "text", text: typeof v === "string" ? v : JSON.stringify(v, null, 2) },
        ],
      },
      async execute() {
        const listed = snapshotDshTools(toolsOf(ctx));
        return {
          count: listed.length,
          note: "These names are for ctx.tool(name, args) inside main.api.ts. Prefer storage/bash/llm when possible.",
          tools: listed,
        };
      },
    };
    const built = defineTool ? defineTool(def) : def;
    const ret = toolsSvc.register(built);
    return typeof ret === "function" ? ret : null;
  } catch (e) {
    console.warn("[monkey-mini-app] register mini_app_list_ctx_tools failed", e);
    return null;
  }
}

export function installSkillDir(src: string, dest: string): void {
  mkdirSync(path.dirname(dest), { recursive: true });
  cpSync(src, dest, { recursive: true });
}

export function defaultSkillDest(): string {
  return path.join(homedir(), ".dsh", "skills", "monkey-mini-app");
}

/** dsh lifecycle: register mini_app_* tools, install skill, provide services. */
export class DshLifecycle implements HostLifecycle {
  private disposers: Array<() => void> = [];

  constructor(
    private readonly ctx: DshCtx,
    private readonly options: DshLifecycleOptions = {},
  ) {}

  async attach(_ctx: unknown, services: HostServices): Promise<void> {
    const defineTool = await loadDefineTool();
    this.disposers.push(...registerTools(this.ctx, services.tools.definitions(), defineTool));
    const extra = registerListCtxTools(this.ctx, defineTool);
    if (extra) this.disposers.push(extra);
    try {
      installSkillDir(getSkillDir(), this.options.skillDest ?? defaultSkillDest());
    } catch (e) {
      console.warn("[monkey-mini-app] skill install skipped:", e);
    }
    if (typeof this.ctx.provide === "function") {
      this.ctx.provide("monkeyMiniApp", {
        tools: services.tools,
        paths: services.paths,
        config: services.config,
        runtimeRoot: services.paths.root,
        skillDir: getSkillDir(),
        skillMarkdown: getSkillMarkdown(),
      });
    }
  }

  async detach(): Promise<void> {
    const list = this.disposers.splice(0, this.disposers.length);
    for (const d of list) {
      try {
        d();
      } catch {
        /* ignore */
      }
    }
  }

  onHostPortChanged(_port: number): void {
    // client reads /api/host-config
  }

  log(level: LogLevel, message: string, meta?: unknown): void {
    const line = `[monkey-mini-app] ${message}`;
    if (level === "error") console.error(line, meta ?? "");
    else if (level === "warn") console.warn(line, meta ?? "");
    else console.log(line, meta ?? "");
  }
}
