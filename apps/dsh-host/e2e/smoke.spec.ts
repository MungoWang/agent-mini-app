import { expect, test } from "@playwright/test";

import { expectFrameAlive, openApp, openMiniApps } from "./helpers.ts";

/**
 * Panel chrome + the two source fixtures. The shipped-stack case (a real npm package inside an
 * app) lives in `spreadsheet.spec.ts`; harness notes are in `helpers.ts`.
 */

test("footer opens the mini-app panel with fixture apps", async ({ page }) => {
  await openMiniApps(page);
  await expect(page.locator("#mma-host")).toContainText("待办");
  await expect(page.locator("#mma-host")).toContainText("修复基准");
  await expect(page.locator("#mma-host")).toContainText("组件库");
  await expect(page.locator("#mma-host")).toContainText("表格台");
});

test("todo iframe renders inside the panel", async ({ page }) => {
  await openApp(page, "待办");
  await expectFrameAlive(page);
});

test("review iframe renders inside the panel", async ({ page }) => {
  await openApp(page, "修复基准");
  await expectFrameAlive(page);
});

test("kit iframe shows section nav", async ({ page }) => {
  const frame = await openApp(page, "组件库");
  await expect(frame.getByTestId("kit-nav")).toBeVisible();
  await frame.getByTestId("kit-nav-forms").click();
  await expect(frame.getByTestId("kit-section-forms")).toBeVisible();
});

test("settings and theme pop open from the toolbar", async ({ page }) => {
  await openMiniApps(page);
  await page.locator("#mma-theme-btn").click();
  await expect(page.locator("#mma-theme-pop")).toHaveAttribute("data-open", "1");
  await page.keyboard.press("Escape");
  await expect(page.locator("#mma-theme-pop")).not.toHaveAttribute("data-open", "1");
  await page.locator("#mma-settings-btn").click();
  await expect(page.locator("#mma-settings")).toHaveAttribute("data-open", "1");
});

test("dock to side then close the panel", async ({ page }) => {
  await openMiniApps(page);
  await page.locator("#mma-dock-host").click();
  await expect(page.locator("html")).toHaveClass(/mma-dock-side/, { timeout: 5_000 });
  await page.locator("#mma-close-host").click();
  await expect(page.locator("#mma-host")).toBeHidden({ timeout: 5_000 });
});
