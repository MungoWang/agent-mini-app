/**
 * Call-level facts for a mini-app API invocation (no capability methods).
 * Passed as the first argument to HostCapabilities.* — never merged into user opts.
 */
export type AppCallContext = {
  /** Reverse-DNS app id (e.g. com.example.todo). */
  appId: string;
  /** Absolute runtime/apps/<appId> directory (derived from appId). */
  appDir: string;
  /** Cancel signal for the current dashboard API call. */
  signal?: AbortSignal;
  /**
   * Optional host.json llm route defaults — routing only, never written into opts.
   */
  hostLlm?: { provider?: string; model?: string };
};

/** Effective abort signal: user opts win when set, else call context signal. */
export function effectiveSignal(
  optsSignal: AbortSignal | undefined,
  call: AppCallContext | undefined,
): AbortSignal | undefined {
  return optsSignal ?? call?.signal;
}
