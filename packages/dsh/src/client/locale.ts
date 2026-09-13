import { detectBrowserLocale, localeFromLanguageTag, type LocaleId } from "@monkey-mini-app/panel";

type LooseCtx = {
  get?: (name: string) => unknown;
  on?: (event: string, listener: (...args: unknown[]) => void) => unknown;
  [key: string]: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Soft-read a cordis service. Attribute access throws when the name is not injected. */
function softGet(ctx: LooseCtx, name: string): unknown {
  try {
    if (typeof ctx.get === "function") {
      const viaGet = ctx.get(name);
      if (viaGet !== undefined) return viaGet;
    }
  } catch {
    /* ignore */
  }
  try {
    const direct = ctx[name];
    if (direct !== undefined) return direct;
  } catch {
    /* undeclared inject — treat as missing */
  }
  return undefined;
}

function activeFromSnapshot(snapshot: unknown): unknown {
  return isRecord(snapshot) ? snapshot.active : undefined;
}

/**
 * Map dsh `getLocale().active` (`zh` | `en` | zh*) to a panel locale.
 * Empty / missing → `null`.
 */
export function panelLocaleFromDshActive(active: unknown): LocaleId | null {
  if (typeof active !== "string") return null;
  const raw = active.trim();
  if (!raw) return null;
  return localeFromLanguageTag(raw);
}

/** Soft-read `ctx.locale.getLocale().active` and map it to a panel locale. */
export function readDshClientLocale(ctx: unknown): LocaleId | null {
  if (!isRecord(ctx)) return null;
  const locale = softGet(ctx as LooseCtx, "locale");
  if (!isRecord(locale) || typeof locale.getLocale !== "function") return null;
  try {
    return panelLocaleFromDshActive(activeFromSnapshot(locale.getLocale()));
  } catch {
    return null;
  }
}

/**
 * Follow dsh language switches. Attach both `ctx.on('locale/change')` and
 * `ctx.locale.subscribe` when available — preference adoption may bump the
 * snapshot without the event (or the event may be missed). Soft-get locale.
 */
export function subscribeDshClientLocale(
  ctx: unknown,
  onChange: (locale: LocaleId) => void,
): () => void {
  if (!isRecord(ctx)) return () => {};
  const rec = ctx as LooseCtx;
  const disposers: Array<() => void> = [];

  const applySnapshot = (snapshot: unknown): void => {
    const mapped = panelLocaleFromDshActive(activeFromSnapshot(snapshot));
    if (mapped) onChange(mapped);
  };

  const pushOff = (off: unknown): void => {
    if (typeof off === "function") {
      disposers.push(() => {
        try {
          (off as () => void)();
        } catch {
          /* ignore */
        }
      });
    }
  };

  try {
    if (typeof rec.on === "function") {
      pushOff(
        rec.on("locale/change", (snapshot: unknown) => {
          applySnapshot(snapshot);
        }),
      );
    }
  } catch {
    /* ignore — still try subscribe */
  }

  const locale = softGet(rec, "locale");
  if (isRecord(locale) && typeof locale.subscribe === "function") {
    try {
      pushOff(
        locale.subscribe(() => {
          const mapped = readDshClientLocale(ctx);
          if (mapped) onChange(mapped);
        }),
      );
    } catch {
      /* ignore */
    }
  }

  return () => {
    for (const d of disposers) d();
  };
}

/** dsh locale when the service is present; otherwise the browser language. */
export function resolveClientLocale(ctx: unknown): LocaleId {
  return readDshClientLocale(ctx) ?? detectBrowserLocale();
}
