/**
 * ToolRegistrarPort for dsh — schema bridge + ctx.tools.register.
 */
import type { ToolDefinition, ToolRegistrarPort } from "@monkey-mini-app/host";

import { type DshCtx, isRecord, toolsOf } from "./ctx.ts";
import { type RegisterableTool,registerListCtxTools, registerTools } from "./lifecycle.ts";

type DefineTool = (opts: Record<string, unknown>) => unknown;

async function loadDefineTool(): Promise<DefineTool | null> {
  try {
    const mod = await import(/* @vite-ignore */ "@deepseek-ai/dsh-tools");
    return typeof mod.defineTool === "function" ? mod.defineTool : null;
  } catch {
    return null;
  }
}

export class DshToolRegistrar implements ToolRegistrarPort {
  private defineTool: DefineTool | null | undefined;

  constructor(private readonly ctx: DshCtx) {}

  private async ensureDefineTool(): Promise<DefineTool | null> {
    if (this.defineTool === undefined) {
      this.defineTool = await loadDefineTool();
    }
    return this.defineTool;
  }

  /**
   * Sync register used by AgentClient.bindToHost. Loads defineTool lazily on first call
   * via a cached promise kicked from {@link prepare}.
   */
  register(definitions: ToolDefinition[]): () => void {
    const defineTool = this.defineTool ?? null;
    const disposers = registerTools(this.ctx, definitions as RegisterableTool[], defineTool);
    return () => {
      for (const d of disposers) {
        try {
          d();
        } catch {
          /* ignore */
        }
      }
    };
  }

  /** Prefetch defineTool before bindToHost so sync register has it. */
  async prepare(): Promise<void> {
    await this.ensureDefineTool();
  }

  registerListCtxTools(): (() => void) | null {
    return registerListCtxTools(this.ctx, this.defineTool ?? null);
  }
}

export function snapshotDshToolNames(ctx: DshCtx): string[] {
  const tools = toolsOf(ctx);
  if (!tools) return [];
  const listed = isRecord(tools) && typeof tools.list === "function" ? tools.list() : undefined;
  if (!Array.isArray(listed)) return [];
  return listed.map((t) => String(isRecord(t) ? t.name ?? "" : "")).filter(Boolean);
}
