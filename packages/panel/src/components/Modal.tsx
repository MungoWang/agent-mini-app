import { usePanelActions, usePanelI18n } from "../context.tsx";
import { usePanelState } from "../store.ts";

export function Modal() {
  const s = usePanelState();
  const actions = usePanelActions();
  const { t } = usePanelI18n();
  if (!s.pendingDelete) return null;
  const app = s.apps.find((a) => a.id === s.pendingDelete) || { id: s.pendingDelete, name: s.pendingDelete };
  return (
    <div className="mma-modal" id="mma-modal">
      <div className="mma-dialog">
        <h3>{t("modal.title")}</h3>
        <p>{t("modal.body", { name: app.name || app.id })}</p>
        <div className="mma-dialog-actions">
          <button type="button" id="mma-dialog-cancel" onClick={() => actions.hideModal()}>
            {t("modal.cancel")}
          </button>
          <button type="button" id="mma-dialog-ok" className="go" onClick={() => void actions.confirmDelete()}>
            {t("modal.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
