export class HostError extends Error {
  readonly code: string;
  /**
   * Per-try record for calls that retry (see `runLlmAttempts`). Kept as `unknown[]` here so the
   * error type stays dependency-free; the llm engine fills it with `LlmAttempt[]`, and whoever
   * catches one reads it without re-deriving what the model said.
   */
  readonly attempts?: readonly unknown[];

  constructor(code: string, message: string, options?: { cause?: unknown; attempts?: readonly unknown[] }) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = new.target.name;
    this.code = code;
    if (options?.attempts) this.attempts = options.attempts;
  }
}

export class HostConfigError extends HostError {
  constructor(message: string, options?: { code?: string; cause?: unknown }) {
    super(options?.code ?? "HOST_CONFIG_INVALID", message, options);
  }
}
