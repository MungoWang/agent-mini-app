// @ts-nocheck
/**
 * @monkeyagent/ui — shadcn-compatible component bag for monkey-mini-app Host.
 * Pure React + CSS variables (no Tailwind build, no Radix runtime).
 * API surface mirrors common shadcn names so AI skills can generate familiar code.
 * Code/Diff 组件（Editor/CodeBlock/JsonBlock/DiffView/copyText）在 ./ui-kit/code.ts。
 */
import { createCodeComponents, copyText, parseUnified } from "./ui-kit/code.js";
import { createExtras } from "./ui-kit/extras.js";
import { createDataGrid } from "./ui-kit/data-grid.js";

export function createUiKit(React: any) {
  const { useState, useEffect, useId, useRef, useCallback, createElement: h, Fragment } = React;
  const codeComps = createCodeComponents(React);

  function cn(...parts) {
    return parts.filter(Boolean).join(" ");
  }

  function merge(a, b) {
    return Object.assign({}, a || {}, b || {});
  }

  // —— primitives ——
  function Button({ variant = "default", size = "default", className, style, disabled, children, asChild, ...rest }) {
    const variants = {
      default: { background: "var(--primary)", color: "var(--primary-foreground)", border: "1px solid transparent" },
      secondary: { background: "var(--secondary)", color: "var(--secondary-foreground)", border: "1px solid transparent" },
      outline: { background: "transparent", color: "var(--foreground)", border: "1px solid var(--border)" },
      ghost: { background: "transparent", color: "var(--foreground)", border: "1px solid transparent" },
      destructive: { background: "var(--destructive)", color: "var(--destructive-foreground)", border: "1px solid transparent" },
      link: { background: "transparent", color: "var(--primary)", border: "none", textDecoration: "underline", padding: 0 },
    };
    const sizes = {
      default: { height: 36, padding: "0 14px", fontSize: 14 },
      sm: { height: 32, padding: "0 10px", fontSize: 13 },
      lg: { height: 40, padding: "0 18px", fontSize: 15 },
      icon: { height: 36, width: 36, padding: 0 },
    };
    return h(
      "button",
      merge(rest, {
        type: rest.type || "button",
        disabled,
        className: cn("mma-btn", className),
        style: merge(
          {
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            borderRadius: "var(--radius)",
            fontWeight: 500,
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.55 : 1,
            ...variants[variant] || variants.default,
            ...sizes[size] || sizes.default,
          },
          style
        ),
      }),
      children
    );
  }

  function Input({ className, style, ...rest }) {
    return h("input", merge(rest, {
      className: cn("mma-input", className),
      style: merge({
        height: 36, width: "100%", boxSizing: "border-box",
        borderRadius: "var(--radius)", border: "1px solid var(--border)",
        background: "var(--background)", color: "var(--foreground)",
        padding: "0 12px", fontSize: 14, outline: "none",
      }, style),
    }));
  }

  function Textarea({ className, style, ...rest }) {
    return h("textarea", merge(rest, {
      className: cn("mma-textarea", className),
      style: merge({
        minHeight: 80, width: "100%", boxSizing: "border-box",
        borderRadius: "var(--radius)", border: "1px solid var(--border)",
        background: "var(--background)", color: "var(--foreground)",
        padding: "8px 12px", fontSize: 14, outline: "none", resize: "vertical",
        fontFamily: "inherit",
      }, style),
    }));
  }

  function Label({ className, style, children, ...rest }) {
    return h("label", merge(rest, {
      className: cn("mma-label", className),
      style: merge({ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--foreground)" }, style),
    }), children);
  }

  function Checkbox({ checked, onCheckedChange, className, style, ...rest }) {
    return h("input", merge(rest, {
      type: "checkbox",
      checked: !!checked,
      onChange: (e) => onCheckedChange && onCheckedChange(e.target.checked),
      className: cn("mma-checkbox", className),
      style: merge({ width: 16, height: 16, accentColor: "var(--primary)" }, style),
    }));
  }

  function Switch({ checked, onCheckedChange, className, style, disabled }) {
    return h("button", {
      type: "button",
      role: "switch",
      "aria-checked": !!checked,
      disabled,
      className: cn("mma-switch", className),
      onClick: () => !disabled && onCheckedChange && onCheckedChange(!checked),
      style: merge({
        width: 40, height: 22, borderRadius: 999, border: "none", padding: 2,
        background: checked ? "var(--primary)" : "var(--muted)",
        cursor: disabled ? "not-allowed" : "pointer", position: "relative",
        opacity: disabled ? 0.55 : 1,
      }, style),
    }, h("span", {
      style: {
        display: "block", width: 18, height: 18, borderRadius: 999,
        background: "#fff", transform: checked ? "translateX(18px)" : "translateX(0)",
        transition: "transform .15s ease",
      },
    }));
  }

  function Progress({ value = 0, className, style }) {
    const v = Math.max(0, Math.min(100, Number(value) || 0));
    return h("div", {
      className: cn("mma-progress", className),
      style: merge({ height: 8, borderRadius: 999, background: "var(--muted)", overflow: "hidden" }, style),
    }, h("div", {
      style: { width: v + "%", height: "100%", background: "var(--primary)", transition: "width .3s ease" },
    }));
  }

  function Badge({ variant = "default", className, style, children, ...rest }) {
    const map = {
      default: { background: "var(--primary)", color: "var(--primary-foreground)" },
      secondary: { background: "var(--secondary)", color: "var(--secondary-foreground)" },
      outline: { background: "transparent", color: "var(--foreground)", border: "1px solid var(--border)" },
      destructive: { background: "var(--destructive)", color: "var(--destructive-foreground)" },
    };
    return h("span", merge(rest, {
      className: cn("mma-badge", className),
      style: merge({
        display: "inline-flex", alignItems: "center", borderRadius: 999,
        padding: "2px 8px", fontSize: 12, fontWeight: 500, border: "1px solid transparent",
        ...(map[variant] || map.default),
      }, style),
    }), children);
  }

  function Separator({ orientation = "horizontal", className, style }) {
    const horiz = orientation !== "vertical";
    return h("div", {
      role: "separator",
      className: cn("mma-separator", className),
      style: merge(horiz
        ? { height: 1, width: "100%", background: "var(--border)", margin: "8px 0" }
        : { width: 1, alignSelf: "stretch", background: "var(--border)", margin: "0 8px" }, style),
    });
  }

  function Skeleton({ className, style }) {
    return h("div", {
      className: cn("mma-skeleton", className),
      style: merge({
        borderRadius: "var(--radius)", background: "var(--muted)",
        animation: "mma-pulse 1.4s ease-in-out infinite",
      }, style),
    });
  }

  function Spinner({ className, style }) {
    return h("div", {
      className: cn("mma-spinner", className),
      style: merge({
        width: 18, height: 18, borderRadius: "50%",
        border: "2px solid var(--muted)", borderTopColor: "var(--primary)",
        animation: "mma-spin .7s linear infinite",
      }, style),
    });
  }

  function Avatar({ src, alt, fallback, className, style }) {
    const [err, setErr] = useState(false);
    return h("div", {
      className: cn("mma-avatar", className),
      style: merge({
        width: 40, height: 40, borderRadius: "50%", overflow: "hidden",
        background: "var(--muted)", display: "inline-flex", alignItems: "center",
        justifyContent: "center", fontSize: 13, fontWeight: 600, color: "var(--muted-foreground)",
      }, style),
    }, src && !err
      ? h("img", { src, alt: alt || "", style: { width: "100%", height: "100%", objectFit: "cover" }, onError: () => setErr(true) })
      : (fallback || "?"));
  }

  // —— Card ——
  function Card({ className, style, children, ...rest }) {
    return h("div", merge(rest, {
      className: cn("mma-card", className),
      style: merge({
        background: "var(--card)", color: "var(--card-foreground)",
        border: "1px solid var(--border)", borderRadius: "calc(var(--radius) + 4px)",
        boxShadow: "0 1px 2px rgba(0,0,0,.04)",
      }, style),
    }), children);
  }
  function CardHeader({ className, style, children }) {
    return h("div", { className, style: merge({ padding: "16px 16px 0" }, style) }, children);
  }
  function CardTitle({ className, style, children }) {
    return h("h3", { className, style: merge({ margin: 0, fontSize: 16, fontWeight: 600 }, style) }, children);
  }
  function CardDescription({ className, style, children }) {
    return h("p", { className, style: merge({ margin: "4px 0 0", fontSize: 13, color: "var(--muted-foreground)" }, style) }, children);
  }
  function CardContent({ className, style, children }) {
    return h("div", { className, style: merge({ padding: 16 }, style) }, children);
  }
  function CardFooter({ className, style, children }) {
    return h("div", { className, style: merge({ padding: "0 16px 16px", display: "flex", gap: 8 }, style) }, children);
  }

  // —— Alert ——
  function Alert({ variant = "default", className, style, children }) {
    const map = {
      default: { borderColor: "var(--border)", background: "var(--card)" },
      destructive: { borderColor: "var(--destructive)", background: "color-mix(in srgb, var(--destructive) 8%, var(--card))" },
    };
    return h("div", {
      role: "alert",
      className: cn("mma-alert", className),
      style: merge({
        border: "1px solid", borderRadius: "var(--radius)", padding: 12,
        ...(map[variant] || map.default),
      }, style),
    }, children);
  }
  function AlertTitle({ children, style }) {
    return h("div", { style: merge({ fontWeight: 600, marginBottom: 4 }, style) }, children);
  }
  function AlertDescription({ children, style }) {
    return h("div", { style: merge({ fontSize: 13, color: "var(--muted-foreground)" }, style) }, children);
  }

  // —— Table ——
  function Table({ className, style, children }) {
    return h("div", { style: { width: "100%", overflowX: "auto" } },
      h("table", { className, style: merge({ width: "100%", borderCollapse: "collapse", fontSize: 13 }, style) }, children));
  }
  function TableHeader({ children }) { return h("thead", null, children); }
  function TableBody({ children }) { return h("tbody", null, children); }
  function TableRow({ children, style, ...rest }) {
    return h("tr", merge(rest, { style: merge({ borderBottom: "1px solid var(--border)" }, style) }), children);
  }
  function TableHead({ children, style, ...rest }) {
    return h("th", merge(rest, { style: merge({ textAlign: "left", padding: "10px 8px", color: "var(--muted-foreground)", fontWeight: 500 }, style) }), children);
  }
  function TableCell({ children, style }) {
    return h("td", { style: merge({ padding: "10px 8px" }, style) }, children);
  }

  // —— Tabs ——
  function Tabs({ defaultValue, value, onValueChange, children, className, style }) {
    const [internal, setInternal] = useState(defaultValue);
    const v = value !== undefined ? value : internal;
    const set = (nv) => {
      if (value === undefined) setInternal(nv);
      onValueChange && onValueChange(nv);
    };
    return h("div", { className, style, "data-tabs": v },
      React.Children.map(children, (child) =>
        child ? React.cloneElement(child, { __tabsValue: v, __setTabs: set }) : child
      )
    );
  }
  function TabsList({ children, className, style, __tabsValue, __setTabs }) {
    return h("div", {
      className,
      style: merge({
        display: "inline-flex", gap: 4, padding: 4, borderRadius: "var(--radius)",
        background: "var(--muted)",
      }, style),
    }, React.Children.map(children, (c) => c && React.cloneElement(c, { __tabsValue, __setTabs })));
  }
  function TabsTrigger({ value, children, __tabsValue, __setTabs, style }) {
    const active = __tabsValue === value;
    return h("button", {
      type: "button",
      onClick: () => __setTabs && __setTabs(value),
      style: merge({
        border: "none", borderRadius: "calc(var(--radius) - 2px)", padding: "6px 12px",
        background: active ? "var(--background)" : "transparent",
        color: "var(--foreground)", fontWeight: active ? 600 : 500, cursor: "pointer", fontSize: 13,
        boxShadow: active ? "0 1px 2px rgba(0,0,0,.06)" : "none",
      }, style),
    }, children);
  }
  function TabsContent({ value, children, __tabsValue, style }) {
    if (__tabsValue !== value) return null;
    return h("div", { style: merge({ marginTop: 12 }, style) }, children);
  }

  // —— Select (native) ——
  function Select({ value, onValueChange, children, className, style, ...rest }) {
    return h("select", merge(rest, {
      value,
      className: cn("mma-select", className),
      onChange: (e) => onValueChange && onValueChange(e.target.value),
      style: merge({
        height: 36, borderRadius: "var(--radius)", border: "1px solid var(--border)",
        background: "var(--background)", color: "var(--foreground)", padding: "0 10px", fontSize: 14,
      }, style),
    }), children);
  }
  function SelectItem({ value, children }) {
    return h("option", { value }, children);
  }

  // —— Dialog (simple modal) ——
  function Dialog({ open, onOpenChange, children }) {
    if (!open) return null;
    return h("div", {
      style: {
        position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center",
        justifyContent: "center", background: "rgba(0,0,0,.4)",
      },
      onClick: () => onOpenChange && onOpenChange(false),
    }, h("div", {
      onClick: (e) => e.stopPropagation(),
      style: {
        background: "var(--card)", color: "var(--card-foreground)", borderRadius: "calc(var(--radius) + 4px)",
        border: "1px solid var(--border)", minWidth: 320, maxWidth: "90vw", maxHeight: "85vh",
        overflow: "auto", padding: 20, boxShadow: "0 12px 40px rgba(0,0,0,.18)",
      },
    }, children));
  }
  function DialogContent({ children }) { return h(Fragment, null, children); }
  function DialogHeader({ children }) { return h("div", { style: { marginBottom: 12 } }, children); }
  function DialogTitle({ children }) { return h("h2", { style: { margin: 0, fontSize: 18, fontWeight: 600 } }, children); }
  function DialogDescription({ children }) { return h("p", { style: { margin: "6px 0 0", color: "var(--muted-foreground)", fontSize: 13 } }, children); }
  function DialogFooter({ children }) { return h("div", { style: { marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 8 } }, children); }

  // —— Accordion ——
  function Accordion({ type = "single", children, className, style }) {
    const [open, setOpen] = useState(type === "multiple" ? [] : null);
    return h("div", { className, style: merge({ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }, style) },
      React.Children.map(children, (child, i) =>
        child && React.cloneElement(child, {
          __open: type === "multiple" ? (open || []).includes(i) : open === i,
          __toggle: () => {
            if (type === "multiple") {
              const arr = open || [];
              setOpen(arr.includes(i) ? arr.filter((x) => x !== i) : arr.concat(i));
            } else setOpen(open === i ? null : i);
          },
        })
      )
    );
  }
  function AccordionItem({ children, __open, __toggle }) {
    return h("div", { style: { borderBottom: "1px solid var(--border)" } },
      React.Children.map(children, (c) => c && React.cloneElement(c, { __open, __toggle })));
  }
  function AccordionTrigger({ children, __open, __toggle }) {
    return h("button", {
      type: "button", onClick: __toggle,
      style: {
        width: "100%", textAlign: "left", padding: "12px 14px", border: "none",
        background: "transparent", cursor: "pointer", fontWeight: 500, color: "var(--foreground)",
        display: "flex", justifyContent: "space-between",
      },
    }, h("span", null, children), h("span", null, __open ? "−" : "+"));
  }
  function AccordionContent({ children, __open }) {
    if (!__open) return null;
    return h("div", { style: { padding: "0 14px 12px", color: "var(--muted-foreground)", fontSize: 13 } }, children);
  }

  // —— Tooltip (title-based lightweight) ——
  function Tooltip({ children, content }) {
    return h("span", { title: typeof content === "string" ? content : undefined, style: { display: "inline-flex" } }, children);
  }

  // —— Empty ——
  function Empty({ title = "No data", description, children, className, style }) {
    return h("div", {
      className,
      style: merge({
        textAlign: "center", padding: 32, color: "var(--muted-foreground)",
        border: "1px dashed var(--border)", borderRadius: "var(--radius)",
      }, style),
    },
      h("div", { style: { fontWeight: 600, color: "var(--foreground)", marginBottom: 6 } }, title),
      description ? h("div", { style: { fontSize: 13 } }, description) : null,
      children
    );
  }

  // —— Layout helpers (kept for existing apps) ——
  function Stack({ className, style, children, gap = 12 }) {
    return h("div", { className, style: merge({ display: "flex", flexDirection: "column", gap }, style) }, children);
  }
  function Inline({ className, style, children, gap = 8 }) {
    return h("div", { className, style: merge({ display: "flex", alignItems: "center", gap, flexWrap: "wrap" }, style) }, children);
  }
  function Box(props) { return h(Stack, props); }
  function Surface({ className, style, children }) {
    return h(Card, { className, style, children });
  }
  function Text({ variant, className, style, children, ...rest }) {
    const tag = variant && /^h[1-4]$/.test(variant) ? variant : "div";
    const styles = {
      h1: { fontSize: 28, fontWeight: 700 },
      h2: { fontSize: 22, fontWeight: 600 },
      h3: { fontSize: 18, fontWeight: 600 },
      h4: { fontSize: 16, fontWeight: 600 },
      muted: { color: "var(--muted-foreground)", fontSize: 13 },
      small: { fontSize: 12, color: "var(--muted-foreground)" },
      label: { fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted-foreground)" },
      kpi: { fontSize: 28, fontWeight: 700, lineHeight: 1.2 },
    };
    return h(tag, merge(rest, {
      className,
      style: merge({ margin: 0, display: "block", ...(styles[variant] || {}) }, style),
    }), children);
  }

  // —— Field ——
  function Field({ label, description, error, children, className, style }) {
    return h("div", { className, style: merge({ marginBottom: 12 }, style) },
      label ? h(Label, null, label) : null,
      children,
      description ? h("div", { style: { fontSize: 12, color: "var(--muted-foreground)", marginTop: 4 } }, description) : null,
      error ? h("div", { style: { fontSize: 12, color: "var(--destructive)", marginTop: 4 } }, error) : null
    );
  }

  // —— Slider ——
  function Slider({ value = 0, min = 0, max = 100, step = 1, onValueChange, className, style }) {
    return h("input", {
      type: "range", min, max, step, value,
      className,
      onChange: (e) => onValueChange && onValueChange(Number(e.target.value)),
      style: merge({ width: "100%", accentColor: "var(--primary)" }, style),
    });
  }

  // —— RadioGroup ——
  function RadioGroup({ value, onValueChange, options = [], className, style }) {
    return h("div", { className, role: "radiogroup", style: merge({ display: "flex", flexDirection: "column", gap: 8 }, style) },
      options.map((opt) => h("label", {
        key: opt.value,
        style: { display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" },
      },
        h("input", {
          type: "radio",
          checked: value === opt.value,
          onChange: () => onValueChange && onValueChange(opt.value),
          style: { accentColor: "var(--primary)" },
        }),
        opt.label || opt.value
      ))
    );
  }

  // —— Chart helpers (lightweight SVG, no recharts required) ——
  function ChartContainer({ title, children, className, style }) {
    return h(Card, { className, style },
      title ? h(CardHeader, null, h(CardTitle, null, title)) : null,
      h(CardContent, null, children)
    );
  }
  function Sparkline({ data = [], max, height = 72, stroke = "var(--primary)" }) {
    if (!data.length) return h("div", { style: { height, opacity: 0.5, fontSize: 12 } }, "no data");
    const w = 320;
    const hh = height;
    const m = Math.max(max || 0, ...data.map(Number), 1);
    const pts = data.map((v, i) => {
      const x = data.length === 1 ? 0 : (i / (data.length - 1)) * w;
      const y = hh - (Number(v) / m) * (hh - 6) - 3;
      return x.toFixed(1) + "," + y.toFixed(1);
    }).join(" ");
    return h("svg", { width: "100%", viewBox: "0 0 " + w + " " + hh, style: { display: "block" } },
      h("polyline", { fill: "none", stroke, strokeWidth: 2, points: pts })
    );
  }

  // —— ScrollArea ——
  function ScrollArea({ className, style, children }) {
    return h("div", {
      className,
      style: merge({ overflow: "auto", maxHeight: 320 }, style),
    }, children);
  }

  // —— Breadcrumb ——
  function Breadcrumb({ items = [], className, style }) {
    return h("nav", { className, style: merge({ fontSize: 13, color: "var(--muted-foreground)", display: "flex", gap: 6, flexWrap: "wrap" }, style) },
      items.map((it, i) => h(Fragment, { key: i },
        i > 0 ? h("span", null, "/") : null,
        h("span", { style: i === items.length - 1 ? { color: "var(--foreground)", fontWeight: 500 } : null }, it)
      ))
    );
  }

  // —— Kbd ——
  function Kbd({ children, style }) {
    return h("kbd", {
      style: merge({
        fontSize: 11, padding: "1px 6px", borderRadius: 4, border: "1px solid var(--border)",
        background: "var(--muted)", fontFamily: "ui-monospace, monospace",
      }, style),
    }, children);
  }


  function AspectRatio({ ratio = 16 / 9, style, children, className }) {
    return h("div", {
      className,
      style: merge({ position: "relative", width: "100%", paddingBottom: (100 / ratio) + "%" }, style),
    }, h("div", { style: { position: "absolute", inset: 0 } }, children));
  }

  function ButtonGroup({ children, className, style }) {
    return h("div", {
      className,
      role: "group",
      style: merge({ display: "inline-flex", gap: 0 }, style),
    }, children);
  }

  function Collapsible({ open, defaultOpen, onOpenChange, children }) {
    const [internal, setInternal] = useState(!!defaultOpen);
    const v = open !== undefined ? open : internal;
    const set = (nv) => { if (open === undefined) setInternal(nv); onOpenChange && onOpenChange(nv); };
    return h("div", null, React.Children.map(children, (c) => c && React.cloneElement(c, { __open: v, __set: set })));
  }
  function CollapsibleTrigger({ children, __open, __set }) {
    return h("button", { type: "button", onClick: () => __set && __set(!__open), style: { background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0 } }, children);
  }
  function CollapsibleContent({ children, __open }) {
    return __open ? h("div", null, children) : null;
  }

  function AlertDialog(props) { return h(Dialog, props); }
  function AlertDialogContent(props) { return h(DialogContent, props); }
  function AlertDialogHeader(props) { return h(DialogHeader, props); }
  function AlertDialogTitle(props) { return h(DialogTitle, props); }
  function AlertDialogDescription(props) { return h(DialogDescription, props); }
  function AlertDialogFooter(props) { return h(DialogFooter, props); }

  function Sheet({ open, onOpenChange, side = "right", children }) {
    if (!open) return null;
    const pos = {
      right: { right: 0, top: 0, bottom: 0, width: 360, maxWidth: "90vw" },
      left: { left: 0, top: 0, bottom: 0, width: 360, maxWidth: "90vw" },
      bottom: { left: 0, right: 0, bottom: 0, maxHeight: "80vh" },
      top: { left: 0, right: 0, top: 0, maxHeight: "80vh" },
    };
    return h("div", {
      style: { position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,.35)" },
      onClick: () => onOpenChange && onOpenChange(false),
    }, h("div", {
      onClick: (e) => e.stopPropagation(),
      style: merge({
        position: "absolute", background: "var(--card)", color: "var(--card-foreground)",
        border: "1px solid var(--border)", padding: 16, overflow: "auto",
      }, pos[side] || pos.right),
    }, children));
  }
  function SheetContent({ children }) { return h(Fragment, null, children); }
  function SheetHeader({ children }) { return h("div", { style: { marginBottom: 12 } }, children); }
  function SheetTitle({ children }) { return h("h2", { style: { margin: 0, fontSize: 16, fontWeight: 600 } }, children); }

  function Popover({ open, onOpenChange, trigger, children }) {
    const [internal, setInternal] = useState(false);
    const v = open !== undefined ? open : internal;
    const set = (nv) => { if (open === undefined) setInternal(nv); onOpenChange && onOpenChange(nv); };
    return h("div", { style: { position: "relative", display: "inline-block" } },
      h("span", { onClick: () => set(!v) }, trigger),
      v ? h("div", {
        style: {
          position: "absolute", top: "100%", left: 0, zIndex: 40, marginTop: 6,
          background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)",
          padding: 10, minWidth: 180, boxShadow: "0 8px 24px rgba(0,0,0,.12)",
        },
      }, children) : null
    );
  }
  function HoverCard({ trigger, children }) {
    const [open, setOpen] = useState(false);
    return h("span", {
      style: { position: "relative", display: "inline-block" },
      onMouseEnter: () => setOpen(true),
      onMouseLeave: () => setOpen(false),
    }, trigger, open ? h("div", {
      style: {
        position: "absolute", top: "100%", left: 0, zIndex: 40, marginTop: 6,
        background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)",
        padding: 10, minWidth: 180, boxShadow: "0 8px 24px rgba(0,0,0,.12)",
      },
    }, children) : null);
  }

  function InputGroup({ children, className, style }) {
    return h("div", { className, style: merge({ display: "flex", alignItems: "center", gap: 0, border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }, style) }, children);
  }
  function InputOTP({ length = 6, value = "", onChange, style }) {
    const chars = String(value).slice(0, length).split("");
    while (chars.length < length) chars.push("");
    return h("div", { style: merge({ display: "flex", gap: 8 }, style) },
      chars.map((c, i) => h("input", {
        key: i,
        value: c,
        maxLength: 1,
        onChange: (e) => {
          const next = chars.slice();
          next[i] = e.target.value.slice(-1);
          onChange && onChange(next.join(""));
        },
        style: { width: 36, height: 40, textAlign: "center", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 16 },
      }))
    );
  }

  function Item({ children, className, style, onClick }) {
    return h("div", {
      className, onClick,
      style: merge({ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: "var(--radius)", cursor: onClick ? "pointer" : "default" }, style),
    }, children);
  }

  function Pagination({ page = 1, pageCount = 1, onPageChange, className, style }) {
    const pages = [];
    for (let i = 1; i <= pageCount; i++) pages.push(i);
    return h("div", { className, style: merge({ display: "flex", gap: 6, alignItems: "center" }, style) },
      h(Button, { size: "sm", variant: "outline", disabled: page <= 1, onClick: () => onPageChange && onPageChange(page - 1) }, "Prev"),
      pages.slice(0, 9).map((n) => h(Button, { key: n, size: "sm", variant: n === page ? "default" : "ghost", onClick: () => onPageChange && onPageChange(n) }, String(n))),
      h(Button, { size: "sm", variant: "outline", disabled: page >= pageCount, onClick: () => onPageChange && onPageChange(page + 1) }, "Next")
    );
  }

  function Toggle({ pressed, onPressedChange, children, className, style }) {
    return h("button", {
      type: "button",
      "aria-pressed": !!pressed,
      className,
      onClick: () => onPressedChange && onPressedChange(!pressed),
      style: merge({
        height: 32, padding: "0 10px", borderRadius: "var(--radius)",
        border: "1px solid var(--border)",
        background: pressed ? "var(--accent)" : "transparent",
        color: "var(--foreground)", cursor: "pointer",
      }, style),
    }, children);
  }
  function ToggleGroup({ value, onValueChange, options = [], type = "single", className, style }) {
    return h("div", { className, style: merge({ display: "inline-flex", gap: 4 }, style) },
      options.map((opt) => {
        const active = type === "multiple" ? (value || []).includes(opt.value) : value === opt.value;
        return h(Toggle, {
          key: opt.value,
          pressed: active,
          onPressedChange: () => {
            if (type === "multiple") {
              const arr = value || [];
              onValueChange && onValueChange(arr.includes(opt.value) ? arr.filter((x) => x !== opt.value) : arr.concat(opt.value));
            } else onValueChange && onValueChange(opt.value);
          },
        }, opt.label || opt.value);
      })
    );
  }

  function DatePicker({ value, onChange, className, style }) {
    return h(Input, { type: "date", value: value || "", className, style, onChange: (e) => onChange && onChange(e.target.value) });
  }
  function NativeSelect(props) { return h(Select, props); }

  function DropdownMenu({ trigger, items = [] }) {
    return h(Popover, {
      trigger,
      children: items.map((it, i) => h("button", {
        key: i,
        type: "button",
        onClick: it.onSelect,
        style: {
          display: "block", width: "100%", textAlign: "left", border: "none", background: "transparent",
          padding: "6px 8px", cursor: "pointer", color: "var(--foreground)", borderRadius: 6,
        },
      }, it.label)),
    });
  }

  const toastState = { items: [], listeners: [] };
  function toast(msg, opts) {
    const id = Date.now() + Math.random();
    toastState.items = toastState.items.concat([{ id, msg, ...(opts || {}) }]);
    toastState.listeners.forEach((fn) => fn(toastState.items));
    setTimeout(() => {
      toastState.items = toastState.items.filter((x) => x.id !== id);
      toastState.listeners.forEach((fn) => fn(toastState.items));
    }, (opts && opts.duration) || 2500);
  }
  function Toaster({ className, style }) {
    const [items, setItems] = useState(toastState.items);
    useEffect(() => {
      const fn = (next) => setItems(next.slice());
      toastState.listeners.push(fn);
      return () => { toastState.listeners = toastState.listeners.filter((x) => x !== fn); };
    }, []);
    return h("div", {
      className,
      style: merge({ position: "fixed", right: 16, bottom: 16, zIndex: 80, display: "flex", flexDirection: "column", gap: 8 }, style),
    }, items.map((it) => h("div", {
      key: it.id,
      style: {
        background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)",
        padding: "10px 12px", minWidth: 200, boxShadow: "0 8px 24px rgba(0,0,0,.12)",
      },
    }, it.msg)));
  }
  return {
    // shadcn-like
    Button, Input, Textarea, Label, Checkbox, Switch, Progress, Badge, Separator,
    Skeleton, Spinner, Avatar,
    Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
    Alert, AlertTitle, AlertDescription,
    Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
    Tabs, TabsList, TabsTrigger, TabsContent,
    Select, SelectItem,
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
    Accordion, AccordionItem, AccordionTrigger, AccordionContent,
    Tooltip, Empty, Field, Slider, RadioGroup,
    ChartContainer, Sparkline, ScrollArea, Breadcrumb, Kbd,
    AspectRatio, ButtonGroup, Collapsible, CollapsibleTrigger, CollapsibleContent,
    AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
    Sheet, SheetContent, SheetHeader, SheetTitle,
    Popover, HoverCard, InputGroup, InputOTP, Item, Pagination,
    Toggle, ToggleGroup, DatePicker, NativeSelect, DropdownMenu,
    toast, Toaster,
    // layout aliases
    Stack, Inline, Box, Surface, Text, Heading: Text,
    // code & diff (CodeMirror 6)
    ...codeComps,
    copyText,
    parseUnified,
    // QA/Dev workflow
    ...createExtras(React, { Button, Input }),
    // data grid (TanStack headless)
    ...createDataGrid(React, { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button }),
  };
}
