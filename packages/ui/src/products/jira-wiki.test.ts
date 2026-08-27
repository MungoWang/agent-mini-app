import { describe, expect, it } from "vitest"

import { parseJiraWiki } from "./jira-wiki-parse"

describe("parseJiraWiki", () => {
  it("parses headings, emphasis, lists, and code", () => {
    const blocks = parseJiraWiki(
      `h1. Title\n*bold* and _italic_ and {{code}}\n* one\n* two\n{code:js}\nconst a = 1\n{code}`
    )
    expect(blocks[0]).toMatchObject({ type: "heading", level: 1 })
    expect(blocks[1]?.type).toBe("paragraph")
    expect(blocks[2]).toMatchObject({ type: "list", ordered: false })
    expect(blocks[3]).toMatchObject({ type: "code", language: "js", value: "const a = 1" })
  })

  it("parses tables and panels", () => {
    const blocks = parseJiraWiki(
      `{panel:title=Note}\nhello\n{panel}\n||A||B||\n|1|2|`
    )
    expect(blocks[0]).toMatchObject({ type: "panel", title: "Note" })
    expect(blocks[1]?.type).toBe("table")
  })

  it("parses attachments, strikethrough, and | tables", () => {
    const blocks = parseJiraWiki(
      `MOCK UI: [^bonded-parts-prototype.html]\n\n-pending review-\n\n|Role|Permission|\n|Edit|YES|`
    )
    expect(blocks[0]).toMatchObject({ type: "paragraph" })
    const first = blocks[0]
    if (first?.type !== "paragraph") throw new Error("expected paragraph")
    expect(first.children.some((node) => node.type === "attachment")).toBe(true)
    expect(blocks[1]).toMatchObject({ type: "paragraph" })
    const strike = blocks[1]
    if (strike?.type !== "paragraph") throw new Error("expected paragraph")
    expect(strike.children.some((node) => node.type === "strike")).toBe(true)
    expect(blocks[2]).toMatchObject({ type: "table" })
    const table = blocks[2]
    if (table?.type !== "table") throw new Error("expected table")
    expect(table.header).toHaveLength(2)
    expect(table.rows).toHaveLength(1)
  })
})
