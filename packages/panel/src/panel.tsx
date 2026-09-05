import { createRoot, type Root } from "react-dom/client";

import { MiniAppPanel } from "./components/MiniAppPanel.tsx";
import { createPanelActions, loadCustomPalettes } from "./actions.ts";
import { PanelProvider } from "./context.tsx";
import { createPanelI18n, resolvePanelLocale } from "./i18n.ts";
import { capabilitiesOf, type PanelHost } from "./panel-host.ts";
import { getPanelState, resetPanelState, setPanelState } from "./store.ts";
import { injectPanelCss } from "./styles.ts";
import { applyThemeTo, type CustomPaletteMap } from "./themes.ts";
import type { LocaleId, PanelActions } from "./types.ts";

export type CreateMiniAppPanelOptions = {
  locale?: LocaleId;
};

export interface PanelInstance {
  actions: PanelActions;
  mount(el: HTMLElement): void;
  unmount(): void;
  open(): void;
  close(): void;
}

export function createMiniAppPanel(host: PanelHost, options?: CreateMiniAppPanelOptions): PanelInstance {
  const locale = resolvePanelLocale(options?.locale ?? host.locale);
  const i18n = createPanelI18n(locale);
  const prev = getPanelState();
  resetPanelState({
    tabs: [{ id: "all", title: i18n.t("tabs.all"), kind: "all" }],
    capabilities: capabilitiesOf(host),
    locale,
    emptyText: host.emptyText,
    theme: prev.theme,
    palette: prev.palette,
    dock: prev.dock,
    cardStyle: prev.cardStyle,
    visible: prev.visible,
  });

  let rootEl: HTMLElement | null = null;
  let root: Root | null = null;
  const actions = createPanelActions(host, () => rootEl, i18n);

  return {
    actions,
    open: () => host.openPanel(),
    close: () => host.closePanel(),
    mount(el: HTMLElement) {
      rootEl = el;
      injectPanelCss();
      const s = getPanelState();
      applyThemeTo(el, s.theme, s.palette, s.customPalettes as CustomPaletteMap);
      loadCustomPalettes(host);
      if (!root) root = createRoot(el);
      root.render(
        <PanelProvider actions={actions} i18n={i18n}>
          <MiniAppPanel />
        </PanelProvider>,
      );
    },
    unmount() {
      if (root) {
        root.unmount();
        root = null;
      }
      rootEl = null;
    },
  };
}
