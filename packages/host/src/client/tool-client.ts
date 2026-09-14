/**
 * Http ToolClient — Agent Client → Host ToolPort over localhost.
 */
import { HostError } from "../errors.ts";
import type { ToolDefinition } from "../tools/tool-facade.ts";

export type ToolClient = {
  list(): Promise<Pick<ToolDefinition, "name" | "description" | "inputSchema">[]>;
  invoke(
    name: string,
    args?: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<unknown>;
};

export type ToolClientOptions = {
  /** Host base URL, e.g. http://127.0.0.1:17880 */
  baseUrl: string;
  /** Optional bearer token (future); unused while Host is loopback-only */
  token?: string;
};

export function createToolClient(options: ToolClientOptions): ToolClient {
  const base = options.baseUrl.replace(/\/$/, "");
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (options.token) headers.authorization = `Bearer ${options.token}`;

  return {
    async list() {
      const res = await fetch(`${base}/api/tools`);
      const body = (await res.json()) as {
        tools?: Pick<ToolDefinition, "name" | "description" | "inputSchema">[];
        error?: string;
      };
      if (!res.ok) {
        throw new HostError("TOOL_CLIENT", body.error ?? `list tools http ${res.status}`);
      }
      return body.tools ?? [];
    },
    async invoke(name, args, signal) {
      const res = await fetch(`${base}/api/tools/invoke`, {
        method: "POST",
        headers,
        body: JSON.stringify({ name, args: args ?? {} }),
        signal,
      });
      const body = await res.json();
      if (!res.ok) {
        const err = body as { error?: string; code?: string };
        throw new HostError(err.code ?? "TOOL_CLIENT", err.error ?? `invoke http ${res.status}`);
      }
      return body;
    },
  };
}
