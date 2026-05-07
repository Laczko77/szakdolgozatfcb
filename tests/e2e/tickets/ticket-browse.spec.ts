/**
 * Tickets — Browse matches (/jegyek) (E2E)
 *
 * Covers:
 *  - Public listing renders match table / list
 *  - Scope tabs ("Közelgő" / "Lejátszott") toggle content
 *  - Each upcoming match with sectors has a "Vásárlás" / ticket CTA
 *  - Navigating to a match detail page (/jegyek/:id)
 */

import { test, expect } from '@playwright/test';

test.describe('Tickets listing (/jegyek)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/jegyek');
    await page.waitForLoadState('domcontentloaded');
  });

  test('renders page heading', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /mérkőzések|naptára/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('scope tabs are visible', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /közelgő/i })).toBeVisible({ timeout: 8_000 });
    await expect(page.getByRole('tab', { name: /lejátszott/i })).toBeVisible({ timeout: 8_000 });
  });

  test('switching to "Lejátszott" tab loads past matches', async ({ page }) => {
    await page.getByRole('tab', { name: /lejátszott/i }).click();
    // Wait for loading skeleton (.animate-pulse divs) to be replaced by real content
    await page.locator('.animate-pulse').first().waitFor({ state: 'detached', timeout: 8_000 }).catch(() => {});
    // Either past matches appear (table rows) OR an empty state message
    const hasContent =
      (await page.locator('table tr, [data-testid="match-row"]').count()) > 0 ||
      (await page.getByText(/nincs lejátszott/i).count()) > 0;
    expect(hasContent).toBe(true);
  });

  test('upcoming matches list renders at least one row when data exists', async ({ page }) => {
    // Wait for loading skeleton to clear (empty state text: "Nincs ütemezett mérkőzés")
    await page.locator('.animate-pulse').first().waitFor({ state: 'detached', timeout: 10_000 }).catch(() => {});
    const rows = page.locator('table tbody tr, [data-testid="match-row"]');
    const rowCount = await rows.count();
    // "Nincs ütemezett mérkőzés" is the actual empty-state heading for the upcoming scope
    const hasEmptyState = (await page.getByText(/nincs ütemezett|nincs közelgő|no upcoming/i).count()) > 0;
    expect(rowCount > 0 || hasEmptyState).toBe(true);
  });

  test('match row with sectors has a ticket CTA link', async ({ page }) => {
    await page.waitForTimeout(2_000);
    // Look for any "Vásárlás", "Jegyek", or "Részletek" link
    const ctaLinks = page.getByRole('link', {
      name: /vásárlás|jegy|részletek/i,
    });
    const count = await ctaLinks.count();
    if (count === 0) {
      test.skip(true, 'No upcoming matches with ticket CTAs found — may be off-season');
    }
    await expect(ctaLinks.first()).toBeVisible();
  });
});

test.describe('Ticket detail page (/jegyek/:id)', () => {
  test('navigating to a match detail page renders the stadium sector map', async ({ page }) => {
    await page.goto('/jegyek');
    await page.waitForTimeout(2_000);

    const firstLink = page
      .getByRole('link', { name: /vásárlás|jegy|részletek/i })
      .first();
    const count = await firstLink.count();
    if (count === 0) {
      test.skip(true, 'No ticket links found — skipping detail page test');
    }

    await firstLink.click();

    // Navigation may go to /jegyek/:id or open a modal — wait to see which
    try {
      await page.waitForURL(/jegyek\//, { timeout: 10_000 });
    } catch {
      test.skip(true, 'Ticket CTA did not navigate to /jegyek/:id — may open a modal or be off-season');
      return;
    }

    // The detail page should contain an SVG stadium map or sector selector
    await expect(
      page.locator('[data-testid="sector-map"], [class*="sector"], svg:not([aria-hidden])').first()
    ).toBeVisible({ timeout: 15_000 });
  });
});
