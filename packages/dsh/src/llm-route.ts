import type { ModelRouteOptions } from "@monkey-mini-app/host";

import { type DshCtx,getService, isRecord } from "./ctx.ts";

/** Same defaults as dsh `agent-default-model` / legacy dsh-adapter. */
export const DSH_LLM_FALLBACK = {
  provider: "deepseek-official",
  model: "deepseek-v4-flash",
} as const;

export function pickLlmRoute(value: unknown): { provider: string; model: string } | null {
  if (!isRecord(value)) return null;
  const provider = typeof value.provider === "string" ? value.provider.trim() : "";
  const model = typeof value.model === "string" ? value.model.trim() : "";
  if (!provider || !model) return null;
  return { provider, model };
}

/**
 * Resolve provider/model for ctx.llm / ctx.agent.
 * Follows call opts → AppCallContext.hostLlm → dsh config → agentDefaultModel → fallback.
 * Never mutates opts.
 */
export function resolveLlmRoute(
  ctx: DshCtx,
  opts?: ModelRouteOptions,
  hostLlm?: { provider?: string; model?: string },
): { provider: string; model: string } {
  const fromOpts = pickLlmRoute({ provider: opts?.provider, model: opts?.model });
  if (fromOpts) return fromOpts;

  const fromHost = pickLlmRoute(hostLlm);
  if (fromHost) return fromHost;

  const cfg = getService(ctx, "config");
  const fromCfg = isRecord(cfg) ? pickLlmRoute(cfg.llm) : null;
  if (fromCfg) return fromCfg;

  const adm = getService(ctx, "agentDefaultModel");
  if (isRecord(adm) && typeof adm.currentSelection === "function") {
    try {
      const fromAdm = pickLlmRoute(adm.currentSelection());
      if (fromAdm) return fromAdm;
    } catch {
      /* ignore unbound settings */
    }
  }

  return { provider: DSH_LLM_FALLBACK.provider, model: DSH_LLM_FALLBACK.model };
}
