import { expect, test } from "@playwright/test"

test("grid: filter sort paginate", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByTestId("data-grid").first()).toBeVisible()
  const rows = page.getByTestId("data-grid").first().getByTestId("data-grid-row")
  await expect(rows).toHaveCount(4)
  await page.getByTestId("column-filter-name").click()
  await page.getByTestId("column-search-name").fill("login")
  await expect(rows).toHaveCount(1)
  await expect(page.getByText("login-spec")).toBeVisible()
})

test("grid: sort and paginate", async ({ page }) => {
  await page.goto("/")
  const grid = page.getByTestId("data-grid").first()
  await grid.getByTestId("sort-name").click()
  await expect(grid.getByTestId("data-grid-row").first()).toContainText("auth-spec")
  await grid.getByTestId("data-grid-next").click()
  await expect(grid.getByTestId("data-grid-page")).toContainText("2 /")
})

test("dates: pickers are interactive", async ({ page }) => {
  await page.goto("/")
  await page.getByTestId("nav-dates").click()
  await expect(page.getByTestId("date-picker-trigger").first()).toBeVisible()
  await expect(page.getByTestId("time-picker").first()).toBeVisible()
  const combined = page.getByTestId("date-time-picker").first()
  await expect(combined).toBeVisible()
  await combined.getByTestId("date-picker-trigger").click()
  await expect(page.getByTestId("time-hour")).toBeVisible()
  await expect(page.getByTestId("time-minute")).toBeVisible()
  await page.getByTestId("time-picker").first().click()
  await page.getByTestId("time-picker-hour").getByText("14", { exact: true }).click()
  await page.getByTestId("time-picker-minute").getByText("15", { exact: true }).click()
  await expect(page.getByTestId("time-picker").first()).toContainText("14:15")
})

test("forms: number field increments", async ({ page }) => {
  await page.goto("/")
  await page.getByTestId("nav-forms").click()
  await expect(page.getByTestId("number-field-value")).toHaveText("value: 3")
  await page.getByRole("button", { name: "Increase" }).click()
  await expect(page.getByTestId("number-field-value")).toHaveText("value: 4")
  await page.getByRole("button", { name: "Decrease" }).click()
  await expect(page.getByTestId("number-field-value")).toHaveText("value: 3")
})

test("primitives: button visible", async ({ page }) => {
  await page.goto("/")
  await page.getByTestId("nav-primitives").click()
  await expect(page.getByTestId("primitive-button")).toBeVisible()
})

test("products: stepper advances", async ({ page }) => {
  await page.goto("/")
  await page.getByTestId("nav-products").click()
  await expect(page.getByTestId("stepper").first()).toBeVisible()
  await page.getByRole("button", { name: "Next step" }).click()
  await expect(page.getByTestId("stepper").first()).toBeVisible()
  await expect(page.getByTestId("stepper").nth(1)).toHaveAttribute("data-orientation", "horizontal")
  await page.getByTestId("calendar-view-week").click()
  await expect(page.getByTestId("event-calendar")).toBeVisible()
})

test("editors: rich text markdown code diff", async ({ page }) => {
  await page.goto("/")
  await page.getByTestId("nav-editors").click()
  await expect(page.getByTestId("rich-text-editor")).toBeVisible()
  await expect(page.getByRole("button", { name: "Bold" })).toBeVisible()
  await expect(page.getByTestId("code-editor").first()).toBeVisible()
  await expect(page.getByTestId("markdown-editor")).toBeVisible()
  await expect(page.getByTestId("markdown-preview").locator("h1")).toHaveText("Title")
  await expect(page.getByTestId("diff-viewer")).toHaveAttribute("data-mode", "unified")
  await page.getByTestId("diff-mode-toggle").click()
  await expect(page.getByTestId("diff-viewer")).toHaveAttribute("data-mode", "split")
})
