import { HostError } from "./errors.ts";
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
  /**
   * How many times to try **in total**, including the first call — `retryTimes: 1` means never
   * retry. Default 3 for `ctx.llm`, 1 for `ctx.agent`. A retry only happens for something
   * retrying can fix: a failed/empty call, or an answer that does not parse under `schema`.
   */
  retryTimes?: number;
  signal?: AbortSignal;
}

/** Options for HostCapabilities.llm / ctx.llm. */
export interface LlmRunOptions extends ModelCallOptions {}

/**
 * Output ceiling applied when the author leaves `maxTokens` unset.
 *
 * The shipped adapter used to default to 1024, which silently truncated any structured answer
 * bigger than a couple of paragraphs — a `schema` call asking for 13 scored items cannot fit, and
 * the app just saw `JSON.parse` fail with no reason in reach. Truncation is also how "the model
 * returned only its thinking" happens: the budget dies before the first content token.
 */
export const DEFAULT_LLM_MAX_TOKENS = 4096;

/**
 * How many times `ctx.llm` tries in total when `retryTimes` is unset. One is available for
 * `ctx.agent`, whose default is deliberately 1 — see `DEFAULT_AGENT_ATTEMPTS`.
 */
export const DEFAULT_LLM_ATTEMPTS = 3;

/**
 * `ctx.agent` does not re-run by default: a turn may already have posted a comment, written a
 * worklog or pushed a build, and replaying it repeats those side effects. Set `retryTimes` there
 * explicitly if your steps are idempotent.
 */
export const DEFAULT_AGENT_ATTEMPTS = 1;

/** Hard ceiling on attempts, so a typo cannot turn one call into a loop. */
export const MAX_LLM_ATTEMPTS = 8;

/** How much of a rejected answer is quoted back to the model and into the error. */
export const LLM_ATTEMPT_HEAD_CHARS = 400;

/** One recorded try, newest last. */
export type LlmAttempt = {
  /** 1-based attempt number. */
  n: number;
  /** `transport` = the call failed or answered nothing; `json` = it answered, not parseable. */
  kind: "transport" | "json";
  /** Why this try was rejected. */
  error: string;
  /** Bytes of model output this try produced (0 when it never got that far). */
  bytes: number;
  /** Start of the rejected output, so the shape of the mistake survives. */
  head?: string;
};

/** What a caller has to provide: run one try with the prompt/system the engine chose. */
export type LlmAttemptRunner = (input: string, opts: LlmRunOptions) => Promise<string>;

function headOf(text: string): string {
  const flat = String(text ?? "");
  return flat.length > LLM_ATTEMPT_HEAD_CHARS ? `${flat.slice(0, LLM_ATTEMPT_HEAD_CHARS)}…` : flat;
}

function attemptsOf(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(Math.floor(value), MAX_LLM_ATTEMPTS));
}

/**
 * Run a model call, retrying what retrying can fix, and never hand back an answer that violates
 * `schema` without saying so.
 *
 * The point is not politeness toward the model: apps used to receive the raw junk string and every
 * one of them re-implemented a salvage parser (~100 lines in the app that found this), because a
 * failure left them with no way to ask *why*. Here each try is recorded, the next try is told what
 * the previous one got wrong, and if nothing works the caller gets an error carrying all of it —
 * the rejected text included, so nothing is hidden from whoever has to fix the prompt.
 */
export async function runLlmAttempts(
  input: string,
  opts: LlmRunOptions | undefined,
  run: LlmAttemptRunner,
  defaults: { attempts: number } = { attempts: DEFAULT_LLM_ATTEMPTS },
): Promise<string> {
  // Own the default here rather than in each adapter, so every host caps output identically.
  const optsWithBudget: LlmRunOptions = { ...opts, maxTokens: opts?.maxTokens ?? DEFAULT_LLM_MAX_TOKENS };
  const total = attemptsOf(opts?.retryTimes, defaults.attempts);
  const wantsJson = optsWithBudget.schema != null;
  const signal = optsWithBudget.signal;
  const attempts: LlmAttempt[] = [];
  let lastError = "llm call failed";
  let rejectedSample = "";

  for (let n = 1; n <= total; n++) {
    if (signal?.aborted) {
      throw new HostError("ABORTED", `ctx.llm cancelled after ${attempts.length} attempt(s)`);
    }
    // From try 2 on, show the model exactly what was wrong. A blind re-roll is how a run burns
    // tokens reproducing the same truncated object.
    const prompt = n === 1 ? input : `${input}\n\nYour previous answer was rejected: ${lastError}${rejectedSample}\nAnswer again, and nothing else.`;
    try {
      const text = await run(prompt, optsWithBudget);
      if (!wantsJson) return text;
      try {
        JSON.parse(text);
        return text;
      } catch (cause) {
        const reason = cause instanceof Error ? cause.message : String(cause);
        lastError = `not valid JSON (${reason})`;
        const head = headOf(text);
        // Quote the mistake back. "not valid JSON" alone tells the model nothing about *its*
        // mistake, which is exactly the loop this is meant to break.
        rejectedSample = `\nIt said:\n${head}`;
        attempts.push({ n, kind: "json", error: reason, bytes: text.length, head });
      }
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : String(cause);
      lastError = `the model call failed (${reason})`;
      rejectedSample = "";
      attempts.push({ n, kind: "transport", error: reason, bytes: 0 });
    }
  }

  const code = attempts.some((a) => a.kind === "json") ? "LLM_JSON_INVALID" : "LLM_RETRY_EXHAUSTED";
  const detail = attempts
    .map((a) =>
      `  ${a.n}. ${a.kind}: ${a.error}${a.bytes ? ` [${a.bytes}B]` : ""}${a.head ? `\n     ${JSON.stringify(a.head)}` : ""}`,
    )
    .join("\n");
  throw new HostError(
    code,
    `${wantsJson ? "no answer matched the schema" : "no usable answer"} after ${attempts.length} attempt(s):\n${detail}`,
    { attempts },
  );
}



/** Subset used by JSON instruct / coerce helpers. */
export type JsonInstructOptions = Pick<ModelCallOptions, "schema" | "system">;

/** Subset used by provider/model routing. */
export type ModelRouteOptions = Pick<ModelCallOptions, "provider" | "model">;
