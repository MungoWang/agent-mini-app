/**
 * ToolRegistrarPort for pi — wraps Host tool defs for pi.registerTool.
 * Works without pi installed: stores registrations for tests / dispose.
 */
import type { ToolDefinition, ToolRegistrarPort } from "@monkey-mini-app/host";

export type PiRegisterTool = (def: {
  name: string;
  description: string;
  parameters?: unknown;
  execute: (
    toolCallId: string,
    params: Record<string, unknown>,
    signal?: AbortSignal,
  ) => Promise<{ content: Array<{ type: string; text: string }>; details?: unknown }>;
}) => (() => void) | void;

export class PiToolRegistrar implements ToolRegistrarPort {
  constructor(private readonly registerTool: PiRegisterTool) {}

  register(definitions: ToolDefinition[]): () => void {
    const disposers: Array<() => void> = [];
    for (const def of definitions) {
      const ret = this.registerTool({
        name: def.name,
        description: def.description,
        parameters: def.inputSchema,
        execute: async (_id, params, signal) => {
          const result = await def.execute(params ?? {}, signal);
          const text = typeof result === "string" ? result : JSON.stringify(result, null, 2);
          return {
            content: [{ type: "text", text }],
            details: result,
          };
        },
      });
      if (typeof ret === "function") disposers.push(ret);
    }
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
}

/** In-memory registrar for unit tests (no pi runtime). */
export function createMemoryPiRegistrar(): {
  registrar: PiToolRegistrar;
  tools: Map<string, ToolDefinition>;
} {
  const tools = new Map<string, ToolDefinition>();
  const registrar = new PiToolRegistrar((def) => {
    tools.set(def.name, {
      name: def.name,
      description: def.description,
      inputSchema: (def.parameters as Record<string, unknown>) ?? { type: "object" },
      execute: async (args, signal) => {
        const out = await def.execute("test", args, signal);
        return out.details ?? out.content[0]?.text;
      },
    });
    return () => {
      tools.delete(def.name);
    };
  });
  return { registrar, tools };
}
