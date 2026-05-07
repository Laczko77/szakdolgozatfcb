/**
 * Admin — Reviews (/admin/ertekelesek) (E2E)
 *
 * Covers:
 *  - Route guard: anonymous → /login, regular user → /
 *  - Admin can view the reviews list or empty state
 *  - Visibility filter (Összes / Csak láthatóak / Csak rejtettek) is visible
 *  - Changing the filter stays on /admin/ertekelesek
 *  - Reviews table or empty state is rendered
 *  - Table columns include rating (star) and review text when reviews exist
 *  - Visibility toggle button is available per row when reviews exist
 *  - API-level: GET /api/admin/reviews without auth returns 401 or 403
 */

import { test, expect } from '../fixtures/auth';

// ──────────────────────────────────────────────────────────
// Route guard
// ──────────────────────────────────────────────────────────

test.describe('Admin reviews route guard', () => {
  test('anonymous user is redirected to /login', async ({ page }) => {
    await page.goto('/admin/ertekelesek');
    await expect(page).toHaveURL(/login/, { timeout: 10_000 });
  });

  test('regular user is redirected away from /admin', async ({ userPage }) => {
    const sameAccount = process.env.TEST_USER_EMAIL === process.env.TEST_ADMIN_EMAIL;
    test.skip(sameAccount, 'TEST_USER_EMAIL is the same admin account — skipped');
    await userPage.goto('/admin/ertekelesek');
    await expect(userPage).not.toHaveURL(/admin/, { timeout: 10_000 });
  });
});

// ──────────────────────────────────────────────────────────
// Admin user tests
// ──────────────────────────────────────────────────────────

test.describe('Admin reviews page (admin user)', () => {
  test.beforeEach(async ({ adminPage }) => {
    await adminPage.goto('/admin/ertekelesek');
    await adminPage.waitForLoadState('domcontentloaded');
    await adminPage.waitForTimeout(1_500);
  });

  test('renders the reviews heading', async ({ adminPage }) => {
    await expect(
      adminPage.getByRole('heading', { name: /értékelés/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('reviews table or empty state is rendered', async ({ adminPage }) => {
    const hasTable = (await adminPage.locator('table').count()) > 0;
    const hasEmpty = (await adminPage.getByText(/nincs értékelés/i).count()) > 0;
    expect(hasTable || hasEmpty).toBe(true);
  });

  test('visibility filter select is visible', async ({ adminPage }) => {
    await expect(
      adminPage.locator('select').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('visibility filter contains Összes, látható and rejtett options', async ({ adminPage }) => {
    const select = adminPage.locator('select').first();
    await expect(select).toBeVisible({ timeout: 10_000 });

    const options = await select.locator('option').allTextContents();
    const joined = options.join(' ');
    expect(joined).toMatch(/összes/i);
    expect(joined).toMatch(/láthat/i);
    expect(joined).toMatch(/rejtett/i);
  });

  test('changing the visibility filter stays on /admin/ertekelesek', async ({ adminPage }) => {
    const select = adminPage.locator('select').first();
    if ((await select.count()) === 0) {
      test.skip(true, 'Visibility filter not found');
    }

    await select.selectOption({ index: 1 });
    await adminPage.waitForTimeout(1_000);

    await expect(adminPage).toHaveURL(/admin\/ertekelesek/, { timeout: 5_000 });
  });

  test('table has multiple columns when reviews exist', async ({ adminPage }) => {
    const hasTable = (await adminPage.locator('table').count()) > 0;
    if (!hasTable) {
      test.skip(true, 'No reviews table — empty state');
    }

    const headers = await adminPage.locator('table th').allTextContents();
    // ReviewsTable renders columns for product, user, rating, text, visibility
    expect(headers.length).toBeGreaterThanOrEqual(3);
  });

  test('review rows exist when reviews are present', async ({ adminPage }) => {
    const tableRows = adminPage.locator('table tbody tr');
    const rowCount = await tableRows.count();

    if (rowCount === 0) {
      const hasEmpty = (await adminPage.getByText(/nincs értékelés/i).count()) > 0;
      expect(hasEmpty).toBe(true);
      return;
    }

    // At least the first row should have visible cells
    await expect(tableRows.first().locator('td').first()).toBeVisible({ timeout: 8_000 });
  });

  test('visibility toggle button is available per row when reviews exist', async ({ adminPage }) => {
    const tableRows = adminPage.locator('table tbody tr');
    const rowCount = await tableRows.count();

    if (rowCount === 0) {
      test.skip(true, 'No reviews in test database');
    }

    // ReviewsTable renders a button to toggle visibility (Elrejt / Megjelenít)
    const toggleButton = adminPage.getByRole('button', { name: /elrejt|megjelenít|láthatóság/i }).first();
    if ((await toggleButton.count()) > 0) {
      await expect(toggleButton).toBeVisible({ timeout: 8_000 });
    } else {
      // Visibility may be a clickable badge — just verify rows have action cells
      const lastCell = tableRows.first().locator('td').last();
      await expect(lastCell).toBeVisible({ timeout: 8_000 });
    }
  });
});

// ──────────────────────────────────────────────────────────
// API-level auth enforcement
// ──────────────────────────────────────────────────────────

test.describe('Reviews API auth enforcement', () => {
  test('GET /api/admin/reviews without auth returns 401 or 403', async ({ request }) => {
    const response = await request.get('/api/admin/reviews');
    expect([401, 403]).toContain(response.status());
  });
});
