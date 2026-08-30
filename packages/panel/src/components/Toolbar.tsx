import { Clock, Database, LayoutGrid, PanelRight, RefreshCw, Settings, X } from "lucide-react";

import { usePanelActions, usePanelI18n } from "../context.tsx";
import { usePanelState } from "../store.ts";
import { ThemePop } from "./ThemePop.tsx";

const iconProps = { size: 16, strokeWidth: 2, className: "mma-ico" };

export function Toolbar() {
  const s = usePanelState();
  const actions = usePanelActions();
  const { t } = usePanelI18n();
  const side = s.dock === "side";
  const appTab = s.tabs.some((tab) => tab.id === s.active && tab.kind === "app");
  const anyApp = s.tabs.some((tab) => tab.kind === "app");
  return (
    <div className="mma-toolbar">
      {appTab && s.capabilities.deleteApp ? (
        <button
          type="button"
          className="mma-textbtn danger"
          id="mma-delete"
          title={t("toolbar.delete")}
          onClick={() => actions.askDelete()}
        >
          {t("toolbar.delete")}
        </button>
      ) : null}
      {appTab ? (
        <button
          type="button"
          className="mma-iconbtn"
          id="mma-reload"
          title={t("toolbar.reload")}
          aria-label={t("toolbar.reload")}
          onClick={() => actions.reloadActive()}
        >
          <RefreshCw {...iconProps} />
        </button>
      ) : null}
      <div className="mma-theme-wrap" id="mma-theme-wrap">
        <button
          type="button"
          className="mma-iconbtn"
          id="mma-theme-btn"
          title={t("toolbar.theme")}
          aria-label={t("toolbar.theme")}
          aria-haspopup="menu"
          onClick={() => actions.toggleThemePop()}
        >
          <LayoutGrid {...iconProps} />
        </button>
        <ThemePop />
      </div>
      {anyApp && s.capabilities.history ? (
        <button
          type="button"
          className="mma-iconbtn"
          id="mma-history-btn"
          title={t("toolbar.history")}
          aria-label={t("toolbar.history")}
          onClick={() => actions.toggleBrowse("history")}
        >
          <Clock {...iconProps} />
        </button>
      ) : null}
      {anyApp && s.capabilities.storage ? (
        <button
          type="button"
          className="mma-iconbtn"
          id="mma-storage-btn"
          title={t("toolbar.storage")}
          aria-label={t("toolbar.storage")}
          onClick={() => actions.toggleBrowse("storage")}
        >
          <Database {...iconProps} />
        </button>
      ) : null}
      {s.capabilities.config ? (
        <button
          type="button"
          className="mma-iconbtn"
          id="mma-settings-btn"
          title={t("toolbar.settings")}
          aria-label={t("toolbar.settings")}
          onClick={() => actions.toggleSettings(true)}
        >
          <Settings {...iconProps} />
        </button>
      ) : null}
      <button
        type="button"
        className="mma-iconbtn"
        id="mma-dock-host"
        title={side ? t("toolbar.dockFill") : t("toolbar.dockSide")}
        aria-label={side ? t("toolbar.dockFill") : t("toolbar.dockSide")}
        onClick={() => actions.setDock(side ? "fill" : "side")}
      >
        <PanelRight {...iconProps} />
      </button>
      <button
        type="button"
        className="mma-iconbtn"
        id="mma-close-host"
        title={t("toolbar.close")}
        aria-label={t("toolbar.close")}
        onClick={() => actions.closeDashboard()}
      >
        <X {...iconProps} />
      </button>
    </div>
  );
}
