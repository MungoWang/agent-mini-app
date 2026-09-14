/**
 * Caps endpoint discovery between pi (serve) and Shell (connect).
 * Well-known file under the shared runtime root.
 */
import fs from "node:fs";
import path from "node:path";

import type { AgentCapabilitiesHttpEndpoint } from "@monkey-mini-app/host";

export const CAPS_ENDPOINT_FILENAME = "agent-capabilities.json";

export function capsEndpointPath(runtimeRoot: string): string {
  return path.join(runtimeRoot, CAPS_ENDPOINT_FILENAME);
}

export function writeCapsEndpoint(
  runtimeRoot: string,
  endpoint: AgentCapabilitiesHttpEndpoint,
): string {
  const fp = capsEndpointPath(runtimeRoot);
  fs.mkdirSync(runtimeRoot, { recursive: true });
  fs.writeFileSync(fp, `${JSON.stringify({ url: endpoint.url, token: endpoint.token }, null, 2)}\n`, "utf8");
  return fp;
}

export function readCapsEndpoint(runtimeRoot: string): AgentCapabilitiesHttpEndpoint {
  const fp = capsEndpointPath(runtimeRoot);
  if (!fs.existsSync(fp)) {
    throw new Error(`caps endpoint file missing: ${fp} (is the pi Agent Client serving?)`);
  }
  const raw = JSON.parse(fs.readFileSync(fp, "utf8")) as { url?: string; token?: string };
  if (typeof raw.url !== "string" || typeof raw.token !== "string") {
    throw new Error(`invalid caps endpoint file: ${fp}`);
  }
  return { url: raw.url, token: raw.token };
}

export function clearCapsEndpoint(runtimeRoot: string): void {
  const fp = capsEndpointPath(runtimeRoot);
  if (fs.existsSync(fp)) fs.unlinkSync(fp);
}
