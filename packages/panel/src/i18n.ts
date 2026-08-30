import { createInstance } from "i18next";

import { PanelError } from "./errors.ts";
import en from "./locales/en.json" with { type: "json" };
import zhCN from "./locales/zh-CN.json" with { type: "json" };
import { LOCALE_IDS, type LocaleId } from "./types.ts";

export type I18nParams = Record<string, string | number>;

export type PanelI18n = {
  readonly locale: LocaleId;
  t(key: string, params?: I18nParams): string;
};

const resources = {
  "zh-CN": { translation: zhCN },
  en: { translation: en },
} as const;

function isLocaleId(value: string): value is LocaleId {
  return (LOCALE_IDS as readonly string[]).includes(value);
}

function nodeEnv(): string | undefined {
  const g = globalThis as { process?: { env?: { NODE_ENV?: string } } };
  return g.process?.env?.NODE_ENV;
}

function failOnMissingKey(): boolean {
  return nodeEnv() !== "production";
}

/** i18next helper bound to `locale`. Missing keys throw outside production. */
export function createPanelI18n(locale: LocaleId): PanelI18n {
  if (!isLocaleId(locale)) {
    throw new PanelError("I18N_INVALID_LOCALE", `unsupported locale: ${String(locale)}`);
  }

  const i18n = createInstance();
  void i18n.init({
    lng: locale,
    fallbackLng: false,
    supportedLngs: [...LOCALE_IDS],
    nonExplicitSupportedLngs: false,
    load: "currentOnly",
    defaultNS: "translation",
    ns: ["translation"],
    resources,
    interpolation: { escapeValue: false },
    returnNull: false,
    returnEmptyString: false,
    initImmediate: false,
    showSupportNotice: false,
  });

  if (!i18n.isInitialized) {
    throw new PanelError("I18N_INIT_FAILED", `i18n failed to initialize for locale: ${locale}`);
  }

  return {
    locale,
    t(key: string, params?: I18nParams): string {
      if (!i18n.exists(key)) {
        if (failOnMissingKey()) {
          throw new PanelError("I18N_MISSING_KEY", `missing i18n key: ${key}`);
        }
        return key;
      }
      const value: unknown = i18n.t(key, params ?? {});
      if (typeof value !== "string") {
        throw new PanelError("I18N_INVALID_VALUE", `i18n key did not resolve to a string: ${key}`);
      }
      return value;
    },
  };
}

export function resolvePanelLocale(value: string | undefined): LocaleId {
  if (value === undefined) return "zh-CN";
  if (!isLocaleId(value)) {
    throw new PanelError("I18N_INVALID_LOCALE", `unsupported locale: ${String(value)}`);
  }
  return value;
}
