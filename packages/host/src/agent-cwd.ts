/**
 * Resolve ctx.agent working directory from cwdType + cwd.
 *
 * Rules:
 * - default cwdType = "process"
 * - cwd alone ⇒ treat as custom path
 * - cwd + cwdType not "custom" ⇒ conflict error
 * - cwdType "custom" without cwd ⇒ error
 * - cwdType "app" needs AppRuntime.appDir (from the calling mini-app ctx)
 */
import { mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { HostError } from "./errors.ts";

export type AgentCwdType = "app" | "process" | "temp" | "custom";

export type AgentCwdInput = {
  cwdType?: AgentCwdType;
  /** Absolute path; only for custom (or alone ⇒ implied custom). */
  cwd?: string;
};

/** Subset of AppRuntime needed to resolve cwdType "app". */
export type AgentCwdContext = {
  appDir?: string;
};

const CWD_TYPES = new Set<AgentCwdType>(["app", "process", "temp", "custom"]);

export function isAgentCwdType(value: unknown): value is AgentCwdType {
  return typeof value === "string" && CWD_TYPES.has(value as AgentCwdType);
}

function assertEnterableDir(abs: string, label: string): string {
  if (!path.isAbsolute(abs)) {
    throw new HostError("INVALID_AGENT_CWD", `agent: ${label} must be an absolute path: ${abs}`);
  }
  try {
    if (!statSync(abs).isDirectory()) {
      throw new HostError("INVALID_AGENT_CWD", `agent: ${label} is not a directory: ${abs}`);
    }
  } catch (cause) {
    if (cause instanceof HostError) throw cause;
    throw new HostError(
      "INVALID_AGENT_CWD",
      `agent: ${label} is not an accessible directory: ${abs}`,
      { cause },
    );
  }
  return abs;
}

/**
 * Resolve an absolute enterable cwd for the agent session.
 * When cwdType is "temp", creates a new directory under os.tmpdir().
 */
export function resolveAgentCwd(input: AgentCwdInput, ctx: AgentCwdContext = {}): string {
  const rawPath = typeof input.cwd === "string" ? input.cwd.trim() : "";
  const hasPath = rawPath.length > 0;
  const type = input.cwdType;

  if (type !== undefined && !isAgentCwdType(type)) {
    throw new HostError(
      "INVALID_AGENT_CWD",
      `agent: cwdType must be app|process|temp|custom (got ${JSON.stringify(type)})`,
    );
  }

  if (hasPath && type !== undefined && type !== "custom") {
    throw new HostError(
      "INVALID_AGENT_CWD",
      `agent: cwd path conflicts with cwdType=${type}; omit cwdType or set cwdType:"custom"`,
    );
  }

  if (hasPath) {
    // Custom paths must already be absolute — do not silently resolve against process.cwd().
    if (!path.isAbsolute(rawPath)) {
      throw new HostError(
        "INVALID_AGENT_CWD",
        `agent: cwd must be an absolute path (got ${JSON.stringify(rawPath)})`,
      );
    }
    return assertEnterableDir(rawPath, "cwd");
  }

  const effective: AgentCwdType = type ?? "process";

  switch (effective) {
    case "custom":
      throw new HostError("INVALID_AGENT_CWD", 'agent: cwdType "custom" requires cwd (absolute path)');
    case "app": {
      const appDir = typeof ctx.appDir === "string" ? ctx.appDir.trim() : "";
      if (!appDir) {
        throw new HostError(
          "INVALID_AGENT_CWD",
          'agent: cwdType "app" requires AppCallContext.appDir',
        );
      }
      return assertEnterableDir(path.resolve(appDir), "appDir");
    }
    case "process":
      return assertEnterableDir(path.resolve(process.cwd()), "process.cwd()");
    case "temp": {
      const dir = mkdtempSync(path.join(tmpdir(), "mma-agent-"));
      return assertEnterableDir(dir, "temp");
    }
    default: {
      const _exhaustive: never = effective;
      throw new HostError("INVALID_AGENT_CWD", `agent: unhandled cwdType ${_exhaustive}`);
    }
  }
}
