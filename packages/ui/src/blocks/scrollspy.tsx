"use client"

import * as React from "react"

/**
 * Anchor nav that highlights the section in view.
 * @when Long settings/report page with jump links.
 * @example
 * <Scrollspy sections={[{ id: "overview", label: "概览" }]} />
 * @family Navigation
 */
export function Scrollspy({
  sections,
}: {
  sections: { id: string; label: string }[]
}) {
  const [active, setActive] = React.useState(sections[0]?.id)
  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting)
        if (visible?.target.id) setActive(visible.target.id)
      },
      { rootMargin: "-40% 0px -50% 0px" }
    )
    sections.forEach((section) => {
      const el = document.getElementById(section.id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [sections])
  return (
    <nav className="flex flex-col gap-1 text-sm" data-testid="scrollspy">
      {sections.map((section) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          className={
            active === section.id
              ? "text-foreground font-medium"
              : "text-muted-foreground"
          }
        >
          {section.label}
        </a>
      ))}
    </nav>
  )
}
