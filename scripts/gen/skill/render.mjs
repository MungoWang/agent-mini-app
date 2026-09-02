/**
 * Format component records into the tracked skill artifacts: catalog.md (grouped by
 * functional family), one contract per component / L1 module, and ai/catalog.json.
 */
import { AUTHOR_IMPORT, DOM_NOISE_NOTE, GENERATED_BANNER } from "./constants.mjs"


/** Collapse `"default" | "outline" | null | undefined` to `default/outline`. */
export function literalUnion(type) {
 const m = String(type).match(/^(?:"[^"]+"(?:\s*\|\s*"[^"]+")+)\s*(?:\|\s*(?:null|undefined)\s*)*$/)
 if (!m) return null
 return type
 .split("|")
 .map((p) => p.trim().replace(/"/g, ""))
 .filter((p) => p && p !== "null" && p !== "undefined")
 .join("/")
}

export function propCell(p) {
 const union = literalUnion(p.type)
 const short = union && union.length <= 48 ? `=${union}` : ""
 return `\`${p.name}${p.optional ? "?" : ""}${short}\``
}

export function renderFamilyContract(f) {
 const lines = [GENERATED_BANNER, `# ${f.root} (L1 primitive)`, ""]
 if (f.summary) lines.push(oneLine(f.summary), "")
 if (f.when) lines.push(`**when** ${oneLine(f.when)}`, "")
 if (f.parts.length > 1) {
 lines.push(
 `Compound: compose the parts below — **do not invent part names**.`,
 ""
)
 }
 const importable = [...f.parts.map((p) => p.name), ...f.helpers.map((p) => p.name)]
 lines.push(`\`import { ${importable.join(", ")} } from "${AUTHOR_IMPORT}"\``, "")
 const meta = [f.family ? `family: ${f.family}` : "", "type: component", "primitive"].filter(Boolean)
 lines.push(`\`${f.file}\` · ${meta.join(" · ")}`, "")

 lines.push("## Parts", "")
 lines.push("| part | own props |", "|---|---|")
 for (const p of f.parts) {
 const cells = p.props.slice(0, 12).map(propCell)
 const more = p.props.length > 12 ? ` +${p.props.length - 12}` : ""
 lines.push(`| \`${p.name}\` | ${esc(cells.join(" ") + more) || "—"} |`)
 }
 for (const p of f.helpers) {
 const args = p.props.length ? p.props.map(propCell).join(" ") : "—"
 lines.push(`| \`${p.name}\` (hook/util) | ${esc(args)} |`)
 }
 lines.push("", DOM_NOISE_NOTE, "")

 if (f.examples.length) {
 lines.push("## Skeleton", "")
 for (const ex of f.examples) {
 const body = ex.startsWith("```") ? ex : "```tsx\n" + ex + "\n```"
 lines.push(body, "")
 }
 }
 return lines.join("\n").trimEnd() + "\n"
}

export function esc(s) {
 return String(s).replace(/\|/g, "\\|")
}

/** JSDoc keeps hard newlines — they break markdown table cells. */
export function oneLine(s) {
 return String(s ?? "").replace(/\s*\n\s*/g, " ").trim()
}

export function renderFieldsTable(fields, dropped) {
 const lines = [
 "| field | type | required | note |",
 "|---|---|:---:|---|",
 ]
 for (const f of fields) {
 // checked = required; empty = optional (saves tokens, still scannable)
 lines.push(
 `| \`${f.name}\` | \`${esc(f.type)}\` | ${f.optional ? "" : "✓"} | ${esc(oneLine(f.doc))} |`
)
 }
 if (dropped > 0) lines.push("", DOM_NOISE_NOTE)
 return lines
}

export function renderContract(c) {
 const lines = [GENERATED_BANNER, `# ${c.name}`, ""]
 if (c.summary) lines.push(oneLine(c.summary), "")
 if (c.when) lines.push(`**when** ${oneLine(c.when)}`, "")

 const typeImports = c.types.map((t) => t.name)
 const importNames = [c.name, ...typeImports].filter(
 (v, i, a) => a.indexOf(v) === i
)
 lines.push(`\`import { ${importNames.join(", ")} } from "${AUTHOR_IMPORT}"\``, "")
 const meta = [
 c.family ? `family: ${c.family}` : "",
 `type: ${c.componentType}`,
 c.primitive ? "primitive" : "",
 ].filter(Boolean)
 lines.push(`\`${c.file}\` · ${meta.join(" · ")}`, "")

 if (c.props.length) {
 lines.push("## Props", "")
 if (c.bases?.length) {
 lines.push(
 `Extends ${c.bases.map((b) => `\`${b}\``).join(" + ")} — those HTML/ARIA props are not repeated below.`,
 ""
)
 }
 lines.push(...renderFieldsTable(c.props, c.dropped), "")
 } else if (c.bases?.length) {
 lines.push("## Props", "")
 lines.push(
 `No extra props: takes exactly ${c.bases.map((b) => `\`${b}\``).join(" + ")} (\`className\`, \`style\`, \`onClick\`, \`aria-*\`, …).`,
 ""
)
 } else if (c.dropped) {
 lines.push("## Props", "", DOM_NOISE_NOTE, "")
 } else {
 lines.push("_Props not inferred — open source or pass standard React props._", "")
 }

 if (c.types?.length) {
 lines.push("## Types", "")
 for (const t of c.types) {
 lines.push(`### \`${t.name}\``, "")
 if (t.kind === "alias" || t.kind === "union") {
 // outside tables — do not escape | (that is only for md table cells)
 lines.push("```ts", t.text, "```", "")
 } else if (t.fields.length) {
 lines.push(...renderFieldsTable(t.fields, t.dropped), "")
 }
 }
 }

 if (c.examples.length) {
 lines.push("## Example", "")
 for (const ex of c.examples) {
 const body = ex.startsWith("```") ? ex : "```tsx\n" + ex + "\n```"
 lines.push(body, "")
 }
 }

 return lines.join("\n").trimEnd() + "\n"
}

export function renderCatalog(entries, families) {
 const lines = [
 GENERATED_BANNER,
 "# Mini-app UI catalog",
 "",
 `Import components, \`useApp\`, \`Icon\` and \`Illu*\` from \`${AUTHOR_IMPORT}\` — the only UI specifier allowed in \`ui.tsx\` (besides \`react\` and relative \`./lib\`).`,
 "The host wraps the iframe with the theme provider + CSS; do not add a Provider yourself.",
 "Open `contracts/<slug>.md` for **props + parts** + examples.",
 "",
 "**Grouped by what you are building** (family, declared as `@family` JSDoc on the component).",
 "`type` is the engineering layer: `component` = L1 base others are built from (often compound —",
 "check the parts), `block` = opinionated preset, `composite` = form control, `product` = whole feature.",
 "Inherited HTML/ARIA props (`className`, `style`, `onClick`, `aria-*`) are never listed — every component takes them.",
 "",
 ]

 const buckets = new Map(families.map((f) => [f.name, []]))
 const loose = []
 for (const e of entries) (buckets.get(e.family) ?? loose).push(e)

 const typeOrder = { product: 0, block: 1, composite: 2, component: 3 }
 for (const fam of families) {
 const rows = (buckets.get(fam.name) ?? []).sort(
 (a, b) =>
 (typeOrder[a.componentType] ?? 9) - (typeOrder[b.componentType] ?? 9) ||
 a.name.localeCompare(b.name)
)
 if (!rows.length) continue
 lines.push(`## ${fam.name}`, "", fam.blurb, "", "| component | type | parts | when | contract |", "|---|---|---|---|---|")
 for (const e of rows) {
 const when = esc(oneLine(e.when || e.summary) || "—")
 let parts = "—"
 if (e.parts) {
 const shown = e.parts.slice(0, 2).map((x) => `\`${x.name}\``).join(" ")
 parts = e.parts.length > 2 ? `${shown} +${e.parts.length - 2}` : shown
 }
 lines.push(`| \`${e.name}\` | ${e.componentType} | ${esc(parts)} | ${when} | [docs](contracts/${e.slug}.md) |`)
 }
 lines.push("")
 }

 if (loose.length) {
 lines.push("## ⚠ Unclassified", "", "Missing or unknown `@family` — fix the JSDoc, then re-run `pnpm gen:skill`.", "")
 for (const e of loose) lines.push(`- \`${e.name}\` (${e.file}) — family: ${e.family || "_none_"}`)
 lines.push("")
 }
 return lines.join("\n")
}

export function renderCatalogJson(entries, families) {
 return {
 package: AUTHOR_IMPORT,
 css: "injected by the host (do not import)",
 import: `import { Button, DataGrid, DatePicker, useApp, Icon } from "${AUTHOR_IMPORT}"`,
 generated: true,
 families,
 components: Object.fromEntries(
 entries
 .sort((a, b) => a.name.localeCompare(b.name))
 .map((e) => [
 e.name,
 {
 componentType: e.componentType,
 family: e.family,
 primitive: e.primitive,
 when: oneLine(e.when || e.summary) || null,
 contract: `references/contracts/${e.slug}.md`,
 ...(e.parts
 ? {
 parts: e.parts.map((x) => x.name),
 helpers: e.helpers.map((x) => x.name),
 }
 : {}),
 },
 ])
),
 }
}
