import { type AppId,asAppId } from "../brand.ts";
import { HostError } from "../errors.ts";

export type AppManifest = {
  id: AppId;
  name: string;
  version: string;
  entry: string;
  description?: string;
  permissions: string[];
  acronym?: string;
  theme?: { followsHost?: boolean };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(raw: Record<string, unknown>, key: string): string {
  const value = raw[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new HostError("INVALID_MANIFEST", `manifest missing ${key}`);
  }
  return value;
}

/** Parse and validate a mini-app manifest.json. */
export function parseManifest(raw: string): AppManifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (cause) {
    throw new HostError("INVALID_MANIFEST", "manifest is not valid JSON", { cause });
  }
  if (!isRecord(parsed)) {
    throw new HostError("INVALID_MANIFEST", "manifest must be an object");
  }
  let id: AppId;
  try {
    id = asAppId(requireString(parsed, "id"));
  } catch (cause) {
    throw new HostError("INVALID_MANIFEST", "manifest id is not a valid AppId", { cause });
  }
  const permissions = Array.isArray(parsed.permissions)
    ? parsed.permissions.filter((p): p is string => typeof p === "string")
    : [];
  const description = typeof parsed.description === "string" ? parsed.description : undefined;
  const acronym = typeof parsed.acronym === "string" ? parsed.acronym : undefined;
  const themeRaw = parsed.theme;
  const theme =
    isRecord(themeRaw) && typeof themeRaw.followsHost === "boolean"
      ? { followsHost: themeRaw.followsHost }
      : undefined;
  return {
    id,
    name: requireString(parsed, "name"),
    version: requireString(parsed, "version"),
    entry: requireString(parsed, "entry"),
    description,
    permissions,
    acronym,
    theme,
  };
}

/** Two-letter badge: manifest acronym wins, else first two alphanumeric of name. */
export function acronymOf(name: string, manifestAcronym?: string): string {
  if (manifestAcronym && /^[a-zA-Z0-9]{2}$/.test(manifestAcronym)) {
    return manifestAcronym.toUpperCase();
  }
  return name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toUpperCase();
}
