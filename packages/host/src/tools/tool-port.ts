/**
 * Kernel ToolPort — agent-facing mini_app_* vocabulary + invoke.
 * Adapters register/transport only; they do not reimplement tool semantics.
 */
import { isMiniAppToolName,type ToolDefinition, ToolFacade } from "./tool-facade.ts";

/** Kernel ToolPort handle (implemented by {@link ToolFacade}). */
export type ToolPort = ToolFacade;

export type { ToolDefinition };
export { isMiniAppToolName, ToolFacade };

/** Explicit factory so composition roots do not `new ToolFacade` as an afterthought. */
export function createAgentTools(
  ...args: ConstructorParameters<typeof ToolFacade>
): ToolPort {
  return new ToolFacade(...args);
}
