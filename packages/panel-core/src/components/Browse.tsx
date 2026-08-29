import * as React from "react"
import { usePanelState } from "../store.js"
import { usePanelActions } from "../context.js"

function CommitItem({ c }: { c: { id: string; message: string; time: string; files?: Array<{ add?: number; del?: number }> } }) {
  const actions = usePanelActions()
  const files = (c.files || []).length
  let add = 0
  let del = 0
  for (const f of c.files || []) {
    if ((f.add || 0) > 0) add += f.add || 0
    if ((f.del || 0) > 0) del += f.del || 0
  }
  return (
    <button type="button" className="mma-bitem" onClick={() => actions.loadCommitDetail(c.id)}>
      <b>{c.message}</b>
      <span className="meta">
        <code>{String(c.id).slice(0, 7)}</code>
        <span>{c.time}</span>
        <span>{files} 个文件</span>
        {add ? <span className="mma-plus">+{add}</span> : null}
        {del ? <span className="mma-minus">-{del}</span> : null}
      </span>
    </button>
  )
}

function StorageItem({ t }: { t: { name: string; size?: number; updatedAt?: string } }) {
  const actions = usePanelActions()
  return (
    <button type="button" className="mma-bitem" onClick={() => actions.loadTable(t.name)}>
      <b>{t.name}</b>
      <span className="meta">
        <span>{t.size || 0} B</span>
        <span>{t.updatedAt || ""}</span>
      </span>
    </button>
  )
}

function CommitDetail() {
  const s = usePanelState()
  const actions = usePanelActions()
  const d = s.browseDetail as
    | { loading?: boolean; error?: string; id?: string; message?: string; time?: string; files?: Array<{ path: string; add?: number; del?: number; preview?: string }> }
    | null
  if (!d) return null
  if (d.loading) return <div className="mma-bempty">加载中…</div>
  if (d.error) return <div className="mma-berr">{d.error}</div>
  return (
    <>
      <div className="mma-browse-head">
        <div className="mma-btns">
          <button type="button" onClick={() => actions.browseBack()}>
            ← 返回
          </button>
        </div>
        <h3>{d.message}</h3>
      </div>
      <div className="meta" style={{ margin: "0 0 10px", fontSize: 11, opacity: 0.75 }}>
        <code>{String(d.id || "").slice(0, 7)}</code>
        <span>{d.time}</span>
      </div>
      <div className="mma-files">
        {(d.files || []).map((f) => {
          const open = s.browseOpenFile === f.path
          return (
            <div key={f.path}>
              <button type="button" className="mma-fitem" onClick={() => actions.browseFile(f.path)}>
                <span className="mma-plus">{(f.add || 0) > 0 ? "+" + (f.add || 0) : "·"}</span>
                <span className="mma-minus">{(f.del || 0) > 0 ? "-" + (f.del || 0) : "·"}</span>
                <span className="p">{f.path}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.5, flex: "0 0 12px" }}>
                  <path d="M9.5 6l6 6-6 6" />
                </svg>
              </button>
              {open && f.preview ? <pre className="mma-preview">{f.preview}</pre> : null}
            </div>
          )
        })}
        {!(d.files || []).length ? <div className="mma-bempty">无文件改动</div> : null}
      </div>
    </>
  )
}

function TableDetail() {
  const s = usePanelState()
  const actions = usePanelActions()
  return (
    <>
      <div className="mma-browse-head">
        <div className="mma-btns">
          <button type="button" onClick={() => actions.browseBack()}>
            ← 返回
          </button>
        </div>
        <h3>{s.browseTable}</h3>
      </div>
      {s.browseLoading ? (
        <div className="mma-bempty">加载中…</div>
      ) : (
        <pre className="mma-preview" style={{ maxHeight: "none", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
          {JSON.stringify(s.browseTableValue, null, 2)}
        </pre>
      )}
    </>
  )
}

export function Browse() {
  const s = usePanelState()
  const actions = usePanelActions()
  if (!s.browseOpen) return null
  let content: React.ReactNode
  if (s.browseKind === "history" && s.browseDetail) content = <CommitDetail />
  else if (s.browseKind === "storage" && s.browseTable !== null) content = <TableDetail />
  else {
    content = (
      <>
        <div className="mma-browse-head">
          <h3>
            {s.browseKind === "history" ? "提交历史" : "存储"}
            <span className="sub">{s.browseAppName}</span>
          </h3>
          <div className="mma-btns">
            <button type="button" onClick={() => actions.toggleBrowse("")}>
              关闭
            </button>
          </div>
        </div>
        {s.browseLoading && !s.browseList.length ? (
          <div className="mma-bempty">加载中…</div>
        ) : s.browseError ? (
          <div className="mma-berr">{s.browseError}</div>
        ) : !s.browseList.length ? (
          <div className="mma-bempty">{s.browseKind === "history" ? "暂无提交记录" : "暂无 storage 文件"}</div>
        ) : (
          <div className="mma-blist">
            {s.browseList.map((item, i) =>
              s.browseKind === "history" ? (
                <CommitItem key={i} c={item as never} />
              ) : (
                <StorageItem key={i} t={item as never} />
              )
            )}
          </div>
        )}
      </>
    )
  }
  return (
    <div className="mma-browse" id="mma-browse" data-open="1">
      <div className="mma-browse-body" id="mma-browse-body">
        {content}
      </div>
    </div>
  )
}
