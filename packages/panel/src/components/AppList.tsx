import * as React from "react";

import { usePanelActions, usePanelI18n } from "../context.tsx";
import { appBlurb, hue, monoOf } from "../lib.ts";
import { usePanelState } from "../store.ts";
import type { AppItem } from "../types.ts";
import { Loading } from "./Loading.tsx";

function Mark({ app, style }: { app: AppItem; style: string }) {
  const mono = monoOf(app);
  if (style === "etch") {
    return (
      <span className="mma-etch" style={{ "--h": hue(app.id) } as React.CSSProperties}>
        {mono}
      </span>
    );
  }
  if (style === "stamp") {
    return (
      <span className="mma-stamp" style={{ "--h": hue(app.id) } as React.CSSProperties}>
        {mono}
      </span>
    );
  }
  return (
    <span className="mma-mono" style={{ "--h": hue(app.id) } as React.CSSProperties}>
      {mono}
    </span>
  );
}

function AppCard({ app }: { app: AppItem }) {
  const s = usePanelState();
  const actions = usePanelActions();
  const { t } = usePanelI18n();
  const open = s.tabs.some((tab) => tab.id === "app:" + app.id);
  const commits = Number(app.commits || 0);
  return (
    <button
      type="button"
      className="mma-card"
      style={{ "--h": hue(app.id) } as React.CSSProperties}
      onClick={() => actions.openAppTab(app)}
    >
      <Mark app={app} style={s.cardStyle} />
      <h3>{app.name || app.id}</h3>
      <p>{appBlurb(app)}</p>
      {commits > 0 || open ? (
        <span className="mma-meta">
          {commits > 0 ? <span className="mma-ver">{t("list.commits", { count: commits })}</span> : null}
          {open ? (
            <span className="mma-open">
              <i />
              {t("list.open")}
            </span>
          ) : null}
        </span>
      ) : null}
    </button>
  );
}

function AppRow({ app }: { app: AppItem }) {
  const s = usePanelState();
  const actions = usePanelActions();
  const { t } = usePanelI18n();
  const open = s.tabs.some((tab) => tab.id === "app:" + app.id);
  const commits = Number(app.commits || 0);
  return (
    <button
      type="button"
      className="mma-row"
      style={{ "--h": hue(app.id) } as React.CSSProperties}
      onClick={() => actions.openAppTab(app)}
    >
      <Mark app={app} style={s.cardStyle} />
      <span className="mma-twrap">
        <span className="mma-t">{app.name || app.id}</span>
        <small>{appBlurb(app)}</small>
      </span>
      <span className="mma-right">
        {open ? (
          <span className="mma-open">
            <i />
            {t("list.open")}
          </span>
        ) : commits > 0 ? (
          <span className="mma-ver">{t("list.commits", { count: commits })}</span>
        ) : null}
        <svg className="mma-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.5 6l6 6-6 6" />
        </svg>
      </span>
    </button>
  );
}

function Search() {
  const s = usePanelState();
  const actions = usePanelActions();
  const { t } = usePanelI18n();
  return (
    <div className="mma-search">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3-3" />
      </svg>
      <input type="search" placeholder={t("list.search")} value={s.query} onChange={(e) => actions.setQuery(e.target.value)} />
    </div>
  );
}

export function AppList() {
  const s = usePanelState();
  const actions = usePanelActions();
  const { t } = usePanelI18n();
  const q = String(s.query || "").trim().toLowerCase();
  const apps = q
    ? s.apps.filter((a) => [a.name, a.id, a.description].join(" ").toLowerCase().includes(q))
    : s.apps;
  if (s.loading && !s.apps.length) return <Loading />;
  if (s.error) {
    return (
      <div className="mma-error">
        {t("list.loadError", { message: s.error })}{" "}
        <button type="button" className="mma-textbtn" onClick={() => actions.fetchApps()}>
          {t("list.retry")}
        </button>
      </div>
    );
  }
  if (!s.apps.length) {
    return <div className="mma-empty">{s.emptyText || t("list.empty")}</div>;
  }
  if (!apps.length) return <div className="mma-empty">{t("list.noMatch", { query: s.query })}</div>;
  const Item = s.dock === "side" ? AppRow : AppCard;
  return (
    <div className="mma-grid">
      {apps.map((app) => (
        <Item key={app.id} app={app} />
      ))}
    </div>
  );
}

export function ListRegion() {
  const s = usePanelState();
  const { t } = usePanelI18n();
  return (
    <div className="mma-list" id="mma-list">
      <div className="mma-list-head">
        <h2>{t("list.title")}</h2>
        <span id="mma-app-count">{t("list.count", { count: s.apps.length })}</span>
      </div>
      <Search />
      <div id="mma-list-body">
        <AppList />
      </div>
    </div>
  );
}
