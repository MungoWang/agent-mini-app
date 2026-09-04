import type { HttpGateway } from "./http/http-gateway.ts";
import type { WorkspacePaths } from "./paths/workspace-paths.ts";
import type { HostCapabilities } from "./capabilities.ts";
import { HostError } from "./errors.ts";
import type { HostLifecycle, HostServices } from "./lifecycle.ts";
import type { HostConfig } from "./types.ts";

/** Agent-agnostic host. `apply` = attach + listen on the Hono HttpGateway. */
export class Host {
  private boundPort = 0;
  private attached = false;
  private active = false;

  constructor(
    private readonly capabilities: HostCapabilities,
    private readonly lifecycle: HostLifecycle,
    private readonly paths: WorkspacePaths,
    private readonly config: HostConfig,
    private readonly services: HostServices,
    private readonly http: HttpGateway,
  ) {}

  /** Live listen port — follows HttpGateway across hostPort rebinds. */
  get port(): number {
    return this.http.port || this.boundPort;
  }

  async apply(ctx?: unknown): Promise<{ port: number }> {
    if (!this.attached) {
      await this.lifecycle.attach(ctx, this.services);
      this.attached = true;
    }
    return this.start();
  }

  async start(): Promise<{ port: number }> {
    this.active = true;
    if (this.port > 0) {
      return { port: this.port };
    }
    try {
      this.boundPort = await this.http.listen(this.config.hostPort);
    } catch (cause) {
      if (cause instanceof HostError) {
        throw cause;
      }
      throw new HostError(
        "HOST_LISTEN_FAILED",
        `failed to listen on ${this.config.hostPort}`,
        { cause },
      );
    }
    this.lifecycle.onHostPortChanged?.(this.port);
    return { port: this.port };
  }

  async stop(): Promise<void> {
    if (!this.active && this.port === 0 && !this.attached) {
      return;
    }
    this.active = false;
    this.boundPort = 0;
    try {
      await this.http.close();
    } finally {
      // Keep the receiver: `detach` is declared as a method on HostLifecycle, so a class
      // implementation is entitled to use `this`. Pulling it out of the object and calling it
      // bare silently broke every such adapter (dsh's detach clears `this.disposers`).
      const { lifecycle } = this;
      this.attached = false;
      if (lifecycle.detach) {
        await lifecycle.detach();
      }
    }
  }
}
