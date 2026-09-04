import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { expect, type Page, test } from "@playwright/test";

/**
 * dsh web ≥ 0.1.2 gates the browser behind a per-process launch token: anything other than the
 * printed `/?token=…` URL answers `401 dsh web authentication required`, and a test then fails
 * with "getByRole('button', { name: '小程序' }) — element(s) not found", i.e. it looks exactly
 * like our own plugin failing to register. `scripts/up.mts` captures that URL into `.dsh/web-url`.
 *
 * Tries both plausible cwds because the suite runs via `pnpm --filter` from the repo root as
 * well as directly here. Falling back to "/" keeps working against a dsh without the gate.
 */
function bootUrl(): string {
  for (const file of [path.resolve(".dsh/web-url"), path.resolve("apps/dsh-host/.dsh/web-url")]) {
    if (!existsSync(file)) continue;
    const url = readFileSync(file, "utf8").trim();
    if (url) return url;
  }
  return "/";
}

/**
 * Clear the first-run gate. dsh has shipped two shapes: a "Configure later" ask, and (since
 * 0.1.x) an "Internal Testing Notice" whose only affordance is **Continue**.
 *
 * Polls rather than waiting once, because on a cold profile the notice can render seconds after
 * first paint — a single fixed wait missed it, the modal stayed mounted, and its mask swallowed
 * every click, which surfaced as a 60 s `locator.click` timeout that never mentioned a dialog.
 * Absence exits after three clean polls (~1 s); a leftover gate fails by naming it.
 */
async function dismissOnboarding(page: Page): Promise<void> {
  const gate = page.getByRole("button", { name: /^(Configure later|Continue)$/ });
  const deadline = Date.now() + 20_000;
  let clear = 0;
  while (Date.now() < deadline && clear < 3) {
    if (await gate
      .first()
      .isVisible()
      .catch(() => false))
    {
      await gate.first().click();
      clear = 0;
    } else {
      clear += 1;
    }
    await page.waitForTimeout(300);
  }
  await expect(page.getByText("Internal Testing Notice")).toHaveCount(0);
}

async function openMiniApps(page: Page): Promise<void> {
  await page.goto(bootUrl());
  await dismissOnboarding(page);
  const foot = page.getByRole("button", { name: "小程序" });
  await expect(foot).toBeVisible();
  await foot.click();
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
