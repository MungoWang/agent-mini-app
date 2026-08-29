import * as React from "react"
import { usePanelState } from "../store.js"
import { usePanelActions } from "../context.js"
import { hue, appBlurb, monoOf } from "../lib.js"
import type { AppItem } from "../types.js"
import { Loading } from "./Loading.js"

function Mark({ app, style }: { app: AppItem; style: string }) {
  const mono = monoOf(app)
  if (style === "etch") {
    return (
      <span className="mma-etch" style={{ "--h": hue(app.id) } as React.CSSProperties}>
        {mono}
      </span>
    )
  }
  if (style === "stamp") {
    return (
      <span className="mma-stamp" style={{ "--h": hue(app.id) } as React.CSSProperties}>
        {mono}
      </span>
    )
  }
  return (
    <span className="mma-mono" style={{ "--h": hue(app.id) } as React.CSSProperties}>
      {mono}
    </span>
  )
}

function AppCard({ app }: { app: AppItem }) {
  const s = usePanelState()
  const actions = usePanelActions()
  const open = s.tabs.some((t) => t.id === "app:" + app.id)
  const commits = Number(app.commits || 0)
  return (
    <button type="button" className="mma-card" style={{ "--h": hue(app.id) } as React.CSSProperties} onClick={() => actions.openAppTab(app)}>
      <Mark app={app} style={s.cardStyle} />
      <h3>{app.name || app.id}</h3>
      <p>{appBlurb(app)}</p>
      {commits > 0 || open ? (
        <span className="mma-meta">
          {commits > 0 ? <span className="mma-ver">{commits} commits</span> : null}
          {open ? (
            <span className="mma-open">
              <i />
              已打开
            </span>
          ) : null}
        </span>
      ) : null}
    </button>
  )
}

function AppRow({ app }: { app: AppItem }) {
  const s = usePanelState()
  const actions = usePanelActions()
  const open = s.tabs.some((t) => t.id === "app:" + app.id)
  const commits = Number(app.commits || 0)
  return (
    <button type="button" className="mma-row" style={{ "--h": hue(app.id) } as React.CSSProperties} onClick={() => actions.openAppTab(app)}>
      <Mark app={app} style={s.cardStyle} />
      <span className="mma-twrap">
        <span className="mma-t">{app.name || app.id}</span>
        <small>{appBlurb(app)}</small>
      </span>
      <span className="mma-right">
        {open ? (
          <span className="mma-open">
            <i />
            已打开
          </span>
        ) : commits > 0 ? (
          <span className="mma-ver">{commits} commits</span>
        ) : null}
        <svg className="mma-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.5 6l6 6-6 6" />
        </svg>
      </span>
    </button>
  )
}

function Search() {
  const s = usePanelState()
  const actions = usePanelActions()
  return (
    <div className="mma-search">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3-3" />
      </svg>
      <input type="search" placeholder="搜索小程序" value={s.query} onChange={(e) => actions.setQuery(e.target.value)} />
    </div>
  )
}

export function AppList() {
  const s = usePanelState()
  const q = String(s.query || "").trim().toLowerCase()
  const apps = q ? s.apps.filter((a) => [a.name, a.id, a.description].join(" ").toLowerCase().includes(q)) : s.apps
  if (s.loading && !s.apps.length) return <Loading />
  if (s.error) {
    return (
      <div className="mma-error">
        列表加载失败：{s.error}{" "}
        <button type="button" className="mma-textbtn" onClick={() => usePanelActions().fetchApps()}>
          重试
        </button>
      </div>
    )
  }
  if (!s.apps.length) {
    return <div className="mma-empty">{s.emptyText || "还没有小程序。"}</div>
  }
  if (!apps.length) return <div className="mma-empty">没有匹配「{s.query}」的小程序。</div>
  const Item = s.dock === "side" ? AppRow : AppCard
  return (
    <div className="mma-grid">
      {apps.map((app) => (
        <Item key={app.id} app={app} />
      ))}
    </div>
  )
}

export function ListRegion() {
  const s = usePanelState()
  return (
    <div className="mma-list" id="mma-list">
      <div className="mma-list-head">
        <h2>小程序</h2>
        <span id="mma-app-count">{s.apps.length} 个</span>
      </div>
      <Search />
      <div id="mma-list-body">
        <AppList />
      </div>
    </div>
  )
}
