import * as React from "react";

import { usePanelActions, usePanelI18n } from "../context.tsx";
import { usePanelState } from "../store.ts";
import {
  applyThemeTo,
  clampPalette,
  type CustomPaletteMap,
  type ModeId,
  type PaletteId,
  PALETTES,
  resolveMode,
  tokensOf,
} from "../themes.ts";
import type { CardStyle } from "../types.ts";
import { OptionCardGrid } from "./OptionCardGrid.tsx";

type SectionId = "appearance" | "network" | "model" | "about";

type DirtySlice = {
  hostPort: string;
  provider: string;
  model: string;
  theme: string;
  palette: string;
  cardStyle: string;
  locale: string;
};

const SECTIONS: SectionId[] = ["appearance", "network", "model", "about"];

const DEFAULTS: DirtySlice & {
  locale: string;
  theme: string;
  palette: string;
  cardStyle: CardStyle;
} = {
  hostPort: "17880",
  provider: "",
  model: "",
  locale: "zh-CN",
  theme: "light",
  palette: "default",
  cardStyle: "stamp",
};

function shortPkg(name: string): string {
  return name.replace(/^@monkey-mini-app\//, "");
}

function validatePort(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return "empty";
  if (!/^\d+$/.test(trimmed)) return "nan";
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 1024 || n > 65535) return "range";
  return null;
}

function ThemePreview({ mode }: { mode: "system" | "light" | "dark" }) {
  if (mode === "system") {
    return (
      <span className="mma-preview-theme mma-preview-theme--system">
        <span className="mma-preview-theme-half mma-preview-theme-half--light" />
        <span className="mma-preview-theme-half mma-preview-theme-half--dark" />
      </span>
    );
  }
  return (
    <span className={`mma-preview-theme mma-preview-theme--${mode}`}>
      <span className="mma-preview-bar" />
      <span className="mma-preview-bar" />
    </span>
  );
}

function PalettePreview({ id, mode }: { id: PaletteId; mode: ModeId }) {
  const t = tokensOf(id, mode);
  return (
    <span className="mma-preview-swatches">
      <span style={{ background: t.primary }} />
      <span style={{ background: t.secondary }} />
      <span style={{ background: t.bg }} />
    </span>
  );
}

function CardStylePreview({ style }: { style: CardStyle }) {
  return <span className={`mma-preview-cardstyle mma-preview-cardstyle--${style}`} />;
}

export function Settings() {
  const s = usePanelState();
  const actions = usePanelActions();
  const { t } = usePanelI18n();
  const [form, setForm] = React.useState<Record<string, string>>({});
  const [snapshot, setSnapshot] = React.useState<DirtySlice | null>(null);
  const [section, setSection] = React.useState<SectionId>("appearance");
  const [portTouched, setPortTouched] = React.useState(false);
  const [confirm, setConfirm] = React.useState<null | "close" | "restore">(null);
  const [lastSavedAt, setLastSavedAt] = React.useState<string | null>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const sectionRefs = React.useRef<Partial<Record<SectionId, HTMLElement | null>>>({});
  const dirtyCountRef = React.useRef(0);
  const confirmRef = React.useRef(confirm);
  confirmRef.current = confirm;
  const [wide, setWide] = React.useState(false);

  React.useEffect(() => {
    if (!s.settingsOpen) return;
    const next = s.cfg && Object.keys(s.cfg).length ? { ...s.cfg } : { ...actions.getCfg() };
    const snap: DirtySlice = {
      hostPort: next.hostPort || "",
      provider: next.provider || "",
      model: next.model || "",
      theme: next.theme || s.theme || "light",
      palette: next.palette || s.palette || "default",
      cardStyle: next.cardStyle || s.cardStyle || "stamp",
      locale: next.locale || next.chatLanguage || "zh-CN",
    };
    setForm({ ...next, ...snap, chatLanguage: snap.locale });
    setSnapshot(snap);
    setPortTouched(false);
    setConfirm(null);
    setSection("appearance");
  }, [s.settingsOpen, s.cfgVersion, s.cfg, actions, s.theme, s.palette, s.cardStyle]);

  React.useEffect(() => {
    if (!s.settingsOpen) return;
    const host = rootRef.current?.closest("#mma-host") ?? rootRef.current;
    if (!host || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setWide(w >= 720);
    });
    ro.observe(host);
    return () => ro.disconnect();
  }, [s.settingsOpen]);

  React.useEffect(() => {
    if (!s.settingsOpen) return;
    const root = contentRef.current;
    if (!root) return;
    const nodes = SECTIONS.map((id) => sectionRefs.current[id]).filter(Boolean) as HTMLElement[];
    if (!nodes.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const id = visible?.target.getAttribute("data-section") as SectionId | null;
        if (id) setSection(id);
      },
      { root, threshold: [0.25, 0.5, 0.75], rootMargin: "-20% 0px -55% 0px" },
    );
    for (const n of nodes) obs.observe(n);
    return () => obs.disconnect();
  }, [s.settingsOpen, form]);

  React.useEffect(() => {
    if (!s.settingsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (confirmRef.current) {
        setConfirm(null);
        return;
      }
      if (dirtyCountRef.current > 0) setConfirm("close");
      else actions.toggleSettings(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [s.settingsOpen, actions]);

  if (!s.capabilities.config) return null;

  // Prefer form (preview) over live panel state — otherwise an unsaved preview
  // cannot stick while s.theme still holds the committed value.
  const themeMode =
    form.theme === "system" || form.theme === "dark" || form.theme === "light"
      ? form.theme
      : s.theme === "system" || s.theme === "dark" || s.theme === "light"
        ? s.theme
        : "light";
  const resolvedMode = resolveMode(themeMode === "system" ? "system" : themeMode);
  const palette = (form.palette || s.palette || "default") as string;
  const cardStyle = (form.cardStyle || s.cardStyle || "stamp") as CardStyle;
  const locale = form.locale || form.chatLanguage || "zh-CN";

  const dirty: DirtySlice = {
    hostPort: form.hostPort || "",
    provider: form.provider || "",
    model: form.model || "",
    theme: themeMode,
    palette,
    cardStyle,
    locale,
  };
  const dirtyKeys = (
    ["hostPort", "provider", "model", "theme", "palette", "cardStyle", "locale"] as const
  ).filter((k) => snapshot != null && dirty[k] !== snapshot[k]);
  const dirtyCount = dirtyKeys.length;
  dirtyCountRef.current = dirtyCount;
  const portDirty = snapshot != null && dirty.hostPort !== snapshot.hostPort;
  const portErrorKey = portTouched || portDirty ? validatePort(form.hostPort || "") : null;
  const portError =
    portErrorKey === "empty"
      ? t("settings.portEmpty")
      : portErrorKey === "nan"
        ? t("settings.portNan")
        : portErrorKey === "range"
          ? t("settings.portRange")
          : null;
  const canSave = dirtyCount > 0 && !portError;
  const hostUrl = `http://127.0.0.1:${(form.hostPort || "").trim() || "—"}`;
  const paletteLabel = t(`palette.${clampPalette(palette as PaletteId)}`);
  const versionLabel =
    s.about?.packages?.[0]?.version ??
    s.about?.packages?.find((p) => p.name.includes("dsh"))?.version ??
    "—";

  const patch = (partial: Record<string, string>) => setForm((prev) => ({ ...prev, ...partial }));

  const paintPreview = (next: {
    theme?: string;
    palette?: string;
    cardStyle?: string;
  }) => {
    const host = document.getElementById("mma-host");
    if (!host) return;
    const theme = next.theme ?? themeMode;
    const pal = next.palette ?? palette;
    const style = next.cardStyle ?? cardStyle;
    applyThemeTo(host, theme, pal, s.customPalettes as CustomPaletteMap);
    host.setAttribute("data-cardstyle", style);
  };

  /** Preview only — no localStorage / host.json until Save. */
  const previewAppearance = (partial: {
    theme?: string;
    palette?: string;
    cardStyle?: CardStyle;
    locale?: string;
  }) => {
    const nextTheme = partial.theme ?? themeMode;
    const nextPalette = partial.palette ?? palette;
    const nextCard = partial.cardStyle ?? cardStyle;
    paintPreview({ theme: nextTheme, palette: nextPalette, cardStyle: nextCard });
    patch({
      ...(partial.theme != null ? { theme: partial.theme } : {}),
      ...(partial.palette != null ? { palette: partial.palette } : {}),
      ...(partial.cardStyle != null ? { cardStyle: partial.cardStyle } : {}),
      ...(partial.locale != null ? { locale: partial.locale, chatLanguage: partial.locale } : {}),
    });
  };

  const scrollTo = (id: SectionId) => {
    setSection(id);
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const discard = () => {
    if (!snapshot) return;
    patch({ ...snapshot, chatLanguage: snapshot.locale });
    paintPreview({
      theme: snapshot.theme,
      palette: snapshot.palette,
      cardStyle: snapshot.cardStyle,
    });
    setPortTouched(false);
  };

  const requestClose = () => {
    if (dirtyCount > 0) setConfirm("close");
    else actions.toggleSettings(false);
  };

  const restoreDefaults = () => {
    previewAppearance({
      theme: DEFAULTS.theme,
      palette: DEFAULTS.palette,
      cardStyle: DEFAULTS.cardStyle,
      locale: DEFAULTS.locale,
    });
    patch({
      hostPort: DEFAULTS.hostPort,
      provider: DEFAULTS.provider,
      model: DEFAULTS.model,
      locale: DEFAULTS.locale,
      chatLanguage: DEFAULTS.locale,
      theme: DEFAULTS.theme,
      palette: DEFAULTS.palette,
      cardStyle: DEFAULTS.cardStyle,
    });
    setPortTouched(true);
    setConfirm(null);
  };

  const save = () => {
    if (!canSave) return;
    const committed: DirtySlice = { ...dirty };
    actions.saveHostConfig({
      ...form,
      theme: committed.theme,
      palette: committed.palette,
      cardStyle: committed.cardStyle,
      locale: committed.locale,
      chatLanguage: committed.locale,
    });
    // Commit preview into persisted prefs (localStorage + host theme POST).
    actions.setAppearance(
      { theme: committed.theme, palette: committed.palette },
      "global",
    );
    actions.setCardStyle(committed.cardStyle as CardStyle);
    setSnapshot(committed);
    const now = new Date();
    setLastSavedAt(
      `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
    );
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(hostUrl);
    } catch {
      /* ignore */
    }
  };

  const sectionLabel = (id: SectionId) =>
    id === "appearance"
      ? t("settings.sectionAppearance")
      : id === "network"
        ? t("settings.sectionNetwork")
        : id === "model"
          ? t("settings.sectionModel")
          : t("settings.sectionAbout");

  return (
    <div
      ref={rootRef}
      className="mma-settings"
      id="mma-settings"
      data-open={s.settingsOpen ? "1" : "0"}
      data-wide={wide ? "1" : "0"}
    >
      <header className="mma-settings-head">
        <div className="mma-settings-head-left">
          <span className="mma-settings-head-icon" aria-hidden="true">
            ⚙
          </span>
          <h3>{t("settings.title")}</h3>
        </div>
        <div className="mma-settings-head-right">
          <span className="mma-settings-meta">
            {versionLabel} · {paletteLabel}
          </span>
          <button
            type="button"
            className="mma-iconbtn"
            id="mma-cfg-close"
            aria-label={t("settings.close")}
            onClick={requestClose}
          >
            ✕
          </button>
        </div>
      </header>

      <div className="mma-settings-body">
        <nav className="mma-settings-rail" role="tablist" aria-label={t("settings.sectionsAria")}>
          <div className="mma-settings-rail-title">{t("settings.sectionNav")}</div>
          {SECTIONS.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-current={section === id ? "page" : undefined}
              data-on={section === id ? "1" : "0"}
              className="mma-settings-rail-item"
              onClick={() => scrollTo(id)}
            >
              {sectionLabel(id)}
            </button>
          ))}
        </nav>

        <div className="mma-settings-content" ref={contentRef}>
          <section
            className="mma-settings-section"
            data-section="appearance"
            ref={(el) => {
              sectionRefs.current.appearance = el;
            }}
          >
            <h4>{t("settings.sectionAppearance")}</h4>

            <div className="mma-settings-field">
              <label className="mma-settings-label" htmlFor="mma-cfg-lang-seg">
                {t("settings.language")}
              </label>
              <div className="mma-seg" id="mma-cfg-lang-seg" role="group" aria-label={t("settings.language")}>
                {(
                  [
                    ["zh-CN", t("settings.langZh")],
                    ["en", t("settings.langEn")],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    data-on={locale === id ? "1" : "0"}
                    onClick={() => previewAppearance({ locale: id })}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mma-settings-field">
              <span className="mma-settings-label">{t("settings.theme")}</span>
              <OptionCardGrid
                aria-label={t("settings.theme")}
                columns={3}
                value={themeMode}
                onChange={(v) => previewAppearance({ theme: v })}
                options={(["system", "light", "dark"] as const).map((mode) => ({
                  value: mode,
                  label: t(`theme.${mode}`),
                  preview: <ThemePreview mode={mode} />,
                }))}
              />
            </div>

            <div className="mma-settings-field">
              <span className="mma-settings-label">{t("settings.palette")}</span>
              <OptionCardGrid
                aria-label={t("settings.palette")}
                columns={4}
                value={palette}
                onChange={(v) => previewAppearance({ palette: v })}
                options={PALETTES.map((p) => ({
                  value: p.id,
                  label: t(`palette.${p.id}`),
                  preview: <PalettePreview id={p.id} mode={resolvedMode} />,
                }))}
              />
            </div>

            <div className="mma-settings-field">
              <span className="mma-settings-label">{t("settings.cardStyle")}</span>
              <OptionCardGrid
                aria-label={t("settings.cardStyle")}
                columns={3}
                value={cardStyle}
                onChange={(v) => previewAppearance({ cardStyle: v as CardStyle })}
                options={(
                  [
                    ["stamp", t("settings.cardStamp")],
                    ["etch", t("settings.cardEtch")],
                    ["hero", t("settings.cardHero")],
                    ["list", t("settings.cardList")],
                  ] as const
                ).map(([value, label]) => ({
                  value,
                  label,
                  preview: <CardStylePreview style={value} />,
                }))}
              />
            </div>
            <p className="mma-settings-hint">{t("settings.appearanceHint")}</p>
          </section>

          <hr className="mma-settings-rule" />

          <section
            className="mma-settings-section"
            data-section="network"
            ref={(el) => {
              sectionRefs.current.network = el;
            }}
          >
            <h4>{t("settings.sectionNetwork")}</h4>
            <div className={`mma-settings-field mma-settings-field--row${portError ? " is-error" : ""}`}>
              <label className="mma-settings-label" htmlFor="mma-cfg-port">
                {t("settings.hostPort")}
              </label>
              <div className="mma-settings-control">
                <div className="mma-port-row">
                  <span className="mma-port-addon" aria-hidden="true">
                    :
                  </span>
                  <input
                    id="mma-cfg-port"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={form.hostPort || ""}
                    aria-invalid={!!portError}
                    aria-describedby="mma-cfg-port-hint"
                    onChange={(e) => {
                      setPortTouched(true);
                      patch({ hostPort: e.target.value });
                    }}
                    onBlur={() => setPortTouched(true)}
                  />
                  <code className="mma-port-url">{hostUrl}</code>
                  <button type="button" className="mma-ghostbtn" onClick={() => void copyUrl()}>
                    {t("settings.copyUrl")}
                  </button>
                  <a className="mma-ghostbtn" href={hostUrl} target="_blank" rel="noreferrer">
                    {t("settings.openUrl")}
                  </a>
                </div>
                <p className="mma-settings-hint" id="mma-cfg-port-hint" role={portError ? "alert" : undefined}>
                  {portError ?? t("settings.portHint")}
                </p>
              </div>
            </div>
          </section>

          <hr className="mma-settings-rule" />

          <section
            className="mma-settings-section"
            data-section="model"
            ref={(el) => {
              sectionRefs.current.model = el;
            }}
          >
            <h4>{t("settings.sectionModel")}</h4>
            <div className="mma-settings-field mma-settings-field--row">
              <label className="mma-settings-label" htmlFor="mma-cfg-provider">
                {t("settings.llmProvider")}
              </label>
              <div className="mma-settings-control mma-settings-control--model">
                <input
                  id="mma-cfg-provider"
                  list="mma-cfg-provider-list"
                  placeholder={t("settings.providerPlaceholder")}
                  value={form.provider || ""}
                  onChange={(e) => patch({ provider: e.target.value, model: "" })}
                />
                <datalist id="mma-cfg-provider-list">
                  <option value="openai" />
                  <option value="anthropic" />
                  <option value="deepseek" />
                </datalist>
              </div>
            </div>
            <div className="mma-settings-field mma-settings-field--row">
              <label className="mma-settings-label" htmlFor="mma-cfg-model">
                {t("settings.llmModel")}
              </label>
              <div className="mma-settings-control mma-settings-control--model">
                <div className="mma-model-row">
                  <input
                    id="mma-cfg-model"
                    placeholder={
                      form.provider ? t("settings.modelPlaceholder") : t("settings.modelNeedsProvider")
                    }
                    value={form.model || ""}
                    disabled={!form.provider}
                    onChange={(e) => patch({ model: e.target.value })}
                  />
                  <span className="mma-status-pill" data-state="idle">
                    {t("settings.llmProbeIdle")}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <hr className="mma-settings-rule" />

          <section
            className="mma-settings-section"
            data-section="about"
            ref={(el) => {
              sectionRefs.current.about = el;
            }}
          >
            <h4>{t("settings.sectionAbout")}</h4>
            {s.about ? (
              <>
                <div className="mma-about-meta">
                  <span className="mma-settings-label">{t("settings.env")}</span>
                  <code>
                    {s.about.adapter} · {s.about.env}
                  </code>
                </div>
                <ul className="mma-about-pkgs">
                  {s.about.packages.map((pkg) => (
                    <li key={pkg.name}>
                      <span title={pkg.name}>{shortPkg(pkg.name)}</span>
                      <code>{pkg.version}</code>
                    </li>
                  ))}
                </ul>
                <div className="mma-about-actions">
                  <button
                    type="button"
                    className="mma-ghostbtn"
                    id="mma-cfg-check-update"
                    disabled={s.updateCheck?.status === "loading"}
                    onClick={() => actions.checkUpdates()}
                  >
                    {s.updateCheck?.status === "loading"
                      ? t("settings.checkingUpdate")
                      : t("settings.checkUpdate")}
                  </button>
                  {s.updateCheck?.status === "done" ? (
                    <span className="mma-settings-hint">
                      {s.updateCheck.error
                        ? t("settings.updateError", { message: s.updateCheck.error })
                        : s.updateCheck.updateAvailable
                          ? t("settings.updateAvailable", {
                              latest: s.updateCheck.latest ?? "",
                              current: s.updateCheck.current,
                            })
                          : t("settings.upToDate", {
                              version: s.updateCheck.latest ?? s.updateCheck.current,
                            })}
                    </span>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="mma-settings-hint">{t("settings.aboutLoading")}</p>
            )}
          </section>
        </div>
      </div>

      <footer className="mma-settings-foot">
        <div className="mma-settings-foot-left" aria-live="polite">
          {lastSavedAt ? (
            <span className="mma-settings-hint">
              {t("settings.lastSaved", { time: lastSavedAt })}
              {dirtyCount > 0 ? " · " : ""}
            </span>
          ) : null}
          {dirtyCount > 0 ? (
            <span className="mma-settings-dirty">{t("settings.dirtyCount", { count: dirtyCount })}</span>
          ) : null}
        </div>
        <div className="mma-settings-foot-right">
          {dirtyCount > 0 ? (
            <button type="button" className="mma-ghostbtn" onClick={discard}>
              {t("settings.discard")}
            </button>
          ) : null}
          <button type="button" className="mma-ghostbtn" onClick={() => setConfirm("restore")}>
            {t("settings.restore")}
          </button>
          <button
            type="button"
            className="mma-primarybtn"
            id="mma-cfg-save"
            disabled={!canSave}
            onClick={save}
          >
            {t("settings.save")}
          </button>
        </div>
        <span className="mma-settings-msg" id="mma-cfg-msg">
          {s.cfgMsg}
        </span>
      </footer>

      {confirm ? (
        <div className="mma-settings-confirm" role="presentation">
          <div
            className="mma-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mma-settings-confirm-title"
          >
            <h3 id="mma-settings-confirm-title">
              {confirm === "close" ? t("settings.confirmCloseTitle") : t("settings.confirmRestoreTitle")}
            </h3>
            <p>{confirm === "close" ? t("settings.confirmCloseBody") : t("settings.confirmRestoreBody")}</p>
            <div className="mma-dialog-actions">
              <button type="button" onClick={() => setConfirm(null)}>
                {t("modal.cancel")}
              </button>
              <button
                type="button"
                className="go"
                onClick={() => {
                  if (confirm === "close") {
                    discard();
                    actions.toggleSettings(false);
                  } else restoreDefaults();
                  setConfirm(null);
                }}
              >
                {confirm === "close" ? t("settings.confirmDiscard") : t("settings.confirmRestoreAction")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
