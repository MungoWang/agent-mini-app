/**
 * Browser half — dsh web slots.
 * Official empty seat: sidebar.footer.action
 * Plus: pin a Dashboard control on the same row as 「新会话」
 * (no official slot exists immediately right of New Session).
 */
export const name = "monkey-mini-app-client";
export const inject = ["slots"] as const;

type Slots = {
  inject: (slot: string, factory: () => unknown) => () => void;
  register: (
    meta: { name: string; id: string; order?: number },
    component: unknown
  ) => unknown;
};

type ClientCtx = {
  slots: Slots;
  inject?: (deps: string[], fn: (scope: { slots: Slots }) => () => void) => void;
  effect?: (fn: () => void | (() => void)) => void;
};

function h(
  tag: string,
  props: Record<string, unknown> | null,
  ...kids: Array<Node | string | null>
): HTMLElement {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (k === "style" && v && typeof v === "object") {
        Object.assign(el.style, v as object);
      } else if (k.startsWith("on") && typeof v === "function") {
        el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
      } else if (k === "className") {
        el.className = String(v);
      } else if (v != null) {
        el.setAttribute(k, String(v));
      }
    }
  }
  for (const c of kids) {
    if (c == null) continue;
    el.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return el;
}

function findNewSessionButton(): HTMLElement | null {
  const nodes = Array.from(document.querySelectorAll("button, a, [role='button']"));
  for (const n of nodes) {
    const t = (n.textContent || "").replace(/\s+/g, "");
    if (t.includes("新会话") || t.includes("NewSession") || t.includes("New chat") || t.includes("NewChat")) {
      return n as HTMLElement;
    }
  }
  return null;
}

function openDashboard() {
  const existing = document.getElementById("mma-dashboard");
  if (existing) {
    existing.remove();
    return;
  }
  const mask = h("div", {
    id: "mma-dashboard",
    style: {
      position: "fixed",
      inset: "0",
      zIndex: "9999",
      background: "rgba(0,0,0,.35)",
      display: "flex",
      justifyContent: "flex-end",
    },
  });
  const panel = h(
    "aside",
    {
      style: {
        width: "min(420px, 92vw)",
        height: "100%",
        background: "var(--dsw-alias-bg, #111)",
        color: "var(--dsw-alias-fg, #f4f4f5)",
        borderLeft: "1px solid var(--dsw-alias-border, #333)",
        padding: "16px",
        overflow: "auto",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
      },
    },
    h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
      h("strong", { style: { fontSize: "16px" } }, "Mini App Dashboard"),
      h("button", { onclick: () => mask.remove(), style: { cursor: "pointer" } }, "✕")
    ),
    h("p", { style: { opacity: "0.7", fontSize: "13px" } }, "Host 多 Tab · runtime apps"),
    listEl
  );
  mask.addEventListener("click", (e) => {
    if (e.target === mask) mask.remove();
  });
  mask.appendChild(panel);
  document.body.appendChild(mask);
  void refreshList();
}

const listEl = h("div", { id: "mma-app-list", style: { marginTop: "12px" } }, "loading…");

async function refreshList() {
  try {
    const r = await fetch("/api/monkey-mini-app/apps");
    if (!r.ok) throw new Error(String(r.status));
    const j = (await r.json()) as { apps?: Array<{ id: string; name?: string; version?: string }> };
    listEl.replaceChildren();
    const apps = j.apps ?? [];
    if (!apps.length) {
      listEl.appendChild(h("p", { style: { opacity: "0.7" } }, "暂无 app。在对话里让模型 register，或把 examples 拷到 ~/.monkey-mini-app/runtime/apps/"));
      return;
    }
    for (const a of apps) {
      listEl.appendChild(
        h(
          "div",
          {
            style: {
              border: "1px solid var(--dsw-alias-border, #333)",
              borderRadius: "8px",
              padding: "10px 12px",
              marginBottom: "8px",
            },
          },
          h("div", { style: { fontWeight: "600" } }, a.name || a.id),
          h("div", { style: { fontSize: "12px", opacity: "0.65" } }, `${a.id} · ${a.version ?? ""}`)
        )
      );
    }
  } catch {
    listEl.replaceChildren();
    listEl.appendChild(
      h("p", null, "Host API 不可用时仍可打开独立 Demo：http://127.0.0.1:8080")
    );
  }
}

function mountNextToNewSession(): () => void {
  let btn: HTMLButtonElement | null = null;
  const place = () => {
    const ns = findNewSessionButton();
    if (!ns || btn?.isConnected) return;
    const parent = ns.parentElement;
    if (!parent) return;
    parent.style.display = parent.style.display || "flex";
    parent.style.alignItems = parent.style.alignItems || "center";
    parent.style.gap = parent.style.gap || "8px";
    ns.style.flex = ns.style.flex || "1";
    btn = document.createElement("button");
    btn.id = "mma-dash-entry";
    btn.type = "button";
    btn.title = "Mini App Dashboard";
    btn.textContent = "Apps";
    btn.style.cssText =
      "flex:0 0 auto;height:36px;padding:0 12px;border-radius:8px;border:1px solid var(--dsw-alias-border, #ddd);background:var(--dsw-alias-bg, #fff);cursor:pointer;font-size:13px;font-weight:600;";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openDashboard();
    });
    ns.insertAdjacentElement("afterend", btn);
  };
  place();
  const mo = new MutationObserver(() => place());
  mo.observe(document.body, { childList: true, subtree: true });
  return () => {
    mo.disconnect();
    btn?.remove();
  };
}

function FooterButton() {
  // Slot occupant: prefer React if present, else return null and rely on DOM pin
  const R = (globalThis as { React?: { createElement: (...a: unknown[]) => unknown } }).React;
  const onClick = (e: Event) => {
    e.preventDefault();
    openDashboard();
  };
  if (R?.createElement) {
    return R.createElement(
      "button",
      {
        type: "button",
        onClick,
        title: "Mini App Dashboard",
        style: { cursor: "pointer", fontWeight: 600 },
      },
      "Apps"
    );
  }
  return null;
}

export function apply(ctx: ClientCtx) {
  const slots = ctx.slots;
  const disposers: Array<() => void> = [];

  try {
    disposers.push(
      slots.inject("sidebar.footer.action", () =>
        slots.register({ name: "sidebar.footer.action", id: "monkey-mini-app", order: 20 }, FooterButton)
      ) as () => void
    );
  } catch (e) {
    console.warn("[monkey-mini-app-client] footer slot failed", e);
  }

  try {
    disposers.push(
      slots.inject("shell.overlay", () =>
        slots.register({ name: "shell.overlay", id: "monkey-mini-app-overlay", order: 80 }, () => null)
      ) as () => void
    );
  } catch {
    /* overlay optional */
  }

  const unpin = mountNextToNewSession();
  disposers.push(unpin);

  return () => {
    for (const d of disposers) {
      try {
        d();
      } catch {
        /* ignore */
      }
    }
  };
}

export default { name, inject, apply };
