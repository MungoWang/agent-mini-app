"use client"

import * as React from "react"
import { enUS, zhCN } from "date-fns/locale"
import type { Locale } from "date-fns"

import { en, type UiMessages } from "./en"
import { zh } from "./zh"

export type UiLocale = "en" | "zh"

type UiI18nValue = {
  locale: UiLocale
  messages: UiMessages
  dateLocale: Locale
}

const dictionaries: Record<UiLocale, UiMessages> = { en, zh }
const dateLocales: Record<UiLocale, Locale> = { en: enUS, zh: zhCN }

const UiI18nContext = React.createContext<UiI18nValue>({
  locale: "en",
  messages: en,
  dateLocale: enUS,
})

export function UiProvider({
  locale = "en",
  messages,
  children,
}: {
  locale?: UiLocale
  messages?: UiMessages
  children: React.ReactNode
}) {
  const value = React.useMemo<UiI18nValue>(
    () => ({
      locale,
      messages: messages ?? dictionaries[locale],
      dateLocale: dateLocales[locale],
    }),
    [locale, messages]
  )
  return <UiI18nContext.Provider value={value}>{children}</UiI18nContext.Provider>
}

export function useUiI18n() {
  return React.useContext(UiI18nContext)
}

export function useUiMessages() {
  return useUiI18n().messages
}

export function useUiLocale() {
  return useUiI18n().locale
}

export function useDateLocale() {
  return useUiI18n().dateLocale
}

export function useLabels<K extends keyof UiMessages>(
  key: K,
  override?: Partial<UiMessages[K]>
): UiMessages[K] {
  const group = useUiMessages()[key]
  if (!override) return group
  return { ...group, ...override }
}

export { en, zh, dictionaries }
