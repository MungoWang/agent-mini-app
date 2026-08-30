import { transform } from "sucrase";

import { HostError } from "../errors.ts";

/** Compile a mini-app backend file to CJS for `new Function`. */
export function compileAppSource(src: string): string {
  const input = src.replace(/^\uFEFF/, "");
  try {
    return transform(input, {
      transforms: ["typescript", "imports"],
      disableESTransforms: true,
      filePath: "app.ts",
    }).code;
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    throw new HostError("COMPILE_FAILED", `compileAppSource: ${message}`, { cause });
  }
}
