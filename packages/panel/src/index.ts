export const packageName = "@monkey-mini-app/panel";

export { PanelError } from "./errors.ts";

export { LOCALE_IDS } from "./types.ts";
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

export type { Palette, PanelHost } from "./panel-host.ts";
export { capabilitiesOf } from "./panel-host.ts";

export {
  getPanelState,
  resetPanelState,
  setPanelState,
  subscribePanel,
  usePanelState,
} from "./store.ts";

export { activeAppFrom, clampPaletteId, createPanelActions, defaultHideThemePop } from "./actions.ts";

export {
  PALETTES,
  applyThemeTo,
  clampMode,
  clampPalette,
  cssVars,
  parseThemeCss,
  runnerThemeCss,
  themeLabelFromCss,
  tokensOf,
} from "./themes.ts";
export type { CustomPaletteMap, ModeId, PaletteId, TokenSet } from "./themes.ts";

export { createPanelI18n, resolvePanelLocale } from "./i18n.ts";
export type { I18nParams, PanelI18n } from "./i18n.ts";

export { createMiniAppPanel } from "./panel.tsx";
export type { CreateMiniAppPanelOptions, PanelInstance } from "./panel.tsx";

export { PanelProvider, usePanelActions, usePanelI18n } from "./context.tsx";
export { PANEL_CSS_TAG, injectPanelCss } from "./styles.ts";
export { appBlurb, hue, monoOf } from "./lib.ts";

export { MiniAppPanel } from "./components/MiniAppPanel.tsx";
export { Tabs } from "./components/Tabs.tsx";
export { Toolbar } from "./components/Toolbar.tsx";
export { ThemePop } from "./components/ThemePop.tsx";
export { AppList, ListRegion } from "./components/AppList.tsx";
export { Settings } from "./components/Settings.tsx";
export { Browse } from "./components/Browse.tsx";
export { Modal } from "./components/Modal.tsx";
export { Loading } from "./components/Loading.tsx";
