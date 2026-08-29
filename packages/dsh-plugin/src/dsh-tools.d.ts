/** @deepseek-ai/dsh-tools 类型兜底（动态 import 运行时由 host 提供）。 */
declare module "@deepseek-ai/dsh-tools" {
  export function defineTool(def: unknown): unknown;
}
