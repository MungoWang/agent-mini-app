import { expect, test, type Page } from "@playwright/test";

import { expectFrameAlive, fixturePath, openApp } from "./helpers.ts";

/**
 * The one fixture that is not a stub: an uploaded `.xlsx` has to reach `exceljs` in this app's
 * own `node_modules`, so this file proves `mini_app_install` works through the shipped stack
 * (verdaccio → dsh plugin → host → iframe), not just in a unit test.
 *
 * The app's storage lives in the harness runtime, which `scripts/up.mts` wipes on start but
 * Playwright does **not** wipe between two `pnpm test:e2e` runs against a reused server. So no
 * assertion here depends on the history being empty.
 *
 * Numbers come from `scripts/gen/dsh-e2e-xlsx.mts`, which prints them on regeneration.
 */
const APP = "表格台";
const FILE = "运输明细.xlsx";

async function upload(page: Page) {
  const frame = await openApp(page, APP);
  await frame.locator("input[type=file]").setInputFiles(fixturePath(FILE));
  return frame;
}

test.describe("spreadsheet sample (per-app npm package)", () => {
  test("registers from the skill template and renders the drop target", async ({ page }) => {
    const frame = await openApp(page, APP);
    await expect(frame.getByRole("heading", { name: APP })).toBeVisible();
    await expect(frame.getByText("拖到这里，或点击选择文件")).toBeVisible();
  });

  test("parses a real workbook locally, including formula and date cells", async ({ page }) => {
    const frame = await upload(page);

    // sheet tabs + KPI totals (2 sheets, 11 data rows)
    await expect(frame.getByRole("tab", { name: "运输明细" })).toBeVisible();
    await expect(frame.getByRole("tab", { name: "异常登记" })).toBeVisible();
    await expect(frame.getByText("工作表")).toBeVisible();
    await expect(frame.getByText("11", { exact: true })).toBeVisible();

    // ⭐ aggregates over EVERY row (the grid only shows a preview) — exceljs + platform lodash
    await expect(frame.getByText("147").first()).toBeVisible(); // 票数 合计
    await expect(frame.getByText("332155.6").first()).toBeVisible(); // 运费 合计
    await expect(frame.getByText("35724").first()).toBeVisible(); // 单票均价 ← formula result
    await expect(frame.getByText("15800–71200.75").first()).toBeVisible();

    // the two cell shapes that break a naive reader: Date → 2026-09-01, {formula,result} → number
    await expect(frame.getByText("顺丰").first()).toBeVisible();
    await expect(frame.getByText("2026-09-01").first()).toBeVisible();
    await expect(frame.getByText("3769.21").first()).toBeVisible();
    await expect(frame.locator("body")).not.toContainText("[object Object]");
  });

  test("second sheet has its own aggregates", async ({ page }) => {
    const frame = await upload(page);
    await frame.getByRole("tab", { name: "异常登记" }).click();
    await expect(frame.getByText("76").first()).toBeVisible(); // 延误小时 合计
    await expect(frame.getByText("SO-1042").first()).toBeVisible();
  });

  test("rejects a legacy .xls before touching the backend", async ({ page }) => {
    const frame = await openApp(page, APP);
    await frame.locator("input[type=file]").setInputFiles({
      name: "报价.xls",
      mimeType: "application/vnd.ms-excel",
      buffer: Buffer.from("not a real xlsx"),
    });
    await expect(frame.getByText(/只支持 \.xlsx/)).toBeVisible();
    await expectFrameAlive(page);
  });

  test("history survives a full reload — it is on disk, not in a tab", async ({ page }) => {
    const frame = await upload(page);
    await expect(frame.getByText("顺丰").first()).toBeVisible();

    await page.reload();
    const again = await openApp(page, APP);
    // the sidebar lists the parsed report without uploading anything again
    const history = again.getByTestId("list-detail-list");
    await expect(history.getByText(FILE).first()).toBeVisible();
    await history.getByText(FILE).first().click();
    await expect(again.getByText("11", { exact: true }).first()).toBeVisible();
  });

  test("摘要 goes through the host model and never blanks the view", async ({ page }) => {
    const frame = await upload(page);
    await frame.getByRole("button", { name: "生成摘要" }).click();

    // A missing **provider** in this harness profile is a legitimate outcome (the app surfaces
    // the host's own `llm: …` message). A missing **capability** never is: `ctx.llm` is host
    // wiring, and "host capability not available" means the adapter's methods were erased —
    // a platform bug, which is what this pair of assertions is for.
    // (Do not match on 模型 alone: the page's own subtitle contains it and would pass anything.)
    await expect(frame.locator("body")).not.toContainText("host capability not available");

    const digest = frame.getByText("由宿主模型基于整表的数值汇总生成");
    // Host LLM errors are prefixed `llm: ` (no service, empty stream, retry exhausted, …).
    const hostLlmError = frame.getByText(/^llm: /);
    await expect
      .poll(async () => (await digest.count()) + (await hostLlmError.count()) > 0, { timeout: 40_000 })
      .toBe(true);
    await expectFrameAlive(page);
  });
});
