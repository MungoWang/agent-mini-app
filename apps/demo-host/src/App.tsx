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
import { ChartBlockExamples } from "./gallery/charts-blocks"
import { DataExamples } from "./gallery/data"
import { EditorExamples } from "./gallery/editors"
import { DateExamples } from "./gallery/dates"
import { FormExamples } from "./gallery/forms"
import { OverlayExamples } from "./gallery/overlays"
import { PrimitiveExamples } from "./gallery/primitives"
import {
  SaasParadigms,
  MinimalParadigm,
  TerminalParadigm,
  EditorialParadigm,
  DarkDataParadigm,
  SemanticParadigm,
  DeskParadigm,
  OpsParadigm,
  GlassParadigm,
} from "./gallery/paradigms/index"
import { ProductExamples } from "./gallery/products"
import { useTheme, type Palette } from "./components/theme-provider"

const sectionIds = [
  "style-glass",
  "style-glow",
  "style-minimal",
  "style-terminal",
  "style-editorial",
  "style-dark",
  "style-semantic",
  "style-desk",
  "style-ops",
  "data",
  "dates",
  "forms",
  "primitives",
  "overlays",
  "products",
  "editors",
  "blocks",
] as const

type Section = (typeof sectionIds)[number]

const navLabel: Record<UiLocale, Record<Section, string>> = {
  en: {
    "style-glass": "Liquid Glass",
    "style-glow": "Glow Minimal",
    "style-minimal": "Minimal",
    "style-terminal": "Terminal",
    "style-editorial": "Editorial",
    "style-dark": "Dark Data",
    "style-semantic": "Semantic",
    "style-desk": "Desk",
    "style-ops": "Ops Console",
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
    "style-glass": "液态玻璃",
    "style-glow": "辉光简约",
    "style-minimal": "极简留白",
    "style-terminal": "终端等宽",
    "style-editorial": "编辑排版",
    "style-dark": "暗夜数据",
    "style-semantic": "语义色板",
    "style-desk": "精致桌面",
    "style-ops": "运维控制台",
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
  const [section, setSection] = React.useState<Section>("style-glass")
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
              样式风格
            </div>
            {sectionIds.slice(0, 9).map((id) => (
              <Button
                key={id}
                size="sm"
                variant={section === id ? "default" : "ghost"}
                className="justify-start"
                data-testid={`nav-${id}`}
                onClick={() => setSection(id)}
              >
                {navLabel[locale][id]}
              </Button>
            ))}
            <div className="mt-4 mb-2 px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              组件
            </div>
            {sectionIds.slice(9).map((id) => (
              <Button
                key={id}
                size="sm"
                variant={section === id ? "default" : "ghost"}
                className="justify-start"
                data-testid={`nav-${id}`}
                onClick={() => setSection(id)}
              >
                {navLabel[locale][id]}
              </Button>
            ))}
          </nav>
        }
      >
        {section === "style-glass" ? <GlassParadigm /> : null}
        {section === "style-glow" ? <SaasParadigms /> : null}
        {section === "style-minimal" ? <MinimalParadigm /> : null}
        {section === "style-terminal" ? <TerminalParadigm /> : null}
        {section === "style-editorial" ? <EditorialParadigm /> : null}
        {section === "style-dark" ? <DarkDataParadigm /> : null}
        {section === "style-semantic" ? <SemanticParadigm /> : null}
        {section === "style-desk" ? <DeskParadigm /> : null}
        {section === "style-ops" ? <OpsParadigm /> : null}
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
