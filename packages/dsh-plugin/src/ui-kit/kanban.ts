// @ts-nocheck
/**
 * @monkeyagent/ui — KanbanBoard（拖拽多栏卡片列表，Jira tickets 场景）。
 * 拖拽用 HTML5 DnD：drag 状态存 useRef（拖拽期间零 re-render，
 * 否则源元素被替换会导致浏览器中断拖拽）；目标列高亮用 DOM 直改。
 * renderCard(item, col, dnd)：自定义卡片 slot，dnd 需 {...dnd} 展开才可拖。
 */
function merge(a, b) {
  return Object.assign({}, a || {}, b || {});
}

export function createKanban(React, ui) {
  const { useRef, createElement: el } = React;

  function KanbanBoard({
    columns = [],
    items = [],
    onDragEnd,
    renderCard,
    idKey = "id",
    titleKey = "title",
    subtitleKey = "subtitle",
    accentKey,
    className,
    style,
  }) {
    const dragRef = useRef(null); // { itemId, columnId }
    const overColRef = useRef(null); // 高亮的列 DOM

    function itId(item) {
      return item[idKey] != null ? item[idKey] : item.id;
    }
    function colItems(colId) {
      return items.filter((it) => it.columnId === colId);
    }
    function clearColHighlight() {
      if (overColRef.current) {
        const el2 = overColRef.current;
        overColRef.current = null;
        el2.style.background = "";
        el2.style.borderColor = "";
      }
    }
    function highlightCol(colEl) {
      if (overColRef.current === colEl) return;
      clearColHighlight();
      overColRef.current = colEl;
      colEl.style.background = "color-mix(in srgb, var(--primary) 8%, transparent)";
      colEl.style.borderColor = "var(--primary)";
    }
    function onDrop(e, colId) {
      e.preventDefault();
      clearColHighlight();
      let from = dragRef.current;
      if (!from) {
        try {
          from = JSON.parse((e.dataTransfer && e.dataTransfer.getData("text/plain")) || "null");
        } catch (_) {
          from = null;
        }
      }
      dragRef.current = null;
      if (from && from.itemId && from.columnId !== colId && onDragEnd) {
        onDragEnd({ itemId: from.itemId, fromColumnId: from.columnId, toColumnId: colId });
      }
    }
    function accentOf(col, item) {
      const v = item && accentKey ? item[accentKey] : undefined;
      return v || col.accent || "var(--primary)";
    }
    function defaultCard(item, col, dnd) {
      return el(
        "div",
        {
          key: itId(item),
          ...dnd,
          title: item[titleKey] != null ? String(item[titleKey]) : String(item.id),
          style: {
            background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10,
            padding: "9px 11px", cursor: "grab", boxShadow: "0 1px 2px var(--shadow)",
          },
          onMouseEnter: (e) => { e.currentTarget.style.boxShadow = "0 4px 12px var(--shadow)"; },
          onMouseLeave: (e) => { e.currentTarget.style.boxShadow = "0 1px 2px var(--shadow)"; },
        },
        accentKey || col.accent
          ? el("div", { style: { height: 3, borderRadius: 2, background: accentOf(col, item), marginBottom: 7 } })
          : null,
        el("div", { style: { fontSize: 13, fontWeight: 600, lineHeight: 1.4, wordBreak: "break-word" } },
          item[titleKey] != null ? item[titleKey] : String(item.id)),
        item[subtitleKey]
          ? el("div", { style: { fontSize: 11.5, color: "var(--muted-foreground)", marginTop: 3, lineHeight: 1.45 } }, item[subtitleKey])
          : null
      );
    }

    return el("div", { className, style: merge({ display: "flex", gap: 12, overflowX: "auto", alignItems: "flex-start", paddingBottom: 6 }, style) },
      columns.map((col) => {
        const list = colItems(col.id);
        return el("div", { key: col.id, style: { flex: "0 0 250px", display: "flex", flexDirection: "column" } },
          el("div", { style: { display: "flex", alignItems: "center", gap: 8, padding: "0 2px 8px" } },
            col.accent
              ? el("i", { style: { width: 8, height: 8, borderRadius: 99, background: col.accent, display: "inline-block" } })
              : null,
            el("b", { style: { fontSize: 13, fontWeight: 650 } }, col.title),
            el("span", { style: { fontSize: 11, color: "var(--muted-foreground)", background: "var(--muted)", borderRadius: 99, padding: "0 7px", lineHeight: 1.6 } }, String(list.length))
          ),
          el("div", {
            "data-col": col.id,
            onDragOver: (e) => {
              e.preventDefault();
              try { e.dataTransfer.dropEffect = "move"; } catch (_) {}
              highlightCol(e.currentTarget);
            },
            onDragLeave: (e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) clearColHighlight();
            },
            onDrop: (e) => onDrop(e, col.id),
            style: {
              display: "flex", flexDirection: "column", gap: 8, flex: 1, minHeight: 60,
              borderRadius: 12, padding: 8,
              background: "color-mix(in srgb, var(--muted) 55%, transparent)",
              border: "1px dashed var(--border)",
              transition: "background-color .15s ease, border-color .15s ease",
            },
          },
            list.map((it) => {
              const dnd = {
                draggable: true,
                onDragStart: (e) => {
                  dragRef.current = { itemId: it[idKey] != null ? it[idKey] : it.id, columnId: col.id };
                  try {
                    e.dataTransfer.setData("text/plain", JSON.stringify({ itemId: it.id, columnId: col.id }));
                    e.dataTransfer.effectAllowed = "move";
                  } catch (_) {}
                },
                onDragEnd: () => {
                  dragRef.current = null;
                  clearColHighlight();
                },
              };
              return renderCard ? renderCard(it, col, dnd) : defaultCard(it, col, dnd);
            })
          )
        );
      })
    );
  }

  return { KanbanBoard };
}
