import type { HostCapabilities } from "./capabilities.ts";
import { HostError } from "./errors.ts";
import type { HttpGateway } from "./http/http-gateway.ts";
import type { HostLifecycle, HostServices } from "./lifecycle.ts";
import type { WorkspacePaths } from "./paths/workspace-paths.ts";
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

  get port(): number {
    return this.boundPort;
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
    if (this.boundPort > 0) {
      return { port: this.boundPort };
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
    this.lifecycle.onHostPortChanged?.(this.boundPort);
    return { port: this.boundPort };
  }

  async stop(): Promise<void> {
    if (!this.active && this.boundPort === 0 && !this.attached) {
      return;
    }
    this.active = false;
    this.boundPort = 0;
    try {
      await this.http.close();
    } finally {
      const detach = this.lifecycle.detach;
      this.attached = false;
      if (detach) {
        await detach();
      }
    }
  }
}
