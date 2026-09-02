import { expect, type Page, test } from "@playwright/test";

async function dismissOnboarding(page: Page): Promise<void> {
  const later = page.getByRole("button", { name: "Configure later" });
  try {
    await later.waitFor({ state: "visible", timeout: 15_000 });
    await later.click();
    await later.waitFor({ state: "hidden", timeout: 10_000 });
  } catch {
    /* already dismissed or not shown */
  }
}

async function openMiniApps(page: Page): Promise<void> {
  await page.goto("/");
  await dismissOnboarding(page);
  await page.getByRole("button", { name: "小程序" }).click();
  await expect(page.locator("#mma-host")).toBeVisible();
}

function card(page: Page, name: string) {
  return page.locator("#mma-list .mma-card").filter({ hasText: name });
}

async function expectFrameAlive(page: Page): Promise<void> {
  const frame = page.frameLocator("#mma-frames iframe").first();
  await expect(frame.locator("#root")).toBeVisible({ timeout: 30_000 });
  await expect(frame.locator("body")).not.toContainText('{"error"');
}

test("footer opens the mini-app panel with fixture apps", async ({ page }) => {
  await openMiniApps(page);
  await expect(page.locator("#mma-host")).toContainText("待办");
  await expect(page.locator("#mma-host")).toContainText("修复基准");
  await expect(page.locator("#mma-host")).toContainText("组件库");
});

test("todo iframe renders inside the panel", async ({ page }) => {
  await openMiniApps(page);
  await card(page, "待办").click();
  await expectFrameAlive(page);
});

test("review iframe renders inside the panel", async ({ page }) => {
  await openMiniApps(page);
  await card(page, "修复基准").click();
  await expectFrameAlive(page);
});

test("kit iframe shows section nav", async ({ page }) => {
  await openMiniApps(page);
  await card(page, "组件库").click();
  await expectFrameAlive(page);
  const frame = page.frameLocator("#mma-frames iframe").first();
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
