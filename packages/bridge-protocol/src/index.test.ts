import { describe, it, expect } from "vitest";
import {
  encodeMessage,
  decodeMessage,
  createCall,
  createResult,
  permissionForApi,
  BRIDGE_PROTOCOL_VERSION,
} from "./index.js";

describe("bridge-protocol", () => {
  it("round-trips call messages", () => {
    const msg = createCall("c-1", "storage.get", { key: "a" });
    const raw = encodeMessage(msg);
    const back = decodeMessage(raw);
    expect(back).toEqual(msg);
    expect(back.v).toBe(BRIDGE_PROTOCOL_VERSION);
  });

  it("round-trips error results", () => {
    const msg = createResult("c-1", false, undefined, {
      code: "PERMISSION_DENIED",
      message: "nope",
    });
    expect(decodeMessage(encodeMessage(msg))).toEqual(msg);
  });

  it("permissionForApi maps storage and host", () => {
    expect(permissionForApi("storage.get")).toBe("storage");
    expect(permissionForApi("host.scanQr")).toBe("host:scanQr");
    expect(permissionForApi("theme.get")).toBeNull();
  });

  it("rejects invalid json", () => {
    expect(() => decodeMessage("{")).toThrow();
  });
});
