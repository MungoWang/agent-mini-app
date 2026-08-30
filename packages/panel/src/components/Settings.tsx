import * as React from "react";

import { usePanelActions, usePanelI18n } from "../context.tsx";
import { usePanelState } from "../store.ts";
import { PALETTES } from "../themes.ts";

export function Settings() {
  const s = usePanelState();
  const actions = usePanelActions();
  const { t } = usePanelI18n();
  const [form, setForm] = React.useState<Record<string, string>>({});
  React.useEffect(() => {
    if (!s.settingsOpen) return;
    setForm(s.cfg && Object.keys(s.cfg).length ? s.cfg : actions.getCfg());
  }, [s.settingsOpen, s.cfgVersion, s.cfg, actions]);
  if (!s.capabilities.config) return null;
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));
  return (
    <div className="mma-settings" id="mma-settings" data-open={s.settingsOpen ? "1" : "0"}>
      <div className="mma-settings-head">
        <h3>{t("settings.title")}</h3>
        <button type="button" className="mma-iconbtn" id="mma-cfg-close" onClick={() => actions.toggleSettings(false)}>
          ✕
        </button>
      </div>
      <label>
        {t("settings.hostPort")}
        <input id="mma-cfg-port" type="number" value={form.hostPort || ""} onChange={set("hostPort")} />
      </label>
      <label>
        {t("settings.language")}
        <select id="mma-cfg-lang" value={form.locale || form.chatLanguage || "zh-CN"} onChange={set("locale")}>
          <option value="zh-CN">{t("settings.langZh")}</option>
          <option value="en">{t("settings.langEn")}</option>
        </select>
      </label>
      <label>
        {t("settings.theme")}
        <select id="mma-cfg-theme" value={form.theme || "light"} onChange={set("theme")}>
          <option value="light">{t("theme.light")}</option>
          <option value="dark">{t("theme.dark")}</option>
        </select>
      </label>
      <label>
        {t("settings.palette")}
        <select id="mma-cfg-palette" value={form.palette || "default"} onChange={set("palette")}>
          {PALETTES.map((p) => (
            <option key={p.id} value={p.id}>
              {t(`palette.${p.id}`)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("settings.cardStyle")}
        <select id="mma-cfg-cardstyle" value={form.cardStyle || "stamp"} onChange={set("cardStyle")}>
          <option value="stamp">{t("settings.cardStamp")}</option>
          <option value="etch">{t("settings.cardEtch")}</option>
          <option value="hero">{t("settings.cardHero")}</option>
          <option value="list">{t("settings.cardList")}</option>
        </select>
      </label>
      <label>
        {t("settings.llmProvider")}
        <input id="mma-cfg-provider" value={form.provider || ""} onChange={set("provider")} />
      </label>
      <label>
        {t("settings.llmModel")}
        <input id="mma-cfg-model" value={form.model || ""} onChange={set("model")} />
      </label>
      <div className="mma-settings-actions">
        <button type="button" className="mma-textbtn" id="mma-cfg-save" onClick={() => actions.saveHostConfig(form)}>
          {t("settings.save")}
        </button>
        <span className="mma-settings-msg" id="mma-cfg-msg">
          {s.cfgMsg}
        </span>
      </div>
    </div>
  );
}
