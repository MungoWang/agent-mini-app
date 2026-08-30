import { defaultHideThemePop } from "../actions.ts";
import { usePanelActions, usePanelI18n } from "../context.tsx";
import { usePanelState } from "../store.ts";
import { PALETTES } from "../themes.ts";

export function ThemePop() {
  const s = usePanelState();
  const actions = usePanelActions();
  const { t } = usePanelI18n();
  const app = actions.getActiveApp();
  const appTheme = app ? app.theme : null;
  const customs = s.customPalettes || {};

  return (
    <>
      {/* Covers panel + iframe; parent document listeners miss iframe clicks. */}
      {s.themePopOpen ? (
        <div
          className="mma-pop-scrim"
          aria-hidden="true"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            defaultHideThemePop();
          }}
        />
      ) : null}
      <div
        className="mma-pop"
        id="mma-theme-pop"
        role="menu"
        data-open={s.themePopOpen ? "1" : "0"}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
      <div className="mma-pop-seg">
        {(["light", "dark"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            data-mode={mode}
            data-on={s.theme === mode ? "1" : "0"}
            onClick={() => actions.setAppearance({ theme: mode }, s.themeScope)}
          >
            {t(`theme.${mode}`)}
          </button>
        ))}
      </div>
      <div className="mma-pop-list">
        {PALETTES.map((p) => (
          <button
            key={p.id}
            type="button"
            className="mma-swatch"
            data-palette={p.id}
            role="menuitem"
            data-on={s.palette === p.id ? "1" : "0"}
            onClick={() => actions.setAppearance({ palette: p.id }, s.themeScope)}
          >
            <i className="mma-dot" style={{ background: p.swatch }} />
            <span>{t(`palette.${p.id}`)}</span>
          </button>
        ))}
        {Object.keys(customs).map((id) => (
          <button
            key={id}
            type="button"
            className="mma-swatch"
            data-palette={id}
            data-custom="1"
            role="menuitem"
            data-on={s.palette === id ? "1" : "0"}
            onClick={() => actions.setAppearance({ palette: id }, s.themeScope)}
          >
            <i className="mma-dot" style={{ background: customs[id].swatch || "#888" }} />
            <span>{customs[id].label || id}</span>
            <i className="mma-custom-badge">{t("theme.custom")}</i>
          </button>
        ))}
      </div>
      <div className="mma-pop-seg mma-scope-seg">
        <button
          type="button"
          data-scope="global"
          data-on={s.themeScope === "global" ? "1" : "0"}
          onClick={() => actions.setThemeScope("global")}
        >
          {t("theme.global")}
        </button>
        <button
          type="button"
          data-scope="app"
          id="mma-scope-app"
          title={app ? t("theme.saveTo", { name: app.name }) : t("theme.openAppFirst")}
          data-on={s.themeScope === "app" ? "1" : "0"}
          disabled={!app || !s.capabilities.appTheme}
          onClick={() => actions.setThemeScope("app")}
        >
          {app ? app.name : t("theme.currentApp")}
        </button>
      </div>
      {s.themeScope === "app" && appTheme ? (
        <button type="button" className="mma-textbtn" id="mma-clear-app-theme" onClick={() => actions.clearAppTheme()}>
          {t("theme.followGlobal")}
        </button>
      ) : null}
      </div>
    </>
  );
}
