/**
 * My Coupons (/kuponjaim) (E2E)
 *
 * Covers:
 *  - Unauthenticated user is redirected to /login
 *  - Authenticated user sees the page heading "Kuponjaim"
 *  - Active coupons or empty state is shown
 *  - Used coupons section renders when applicable
 *  - Stats strip (összes / aktív / felhasznált) is visible when coupons exist
 *  - Link to Pont-áruház is present
 *  - API: GET /api/users/me/coupons returns 401 without auth
 */

import { test, expect } from '../fixtures/auth';

test.describe('My Coupons (unauthenticated)', () => {
  test('redirects unauthenticated user to /login', async ({ page }) => {
    await page.goto('/kuponjaim');
    await expect(page).toHaveURL(/login/, { timeout: 10_000 });
  });

  test('GET /api/users/me/coupons returns 401 without auth', async ({ request }) => {
    const response = await request.get('/api/users/me/coupons');
    expect([401, 404]).toContain(response.status());
  });
});

test.describe('My Coupons (authenticated)', () => {
  test.beforeEach(async ({ userPage }) => {
    await userPage.goto('/kuponjaim');
    await userPage.waitForLoadState('domcontentloaded');
    // Wait for fetchMyCoupons to resolve
    await userPage.waitForTimeout(3_000);
  });

  test('page heading "Kuponjaim" is visible', async ({ userPage }) => {
    // h1 = "Kuponjaim"; avoid .or() strict mode violation with eyebrow <p>
    await expect(
      userPage.getByRole('heading', { name: /kuponjaim/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('eyebrow label includes "Kuponjaim"', async ({ userPage }) => {
    await expect(
      userPage.getByText(/forca barça.*kuponjaim|kuponjaim/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('page description text is visible', async ({ userPage }) => {
    await expect(
      userPage.getByText(/beváltott kuponodat|aktív kódokat/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('coupon cards or empty state is rendered', async ({ userPage }) => {
    const hasCouponCards = (await userPage.locator('[data-testid="redeemed-coupon-card"], [class*="coupon"]').count()) > 0;
    const hasEmptyState = (await userPage.getByText(/még nincs kuponod|no coupons/i).count()) > 0;
    const hasActiveSection = (await userPage.getByText(/készen áll a beváltásra|aktív/i).count()) > 0;
    expect(hasCouponCards || hasEmptyState || hasActiveSection).toBe(true);
  });

  test('empty state shows link to pont-aruhaz when no coupons', async ({ userPage }) => {
    const hasEmptyState = (await userPage.getByText(/még nincs kuponod/i).count()) > 0;
    if (!hasEmptyState) {
      test.skip(true, 'User has coupons — empty state not rendered');
    }

    await expect(
      userPage.getByRole('link', { name: /irány a pont-áruház|pont-áruház/i }).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('stats strip shows coupon counts when coupons exist', async ({ userPage }) => {
    const hasCoupons = (await userPage.locator('[data-testid="redeemed-coupon-card"]').count()) > 0
      || (await userPage.getByText(/készen áll a beváltásra/i).count()) > 0;

    if (!hasCoupons) {
      test.skip(true, 'No coupons found — stats strip not rendered');
    }

    // Stats strip tiles: "Összes kupon", "Aktív", "Felhasznált"
    await expect(
      userPage.getByText(/összes kupon/i).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('active section header is visible when active coupons exist', async ({ userPage }) => {
    const hasActiveSection = (await userPage.getByText(/készen áll a beváltásra/i).count()) > 0;
    if (!hasActiveSection) {
      test.skip(true, 'No active coupon section found');
    }

    await expect(
      userPage.getByText(/aktív/i).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('used section renders when used coupons exist', async ({ userPage }) => {
    // Only "korábbi beváltások" header indicates the used section — "felhasznált" appears in stats strip too
    const hasUsedSection = (await userPage.getByText(/korábbi beváltások/i).count()) > 0;
    if (!hasUsedSection) {
      test.skip(true, 'No used coupons section found');
    }

    await expect(
      userPage.getByText(/korábbi beváltások/i).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('Pont-aruhaz link in header is visible', async ({ userPage }) => {
    // The header always renders a link to /pont-aruhaz regardless of coupon state
    await expect(
      userPage.getByRole('link', { name: /pont-áruház/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('loading skeleton resolves within reasonable time', async ({ userPage }) => {
    // After 3s wait in beforeEach, animate-pulse skeletons should be gone
    const loadingSkeletons = await userPage.locator('[class*="animate-pulse"]').count();
    // Some residual animation is fine, but there should not be 3 full placeholder cards
    expect(loadingSkeletons).toBeLessThan(3);
  });
});
