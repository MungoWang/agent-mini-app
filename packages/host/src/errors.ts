export class HostError extends Error {
  readonly code: string;

  constructor(code: string, message: string, options?: { cause?: unknown }) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = new.target.name;
    this.code = code;
  }
}

export class HostConfigError extends HostError {
  constructor(message: string, options?: { code?: string; cause?: unknown }) {
    super(options?.code ?? "HOST_CONFIG_INVALID", message, options);
  }
}
