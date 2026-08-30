/**
 * Shared / extensible options for ctx.llm and ctx.agent.
 * Minimum known field set is explicit; hosts may intersect extra fields at the edges.
 */

/** JSON Schema document passed as `opts.schema` (soft-instruct + coerce). */
export type JsonSchema = object;

/**
 * Minimum shared options for model-backed calls (llm + agent).
 * Open for declaration merging / intersection by host packages.
 */
export interface ModelCallOptions {
  provider?: string;
  model?: string;
  /** Extra system instruction (combined with schema instruction when both set). */
  system?: string;
  /** When set, host soft-instructs JSON-only output and coerces fences/preamble. */
  schema?: JsonSchema;
  maxTokens?: number;
  signal?: AbortSignal;
}

/** Options for HostCapabilities.llm / ctx.llm. */
export interface LlmRunOptions extends ModelCallOptions {}

/** Subset used by JSON instruct / coerce helpers. */
export type JsonInstructOptions = Pick<ModelCallOptions, "schema" | "system">;

/** Subset used by provider/model routing. */
export type ModelRouteOptions = Pick<ModelCallOptions, "provider" | "model">;
