export const packageName = "@monkey-mini-app/panel";

export { activeAppFrom, clampPaletteId, createPanelActions, defaultHideThemePop } from "./actions.ts";
export { AppList, ListRegion } from "./components/AppList.tsx";
export { Browse } from "./components/Browse.tsx";
export { Loading } from "./components/Loading.tsx";
export { MiniAppPanel } from "./components/MiniAppPanel.tsx";
export { Modal } from "./components/Modal.tsx";
export { Settings } from "./components/Settings.tsx";
export { Tabs } from "./components/Tabs.tsx";
export { ThemePop } from "./components/ThemePop.tsx";
export { Toolbar } from "./components/Toolbar.tsx";
export { PanelProvider, usePanelActions, usePanelI18n } from "./context.tsx";
export { PanelError } from "./errors.ts";
export type { I18nParams, PanelI18n } from "./i18n.ts";
export { createPanelI18n, resolvePanelLocale } from "./i18n.ts";
export { appBlurb, hue, monoOf } from "./lib.ts";
export type { CreateMiniAppPanelOptions, PanelInstance } from "./panel.tsx";
export { createMiniAppPanel } from "./panel.tsx";
export type { Palette, PanelHost } from "./panel-host.ts";
export { capabilitiesOf } from "./panel-host.ts";
export {
  getPanelState,
  resetPanelState,
  setPanelState,
  subscribePanel,
  usePanelState,
} from "./store.ts";
export { injectPanelCss,PANEL_CSS_TAG } from "./styles.ts";
export type { CustomPaletteMap, ModeId, PaletteId, TokenSet } from "./themes.ts";
export {
  applyThemeTo,
  clampMode,
  clampPalette,
  cssVars,
  PALETTES,
  parseThemeCss,
  runnerThemeCss,
  themeLabelFromCss,
  tokensOf,
} from "./themes.ts";
export type {
  AppItem,
  BrowseKind,
  CardStyle,
  Commit,
  CommitFile,
  DockId,
  LocaleId,
  PanelActions,
  PanelCapabilities,
  PanelState,
  StorageTable,
  TabItem,
  TabKind,
  ThemeScope,
} from "./types.ts";
export { LOCALE_IDS } from "./types.ts";
