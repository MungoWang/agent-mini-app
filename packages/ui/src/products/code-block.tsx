"use client"

import * as React from "react"

import { cn } from "@monkey-mini-app/ui/lib/utils"

const aliases: Record<string, string> = {
  typescript: "ts",
  javascript: "js",
  py: "python",
  sh: "bash",
  shell: "bash",
  yml: "yaml",
  plaintext: "text",
  txt: "text",
}

export function CodeBlock({
  code,
  language = "ts",
  className,
}: {
  code: string
  language?: string
  className?: string
}) {
  const [html, setHtml] = React.useState<string | null>(null)
  const lang = aliases[language.toLowerCase()] ?? language.toLowerCase()
  const dark =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark")

  React.useEffect(() => {
    let cancelled = false
    // Dynamic import so shiki (all langs/themes) is code-split into a lazy chunk
    // and only fetched when a CodeBlock is actually rendered.
    ;(async () => {
      try {
        const { codeToHtml } = await import("https://esm.run/shiki@4.4.3")
        let out: string
        try {
          out = await codeToHtml(code, {
            lang,
            theme: dark ? "github-dark" : "github-light",
          })
        } catch {
          out = await codeToHtml(code, {
            lang: "text",
            theme: dark ? "github-dark" : "github-light",
          })
        }
        if (!cancelled) setHtml(out)
      } catch {
        // CDN unavailable / unsupported lang → keep the native <pre><code> fallback.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [code, lang, dark])

  return (
    <div
      data-testid="code-block"
      data-language={lang}
      data-highlighted={html ? "true" : "false"}
      className={cn(
        "overflow-auto rounded-xl border text-xs leading-6 [&_code]:font-mono [&_pre]:m-0 [&_pre]:bg-transparent [&_pre]:p-3",
        className
      )}
    >
      {html ? (
        <div dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <pre>
          <code>{code}</code>
        </pre>
      )}
    </div>
  )
}
