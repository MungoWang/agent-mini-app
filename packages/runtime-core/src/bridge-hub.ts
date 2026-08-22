import {
  type Transport,
  type BridgeCallMessage,
  decodeMessage,
  encodeMessage,
  createResult,
  permissionForApi,
  type BridgeErrorCode,
} from "@monkey-mini-app/bridge-protocol";
import type { HostPort, Manifest } from "@monkey-mini-app/host-port";
import type { createStorageHandlers } from "./storage.js";

export type BridgeHubOptions = {
  host: HostPort;
  getManifest: (appId: string) => Manifest | null;
  storage: ReturnType<typeof createStorageHandlers>;
  getThemeId: () => string;
};

export function attachBridgeHub(
  appId: string,
  transport: Transport,
  opts: BridgeHubOptions
): () => void {
  return transport.onMessage(async (raw) => {
    let msg;
    try {
      msg = decodeMessage(raw);
    } catch {
      return;
    }
    if (msg.type !== "bridge.call") return;
    const call = msg as BridgeCallMessage;
    try {
      const result = await dispatch(appId, call.api, call.payload, opts);
      transport.send(encodeMessage(createResult(call.id, true, result)));
    } catch (e) {
      const err = e as { code?: BridgeErrorCode; message?: string };
      const code: BridgeErrorCode =
        err.code === "PERMISSION_DENIED" ||
        err.code === "NOT_FOUND" ||
        err.code === "INVALID_PAYLOAD" ||
        err.code === "HOST_ERROR" ||
        err.code === "INTERNAL"
          ? err.code
          : "HOST_ERROR";
      transport.send(
        encodeMessage(
          createResult(call.id, false, undefined, {
            code,
            message: err.message ?? String(e),
          })
        )
      );
    }
  });
}

async function dispatch(
  appId: string,
  api: string,
  payload: unknown,
  opts: BridgeHubOptions
): Promise<unknown> {
  const manifest = opts.getManifest(appId);
  if (!manifest) {
    throw Object.assign(new Error("app not found"), { code: "NOT_FOUND" });
  }
  const required = permissionForApi(api);
  if (required && !manifest.permissions.includes(required)) {
    throw Object.assign(new Error(`permission required: ${required}`), {
      code: "PERMISSION_DENIED",
    });
  }

  const p = (payload ?? {}) as Record<string, unknown>;

  if (api === "storage.get") {
    return opts.storage.get(appId, {
      key: String(p.key),
      file: p.file as string | undefined,
    });
  }
  if (api === "storage.set") {
    return opts.storage.set(appId, {
      key: String(p.key),
      value: p.value,
      file: p.file as string | undefined,
    });
  }
  if (api === "storage.delete") {
    return opts.storage.delete(appId, {
      key: String(p.key),
      file: p.file as string | undefined,
    });
  }
  if (api === "storage.keys") {
    return opts.storage.keys(appId, { file: p.file as string | undefined });
  }
  if (api === "storage.clear") {
    return opts.storage.clear(appId, { file: p.file as string | undefined });
  }
  if (api === "storage.listFiles") {
    return opts.storage.listFiles(appId);
  }
  if (api === "theme.get") {
    return { themeId: opts.getThemeId() };
  }
  if (api === "ui.toast") {
    opts.host.log?.("info", `toast:${appId}`, p);
    return { ok: true };
  }
  if (api.startsWith("host.")) {
    const name = api.slice("host.".length);
    try {
      return await opts.host.invoke(name, p);
    } catch (e) {
      throw Object.assign(new Error(String(e)), { code: "HOST_ERROR" });
    }
  }
  throw Object.assign(new Error(`unknown api: ${api}`), { code: "NOT_FOUND" });
}
