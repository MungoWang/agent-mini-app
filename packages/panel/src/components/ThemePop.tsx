import { defaultHideThemePop } from "../actions.ts";
import { usePanelActions, usePanelI18n } from "../context.tsx";
import { usePanelState } from "../store.ts";
import { GLOBAL_PALETTE_ID, LOCAL_PALETTE_ID, PALETTES, selectedPalette } from "../themes.ts";

export function ThemePop() {
  const s = usePanelState();
  const actions = usePanelActions();
  const { t } = usePanelI18n();
  const app = actions.getActiveApp();
  const appScope = Boolean(app) && s.themeScope === "app";
  const viewTheme = appScope ? (app?.theme?.theme ?? s.theme) : s.theme;
  const viewPalette = appScope
    ? selectedPalette(app?.theme?.palette, Boolean(app?.localPalette))
    : s.palette;
  const customs = s.customPalettes || {};
  const canApp = Boolean(app && s.capabilities.appTheme);

  return (
    <>
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
        <div className="mma-pop-lab">{t("theme.apply")}</div>
        <div className="mma-pop-seg">
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
            data-on={appScope ? "1" : "0"}
            disabled={!canApp}
            onClick={() => actions.setThemeScope("app")}
          >
            {app ? app.name : t("theme.currentApp")}
          </button>
        </div>

        <div className="mma-pop-lab">{t("theme.appearance")}</div>
        <div className="mma-pop-seg">
          {(["system", "light", "dark"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              data-mode={mode}
              data-on={viewTheme === mode ? "1" : "0"}
              onClick={() => actions.setAppearance({ theme: mode }, s.themeScope)}
            >
              {t(`theme.${mode}`)}
            </button>
          ))}
        </div>

        <div className="mma-pop-lab">{t("theme.palettes")}</div>
        <div className="mma-pop-list">
          {appScope ? (
            <button
              type="button"
              className="mma-swatch"
              id="mma-follow-global"
              data-on={viewPalette === GLOBAL_PALETTE_ID ? "1" : "0"}
              role="menuitem"
              onClick={() => actions.setAppearance({ palette: GLOBAL_PALETTE_ID }, "app")}
            >
              <i className="mma-dot" style={{ background: "linear-gradient(135deg,#888,#ddd)" }} />
              <span>{t("theme.followGlobal")}</span>
            </button>
          ) : null}
          {PALETTES.map((p) => (
            <button
              key={p.id}
              type="button"
              className="mma-swatch"
              data-palette={p.id}
              role="menuitem"
              data-on={viewPalette === p.id ? "1" : "0"}
              onClick={() => actions.setAppearance({ palette: p.id }, s.themeScope)}
            >
              <i className="mma-dot" style={{ background: p.swatch }} />
              <span>{t(`palette.${p.id}`)}</span>
              <i className="mma-custom-badge">{t("theme.chipSystem")}</i>
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
              data-on={viewPalette === id ? "1" : "0"}
              onClick={() => actions.setAppearance({ palette: id }, s.themeScope)}
            >
              <i className="mma-dot" style={{ background: customs[id].swatch || "#888" }} />
              <span>{customs[id].label || id}</span>
              <i className="mma-custom-badge">{t("theme.custom")}</i>
            </button>
          ))}
          {appScope && app?.localPalette ? (
            <button
              type="button"
              className="mma-swatch"
              data-palette={LOCAL_PALETTE_ID}
              role="menuitem"
              data-on={viewPalette === LOCAL_PALETTE_ID ? "1" : "0"}
              onClick={() => actions.setAppearance({ palette: LOCAL_PALETTE_ID }, "app")}
            >
              <i className="mma-dot" style={{ background: app.localPalette.swatch }} />
              <span>{app.localPalette.label}</span>
              <i className="mma-custom-badge">{t("theme.chipApp")}</i>
            </button>
          ) : null}
        </div>
        {appScope && app?.theme ? (
          <button
            type="button"
            className="mma-textbtn"
            id="mma-reset-app-theme"
            onClick={() => actions.clearAppTheme()}
          >
            {t("theme.resetApp")}
          </button>
        ) : null}
      </div>
    </>
  );
}
