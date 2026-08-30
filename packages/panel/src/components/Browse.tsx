import * as React from "react";

import { usePanelActions, usePanelI18n } from "../context.tsx";
import { usePanelState } from "../store.ts";
import type { Commit, StorageTable } from "../types.ts";

function isCommit(value: unknown): value is Commit {
  return typeof value === "object" && value !== null && "id" in value && "message" in value;
}

function isStorageTable(value: unknown): value is StorageTable {
  return typeof value === "object" && value !== null && "name" in value;
}

/** Line-colored diff preview (+/− only; no syntax highlighting). */
function DiffPreview({ text }: { text: string }) {
  const lines = text.replace(/\n$/, "").split("\n");
  return (
    <pre className="mma-preview mma-diff-preview">
      {lines.map((line, i) => {
        const kind = line.startsWith("+") ? "add" : line.startsWith("-") ? "del" : "ctx";
        return (
          <span key={i} className={`mma-diff-line mma-diff-line--${kind}`}>
            {line || " "}
            {"\n"}
          </span>
        );
      })}
    </pre>
  );
}

function CommitItem({ c }: { c: Commit }) {
  const actions = usePanelActions();
  const { t } = usePanelI18n();
  const files = (c.files || []).length;
  let add = 0;
  let del = 0;
  for (const f of c.files || []) {
    if ((f.add || 0) > 0) add += f.add || 0;
    if ((f.del || 0) > 0) del += f.del || 0;
  }
  return (
    <button type="button" className="mma-bitem" onClick={() => actions.loadCommitDetail(c.id)} title={c.message}>
      <b className="mma-commit-msg mma-commit-msg--clamp2">{c.message}</b>
      <span className="meta">
        <code>{String(c.id).slice(0, 7)}</code>
        <span>{c.time}</span>
        <span>{t("browse.files", { count: files })}</span>
        {add ? <span className="mma-plus">+{add}</span> : null}
        {del ? <span className="mma-minus">-{del}</span> : null}
      </span>
    </button>
  );
}

function StorageItem({ table }: { table: StorageTable }) {
  const actions = usePanelActions();
  return (
    <button type="button" className="mma-bitem" onClick={() => actions.loadTable(table.name)}>
      <b>{table.name}</b>
      <span className="meta">
        <span>{table.size || 0} B</span>
        <span>{table.updatedAt || ""}</span>
      </span>
    </button>
  );
}

type CommitDetailState = Commit & { loading?: boolean; error?: string };

function CommitDetail() {
  const s = usePanelState();
  const actions = usePanelActions();
  const { t } = usePanelI18n();
  const [msgExpanded, setMsgExpanded] = React.useState(false);
  const d = s.browseDetail as CommitDetailState | null;
  React.useEffect(() => {
    setMsgExpanded(false);
  }, [d?.id]);
  if (!d) return null;
  if (d.loading) return <div className="mma-bempty">{t("browse.loading")}</div>;
  if (d.error) return <div className="mma-berr">{d.error}</div>;
  const longMsg = (d.message || "").length > 80 || (d.message || "").includes("\n");
  return (
    <>
      <div className="mma-browse-head mma-browse-head--tools">
        <div className="mma-btns">
          <button type="button" onClick={() => actions.browseBack()}>
            {t("browse.back")}
          </button>
        </div>
      </div>
      <div className="mma-commit-meta">
        <p
          className={msgExpanded ? "mma-commit-msg" : "mma-commit-msg mma-commit-msg--clamp3"}
          title={d.message}
        >
          {d.message}
        </p>
        {longMsg ? (
          <button type="button" className="mma-commit-msg-toggle" onClick={() => setMsgExpanded((v) => !v)}>
            {msgExpanded ? t("browse.collapseMsg") : t("browse.expandMsg")}
          </button>
        ) : null}
        <div className="meta mma-commit-ids">
          <code>{String(d.id || "").slice(0, 7)}</code>
          <span>{d.time}</span>
        </div>
      </div>
      <div className="mma-files">
        {(d.files || []).map((f) => {
          const open = s.browseOpenFile === f.path;
          const add = f.add || 0;
          const del = f.del || 0;
          return (
            <div key={f.path}>
              <button
                type="button"
                className="mma-fitem"
                data-open={open ? "1" : undefined}
                onClick={() => actions.browseFile(f.path)}
              >
                <span className="mma-diff">
                  <span className={add > 0 ? "mma-plus" : "mma-diff-zero"}>{add > 0 ? `+${add}` : "·"}</span>
                  <span className={del > 0 ? "mma-minus" : "mma-diff-zero"}>{del > 0 ? `-${del}` : "·"}</span>
                </span>
                <span className="p">{f.path}</span>
                <svg className="mma-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9.5 6l6 6-6 6" />
                </svg>
              </button>
              {open && f.preview ? <DiffPreview text={f.preview} /> : null}
            </div>
          );
        })}
        {!(d.files || []).length ? <div className="mma-bempty">{t("browse.noFiles")}</div> : null}
      </div>
    </>
  );
}

function TableDetail() {
  const s = usePanelState();
  const actions = usePanelActions();
  const { t } = usePanelI18n();
  return (
    <>
      <div className="mma-browse-head">
        <div className="mma-btns">
          <button type="button" onClick={() => actions.browseBack()}>
            {t("browse.back")}
          </button>
        </div>
        <h3>{s.browseTable}</h3>
      </div>
      {s.browseLoading ? (
        <div className="mma-bempty">{t("browse.loading")}</div>
      ) : (
        <pre className="mma-preview" style={{ maxHeight: "none", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
          {JSON.stringify(s.browseTableValue, null, 2)}
        </pre>
      )}
    </>
  );
}

export function Browse() {
  const s = usePanelState();
  const actions = usePanelActions();
  const { t } = usePanelI18n();
  if (!s.browseOpen) return null;
  let content: React.ReactNode;
  if (s.browseKind === "history" && s.browseDetail) content = <CommitDetail />;
  else if (s.browseKind === "storage" && s.browseTable !== null) content = <TableDetail />;
  else {
    content = (
      <>
        <div className="mma-browse-head">
          <h3>
            {s.browseKind === "history" ? t("browse.history") : t("browse.storage")}
            <span className="sub">{s.browseAppName}</span>
          </h3>
          <div className="mma-btns">
            <button type="button" onClick={() => actions.toggleBrowse("")}>
              {t("browse.close")}
            </button>
          </div>
        </div>
        {s.browseLoading && !s.browseList.length ? (
          <div className="mma-bempty">{t("browse.loading")}</div>
        ) : s.browseError ? (
          <div className="mma-berr">{s.browseError}</div>
        ) : !s.browseList.length ? (
          <div className="mma-bempty">{s.browseKind === "history" ? t("browse.noCommits") : t("browse.noStorage")}</div>
        ) : (
          <div className="mma-blist">
            {s.browseList.map((item, i) =>
              s.browseKind === "history" && isCommit(item) ? (
                <CommitItem key={i} c={item} />
              ) : isStorageTable(item) ? (
                <StorageItem key={i} table={item} />
              ) : null,
            )}
          </div>
        )}
      </>
    );
  }
  return (
    <div className="mma-browse" id="mma-browse" data-open="1">
      <div className="mma-browse-body" id="mma-browse-body">
        {content}
      </div>
    </div>
  );
}
