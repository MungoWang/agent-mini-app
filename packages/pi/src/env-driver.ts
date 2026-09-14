/**
 * Env-side AgentCapabilities drivers for pi: tool / mcp / listTools.
 * Same pattern as PiAiDriver — injectable; tests use memory, extension wires pi runtime.
 */
export type PiEnvDriver = {
  tool(name: string, args?: Record<string, unknown>): Promise<unknown>;
  mcp(name: string, args?: Record<string, unknown>): Promise<unknown>;
  listTools(): unknown[];
};

/** Clear failures until a live pi tool/MCP bridge is wired. */
export function createUnavailableEnvDriver(
  reason = "pi tool/mcp bridge not configured",
): PiEnvDriver {
  return {
    async tool() {
      throw new Error(reason);
    },
    async mcp() {
      throw new Error(reason);
    },
    listTools() {
      return [];
    },
  };
}

/** In-memory tool/mcp table for tests and local demos. */
export function createMemoryEnvDriver(seed?: {
  tools?: Record<string, (args?: Record<string, unknown>) => unknown | Promise<unknown>>;
  mcp?: Record<string, (args?: Record<string, unknown>) => unknown | Promise<unknown>>;
}): PiEnvDriver {
  const tools = { ...(seed?.tools ?? {}) };
  const mcp = { ...(seed?.mcp ?? {}) };
  return {
    async tool(name, args) {
      const fn = tools[name];
      if (!fn) throw new Error(`tool not found: ${name}`);
      return fn(args);
    },
    async mcp(name, args) {
      const fn = mcp[name];
      if (!fn) throw new Error(`mcp not found: ${name}`);
      return fn(args);
    },
    listTools() {
      return Object.keys(tools).map((name) => ({
        name,
        description: "",
        parameters: { type: "object", properties: {} },
      }));
    },
  };
}
