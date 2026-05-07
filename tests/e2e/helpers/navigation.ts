/**
 * Shared navigation helpers for FC Barcelona Szurkolói Portál E2E tests.
 */

import type { Page } from '@playwright/test';

/**
 * Navigate to a page and wait for it to be fully loaded (no network idle).
 */
export async function goTo(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForLoadState('domcontentloaded');
}

/**
 * Wait for a toast notification matching the given text pattern.
 */
export async function waitForToast(page: Page, textPattern: string | RegExp): Promise<void> {
  await page
    .locator('[role="alert"], [data-testid="toast"]')
    .filter({ hasText: textPattern })
    .first()
    .waitFor({ timeout: 8_000 });
}

/**
 * Dismiss any open modal by pressing Escape.
 */
export async function dismissModal(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
}
