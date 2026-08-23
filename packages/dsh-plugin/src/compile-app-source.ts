import { transform } from "sucrase";

/**
 * Compile a mini-app backend file (main.api.ts / lib/*.ts) to CJS that
 * `new Function("module","exports","require", ...)` can run.
 *
 * Use sucrase (same engine as the UI runner) so real TypeScript —
 * parameter types, return types, `catch (e: any)` — compiles. Do not
 * regex-strip `: type` (that wrecks `{ key: value }` and `(?:...)`).
 */
export function compileAppSource(src: string): string {
  const input = String(src || "").replace(/^\uFEFF/, "");
  try {
    return transform(input, {
      transforms: ["typescript", "imports"],
      disableESTransforms: true,
      filePath: "app.ts",
    }).code;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error("compileAppSource: " + msg);
  }
}

export function jsonClone<T>(value: T, fallback: T): T {
  try {
    if (value === undefined) return fallback;
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return fallback;
  }
}
