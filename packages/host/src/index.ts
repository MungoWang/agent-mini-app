export const packageName = "@monkey-mini-app/host";

export {
  asAbsolutePath,
  asAppId,
  assertNever,
  isAbsolutePath,
  isAppId,
} from "./brand.ts";
export type { AbsolutePath, AppId } from "./brand.ts";

export { HostConfigError, HostError } from "./errors.ts";

export { LOCALE_IDS, PALETTE_IDS, THEME_IDS } from "./types.ts";
export type {
  HostConfig,
  HostConfigInitInput,
  HostConfigSeed,
  LocaleId,
  LlmConfig,
  PaletteId,
  ThemeId,
} from "./types.ts";

export { DEFAULT_HOST_CONFIG_SEED } from "./config/defaults.ts";
export { parseHostConfig } from "./config/parse.ts";
export { bootstrapHostConfig } from "./config/bootstrap.ts";
export { loadHostConfig } from "./config/load.ts";
export { writeHostConfig } from "./config/write.ts";
export { WorkspacePaths } from "./paths/workspace-paths.ts";

export { createHostI18n } from "./i18n/index.ts";
export type { HostI18n, I18nParams } from "./i18n/index.ts";

export type { BoundHostCapabilities, HostCapabilities } from "./capabilities.ts";
export { bindCapsToContext } from "./capabilities.ts";
export type { AppCallContext } from "./app-runtime.ts";
export { effectiveSignal } from "./app-runtime.ts";
export type {
  AgentCwdType,
  AgentEvent,
  AgentEventHandler,
  AgentRunOptions,
  AgentTurnEndReason,
} from "./agent-events.ts";
export { isAgentCwdType, resolveAgentCwd } from "./agent-cwd.ts";
export type { AgentCwdContext, AgentCwdInput } from "./agent-cwd.ts";
export type {
  JsonInstructOptions,
  JsonSchema,
  LlmRunOptions,
  ModelCallOptions,
  ModelRouteOptions,
} from "./model-call.ts";
export type { HostLifecycle, HostServices, LogLevel } from "./lifecycle.ts";
export { EMPTY_THEME_RESOURCE } from "./theme-resource.ts";
export type { CustomThemePalette, ThemeResource } from "./theme-resource.ts";
export { HostEventBus, formatSse } from "./events/host-events.ts";
export type { HostEvent, HostEventListener } from "./events/host-events.ts";
export { Host } from "./host.ts";
export { createHost } from "./create-host.ts";

export { parseManifest, acronymOf } from "./apps/manifest.ts";
export type { AppManifest } from "./apps/manifest.ts";
export { listStorageTables, storageTablePath, readJsonFile } from "./apps/storage.ts";
export type { StorageTableInfo } from "./apps/storage.ts";
export { readAppTheme, writeAppTheme } from "./apps/app-theme.ts";
export type { AppTheme } from "./apps/app-theme.ts";
export { AppsManager } from "./apps/apps-manager.ts";
export type {
  AfterMutateOptions,
  AfterMutateResult,
  AppContext,
  AppItem,
  AppStorage,
  DashboardDef,
  DashboardMethod,
  ReloadResult,
} from "./apps/apps-manager.ts";
export {
  applyEditsToNormalizedContent,
  fuzzyFindText,
} from "./apps/edit-diff.ts";
export type { Edit } from "./apps/edit-diff.ts";

export { GitHistory } from "./git/git-history.ts";
export type {
  Commit,
  CommitNode,
  CommitTree,
  FileStat,
  GitAuthor,
} from "./git/git-history.ts";

export { ToolFacade, isMiniAppToolName } from "./tools/tool-facade.ts";
export type { ToolDefinition } from "./tools/tool-facade.ts";

export { HttpGateway } from "./http/http-gateway.ts";
export { appRunnerHtml } from "./http/app-runner-html.ts";
export { UiCompiler, resolveUiDistDir } from "./compile/ui-compiler.ts";
export type { UiBuildFile, UiCompileOptions } from "./compile/ui-compiler.ts";
