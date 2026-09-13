export const packageName = "@monkey-mini-app/host";

export type {
  AboutInfo,
  AboutPackage,
  HostAboutMeta,
  UpdateCheck,
} from "./about.ts";
export {
  checkPackageUpdate,
  fetchNpmLatest,
  isUpdateAvailable,
  resolveAboutInfo,
} from "./about.ts";
export type { AgentCwdContext, AgentCwdInput } from "./agent-cwd.ts";
export { isAgentCwdType, resolveAgentCwd } from "./agent-cwd.ts";
export type {
  AgentCwdType,
  AgentEvent,
  AgentEventHandler,
  AgentRunOptions,
  AgentTurnEndReason,
} from "./agent-events.ts";
export type { AppCallContext } from "./app-runtime.ts";
export { effectiveSignal } from "./app-runtime.ts";
export type {
  AppPackageManifest,
  InstallOutcome,
} from "./apps/app-packages.ts";
export {
  installAppPackages,
  readAppManifest,
  requireFromAppPackages,
  writeAppManifest,
} from "./apps/app-packages.ts";
export type { AppTheme } from "./apps/app-theme.ts";
export {
  localThemeCssVars,
  readAppTheme,
  writeAppTheme,
} from "./apps/app-theme.ts";
export type {
  AfterMutateOptions,
  AfterMutateResult,
  AppContext,
  AppDef,
  AppItem,
  AppMethod,
  AppStorage,
  CommitOutcome,
  CommitStatus,
  ReloadResult,
} from "./apps/apps-manager.ts";
export { AppsManager } from "./apps/apps-manager.ts";
export type { Edit } from "./apps/edit-diff.ts";
export {
  applyEditsToNormalizedContent,
  fuzzyFindText,
} from "./apps/edit-diff.ts";
export {
  adviceForTable,
  analyzeTable,
  buildSplitPrompt,
  clearTable,
  deleteKey,
  type HeavyKey,
  NOTICE_BYTES,
  readKey,
  readTable,
  stats,
  type StorageAdvice,
  type TableStats,
  writeKey,
} from "./apps/file-store.ts";
export type { AppManifest } from "./apps/manifest.ts";
export { acronymOf, parseManifest } from "./apps/manifest.ts";
export type { StorageTableInfo } from "./apps/storage.ts";
export {
  listStorageNotices,
  listStorageTables,
  readJsonFile,
  readTableView,
  storageTablePath,
} from "./apps/storage.ts";
export type { AbsolutePath, AppId } from "./brand.ts";
export {
  asAbsolutePath,
  asAppId,
  assertNever,
  isAbsolutePath,
  isAppId,
} from "./brand.ts";
export type {
  BoundHostCapabilities,
  HostCapabilities,
} from "./capabilities.ts";
export { bindCapsToContext } from "./capabilities.ts";
export { AppCssCompiler, appCssExists } from "./compile/app-css.ts";
export {
  keyframeNamesIn,
  platformKeyframeNames,
} from "./compile/platform-keyframes.ts";
export type {
  Vendor,
  VendorId,
  VendorResolve,
  VendorTarget,
} from "./compile/platform-modules.ts";
export {
  findVendor,
  resolveVendorSpecifier,
  RUNTIME_HREF,
  SDK_HREF,
  VENDOR_IDS,
  vendorFileHref,
  vendorIdFromFile,
  VENDORS,
  VENDORS_HREF_PREFIX,
  vendorSpecifierFilter,
} from "./compile/platform-modules.ts";
export { RUNNER_INLINE_CSS } from "./compile/runner-inline-css.ts";
export type {
  StaticCheckResult,
  StaticFinding,
} from "./compile/static-check.ts";
export {
  checkAppSources,
  formatFinding,
  layerOfRel,
  staticCheckAvailable,
} from "./compile/static-check.ts";
export type { UiBuildFile, UiCompileOptions } from "./compile/ui-compiler.ts";
export {
  resolveSdkDistDir,
  resolveUiDistDir,
  UiCompiler,
} from "./compile/ui-compiler.ts";
export { bootstrapHostConfig } from "./config/bootstrap.ts";
export { DEFAULT_HOST_CONFIG_SEED } from "./config/defaults.ts";
export type { DshLocaleSources, SystemLocaleSources } from "./config/detect-locale.ts";
export {
  defaultDshSettingsPath,
  detectDshOrSystemLocale,
  detectSystemLocale,
  localeFromDshPreference,
  localeFromLanguageTag,
  parseDshLocalePreference,
  readDshLocalePreference,
} from "./config/detect-locale.ts";
export { ensureHostConfig } from "./config/ensure.ts";
export { loadHostConfig } from "./config/load.ts";
export { parseHostConfig } from "./config/parse.ts";
export { writeHostConfig } from "./config/write.ts";
export { createHost } from "./create-host.ts";
export { HostConfigError, HostError } from "./errors.ts";
export type {
  AppErrorInput,
  AppRuntimeError,
  HostEvent,
  HostEventListener,
  ViewEvalInput,
  ViewEvalReply,
  ViewState,
} from "./events/host-events.ts";
export {
  APP_ERROR_BUFFER,
  APP_EVENT_BUFFER,
  clampViewEvalTimeout,
  formatSse,
  HostEventBus,
  VIEW_EVAL_TIMEOUT_MAX_MS,
  VIEW_EVAL_TIMEOUT_MIN_MS,
  VIEW_EVAL_TIMEOUT_MS,
} from "./events/host-events.ts";
export type {
  Commit,
  CommitNode,
  CommitTree,
  FileStat,
  GitAuthor,
} from "./git/git-history.ts";
export { GitHistory } from "./git/git-history.ts";
export { Host } from "./host.ts";
export { appRunnerHtml } from "./http/app-runner-html.ts";
export type { ViewEvalLimits } from "./http/app-view-eval.ts";
export {
  VIEW_EVAL_BYTE_CAP,
  LIMITS as VIEW_EVAL_LIMITS,
  VIEW_EVAL_MAX_NODES,
  VIEW_EVAL_SELF_TIMEOUT_MS,
  VIEW_EVAL_TREE_DEPTH,
  viewEvalClient,
  viewEvalRuntime,
} from "./http/app-view-eval.ts";
export { HttpGateway } from "./http/http-gateway.ts";
export type { HostI18n, I18nParams } from "./i18n/index.ts";
export { createHostI18n } from "./i18n/index.ts";
export type { HostLifecycle, HostServices, LogLevel } from "./lifecycle.ts";
export type {
  JsonInstructOptions,
  JsonSchema,
  LlmAttempt,
  LlmAttemptRunner,
  LlmRunOptions,
  ModelCallOptions,
  ModelRouteOptions,
} from "./model-call.ts";
export {
  DEFAULT_AGENT_ATTEMPTS,
  DEFAULT_LLM_ATTEMPTS,
  DEFAULT_LLM_MAX_TOKENS,
  MAX_LLM_ATTEMPTS,
  runLlmAttempts,
} from "./model-call.ts";
export { WorkspacePaths } from "./paths/workspace-paths.ts";
export type { CustomThemePalette, ThemeResource } from "./theme-resource.ts";
export { EMPTY_THEME_RESOURCE } from "./theme-resource.ts";
export type { ToolDefinition } from "./tools/tool-facade.ts";
export { isMiniAppToolName, ToolFacade } from "./tools/tool-facade.ts";
export type {
  HostConfig,
  HostConfigInitInput,
  HostConfigSeed,
  LlmConfig,
  LocaleId,
  PaletteId,
  ThemeId,
  ThemePref,
} from "./types.ts";
export { LOCALE_IDS, PALETTE_IDS, THEME_IDS, THEME_PREF_IDS } from "./types.ts";
