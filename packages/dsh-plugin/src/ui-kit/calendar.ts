// @ts-nocheck
/**
 * @monkeyagent/ui — Calendar（mini 月视图）+ FullCalendar（月/周/日三视图，自绘增强版）。
 * FullCalendar 参考 FullCalendar.io 交互：跨天事件连续长条（Outlook 风格）、
 * 拖选时间/日期范围创建事件、datetime input 表单；onAddEvent 回调由调用方持久化。
 */
function merge(a, b) {
  return Object.assign({}, a || {}, b || {});
}
function pad2(n) {
  return n < 10 ? "0" + n : String(n);
}
function hmOf(s) {
  const d = parseDT(s);
  return d ? pad2(d.getHours()) + ":" + pad2(d.getMinutes()) : "";
}
function parseDT(s) {
  if (!s) return null;
  const m = String(s).match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):?(\d{1,2})?)?/);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), 0, 0);
}
function toStr(d) {
  if (!d) return "";
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}
function hasTime(s) {
  return typeof s === "string" && /[T ]\d{1,2}:\d{2}/.test(s);
}
const EVENT_COLORS = ["#3b82f6", "#8b5cf6", "#22c55e", "#f59e0b", "#ef4444", "#0ea5e9"];
const WEEKDAY = ["日", "一", "二", "三", "四", "五", "六"];

export function createCalendar(React, ui, extraInputs) {
  const { useEffect, useRef, useState, createElement: el } = React;
  const { Button, Input, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } = ui;
  const { DateInput, TimeInput, DateRangeInput, TimeRangeInput, DateTimeRangeInput } = extraInputs || {};

  /* —— Calendar（mini）：月视图，选中/今天/事件圆点，受控 value=YYYY-MM-DD —— */
  function Calendar({ value, onChange, mark, events = [], className, style }) {
    const selected = value ? new Date(String(value) + "T00:00:00") : null;
    const [view, setView] = useState(() => {
      const d = selected || new Date();
      return { y: d.getFullYear(), m: d.getMonth() };
    });
    useEffect(() => {
      if (selected && (selected.getFullYear() !== view.y || selected.getMonth() !== view.m)) {
        setView({ y: selected.getFullYear(), m: selected.getMonth() });
      }
    }, [value]);
    const todayStr = toStr(new Date());
    const first = new Date(view.y, view.m, 1);
    const startDow = first.getDay();
    const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
    const eventSet = {};
    events.forEach((ev) => {
      const d = ev && (ev.date || ev.start);
      if (d) eventSet[String(d).slice(0, 10)] = true; // start 可能带时间，只取日期
    });
    const cells = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(view.y, view.m, d));

    return el("div", { className, style: merge({ width: "fit-content", background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 12, minWidth: 260 }, style) },
      el("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 } },
        el(Button, { size: "sm", variant: "ghost", onClick: () => setView({ y: view.m === 0 ? view.y - 1 : view.y, m: (view.m + 11) % 12 }) }, "‹"),
        el("b", { style: { fontSize: 14, fontWeight: 650 } }, view.y + " 年 " + (view.m + 1) + " 月"),
        el(Button, { size: "sm", variant: "ghost", onClick: () => setView({ y: view.m === 11 ? view.y + 1 : view.y, m: (view.m + 1) % 12 }) }, "›")
      ),
      el("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: 4 } },
        WEEKDAY.map((w) => el("span", { key: w, style: { width: 32, textAlign: "center", fontSize: 11, color: "var(--muted-foreground)" } }, w))
      ),
      el("div", { style: { display: "grid", gridTemplateColumns: "repeat(7, 32px)", gap: 2, justifyContent: "space-between" } },
        cells.map((d, i) => {
          if (!d) return el("span", { key: "e" + i, style: { width: 32, height: 32 } });
          const ds = toStr(d);
          const isSel = selected && ds === toStr(selected);
          const isToday = ds === todayStr;
          const hasEv = eventSet[ds] || (mark && mark(ds));
          return el("button", {
            key: ds,
            type: "button",
            onClick: () => onChange && onChange(ds),
            title: hasEv ? ds + "（有事件）" : ds,
            style: {
              width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 12.5, cursor: "pointer", position: "relative",
              font: "inherit", boxSizing: "border-box",
              background: isSel ? "var(--primary)" : "transparent",
              color: isSel ? "var(--primary-foreground)" : "var(--card-foreground)",
              border: isToday && !isSel ? "1px solid var(--primary)" : "none",
            },
          },
            String(d.getDate()),
            hasEv && !isSel
              ? el("i", { style: { position: "absolute", bottom: 3, left: "50%", transform: "translateX(-50%)", width: 4, height: 4, borderRadius: 99, background: "var(--primary)" } })
              : null
          );
        })
      )
    );
  }

  /* —— FullCalendar：月/周/日 + 跨天长条 + 拖选创建 + datetime input —— */
  function FullCalendar({
    events = [],
    onAddEvent,
    onUpdateEvent,
    defaultView = "month",
    view,
    onViewChange,
    value,
    onChange,
    hourStart = 0,
    hourEnd = 24,
    className,
    style,
  }) {
    const sel = parseDT(value) || new Date();
    const [viewState, setViewState] = useState(defaultView);
    const activeView = view || viewState;
    const setView = (v) => {
      setViewState(v);
      onViewChange && onViewChange(v);
    };
    const [cursor, setCursor] = useState({ y: sel.getFullYear(), m: sel.getMonth(), d: sel.getDate() });
    const cursorDate = new Date(cursor.y, cursor.m, cursor.d);
    const [showAdd, setShowAdd] = useState(false);
    const [editingEvent, setEditingEvent] = useState(null);
    const [form, setForm] = useState({ title: "", start: "", end: "", startTime: "09:00", endTime: "10:00", allDay: true, color: EVENT_COLORS[0] });
    const [selRange, setSelRange] = useState(null); // { start, end, allDay } 拖选高亮
    const [selected, setSelected] = useState(value ? String(value) : dtStr(new Date())); // 单击选中保持
    const [moreDay, setMoreDay] = useState(null); // 月视图「+N 更多」弹该天全部事件
    const dragRef = useRef(null);
    useEffect(() => {
      if (value) setSelected(String(value));
    }, [value]);

    // 拖选：document 级 pointermove（连续高亮，跨格不漏）+ window pointerup 收尾
    useEffect(() => {
      const mv = (e) => {
        if (!dragRef.current) return;
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const cell = el && el.closest ? el.closest("[data-hour]") : null;
        if (cell) {
          const key = cell.getAttribute("data-hour") || "";
          const sp = key.indexOf(":");
          if (sp > 0) {
            const d = key.slice(0, sp);
            const hh = parseInt(key.slice(sp + 1), 10);
            if (!isNaN(hh)) {
              dragRef.current.moved = true;
              dragRef.current.endDay = d;
              dragRef.current.endH = hh + 1;
              setSelRange({ startDay: dragRef.current.startDay, endDay: d, startH: dragRef.current.startH, endH: hh + 1, allDay: false });
            }
          }
        }
      };
      const up = () => {
        if (!dragRef.current) return;
        const r = dragRef.current;
        dragRef.current = null;
        setSelRange(null);
        if (!r.moved) return; // 未拖选（单击），交给 click 处理选中
        if (r.allDay) {
          const d0 = r.start < r.end ? r.start : r.end;
          const d1 = r.start < r.end ? r.end : r.start;
          openAdd({ start: d0, end: d1, allDay: true });
        } else {
          const d0 = r.startDay < r.endDay ? r.startDay : r.endDay;
          const d1 = r.startDay < r.endDay ? r.endDay : r.startDay;
          const sH = Math.min(r.startH, r.endH - 1);
          const eH = Math.max(r.startH, r.endH - 1);
          openAdd({ start: d0 + "T" + pad(sH) + ":00", end: d1 + "T" + pad(eH + 1) + ":00", allDay: false, startTime: pad(sH) + ":00", endTime: pad(eH + 1) + ":00" });
        }
      };
      document.addEventListener("pointermove", mv);
      window.addEventListener("pointerup", up);
      return () => {
        document.removeEventListener("pointermove", mv);
        window.removeEventListener("pointerup", up);
      };
    }, []);
    const pad = pad2;
    function dtStr(d) {
      return toStr(d);
    }
    function eventsOnDay(d) {
      const ds = dtStr(d);
      return events.filter((ev) => {
        const s = parseDT(ev.start);
        if (!s) return false;
        const e = parseDT(ev.end || ev.start);
        return dtStr(s) <= ds && ds <= dtStr(e);
      });
    }
    function openAdd(patch) {
      const base = patch || {};
      const d = base.start || (value ? String(value) : dtStr(new Date()));
      setForm(Object.assign({}, form, { title: "" }, { start: d, end: base.end || d }, base));
      setShowAdd(true);
    }
    function openEdit(ev) {
      const s = parseDT(ev.start);
      const e = parseDT(ev.end || ev.start);
      const allDay = ev.allDay !== false && !hasTime(ev.start);
      setForm({
        title: ev.title || "",
        start: s ? toStr(s) : toStr(new Date()),
        startTime: s ? pad(s.getHours()) + ":" + pad(s.getMinutes()) : "09:00",
        end: e ? toStr(e) : s ? toStr(s) : toStr(new Date()),
        endTime: e ? pad(e.getHours()) + ":" + pad(e.getMinutes()) : "10:00",
        allDay,
        color: ev.color || EVENT_COLORS[0],
      });
      setEditingEvent(ev);
      setShowAdd(true);
    }
    function submitAdd() {
      const title = form.title.trim();
      if (!title) return;
      const start = form.allDay ? form.start : form.start + "T" + form.startTime;
      const end = form.allDay ? form.end : form.end + "T" + form.endTime;
      if (editingEvent) {
        if (onUpdateEvent) onUpdateEvent({ ...editingEvent, title, start, end, color: form.color, allDay: form.allDay });
      } else if (onAddEvent) {
        onAddEvent({ title, start, end, color: form.color, allDay: form.allDay });
      }
      setEditingEvent(null);
      setShowAdd(false);
    }
    function closeForm() {
      setEditingEvent(null);
      setShowAdd(false);
    }
    const nav = (delta) => {
      let d;
      if (activeView === "month") d = new Date(cursor.y, cursor.m + delta, 1);
      else if (activeView === "week") d = new Date(cursor.y, cursor.m, cursor.d + delta * 7);
      else d = new Date(cursor.y, cursor.m, cursor.d + delta);
      setCursor({ y: d.getFullYear(), m: d.getMonth(), d: d.getDate() });
    };
    const goToday = () => {
      const t = new Date();
      setCursor({ y: t.getFullYear(), m: t.getMonth(), d: t.getDate() });
    };
    const headLabel =
      activeView === "month"
        ? cursor.y + " 年 " + (cursor.m + 1) + " 月"
        : activeView === "week"
          ? cursor.y + " 年 " + (cursor.m + 1) + " 月"
          : dtStr(cursorDate);

    /* 月视图：跨天事件连续长条（行内绝对定位 + 堆叠） */
    function monthView() {
      const first = new Date(cursor.y, cursor.m, 1);
      const startDow = first.getDay();
      const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
      const cells = [];
      for (let i = 0; i < startDow; i++) cells.push(null);
      for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(cursor.y, cursor.m, d));
      // 按周分行（保留前置空格，保证 1 号对齐到正确列）
      const weeks = [];
      let row = [];
      cells.forEach((d) => {
        row.push(d);
        if (row.length === 7) {
          weeks.push(row);
          row = [];
        }
      });
      if (row.length) {
        while (row.length < 7) row.push(null);
        weeks.push(row);
      }
      function segsForRow(rowDays) {
        const rS = rowDays[0];
        const rE = rowDays[6];
        const segs = [];
        events.forEach((ev) => {
          const s = parseDT(ev.start);
          const e = parseDT(ev.end || ev.start);
          if (!s || !rS) return;
          if (dtStr(e) < dtStr(rS) || dtStr(s) > dtStr(rE)) return;
          if (dtStr(s) === dtStr(e)) return; // 当天事件 → 格子内竖排（dayRow），不走跨天条
          const cs = dtStr(s) < dtStr(rS) ? rS : s;
          const ce = dtStr(e) > dtStr(rE) ? rE : e;
          segs.push({ ev, colStart: cs.getDay(), colEnd: ce.getDay() });
        });
        segs.sort((a, b) => a.colStart - b.colStart || b.colEnd - a.colEnd);
        const lanes = [];
        segs.forEach((seg) => {
          let li = lanes.findIndex((l) => !l.some((o) => seg.colStart <= o.colEnd && o.colStart <= seg.colEnd));
          if (li < 0) {
            li = lanes.length;
            lanes.push([]);
          }
          lanes[li].push(seg);
          seg.lane = li;
        });
        return segs;
      }
      return el("div", null,
        el("div", { style: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 4 } },
          WEEKDAY.map((w) => el("div", { key: w, style: { textAlign: "center", fontSize: 11, color: "var(--muted-foreground)", padding: 2 } }, w))
        ),
        weeks.map((rowDays, wi) => {
          const segs = segsForRow(rowDays);
          return el("div", { key: wi, style: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, position: "relative", minHeight: 100 } },
            rowDays.map((d, ci) => {
              if (!d) return el("div", { key: "e" + ci, style: { minHeight: 100, border: "1px solid transparent", borderRadius: 8 } });
              const ds = dtStr(d);
              const isToday = ds === dtStr(new Date());
              const inSel = selRange && ds >= selRange.start && ds <= selRange.end;
              const isSel = selected && ds === selected;
              return el("div", {
                key: ds,
                "data-day": ds,
                onClick: () => { setSelected(ds); onChange && onChange(ds); },
                onDoubleClick: () => openAdd({ start: ds, end: ds, allDay: true }),
                onPointerDown: (e) => {
                  e.preventDefault();
                  dragRef.current = { start: ds, end: ds, allDay: true, moved: false };
                  setSelRange({ start: ds, end: ds, allDay: true });
                },
                onPointerEnter: () => {
                  if (dragRef.current) {
                    dragRef.current.moved = true;
                    dragRef.current.end = ds;
                    setSelRange({ start: dragRef.current.start, end: ds, allDay: true });
                  }
                },
                style: {
                  minHeight: 100, borderRadius: 8, padding: "28px 4px 4px", boxSizing: "border-box", position: "relative",
                  cursor: "pointer",
                  background: inSel ? "color-mix(in srgb, var(--primary) 14%, transparent)" : isSel ? "color-mix(in srgb, var(--primary) 10%, transparent)" : isToday ? "color-mix(in srgb, var(--primary) 6%, transparent)" : undefined,
                  border: isSel ? "1px solid color-mix(in srgb, var(--primary) 45%, transparent)" : isToday ? "1px solid var(--primary)" : "1px solid var(--border)",
                },
              },
                el("span", { style: { position: "absolute", top: 3, left: 5, fontSize: 11.5, fontWeight: isToday || isSel ? 700 : 500, color: isToday || isSel ? "var(--primary)" : "var(--card-foreground)" } }, String(d.getDate())),
                ...(function dayRow() {
                  // mac 风格：格子内竖排限 3 行（跨天条优先），超出显示 +N 更多
                  const dayEvs = events
                    .filter((ev) => { const s = parseDT(ev.start); return s && dtStr(s) === ds; })
                    .sort((a, b) => (parseDT(a.start) || 0) - (parseDT(b.start) || 0));
                  const covered = segs.filter((s2) => s2.colStart <= ci && s2.colEnd >= ci);
                  const lanesUsed = covered.length ? Math.max.apply(null, covered.map((s2) => s2.lane)) + 1 : 0;
                  const avail = Math.max(0, 3 - lanesUsed);
                  const evTop = 24 + lanesUsed * 20;
                  return [
                    ...dayEvs.slice(0, avail).map((ev, i) =>
                      el("div", {
                        key: ev.id,
                        title: ev.title,
                        onClick: (e) => { e.stopPropagation(); openEdit(ev); },
                        style: {
                          position: "absolute", left: 4, right: 4, top: evTop + i * 20, height: 18, boxSizing: "border-box",
                          borderRadius: 4, padding: "0 5px", fontSize: 10.5, lineHeight: 1.7,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          background: ev.color || "var(--primary)", color: "#fff", cursor: "pointer",
                        },
                      }, (hasTime(ev.start) ? hmOf(ev.start) + " " : "") + ev.title)
                    ),
                    dayEvs.length > avail
                      ? el("div", {
                          key: "more",
                          onClick: (e) => { e.stopPropagation(); setMoreDay(ds); },
                          style: {
                            position: "absolute", left: 4, top: evTop + avail * 20, height: 14, fontSize: 10, lineHeight: "14px",
                            color: "var(--primary)", fontWeight: 600, cursor: "pointer",
                          },
                        }, "+" + (dayEvs.length - avail) + " 更多")
                      : null,
                  ];
                })()
              );
            }),
            segs.filter((s2) => s2.lane < 3).map((seg) =>
              el("div", {
                key: seg.ev.id,
                title: seg.ev.title,
                onClick: (e) => { e.stopPropagation(); openEdit(seg.ev); },
                style: {
                  position: "absolute", boxSizing: "border-box",
                  left: (seg.colStart / 7) * 100 + "%",
                  width: ((seg.colEnd - seg.colStart + 1) / 7) * 100 + "%",
                  top: 24 + seg.lane * 20, height: 18,
                  borderRadius: 4, padding: "0 6px", fontSize: 10.5, lineHeight: 1.7,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  background: seg.ev.color || "var(--primary)", color: "#fff",
                },
              }, seg.ev.title)
            )
          );
        })
      );
    }

    /* 周/日视图：全天条 + 时间网格 + 时间事件 + 拖选时间段 */
    function timelineView() {
      const days = [];
      if (activeView === "day") {
        days.push(cursorDate);
      } else {
        const start = new Date(cursor.y, cursor.m, cursor.d - ((cursorDate.getDay() + 6) % 7)); // 周一起
        for (let i = 0; i < 7; i++) days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
      }
      // 时间范围：hourStart/hourEnd 为最小范围，timed 事件超出自动扩展（上下留 1h），保证 02:00-08:00 类事件从真实时刻显示
      const tEvs = events.filter((ev) => hasTime(ev.start));
      let hStart = hourStart;
      let hEnd = hourEnd;
      if (tEvs.length) {
        let mn = hStart, mx = hEnd;
        tEvs.forEach((ev) => {
          const s = parseDT(ev.start);
          const e = parseDT(ev.end || ev.start);
          if (s) mn = Math.min(mn, s.getHours());
          if (e) mx = Math.max(mx, e.getHours() + (e.getMinutes() > 0 ? 1 : 0));
        });
        hStart = Math.max(0, mn - 1);
        hEnd = Math.min(24, mx + 1);
      }
      const span = hEnd - hStart;
      const H = 32; // 每小时高度
      const dayStrs = days.map((d) => dtStr(d));
      // —— 时间格列（每列：小时网格 + timed 事件） ——
      const timeCol = (d) => {
        const ds = dtStr(d);
        const timed = eventsOnDay(d).filter((ev) => hasTime(ev.start));
        const colSel = selected && ds === selected;
        return el("div", { key: ds, style: { position: "relative", borderLeft: "1px solid var(--border)", minWidth: 0, background: colSel ? "color-mix(in srgb, var(--primary) 5%, transparent)" : undefined } },
          hours.map((h) => {
            const inSel = selRange && ds >= selRange.startDay && ds <= selRange.endDay && h >= selRange.startH && h < selRange.endH;
            return el("div", {
              key: h,
              "data-hour": ds + ":" + h,
              onClick: () => { setSelected(ds); onChange && onChange(ds); },
              onDoubleClick: () => openAdd({ start: ds + "T" + pad(h) + ":00", end: ds + "T" + pad(h + 1) + ":00", allDay: false, startTime: pad(h) + ":00", endTime: pad(h + 1) + ":00" }),
              onPointerDown: (e) => {
                e.preventDefault();
                dragRef.current = { startDay: ds, endDay: ds, startH: h, endH: h + 1, allDay: false, moved: false };
                setSelRange({ startDay: ds, endDay: ds, startH: h, endH: h + 1, allDay: false });
              },
              onPointerEnter: () => {
                if (dragRef.current) {
                  dragRef.current.moved = true;
                  dragRef.current.endDay = ds;
                  dragRef.current.endH = h + 1;
                  setSelRange({ startDay: dragRef.current.startDay, endDay: ds, startH: dragRef.current.startH, endH: h + 1, allDay: false });
                }
              },
              style: {
                position: "absolute", top: (h - hStart) * H, left: 0, right: 0, height: H,
                borderTop: "1px solid color-mix(in srgb, var(--border) 60%, transparent)",
                cursor: "crosshair",
                background: inSel ? "color-mix(in srgb, var(--primary) 14%, transparent)" : undefined,
              },
            });
          }),
          (function layoutTimed() {
            // 重叠检测分配 lane（同时间段并排），避免错位覆盖
            const sorted = timed.slice().sort((a, b) => (parseDT(a.start) || 0) - (parseDT(b.start) || 0));
            const lanes = [];
            sorted.forEach((ev) => {
              const s = parseDT(ev.start);
              const e = parseDT(ev.end || ev.start);
              let li = lanes.findIndex((l) => !l.some((o) => {
                const os = parseDT(o.start);
                const oe = parseDT(o.end || o.start);
                return s < oe && os < e;
              }));
              if (li < 0) { li = lanes.length; lanes.push([]); }
              lanes[li].push(ev);
              ev._lane = li;
            });
            const n = Math.max(lanes.length, 1);
            return sorted.map((ev) => {
              const s = parseDT(ev.start);
              const e = parseDT(ev.end || ev.start);
              let top = Math.max(s.getHours() - hStart + s.getMinutes() / 60, 0);
              let height = Math.max(e.getTime() - s.getTime(), 60 * 60 * 1000) / 1000 / 3600;
              if (top < 0) { height += top; top = 0; }
              if (top + height > span) height = span - top;
              const w = 100 / n;
              return el("div", {
                key: ev.id,
                title: ev.title,
                onClick: () => openEdit(ev),
                style: {
                  position: "absolute", top: top * H + 1,
                  height: height * H,
                  left: "calc((100%/" + n + ") * " + ev._lane + " + 2px)",
                  width: "calc(100%/" + n + " - 4px)",
                  minHeight: 16, boxSizing: "border-box",
                  borderRadius: 5, padding: "1px 6px", fontSize: 11, lineHeight: 1.5, overflow: "hidden",
                  background: ev.color || "var(--primary)", color: "#fff", cursor: "pointer",
                },
              }, ev.title);
            });
          })()
        );
      };
      // —— all-day 事件 → 连续 bar（mac 风格：通栏跨列 + lane 堆叠） ——
      const allDayItems = [];
      events.forEach((ev) => {
        if (hasTime(ev.start)) return;
        const s = parseDT(ev.start);
        const e = parseDT(ev.end || ev.start);
        if (!s) return;
        if (activeView === "day") {
          const ds = dayStrs[0];
          if (!(dtStr(s) <= ds && dtStr(e) >= ds)) return;
          allDayItems.push({ ev, sc: 0, ec: 0 });
        } else {
          let sc = dayStrs.indexOf(dtStr(s));
          let ec = dayStrs.indexOf(dtStr(e));
          if (sc < 0) sc = 0;
          if (ec >= days.length) ec = days.length - 1;
          if (sc > days.length - 1 || ec < 0 || sc > ec) return;
          allDayItems.push({ ev, sc, ec });
        }
      });
      const allDaySorted = allDayItems.slice().sort((a, b) => a.sc - b.sc);
      const allDayLanes = [];
      allDaySorted.forEach((it) => {
        // <=：同日/相邻天 all-day 事件都算重叠（mac：共用天即并排），避免多事件挤进同一 lane 互相覆盖
        let li = allDayLanes.findIndex((l) => !l.some((o) => it.sc <= o.ec && o.sc <= it.ec));
        if (li < 0) { li = allDayLanes.length; allDayLanes.push([]); }
        allDayLanes[li].push(it);
        it.lane = li;
      });
      const laneCount = Math.max(allDayLanes.length, 1);
      const allDayH = laneCount * 30 + 6;
      const weekDays = ["日", "一", "二", "三", "四", "五", "六"];
      const hours = [];
      for (let h = hStart; h < hEnd; h++) hours.push(h);
      const colCount = days.length;
      return el("div", { style: { display: "flex" } },
        el("div", { style: { width: 44, flex: "0 0 44px" } },
          el("div", { style: { height: 46 } }),
          el("div", { style: { height: allDayH, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 6, fontSize: 10.5, color: "var(--muted-foreground)", whiteSpace: "nowrap", overflow: "hidden" } }, "全天"),
          el("div", { style: { position: "relative", height: span * H } },
            hours.map((h) => el("div", { key: h, style: { position: "absolute", top: (h - hStart) * H - 7, right: 6, fontSize: 10.5, color: "var(--muted-foreground)" } }, pad(h) + ":00"))
          )
        ),
        el("div", { style: { flex: 1, display: "grid", gridTemplateColumns: "repeat(" + colCount + ", minmax(0, 1fr))", gridTemplateRows: "46px " + allDayH + "px " + span * H + "px", minWidth: 0 } },
          // 日期头（mac：周几 + 日期，今天红底圆标）
          days.map((d, i) =>
            el("div", { key: "hd" + i, style: { textAlign: "center", paddingTop: 4, overflow: "hidden" } },
              el("div", { style: { fontSize: 10.5, color: "var(--muted-foreground)", lineHeight: 1.5 } }, "周" + weekDays[d.getDay()]),
              el("div", {
                onClick: () => { setSelected(dtStr(d)); onChange && onChange(dtStr(d)); },
                style: {
                  width: 24, height: 24, lineHeight: "24px", borderRadius: 99, margin: "0 auto",
                  fontSize: 13, fontWeight: 650, cursor: "pointer",
                  background: dtStr(d) === dtStr(new Date()) ? "var(--primary)" : selected && dtStr(d) === selected ? "color-mix(in srgb, var(--primary) 18%, transparent)" : undefined,
                  color: dtStr(d) === dtStr(new Date()) ? "#fff" : selected && dtStr(d) === selected ? "var(--primary)" : "var(--card-foreground)",
                },
              }, d.getDate())
            )
          ),
          // all-day 区背景（通栏浅色条）
          el("div", { key: "adb", style: { gridColumn: "1 / " + (colCount + 1), gridRow: 2, background: "color-mix(in srgb, var(--muted) 32%, transparent)", borderTop: "1px solid var(--border)", borderBottom: "1px dashed var(--border)" } }),
          // all-day 连续 bar（跨列 + lane 堆叠）
          allDaySorted.map((it) =>
            el("div", {
              key: "al" + it.ev.id,
              title: it.ev.title,
              onClick: (e) => { e.stopPropagation(); openEdit(it.ev); },
              style: {
                gridColumn: (it.sc + 1) + " / " + (it.ec + 2),
                gridRow: 2,
                marginTop: it.lane * 30 + 3,
                marginLeft: 2, marginRight: 2, marginBottom: 3,
                height: 24, alignSelf: "start",
                fontSize: 11, lineHeight: "24px", padding: "0 8px", borderRadius: 6,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                background: it.ev.color || "var(--primary)", color: "#fff", cursor: "pointer",
                boxShadow: "0 1px 2px var(--shadow)",
              },
            }, it.ev.title)
          ),
          // 时间格列
          days.map((d) => timeCol(d))
        )
      );
    }

    return el("div", { className, style: merge({ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 12, minWidth: 320 }, style) },
      el("div", { style: { display: "flex", alignItems: "center", gap: 6, marginBottom: 10, flexWrap: "wrap" } },
        el(Button, { size: "sm", variant: "ghost", onClick: () => nav(-(activeView === "month" ? 1 : activeView === "week" ? 7 : 1)) }, "‹"),
        el(Button, { size: "sm", variant: "ghost", onClick: () => nav(activeView === "month" ? 1 : activeView === "week" ? 7 : 1) }, "›"),
        el("b", { style: { fontSize: 14, fontWeight: 650, margin: "0 6px", whiteSpace: "nowrap" } }, headLabel),
        el(Button, { size: "sm", variant: "outline", onClick: goToday }, "今天"),
        el("div", { style: { flex: 1 } }),
        (["month", "week", "day"]).map((v) =>
          el(Button, { key: v, size: "sm", variant: activeView === v ? "default" : "ghost", onClick: () => setView(v) }, v === "month" ? "月" : v === "week" ? "周" : "日")
        ),
        el(Button, { size: "sm", onClick: () => openAdd({ start: dtStr(cursorDate), end: dtStr(cursorDate) }) }, "+ 添加")
      ),
      el("div", { style: { userSelect: "none" } },
        activeView === "month" ? monthView() : timelineView()
      ),
      el(Dialog, { open: showAdd, onOpenChange: (v) => { setShowAdd(v); if (!v) setEditingEvent(null); } },
        el(DialogContent, null,
          el(DialogHeader, null,
            el(DialogTitle, null, editingEvent ? "编辑事件" : "添加事件"),
            el(DialogDescription, null, editingEvent ? "修改后提交 onUpdateEvent 持久化" : "提交后由调用方持久化保存（onAddEvent）")
          ),
          el("div", { style: { display: "flex", flexDirection: "column", gap: 8, marginTop: 8 } },
            el(Input, { value: form.title, placeholder: "事件标题", onChange: (e) => setForm(Object.assign({}, form, { title: e.target.value })) }),
            el("div", { style: { display: "flex", gap: 8, alignItems: "center" } },
              el("label", { style: { display: "flex", alignItems: "center", gap: 5, fontSize: 12 } },
                el("input", { type: "checkbox", checked: form.allDay, onChange: (e) => setForm(Object.assign({}, form, { allDay: e.target.checked })) }),
                "全天"
              ),
              el("div", { style: { display: "flex", gap: 4, flex: 1, justifyContent: "flex-end" } },
                EVENT_COLORS.map((c) =>
                  el("button", {
                    key: c, type: "button",
                    onClick: () => setForm(Object.assign({}, form, { color: c })),
                    style: { width: 18, height: 18, borderRadius: 6, background: c, border: form.color === c ? "2px solid var(--card-foreground)" : "none", cursor: "pointer" },
                  })
                )
              )
            ),
            el("div", { style: { display: "flex", gap: 8 } },
              el("div", { style: { flex: 1 } },
                el("div", { style: { fontSize: 11, color: "var(--muted-foreground)", marginBottom: 3 } }, "开始"),
                el(DateInput, { value: form.start, max: form.end, onChange: (v) => setForm(Object.assign({}, form, { start: v })) }),
                !form.allDay ? el(TimeInput, { value: form.startTime, max: form.endTime, onChange: (v) => setForm(Object.assign({}, form, { startTime: v })) }) : null
              ),
              el("div", { style: { flex: 1 } },
                el("div", { style: { fontSize: 11, color: "var(--muted-foreground)", marginBottom: 3 } }, "结束"),
                el(DateInput, { value: form.end, min: form.start, onChange: (v) => setForm(Object.assign({}, form, { end: v })) }),
                !form.allDay ? el(TimeInput, { value: form.endTime, min: form.startTime, onChange: (v) => setForm(Object.assign({}, form, { endTime: v })) }) : null
              )
            )
          ),
          el(DialogFooter, null,
            el(Button, { size: "sm", variant: "ghost", onClick: closeForm }, "取消"),
            el(Button, { size: "sm", onClick: submitAdd, disabled: !form.title.trim() }, editingEvent ? "保存" : "添加")
          )
        )
      ),
      el(Dialog, { open: !!moreDay, onOpenChange: (v) => { if (!v) setMoreDay(null); } },
        el(DialogContent, null,
          el(DialogHeader, null,
            el(DialogTitle, null, (moreDay || "") + " 全部事件"),
            el(DialogDescription, null, "点击事件可编辑")
          ),
          el("div", { style: { display: "flex", flexDirection: "column", gap: 4, marginTop: 8, maxHeight: 320, overflowY: "auto" } },
            (moreDay
              ? events
                  .filter((ev) => { const s = parseDT(ev.start); return s && dtStr(s) === moreDay; })
                  .sort((a, b) => (parseDT(a.start) || 0) - (parseDT(b.start) || 0))
              : []
            ).map((ev) =>
              el("div", {
                key: ev.id,
                onClick: () => { openEdit(ev); setMoreDay(null); },
                style: { display: "flex", gap: 6, alignItems: "center", padding: "7px 8px", borderRadius: 6, cursor: "pointer", background: "var(--muted)" },
              },
                el("i", { style: { width: 8, height: 8, borderRadius: 99, background: ev.color || "var(--primary)", flex: "0 0 auto" } }),
                el("span", { style: { fontSize: 12.5, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
                  (hasTime(ev.start) ? hmOf(ev.start) + "–" + hmOf(ev.end || ev.start) + "  " : "全天  ") + ev.title
                )
              )
            )
          )
        )
      )
    );
  }

  return { Calendar, FullCalendar };
}
