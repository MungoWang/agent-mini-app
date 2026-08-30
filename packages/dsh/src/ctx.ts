export type DshToolSchema = {
  name?: string;
  description?: string;
  parameters?: Record<string, unknown>;
};

export type DshToolService = {
  register?: (tool: unknown) => void | (() => void);
  get?: (name: string) => unknown;
  schemas?: (scope?: unknown) => DshToolSchema[];
  list?: () => unknown;
  /** Agent-scoped mask; `deny` / `allow` must name known global tools. */
  restrict?: (filter: { allow?: string[]; deny?: string[] }) => () => void;
};

export type DshLlmService = {
  stream: (req: unknown) => AsyncIterable<unknown>;
};

export type DshCtx = {
  tools?: DshToolService;
  get?: (name: string) => unknown;
  provide?: (key: string, value: unknown) => void;
  [key: string]: unknown;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * cordis 服务访问：优先 `ctx.get(name)`（不要求 inject）。
 * 属性访问 `ctx[name]` 仅对已 inject 的服务安全；未声明时 Proxy 会抛，必须 catch。
 */
export function getService(ctx: DshCtx, name: string): unknown {
  try {
    if (typeof ctx.get === "function") {
      const viaGet = ctx.get(name);
      if (viaGet !== undefined) return viaGet;
    }
  } catch {
    /* ignore */
  }
  try {
    const direct = ctx[name];
    if (direct !== undefined) return direct;
  } catch {
    /* undeclared inject — treat as missing */
  }
  return undefined;
}

export function toolsOf(ctx: DshCtx): DshToolService | undefined {
  const tools = getService(ctx, "tools");
  return isRecord(tools) ? (tools as DshToolService) : undefined;
}
