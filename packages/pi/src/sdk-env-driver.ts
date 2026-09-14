/**
 * PiEnvDriver backed by the official pi SDK.
 *
 * tool / listTools: long-lived ephemeral AgentSession holding the tool registry
 * (isolated from the user's chat session via SessionManager.inMemory()).
 *
 * mcp: pi exposes MCP servers as tools (sourceInfo). We route mcp(name) to the
 * same execute path; if no matching tool, fail loud.
 */
import { randomBytes } from "node:crypto";

import type { PiEnvDriver } from "./env-driver.ts";
import {
  loadPiCodingAgent,
  openEphemeralSession,
  type EphemeralSession,
  type PiSdkModule,
  type PiSdkRuntimeOptions,
} from "./sdk-runtime.ts";

export type CreatePiSdkEnvDriverOptions = PiSdkRuntimeOptions & {
  /** Tool allowlist for the env session. Default: coding builtins. */
  tools?: string[];
};

type ToolDef = {
  name: string;
  description?: string;
  parameters?: unknown;
  execute: (
    toolCallId: string,
    params: Record<string, unknown>,
    signal: AbortSignal | undefined,
    onUpdate: undefined,
    ctx: unknown,
  ) => Promise<{ content: Array<{ type: string; text?: string }>; details?: unknown }>;
};

function stringifyResult(result: {
  content: Array<{ type: string; text?: string }>;
  details?: unknown;
}): unknown {
  if (result.details !== undefined) return result.details;
  const text = result.content
    .filter((c) => c.type === "text" && typeof c.text === "string")
    .map((c) => c.text)
    .join("\n");
  return text;
}

function minimalToolCtx(session: EphemeralSession["session"], cwd: string): unknown {
  return {
    ui: {
      notify: () => {},
      select: async () => undefined,
      confirm: async () => false,
      input: async () => undefined,
    },
    mode: "rpc",
    hasUI: false,
    cwd,
    sessionManager: (session as unknown as { sessionManager?: unknown }).sessionManager,
    modelRegistry: (session as unknown as { modelRegistry?: unknown }).modelRegistry,
    model: session.model,
    scopedModels: [],
    isIdle: () => true,
    isProjectTrusted: () => true,
    signal: undefined,
    abort: () => {},
    hasPendingMessages: () => false,
    shutdown: () => {},
    getContextUsage: () => undefined,
    compact: () => {},
    getSystemPrompt: () => "",
  };
}

export async function createPiSdkEnvDriver(
  options: CreatePiSdkEnvDriverOptions = {},
): Promise<PiEnvDriver & { dispose(): void }> {
  const pi = await loadPiCodingAgent();
  const cwd = options.cwd ?? process.cwd();
  const ephemeral = await openEphemeralSession(pi, {
    cwd,
    agentDir: options.agentDir,
    provider: options.provider,
    model: options.model,
    tools: options.tools ?? ["read", "bash", "edit", "write", "grep", "find", "ls"],
  });

  const getDef = (name: string): ToolDef | undefined => {
    return ephemeral.session.getToolDefinition(name) as ToolDef | undefined;
  };

  return {
    listTools() {
      return ephemeral.session.getAllTools().map((t) => ({
        name: t.name,
        description: t.description ?? "",
        parameters: t.parameters ?? { type: "object", properties: {} },
        source: (t as { sourceInfo?: { source?: string } }).sourceInfo?.source,
      }));
    },

    async tool(name, args) {
      const def = getDef(name);
      if (!def) throw new Error(`tool not found: ${name}`);
      const result = await def.execute(
        `mma-${randomBytes(4).toString("hex")}`,
        args ?? {},
        undefined,
        undefined,
        minimalToolCtx(ephemeral.session, cwd),
      );
      return stringifyResult(result);
    },

    async mcp(name, args) {
      // Prefer exact name; also try common mcp__server__tool patterns if present.
      const all = ephemeral.session.getAllTools();
      const match =
        getDef(name) ??
        all
          .filter((t) => {
            const src = (t as { sourceInfo?: { source?: string } }).sourceInfo?.source ?? "";
            return src.toLowerCase().includes("mcp") && t.name === name;
          })
          .map((t) => getDef(t.name))[0];
      if (!match) {
        throw new Error(
          `mcp tool not found: ${name} (pi MCP servers appear as tools; use listTools / ctx.tool)`,
        );
      }
      const result = await match.execute(
        `mma-mcp-${randomBytes(4).toString("hex")}`,
        args ?? {},
        undefined,
        undefined,
        minimalToolCtx(ephemeral.session, cwd),
      );
      return stringifyResult(result);
    },

    dispose() {
      ephemeral.dispose();
    },
  };
}

/** Env driver that lists/executes via ExtensionAPI + a sibling SDK session for execute. */
export async function createPiExtensionEnvDriver(
  piApi: {
    getAllTools(): Array<{
      name: string;
      description?: string;
      parameters?: unknown;
      sourceInfo?: { source?: string };
    }>;
    getActiveTools(): string[];
  },
  options: CreatePiSdkEnvDriverOptions = {},
): Promise<PiEnvDriver & { dispose(): void }> {
  // Listing comes from the live extension session; execution still uses an isolated SDK session
  // so we don't inject tool runs into the user's chat transcript.
  const sdk = await createPiSdkEnvDriver(options);
  return {
    listTools() {
      return piApi.getAllTools().map((t) => ({
        name: t.name,
        description: t.description ?? "",
        parameters: t.parameters ?? { type: "object", properties: {} },
        source: t.sourceInfo?.source,
        active: piApi.getActiveTools().includes(t.name),
      }));
    },
    tool: (name, args) => sdk.tool(name, args),
    mcp: (name, args) => sdk.mcp(name, args),
    dispose: () => sdk.dispose(),
  };
}

export type { PiSdkModule };
