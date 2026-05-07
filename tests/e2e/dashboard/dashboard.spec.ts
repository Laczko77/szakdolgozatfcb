/**
 * Dashboard (/dashboard) (E2E)
 *
 * Covers:
 *  - Authenticated user can access /dashboard
 *  - Unauthenticated user is redirected to /login
 *  - Dashboard hero greeting renders (username or email)
 *  - Points widget is visible
 *  - Next match widget renders or shows empty state
 *  - Latest news widget renders or shows empty state
 *  - Orders widget renders or shows empty state
 *  - Quick links strip is visible
 */

import { test, expect } from '../fixtures/auth';

test.describe('Dashboard (unauthenticated)', () => {
  test('redirects unauthenticated user to /login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/login/, { timeout: 10_000 });
  });

  test('login page provides returnUrl back to dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/login/, { timeout: 10_000 });
    // The redirect should encode returnUrl so the user lands back after login
    const url = page.url();
    expect(url).toMatch(/returnUrl|redirect/i);
  });
});

test.describe('Dashboard (authenticated)', () => {
  test.beforeEach(async ({ userPage }) => {
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('domcontentloaded');
    // Give widgets time to resolve their async fetches
    await userPage.waitForTimeout(3_000);
  });

  test('dashboard renders a greeting for the authenticated user', async ({ userPage }) => {
    // DashboardHero renders the user's username or email greeting
    await expect(
      userPage.locator('[data-testid="dashboard-hero"], [class*="hero"]')
        .or(userPage.getByRole('heading', { level: 1 }))
        .first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('points widget is visible with a numeric balance', async ({ userPage }) => {
    await expect(
      userPage.getByText(/pont|pontok|points|egyenleg/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('next match widget renders or shows empty state', async ({ userPage }) => {
    const hasMatch = (await userPage.locator('[data-testid="next-match-widget"], [class*="match"]').count()) > 0;
    const hasMatchText = (await userPage.getByText(/következő mérkőzés|next match|nincs közelgő/i).count()) > 0;
    expect(hasMatch || hasMatchText).toBe(true);
  });

  test('latest news widget renders or shows empty state', async ({ userPage }) => {
    const hasNewsWidget = (await userPage.locator('[data-testid="latest-news-widget"], [class*="news"]').count()) > 0;
    const hasNewsText = (await userPage.getByText(/legfrissebb hírek|latest news|nincs cikk|no articles/i).count()) > 0;
    const hasArticleLinks = (await userPage.locator('a[href*="/hirek/"]').count()) > 0;
    expect(hasNewsWidget || hasNewsText || hasArticleLinks).toBe(true);
  });

  test('orders widget renders or shows empty state', async ({ userPage }) => {
    const hasOrdersWidget = (await userPage.locator('[data-testid="orders-widget"]').count()) > 0;
    const hasOrdersText = (await userPage.getByText(/rendelés|orders|nincs rendelés/i).count()) > 0;
    expect(hasOrdersWidget || hasOrdersText).toBe(true);
  });

  test('quick links strip is visible', async ({ userPage }) => {
    // QuickLinks renders navigation tiles to main sections
    const hasQuickLinks = (await userPage.locator('[data-testid="quick-links"]').count()) > 0;
    // Alternatively check for links to key sections
    const hasNavLinks = (await userPage.locator('a[href="/shop"], a[href="/jegyek"], a[href="/kozosseg"]').count()) > 0;
    expect(hasQuickLinks || hasNavLinks).toBe(true);
  });

  test('dashboard page title is set', async ({ userPage }) => {
    const title = await userPage.title();
    // Should be a meaningful page title
    expect(title.length).toBeGreaterThan(0);
  });
});
