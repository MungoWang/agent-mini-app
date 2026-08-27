import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { PageHeader } from "./page-header"

describe("PageHeader", () => {
  it("renders title and description", () => {
    render(<PageHeader title="QA Runs" description="Latest CI" />)
    expect(screen.getByTestId("page-header")).toHaveTextContent("QA Runs")
    expect(screen.getByText("Latest CI")).toBeInTheDocument()
  })
})
