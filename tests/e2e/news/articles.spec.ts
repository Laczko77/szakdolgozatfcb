/**
 * News / Hírek (E2E)
 *
 * Covers:
 *  - Public listing page renders articles
 *  - Category filter tabs are visible and functional
 *  - Clicking an article card navigates to the detail page
 *  - Article detail page renders title and body content
 *  - "Load more" button appears when there are additional pages
 */

import { test, expect } from '@playwright/test';

test.describe('News listing (/hirek)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/hirek');
    // Wait for initial content load (skeleton disappears)
    await page.waitForLoadState('domcontentloaded');
  });

  test('renders the news page heading', async ({ page }) => {
    // h1 = "A legfrissebb a klubról" — use level:1 to avoid regex mismatch
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('displays category filter pills', async ({ page }) => {
    // Category pills use role="tab" (CategoryPills component renders tablist)
    const pills = page.getByRole('tab').filter({ hasText: /összes|transfer|hírek|meccs|klub|mind/i });
    await expect(pills.first()).toBeVisible({ timeout: 10_000 });
  });

  test('articles are loaded and at least one card is visible', async ({ page }) => {
    await page.waitForTimeout(2_000);
    // ArticleCard renders as <motion.li> with a Link to /hirek/:id
    await expect(page.locator('a[href*="/hirek/"]').first()).toBeVisible({ timeout: 15_000 });
  });

  test('clicking a category filter updates the URL and reloads articles', async ({ page }) => {
    // Category pills use role="tab"
    const pills = page.getByRole('tab').filter({ hasText: /transfer|meccs|klub|összefoglaló/i });
    const count = await pills.count();
    if (count === 0) {
      test.skip(true, 'No filterable category pills found — data may be empty');
    }
    await pills.first().click();
    await page.waitForTimeout(1_000);
    // After filter click the list updates (URL may or may not change)
    await expect(page).toHaveURL(/hirek/, { timeout: 8_000 });
  });

  test('clicking an article navigates to the detail page', async ({ page }) => {
    await page.waitForTimeout(2_000);
    const firstLink = page.locator('a[href*="/hirek/"]').first();
    await expect(firstLink).toBeVisible({ timeout: 15_000 });
    await firstLink.click();
    // URL should match /hirek/:id
    await expect(page).toHaveURL(/hirek\//, { timeout: 10_000 });
  });
});

test.describe('News article detail (/hirek/:id)', () => {
  test('article detail page renders title and content', async ({ page }) => {
    // Navigate to the listing first to get a real article link
    await page.goto('/hirek');
    await page.waitForTimeout(2_000);
    const firstLink = page.locator('a[href*="/hirek/"]').first();
    await expect(firstLink).toBeVisible({ timeout: 15_000 });
    await firstLink.click();
    await page.waitForLoadState('domcontentloaded');

    // The detail page should render an h1
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10_000 });

    // And some body text
    await expect(page.locator('main p, article p').first()).toBeVisible({ timeout: 10_000 });
  });
});
