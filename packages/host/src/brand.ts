import path from "node:path";

import { HostError } from "./errors.ts";

declare const appIdBrand: unique symbol;
declare const absolutePathBrand: unique symbol;

export type AppId = string & { readonly [appIdBrand]: "AppId" };
export type AbsolutePath = string & { readonly [absolutePathBrand]: "AbsolutePath" };

const APP_ID_RE = /^[a-z][a-z0-9-]*(\.[a-z0-9-]+)+$/;

export function isAppId(value: string): value is AppId {
  return APP_ID_RE.test(value);
}

export function asAppId(value: string): AppId {
  if (!isAppId(value)) {
    throw new HostError("INVALID_APP_ID", `invalid AppId: ${value}`);
  }
  return value;
}

export function isAbsolutePath(value: string): value is AbsolutePath {
  return path.isAbsolute(value);
}

export function asAbsolutePath(value: string): AbsolutePath {
  if (!isAbsolutePath(value)) {
    throw new HostError("INVALID_PATH", `path must be absolute: ${value}`);
  }
  return value;
}

export function assertNever(value: never, message?: string): never {
  throw new HostError("UNREACHABLE", message ?? `unexpected value: ${String(value)}`);
}
