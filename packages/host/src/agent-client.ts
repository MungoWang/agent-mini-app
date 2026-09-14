/**
 * Agent Client aggregate — caps + tool registration (+ optional skills/session).
 * Product adapters supply port implementations; this assembler has no product name.
 */
import type { ToolClient } from "./client/tool-client.ts";
import type { ToolDefinition } from "./tools/tool-facade.ts";
import type { ToolPort } from "./tools/tool-port.ts";
import type { AgentCapabilities } from "./capabilities.ts";

export type ToolAccess =
  | { mode: "inproc"; port: ToolPort }
  | { mode: "http"; client: ToolClient };

export interface ToolRegistrarPort {
  register(definitions: ToolDefinition[]): () => void;
}

export interface SkillPort {
  install(sourceDir: string): void;
}

export interface SessionPort {
  onSession?(handlers: { attach: () => void; detach: () => void }): () => void;
}

export type AgentClientPorts = {
  capabilities: AgentCapabilities;
  tools: ToolRegistrarPort;
  skills?: SkillPort;
  session?: SessionPort;
  /** Skill source directory installed on {@link AgentClient.start} when skills port is set */
  skillSourceDir?: string;
};

export interface AgentClient {
  readonly capabilities: AgentCapabilities;
  start(): Promise<void>;
  /** In-proc: registers immediately. Http: prefer {@link bindToHostAsync}. */
  bindToHost(access: ToolAccess): void;
  bindToHostAsync(access: ToolAccess): Promise<void>;
  dispose(): void;
}

async function definitionsFromAccess(access: ToolAccess): Promise<ToolDefinition[]> {
  if (access.mode === "inproc") {
    return access.port.definitions();
  }
  const listed = await access.client.list();
  return listed.map((d) => ({
    name: d.name,
    description: d.description,
    inputSchema: d.inputSchema,
    execute: (args, signal) => access.client.invoke(d.name, args, signal),
  }));
}

export function createAgentClient(ports: AgentClientPorts): AgentClient {
  const disposers: Array<() => void> = [];
  let started = false;
  let sessionUnsub: (() => void) | undefined;

  const registerDefs = (defs: ToolDefinition[]) => {
    disposers.push(ports.tools.register(defs));
  };

  return {
    capabilities: ports.capabilities,
    async start() {
      if (started) return;
      started = true;
      if (ports.skills && ports.skillSourceDir) {
        ports.skills.install(ports.skillSourceDir);
      }
      if (ports.session?.onSession) {
        sessionUnsub = ports.session.onSession({
          attach: () => {},
          detach: () => {},
        });
      }
    },
    bindToHost(access) {
      if (access.mode === "inproc") {
        registerDefs(access.port.definitions());
        return;
      }
      void definitionsFromAccess(access).then(registerDefs);
    },
    async bindToHostAsync(access) {
      registerDefs(await definitionsFromAccess(access));
    },
    dispose() {
      sessionUnsub?.();
      sessionUnsub = undefined;
      const list = disposers.splice(0, disposers.length);
      for (const d of list) {
        try {
          d();
        } catch {
          /* ignore */
        }
      }
      started = false;
    },
  };
}
