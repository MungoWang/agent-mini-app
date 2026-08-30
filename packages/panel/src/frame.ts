/**
 * FrameController — browser iframe hosting for mini-apps.
 *
 * Reusable chrome: mounts an app iframe into a given container, posts the
 * current theme/palette/dock env into it (the appRunnerHtml listens for
 * `mma-set-env`), and shows a loading overlay. Host-agnostic: the container and
 * an `envOf(appId)` accessor are injected, so dsh and apps/react-host both use it.
 */
export type FrameEnv = { theme: string; palette: string; dock: string };

export type FrameRecord = { wrap: HTMLElement; iframe: HTMLIFrameElement };

export type FrameController = {
  url(appId: string): string;
  mount(appId: string, title?: string): void;
  unmount(appId: string): void;
  unmountAll(): void;
  reload(appId: string): void;
  postEnv(appId: string): void;
  postEnvAll(): void;
  /** Set/rebind the container the app iframes mount into (e.g. the panel's #mma-frames). */
  setContainer(el: HTMLElement): void;
  readonly map: Map<string, FrameRecord>;
};

export type FrameControllerOptions = {
  /** The element app iframes mount into; may be bound later via setContainer. */
  container?: HTMLElement | null;
  /** Build the iframe src for an app. Usually appFrameUrl(origin, appId, env). */
  urlOf(appId: string): string;
  /** Current env for an app (theme/palette/dock), posted via mma-set-env. */
  envOf(appId: string): FrameEnv;
};

function escapeHtml(s: unknown): string {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return c;
    }
  });
}

function loadingMarkup(): string {
  return `<div class="mma-load" role="status" aria-label="加载中">
<div class="mma-load-art" aria-hidden="true">
<svg viewBox="0 0 88 64" fill="none">
<rect x="10" y="8" width="68" height="48" rx="10" stroke="currentColor" stroke-width="1.6" opacity=".35"/>
<rect x="10" y="8" width="68" height="12" rx="10" fill="currentColor" opacity=".08"/>
<circle cx="20" cy="14" r="2.2" fill="currentColor" opacity=".35"/>
<rect x="26" y="12.2" width="18" height="3.6" rx="1.8" fill="currentColor" opacity=".22"/>
<rect x="20" y="28" width="28" height="4" rx="2" fill="currentColor" opacity=".16"/>
<rect x="20" y="36" width="40" height="4" rx="2" fill="currentColor" opacity=".1"/>
<rect x="20" y="44" width="22" height="4" rx="2" fill="currentColor" opacity=".08"/>
<path d="M62 40c6 0 10 5 10 10" stroke="var(--primary,#3b82f6)" stroke-width="1.8" stroke-linecap="round" opacity=".85"/>
<circle cx="72" cy="50" r="3.2" fill="var(--primary,#3b82f6)" opacity=".9"/>
</svg>
<div class="mma-load-dots"><i></i><i></i><i></i></div></div></div>`;
}

export function createFrameController(opts: FrameControllerOptions): FrameController {
  const { container: initial, urlOf, envOf } = opts;
  let container: HTMLElement | null = initial ?? null;
  const map = new Map<string, FrameRecord>();

  return {
    map,
    url: (appId) => urlOf(appId),
    setContainer(el) {
      container = el;
    },
    postEnv(appId) {
      const rec = map.get(appId);
      const w = rec?.iframe.contentWindow;
      if (!w) return;
      const env = envOf(appId);
      try {
        w.postMessage({ type: "mma-set-env", theme: env.theme, palette: env.palette, dock: env.dock }, "*");
      } catch {
        /* ignore */
      }
    },
    postEnvAll() {
      for (const id of map.keys()) this.postEnv(id);
    },
    mount(appId, title) {
      for (const rec of map.values()) rec.wrap.style.display = "none";
      let rec = map.get(appId);
      if (!rec) {
        const wrap = document.createElement("div");
        wrap.className = "mma-frame";
        wrap.setAttribute("data-app", appId);
        wrap.innerHTML = `${loadingMarkup()}<iframe title="${escapeHtml(title || appId)}"></iframe>`;
        if (!container) return;
      container.appendChild(wrap);
        const iframe = wrap.querySelector("iframe");
        if (!iframe) return;
        iframe.src = urlOf(appId);
        iframe.addEventListener("load", () => {
          const overlay = wrap.querySelector(".mma-load");
          overlay?.parentNode?.removeChild(overlay);
          this.postEnvAll();
        });
        rec = { wrap, iframe };
        map.set(appId, rec);
      }
      rec.wrap.style.display = "flex";
    },
    unmount(appId) {
      const rec = map.get(appId);
      if (!rec) return;
      rec.wrap.parentNode?.removeChild(rec.wrap);
      map.delete(appId);
    },
    unmountAll() {
      for (const id of [...map.keys()]) this.unmount(id);
    },
    reload(appId) {
      const rec = map.get(appId);
      if (!rec) return;
      if (!rec.wrap.querySelector(".mma-load")) rec.wrap.insertAdjacentHTML("afterbegin", loadingMarkup());
      rec.iframe.src = `${urlOf(appId)}&_=${Date.now()}`;
    },
  };
}
