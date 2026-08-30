import { appFrameUrl } from "./apps-host.ts";
import { escapeHtml } from "./utils.ts";

export type FrameEnv = { theme: string; palette: string; dock: string };

export type FrameRecord = { wrap: HTMLElement; iframe: HTMLIFrameElement };

export function loadingMarkup(): string {
  return (
    '<div class="mma-load" role="status" aria-label="加载中">' +
    '<div class="mma-load-art" aria-hidden="true">' +
    '<svg viewBox="0 0 88 64" fill="none">' +
    '<rect x="10" y="8" width="68" height="48" rx="10" stroke="currentColor" stroke-width="1.6" opacity=".35"/>' +
    '<rect x="10" y="8" width="68" height="12" rx="10" fill="currentColor" opacity=".08"/>' +
    '<circle cx="20" cy="14" r="2.2" fill="currentColor" opacity=".35"/>' +
    '<rect x="26" y="12.2" width="18" height="3.6" rx="1.8" fill="currentColor" opacity=".22"/>' +
    '<rect x="20" y="28" width="28" height="4" rx="2" fill="currentColor" opacity=".16"/>' +
    '<rect x="20" y="36" width="40" height="4" rx="2" fill="currentColor" opacity=".1"/>' +
    '<rect x="20" y="44" width="22" height="4" rx="2" fill="currentColor" opacity=".08"/>' +
    '<path d="M62 40c6 0 10 5 10 10" stroke="var(--dsw-alias-primary,#3b82f6)" stroke-width="1.8" stroke-linecap="round" opacity=".85"/>' +
    '<circle cx="72" cy="50" r="3.2" fill="var(--dsw-alias-primary,#3b82f6)" opacity=".9"/>' +
    "</svg>" +
    '<div class="mma-load-dots"><i></i><i></i><i></i></div></div></div>'
  );
}

export class FrameController {
  readonly map = new Map<string, FrameRecord>();

  constructor(private readonly envOf: (appId: string) => FrameEnv, private readonly originOf: () => string) {}

  url(appId: string): string {
    return appFrameUrl(this.originOf(), appId, this.envOf(appId));
  }

  postEnv(appId: string): void {
    const rec = this.map.get(appId);
    if (!rec?.iframe.contentWindow) return;
    const env = this.envOf(appId);
    try {
      rec.iframe.contentWindow.postMessage(
        { type: "mma-set-env", theme: env.theme, palette: env.palette, dock: env.dock },
        "*",
      );
    } catch {
      /* ignore */
    }
  }

  postEnvAll(): void {
    for (const id of this.map.keys()) this.postEnv(id);
  }

  mount(appId: string, title?: string): void {
    const frames = document.getElementById("mma-frames");
    if (!frames) return;
    for (const rec of this.map.values()) rec.wrap.style.display = "none";
    let rec = this.map.get(appId);
    if (!rec) {
      const wrap = document.createElement("div");
      wrap.className = "mma-frame";
      wrap.setAttribute("data-app", appId);
      wrap.innerHTML = `${loadingMarkup()}<iframe title="${escapeHtml(title || appId)}"></iframe>`;
      frames.appendChild(wrap);
      const iframe = wrap.querySelector("iframe");
      if (!iframe) return;
      iframe.src = this.url(appId);
      iframe.addEventListener("load", () => {
        const overlay = wrap.querySelector(".mma-load");
        overlay?.parentNode?.removeChild(overlay);
        this.postEnvAll();
      });
      rec = { wrap, iframe };
      this.map.set(appId, rec);
    }
    rec.wrap.style.display = "flex";
  }

  unmount(appId: string): void {
    const rec = this.map.get(appId);
    if (!rec) return;
    rec.wrap.parentNode?.removeChild(rec.wrap);
    this.map.delete(appId);
  }

  unmountAll(): void {
    for (const id of [...this.map.keys()]) this.unmount(id);
  }

  reload(appId: string): void {
    const rec = this.map.get(appId);
    if (!rec) return;
    if (!rec.wrap.querySelector(".mma-load")) rec.wrap.insertAdjacentHTML("afterbegin", loadingMarkup());
    rec.iframe.src = `${this.url(appId)}&_=${Date.now()}`;
  }
}
