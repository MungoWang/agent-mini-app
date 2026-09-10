import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { AppShell } from "@monkey-mini-app/ui/blocks/app-shell"
import { Button } from "@monkey-mini-app/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@monkey-mini-app/ui/components/dropdown-menu"
import { UiProvider, type UiLocale } from "@monkey-mini-app/ui"
import {
  ChartBlockExamples,
  DataExamples,
  DateExamples,
  EditorExamples,
  FormExamples,
  LOOKS,
  OverlayExamples,
  PrimitiveExamples,
  ProductExamples,
} from "@monkey-mini-app/ui-examples"
import { useTheme, type Palette } from "./components/theme-provider"

const kitIds = [
  "data",
  "dates",
  "forms",
  "primitives",
  "overlays",
  "products",
  "editors",
  "blocks",
] as const

type KitId = (typeof kitIds)[number]
type Section = (typeof LOOKS)[number]["id"] | KitId

const kitLabel: Record<UiLocale, Record<KitId, string>> = {
  en: {
    data: "Data",
    dates: "Dates",
    forms: "Forms",
    primitives: "Primitives",
    overlays: "Overlays",
    products: "Products",
    editors: "Editors",
    blocks: "Charts & blocks",
  },
  zh: {
    data: "数据",
    dates: "日期",
    forms: "表单",
    primitives: "原语",
    overlays: "浮层",
    products: "产品",
    editors: "编辑器",
    blocks: "图表积木",
  },
}

const palettes: {
  id: Palette
  en: string
  zh: string
  dots: [string, string]
}[] = [
  {
    id: "default",
    en: "Mono",
    zh: "黑白",
    dots: ["oklch(0.2 0 0)", "oklch(0.92 0 0)"],
  },
  {
    id: "strawberry-matcha",
    en: "Strawberry Matcha",
    zh: "草莓抹茶",
    dots: ["oklch(0.58 0.175 18)", "oklch(0.62 0.11 140)"],
  },
  {
    id: "tundra",
    en: "Tundra",
    zh: "苔原",
    dots: ["oklch(0.42 0.065 155)", "oklch(0.68 0.06 220)"],
  },
  {
    id: "graphite-qing",
    en: "Graphite Qing",
    zh: "石墨青",
    dots: ["oklch(0.40 0.075 205)", "oklch(0.45 0.02 255)"],
  },
]

function readLocale(): UiLocale {
  try {
    const stored = localStorage.getItem("monkey-mini-app-ui-locale")
    if (stored === "zh" || stored === "en") return stored
  } catch {
    /* ignore */
  }
  return "en"
}

export function App() {
  const [section, setSection] = React.useState<Section>("glass-island")
  const [locale, setLocale] = React.useState<UiLocale>(readLocale)
  const { theme, setTheme, palette, setPalette } = useTheme()
  const paletteMeta = palettes.find((item) => item.id === palette) ?? palettes[0]!
  const dark = theme === "dark" || (theme === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches)

  const toggleLocale = () => {
    const next: UiLocale = locale === "en" ? "zh" : "en"
    setLocale(next)
    try {
      localStorage.setItem("monkey-mini-app-ui-locale", next)
    } catch {
      /* ignore */
    }
  }

  return (
    <UiProvider locale={locale}>
      <AppShell
        header={
          <div className="flex items-center justify-end gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="sm" data-testid="palette-toggle" />
                }
              >
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-flex gap-0.5">
                    {paletteMeta.dots.map((color) => (
                      <span
                        key={color}
                        className="size-2.5 rounded-full ring-1 ring-foreground/15"
                        style={{ background: color }}
                      />
                    ))}
                  </span>
                  {locale === "zh" ? paletteMeta.zh : paletteMeta.en}
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-44">
                <DropdownMenuRadioGroup
                  value={palette}
                  onValueChange={(value) => {
                    if (value) setPalette(value as Palette)
                  }}
                >
                  {palettes.map((item) => (
                    <DropdownMenuRadioItem key={item.id} value={item.id}>
                      <span className="inline-flex gap-0.5">
                        {item.dots.map((color) => (
                          <span
                            key={color}
                            className="size-2.5 rounded-full ring-1 ring-foreground/15"
                            style={{ background: color }}
                          />
                        ))}
                      </span>
                      {locale === "zh" ? item.zh : item.en}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="sm"
              data-testid="locale-toggle"
              aria-label={locale === "en" ? "Switch to Chinese" : "切换到英文"}
              onClick={toggleLocale}
            >
              {locale === "en" ? "中" : "EN"}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              data-testid="theme-toggle"
              aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
              onClick={() => setTheme(dark ? "light" : "dark")}
            >
              {dark ? <Sun /> : <Moon />}
            </Button>
          </div>
        }
        sidebar={
          <nav className="flex flex-col gap-1">
            <div className="mb-2 px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Looks
            </div>
            {LOOKS.map((look) => (
              <Button
                key={look.id}
                size="sm"
                variant={section === look.id ? "default" : "ghost"}
                className="justify-start"
                data-testid={`nav-${look.id}`}
                onClick={() => setSection(look.id)}
              >
                {locale === "zh" ? look.zh : look.title}
              </Button>
            ))}
            <div className="mt-4 mb-2 px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              组件
            </div>
            {kitIds.map((id) => (
              <Button
                key={id}
                size="sm"
                variant={section === id ? "default" : "ghost"}
                className="justify-start"
                data-testid={`nav-${id}`}
                onClick={() => setSection(id)}
              >
                {kitLabel[locale][id]}
              </Button>
            ))}
          </nav>
        }
      >
        {LOOKS.map((look) => {
          if (section !== look.id) return null
          const View = look.View
          return (
            <div key={look.id} className="-m-4 flex h-[calc(100%+2rem)] min-h-0 flex-col overflow-hidden">
              <View />
            </div>
          )
        })}
        {section === "data" ? <DataExamples /> : null}
        {section === "dates" ? <DateExamples /> : null}
        {section === "forms" ? <FormExamples /> : null}
        {section === "primitives" ? <PrimitiveExamples /> : null}
        {section === "overlays" ? <OverlayExamples /> : null}
        {section === "products" ? <ProductExamples /> : null}
        {section === "editors" ? <EditorExamples /> : null}
        {section === "blocks" ? <ChartBlockExamples /> : null}
      </AppShell>
    </UiProvider>
  )
}
