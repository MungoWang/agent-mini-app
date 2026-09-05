import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { expect, type Page } from "@playwright/test";
/**
 * Shared dsh-web harness plumbing for the e2e specs.
 *
 * Everything here exists because of a failure that looked like something else: dsh web ≥ 0.1.2
 * gates the browser behind a per-process launch token, and a spec that opens the wrong URL
 * fails as "footer button 小程序 not found" — indistinguishable from our plugin not loading.
 */

/** Where `scripts/up.mts` captured the tokenized boot URL. */
function harnessFile(rel: string): string {
  for (const base of [path.resolve("."), path.resolve("apps/dsh-host")]) {
    const p = path.join(base, rel);
    if (existsSync(p)) return p;
  }
  return "";
}

/**
 * Tries both plausible cwds because the suite runs via `pnpm --filter` from the repo root as
 * well as directly here. Falling back to "/" keeps working against a dsh without the gate.
 */
export function bootUrl(): string {
  const f = harnessFile(".dsh/web-url");
  if (f) {
    const url = readFileSync(f, "utf8").trim();
    if (url) return url;
  }
  return "/";
}

/** Absolute path to a file under `e2e/fixtures/`, from either cwd. */
export function fixturePath(name: string): string {
  const f = harnessFile(path.join("e2e/fixtures", name));
  if (!f) throw new Error(`e2e fixture missing: ${name} (run: pnpm exec tsx scripts/gen/dsh-e2e-xlsx.mts)`);
  return f;
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
    if (
      await gate
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      await gate.first().click();
      clear = 0;
    } else {
      clear += 1;
    }
    await page.waitForTimeout(300);
  }
  await expect(page.getByText("Internal Testing Notice")).toHaveCount(0);
}

export async function openMiniApps(page: Page): Promise<void> {
  await page.goto(bootUrl());
  await dismissOnboarding(page);
  const foot = page.getByRole("button", { name: "小程序" });
  await expect(foot).toBeVisible();
  await foot.click();
  await expect(page.locator("#mma-host")).toBeVisible();
}

export function card(page: Page, name: string) {
  return page.locator("#mma-list .mma-card").filter({ hasText: name });
}

/** The app iframe (the panel keeps one per opened app; `.first()` is the visible one). */
export function frameOf(page: Page) {
  return page.frameLocator("#mma-frames iframe").first();
}

export async function expectFrameAlive(page: Page): Promise<void> {
  const frame = frameOf(page);
  await expect(frame.locator("#root")).toBeVisible({ timeout: 30_000 });
  await expect(frame.locator("body")).not.toContainText('{"error"');
}

/** Open an app from the gallery and wait until its iframe has real content. */
export async function openApp(page: Page, name: string) {
  await openMiniApps(page);
  await card(page, name).click();
  await expectFrameAlive(page);
  return frameOf(page);
}
