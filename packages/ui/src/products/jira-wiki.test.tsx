import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { JiraWiki } from "./jira-wiki"

describe("JiraWiki", () => {
  it("renders wiki markup without html injection", () => {
    render(<JiraWiki>{"h1. Hello\n*item*\n[Docs|https://example.com]"}</JiraWiki>)
    expect(screen.getByTestId("jira-wiki").querySelector("h1")).toHaveTextContent("Hello")
    expect(screen.getByRole("link", { name: "Docs" })).toHaveAttribute("href", "https://example.com")
  })

  it("renders attachments and pipe tables", () => {
    render(<JiraWiki>{"MOCK UI: [^spec.html]\n|Role|Access|\n|Edit|YES|"}</JiraWiki>)
    expect(screen.getByRole("button", { name: "spec.html" })).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: "Role" })).toBeInTheDocument()
    expect(screen.getByRole("cell", { name: "Edit" })).toBeInTheDocument()
  })
})
