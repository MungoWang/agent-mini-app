export const BRIDGE_PROTOCOL_VERSION = 1 as const;

export type BridgeErrorCode =
  | "PERMISSION_DENIED"
  | "NOT_FOUND"
  | "INVALID_PAYLOAD"
  | "TIMEOUT"
  | "HOST_ERROR"
  | "INTERNAL";

export type BridgeCallMessage = {
  v: typeof BRIDGE_PROTOCOL_VERSION;
  type: "bridge.call";
  id: string;
  api: string;
  payload: unknown;
};

export type BridgeResultMessage = {
  v: typeof BRIDGE_PROTOCOL_VERSION;
  type: "bridge.result";
  id: string;
  ok: boolean;
  result?: unknown;
  error?: { code: BridgeErrorCode; message: string };
};

export type BridgeEventMessage = {
  v: typeof BRIDGE_PROTOCOL_VERSION;
  type: "host.event";
  event: string;
  payload: unknown;
};

export type BridgeMessage =
  | BridgeCallMessage
  | BridgeResultMessage
  | BridgeEventMessage;

export type Transport = {
  send(message: string): void;
  onMessage(handler: (message: string) => void): () => void;
};

export function encodeMessage(msg: BridgeMessage): string {
  return JSON.stringify(msg);
}

export function decodeMessage(raw: string): BridgeMessage {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("INVALID_JSON");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("INVALID_MESSAGE");
  }
  const m = parsed as Record<string, unknown>;
  if (m.v !== BRIDGE_PROTOCOL_VERSION) {
    throw new Error("UNSUPPORTED_VERSION");
  }
  if (
    m.type !== "bridge.call" &&
    m.type !== "bridge.result" &&
    m.type !== "host.event"
  ) {
    throw new Error("UNKNOWN_TYPE");
  }
  return parsed as BridgeMessage;
}

export function createCall(
  id: string,
  api: string,
  payload: unknown
): BridgeCallMessage {
  return {
    v: BRIDGE_PROTOCOL_VERSION,
    type: "bridge.call",
    id,
    api,
    payload,
  };
}

export function createResult(
  id: string,
  ok: boolean,
  result?: unknown,
  error?: { code: BridgeErrorCode; message: string }
): BridgeResultMessage {
  return {
    v: BRIDGE_PROTOCOL_VERSION,
    type: "bridge.result",
    id,
    ok,
    ...(ok ? { result } : { error }),
  };
}

export function createEvent(
  event: string,
  payload: unknown
): BridgeEventMessage {
  return {
    v: BRIDGE_PROTOCOL_VERSION,
    type: "host.event",
    event,
    payload,
  };
}

/** Map API name → required permission (null = no permission required). */
export function permissionForApi(api: string): string | null {
  if (api.startsWith("storage.")) return "storage";
  if (api === "theme.get") return null;
  if (api.startsWith("ui.")) return "ui";
  if (api.startsWith("host.")) {
    const name = api.slice("host.".length);
    return `host:${name}`;
  }
  return api;
}
