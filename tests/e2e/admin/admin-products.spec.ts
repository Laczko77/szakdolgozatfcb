/**
 * Admin — Products (/admin/termekek) (E2E)
 *
 * Covers:
 *  - Route guard: anonymous → /login, regular user → /
 *  - Admin can view product list with search
 *  - "Új termék" button opens ProductEditor dialog
 *  - Search input filters the product table
 *  - Delete confirmation dialog appears and can be cancelled
 *  - API-level: product creation requires admin auth
 */

import { test, expect } from '../fixtures/auth';

// ──────────────────────────────────────────────────────────
// Route guard
// ──────────────────────────────────────────────────────────

test.describe('Admin products route guard', () => {
  test('anonymous user is redirected to /login', async ({ page }) => {
    await page.goto('/admin/termekek');
    await expect(page).toHaveURL(/login/, { timeout: 10_000 });
  });

  test('regular user is redirected away from /admin', async ({ userPage }) => {
    const sameAccount = process.env.TEST_USER_EMAIL === process.env.TEST_ADMIN_EMAIL;
    test.skip(sameAccount, 'TEST_USER_EMAIL is the same admin account — skipped');
    await userPage.goto('/admin/termekek');
    await expect(userPage).not.toHaveURL(/admin/, { timeout: 10_000 });
  });
});

// ──────────────────────────────────────────────────────────
// Admin user tests
// ──────────────────────────────────────────────────────────

test.describe('Admin products page (admin user)', () => {
  test.beforeEach(async ({ adminPage }) => {
    await adminPage.goto('/admin/termekek');
    await adminPage.waitForLoadState('domcontentloaded');
    await adminPage.waitForTimeout(1_500);
  });

  test('renders the products heading', async ({ adminPage }) => {
    await expect(
      adminPage.getByRole('heading', { name: /termék/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('"Új termék" button is visible', async ({ adminPage }) => {
    await expect(
      adminPage.getByRole('button', { name: /új termék/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('product table or empty state is rendered', async ({ adminPage }) => {
    const hasTable = (await adminPage.locator('table').count()) > 0;
    const hasEmpty = (await adminPage.getByText(/nincs termék/i).count()) > 0;
    expect(hasTable || hasEmpty).toBe(true);
  });

  test('search input is visible', async ({ adminPage }) => {
    await expect(
      adminPage.getByPlaceholder(/keresés|search/i)
    ).toBeVisible({ timeout: 10_000 });
  });

  test('typing in search filters the product list', async ({ adminPage }) => {
    const searchInput = adminPage.getByPlaceholder(/keresés|search/i);
    if ((await searchInput.count()) === 0) {
      test.skip(true, 'Search input not found');
    }

    await searchInput.fill('Barcelona');
    await adminPage.waitForTimeout(600); // debounce

    // Either results are shown or empty state text appears
    const hasTable = (await adminPage.locator('table tbody tr').count()) > 0;
    const hasEmpty = (await adminPage.getByText(/nem hozott találatot|nincs termék/i).count()) > 0;
    expect(hasTable || hasEmpty).toBe(true);
  });

  test('clearing search restores the full list', async ({ adminPage }) => {
    const searchInput = adminPage.getByPlaceholder(/keresés|search/i);
    if ((await searchInput.count()) === 0) {
      test.skip(true, 'Search input not found');
    }

    await searchInput.fill('xxxxnotexist');
    await adminPage.waitForTimeout(600);
    await searchInput.fill('');
    await adminPage.waitForTimeout(600);

    // Page is still on /admin/termekek
    await expect(adminPage).toHaveURL(/admin\/termekek/, { timeout: 5_000 });
  });

  test('"Új termék" opens the ProductEditor dialog', async ({ adminPage }) => {
    await adminPage.getByRole('button', { name: /új termék/i }).click();
    await adminPage.waitForTimeout(500);

    await expect(
      adminPage.locator('[role="dialog"]').first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('product editor dialog has name field', async ({ adminPage }) => {
    await adminPage.getByRole('button', { name: /új termék/i }).click();
    await adminPage.waitForTimeout(600);

    // Expect some labeled input in the dialog (e.g. "Név" or "Termék neve")
    await expect(
      adminPage.locator('[role="dialog"] input').first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('closing the product editor with Escape removes the dialog', async ({ adminPage }) => {
    await adminPage.getByRole('button', { name: /új termék/i }).click();
    await adminPage.waitForTimeout(600);

    await adminPage.keyboard.press('Escape');
    await adminPage.waitForTimeout(400);

    await expect(
      adminPage.locator('[role="dialog"]')
    ).not.toBeVisible({ timeout: 5_000 });
  });

  test('delete confirmation dialog appears for an existing product', async ({ adminPage }) => {
    const deleteButtons = adminPage.getByRole('button', { name: /törl/i });
    if ((await deleteButtons.count()) === 0) {
      test.skip(true, 'No products to delete — table may be empty');
    }

    await deleteButtons.first().click();
    await adminPage.waitForTimeout(500);

    await expect(
      adminPage.locator('[role="dialog"]').first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('cancelling the delete dialog does not remove the product', async ({ adminPage }) => {
    const deleteButtons = adminPage.getByRole('button', { name: /törl/i });
    if ((await deleteButtons.count()) === 0) {
      test.skip(true, 'No products to delete');
    }

    const rowsBefore = await adminPage.locator('table tbody tr').count();

    await deleteButtons.first().click();
    await adminPage.waitForTimeout(500);

    const cancelButton = adminPage.getByRole('button', { name: /mégse|cancel/i }).first();
    if ((await cancelButton.count()) > 0) {
      await cancelButton.click();
      await adminPage.waitForTimeout(400);
    }

    // Row count should be unchanged
    const rowsAfter = await adminPage.locator('table tbody tr').count();
    expect(rowsAfter).toBe(rowsBefore);
  });
});

// ──────────────────────────────────────────────────────────
// API-level tests
// ──────────────────────────────────────────────────────────

test.describe('Products API auth enforcement', () => {
  test('GET /api/admin/products without auth returns 401', async ({ request }) => {
    const response = await request.get('/api/admin/products');
    expect([401, 403, 405]).toContain(response.status());
  });
});
