import * as React from "react";

import type { PanelI18n } from "./i18n.ts";
import type { PanelActions } from "./types.ts";

const PanelActionsContext = React.createContext<PanelActions | null>(null);
const PanelI18nContext = React.createContext<PanelI18n | null>(null);

export function PanelProvider({
  actions,
  i18n,
  children,
}: {
  actions: PanelActions;
  i18n: PanelI18n;
  children: React.ReactNode;
}) {
  return (
    <PanelI18nContext.Provider value={i18n}>
      <PanelActionsContext.Provider value={actions}>{children}</PanelActionsContext.Provider>
    </PanelI18nContext.Provider>
  );
}

export function usePanelActions(): PanelActions {
  const ctx = React.useContext(PanelActionsContext);
  if (!ctx) throw new Error("usePanelActions must be used inside <PanelProvider>");
  return ctx;
}

export function usePanelI18n(): PanelI18n {
  const ctx = React.useContext(PanelI18nContext);
  if (!ctx) throw new Error("usePanelI18n must be used inside <PanelProvider>");
  return ctx;
}
