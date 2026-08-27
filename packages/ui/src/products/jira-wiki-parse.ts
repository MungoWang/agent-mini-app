export type WikiInline =
  | { type: "text"; value: string }
  | { type: "bold"; children: WikiInline[] }
  | { type: "italic"; children: WikiInline[] }
  | { type: "strike"; children: WikiInline[] }
  | { type: "code"; value: string }
  | { type: "link"; href: string; label: string }
  | { type: "attachment"; name: string }

export type WikiBlock =
  | { type: "heading"; level: number; children: WikiInline[] }
  | { type: "paragraph"; children: WikiInline[] }
  | { type: "list"; ordered: boolean; items: WikiInline[][] }
  | { type: "code"; language?: string; value: string }
  | { type: "quote"; children: WikiInline[] }
  | { type: "panel"; title?: string; children: WikiBlock[] }
  | { type: "table"; header: WikiInline[][]; rows: WikiInline[][][] }
  | { type: "hr" }

export function parseInline(input: string): WikiInline[] {
  const nodes: WikiInline[] = []
  let rest = input
  while (rest.length) {
    const attachment = /^\[\^([^\]]+)\]/.exec(rest)
    if (attachment) {
      nodes.push({ type: "attachment", name: attachment[1] ?? "" })
      rest = rest.slice(attachment[0].length)
      continue
    }
    const link = /^\[([^\]|]+)\|([^\]]+)\]/.exec(rest) ?? /^\[([^\]]+)\]/.exec(rest)
    if (link) {
      const label = link[1] ?? ""
      const href = link[2] ?? link[1] ?? ""
      nodes.push({ type: "link", href, label })
      rest = rest.slice(link[0].length)
      continue
    }
    const code = /^\{\{(.+?)\}\}/.exec(rest)
    if (code) {
      nodes.push({ type: "code", value: code[1] ?? "" })
      rest = rest.slice(code[0].length)
      continue
    }
    const bold = /^\*([^*\n]+)\*/.exec(rest)
    if (bold) {
      nodes.push({ type: "bold", children: parseInline(bold[1] ?? "") })
      rest = rest.slice(bold[0].length)
      continue
    }
    const italic = /^_([^_\n]+)_/.exec(rest)
    if (italic) {
      nodes.push({ type: "italic", children: parseInline(italic[1] ?? "") })
      rest = rest.slice(italic[0].length)
      continue
    }
    const strike = /^-([^-]+)-(?=$|[\s.,;:!?)"]])/.exec(rest)
    if (strike) {
      nodes.push({ type: "strike", children: parseInline(strike[1] ?? "") })
      rest = rest.slice(strike[0].length)
      continue
    }
    const next = rest.search(/[\[*{_-]/)
    if (next <= 0) {
      const take = next === 0 ? 1 : rest.length
      const last = nodes.at(-1)
      if (last?.type === "text") last.value += rest.slice(0, take)
      else nodes.push({ type: "text", value: rest.slice(0, take) })
      rest = rest.slice(take)
      continue
    }
    const last = nodes.at(-1)
    if (last?.type === "text") last.value += rest.slice(0, next)
    else nodes.push({ type: "text", value: rest.slice(0, next) })
    rest = rest.slice(next)
  }
  return nodes
}

function splitCells(line: string, delim: "||" | "|") {
  const trimmed = line.trim()
  const inner =
    delim === "||"
      ? trimmed.replace(/^\|\|/, "").replace(/\|\|$/, "")
      : trimmed.replace(/^\|/, "").replace(/\|$/, "")
  return inner.split(delim === "||" ? "||" : "|").map((cell) => parseInline(cell.trim()))
}

function isTableRow(line: string) {
  return line.startsWith("|") && line.endsWith("|") && line.length >= 2
}

function collectFence(lines: string[], start: number, close: string) {
  const body: string[] = []
  let i = start + 1
  while (i < lines.length && lines[i]?.trim() !== close) {
    body.push(lines[i] ?? "")
    i += 1
  }
  return { body: body.join("\n"), end: i }
}

export function parseJiraWiki(input: string): WikiBlock[] {
  const lines = input.replace(/\r\n/g, "\n").split("\n")
  const blocks: WikiBlock[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i] ?? ""
    const trimmed = line.trim()
    if (!trimmed) {
      i += 1
      continue
    }
    if (trimmed === "----") {
      blocks.push({ type: "hr" })
      i += 1
      continue
    }
    const heading = /^h([1-6])\.\s+(.*)$/.exec(trimmed)
    if (heading) {
      blocks.push({
        type: "heading",
        level: Number(heading[1]),
        children: parseInline(heading[2] ?? ""),
      })
      i += 1
      continue
    }
    const codeOpen = /^\{code(?::([a-zA-Z0-9+-]+))?\}$/.exec(trimmed)
    if (codeOpen) {
      const fence = collectFence(lines, i, "{code}")
      blocks.push({ type: "code", language: codeOpen[1], value: fence.body })
      i = fence.end + 1
      continue
    }
    if (trimmed === "{noformat}") {
      const fence = collectFence(lines, i, "{noformat}")
      blocks.push({ type: "code", value: fence.body })
      i = fence.end + 1
      continue
    }
    if (trimmed === "{quote}") {
      const fence = collectFence(lines, i, "{quote}")
      blocks.push({ type: "quote", children: parseInline(fence.body.replace(/\n/g, " ")) })
      i = fence.end + 1
      continue
    }
    const panelOpen = /^\{panel(?::title=([^}]+))?\}$/.exec(trimmed)
    if (panelOpen) {
      const fence = collectFence(lines, i, "{panel}")
      blocks.push({
        type: "panel",
        title: panelOpen[1],
        children: parseJiraWiki(fence.body),
      })
      i = fence.end + 1
      continue
    }
    if (isTableRow(trimmed)) {
      const collected: { header: boolean; cells: WikiInline[][] }[] = []
      while (i < lines.length) {
        const row = lines[i]?.trim() ?? ""
        if (!isTableRow(row)) break
        const header = row.startsWith("||")
        collected.push({ header, cells: splitCells(row, header ? "||" : "|") })
        i += 1
      }
      const headerRows = collected.filter((row) => row.header).map((row) => row.cells)
      const rows = collected.filter((row) => !row.header).map((row) => row.cells)
      const header = headerRows[0] ?? rows.shift() ?? []
      blocks.push({ type: "table", header, rows })
      continue
    }
    if (/^[*#-]\s+/.test(trimmed)) {
      const ordered = trimmed.startsWith("#")
      const items: WikiInline[][] = []
      while (i < lines.length) {
        const item = lines[i]?.trim() ?? ""
        const match = ordered ? /^#\s+(.*)$/.exec(item) : /^[*#-]\s+(.*)$/.exec(item)
        if (!match) break
        items.push(parseInline(match[1] ?? ""))
        i += 1
      }
      blocks.push({ type: "list", ordered, items })
      continue
    }
    const para: string[] = [trimmed]
    i += 1
    while (i < lines.length) {
      const next = lines[i]?.trim() ?? ""
      if (!next || /^(h[1-6]\.|----|\{code|\{panel|\{quote|\{noformat|\||[*#-]\s)/.test(next)) break
      para.push(next)
      i += 1
    }
    blocks.push({ type: "paragraph", children: parseInline(para.join(" ")) })
  }
  return blocks
}
