import { usePanelActions, usePanelI18n } from "../context.tsx";
import { usePanelState } from "../store.ts";

export function Tabs() {
  const s = usePanelState();
  const actions = usePanelActions();
  const { t } = usePanelI18n();
  return (
    <div className="mma-tabs" id="mma-tabs">
      {s.tabs.map((tb) => {
        const active = tb.id === s.active;
        const close =
          tb.id === "all" ? null : (
            <span
              className="mma-tab-x"
              role="button"
              aria-label={t("tabs.close", { title: tb.title })}
              onClick={(e) => {
                e.stopPropagation();
                actions.closeTab(tb.id);
              }}
            >
              ×
            </span>
          );
        return (
          <button
            key={tb.id}
            type="button"
            className="mma-tab"
            data-active={active ? "1" : "0"}
            title={tb.id === "all" ? t("tabs.allTitle") : tb.title}
            onClick={() => actions.switchTab(tb.id)}
          >
            <span>{tb.title}</span>
            {close}
          </button>
        );
      })}
    </div>
  );
}
