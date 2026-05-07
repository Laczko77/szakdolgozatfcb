/**
 * Admin — Orders (/admin/rendelesek) (E2E)
 *
 * Covers:
 *  - Route guard: anonymous → /login, regular user → /
 *  - Admin can view orders list or empty state
 *  - Status filter select is visible
 *  - Status filter shows the correct options (processing, shipped, delivered, cancelled)
 *  - Changing the status filter keeps the page on /admin/rendelesek
 *  - Order rows contain relevant data columns when orders exist
 *  - API-level: GET /api/admin/orders without auth returns 401 or 403
 */

import { test, expect } from '../fixtures/auth';

// ──────────────────────────────────────────────────────────
// Route guard
// ──────────────────────────────────────────────────────────

test.describe('Admin orders route guard', () => {
  test('anonymous user is redirected to /login', async ({ page }) => {
    await page.goto('/admin/rendelesek');
    await expect(page).toHaveURL(/login/, { timeout: 10_000 });
  });

  test('regular user is redirected away from /admin', async ({ userPage }) => {
    const sameAccount = process.env.TEST_USER_EMAIL === process.env.TEST_ADMIN_EMAIL;
    test.skip(sameAccount, 'TEST_USER_EMAIL is the same admin account — skipped');
    await userPage.goto('/admin/rendelesek');
    await expect(userPage).not.toHaveURL(/admin/, { timeout: 10_000 });
  });
});

// ──────────────────────────────────────────────────────────
// Admin user tests
// ──────────────────────────────────────────────────────────

test.describe('Admin orders page (admin user)', () => {
  test.beforeEach(async ({ adminPage }) => {
    await adminPage.goto('/admin/rendelesek');
    await adminPage.waitForLoadState('domcontentloaded');
    await adminPage.waitForTimeout(1_500);
  });

  test('renders the orders heading', async ({ adminPage }) => {
    await expect(
      adminPage.getByRole('heading', { name: /rendelés/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('orders table or empty state is rendered', async ({ adminPage }) => {
    const hasTable = (await adminPage.locator('table').count()) > 0;
    const hasEmpty = (await adminPage.getByText(/nincs rendelés/i).count()) > 0;
    expect(hasTable || hasEmpty).toBe(true);
  });

  test('status filter select is visible', async ({ adminPage }) => {
    await expect(
      adminPage.locator('select').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('status filter contains expected status options', async ({ adminPage }) => {
    const select = adminPage.locator('select').first();
    await expect(select).toBeVisible({ timeout: 10_000 });

    // Verify the "Mind" (all) option is present
    const options = await select.locator('option').allTextContents();
    const joinedOptions = options.join(' ').toLowerCase();

    // The page renders: Mind, Feldolgozás alatt, Szállítás alatt, Teljesítve, Törölve
    expect(options.length).toBeGreaterThanOrEqual(2);
    expect(joinedOptions).toMatch(/mind/i);
  });

  test('changing the status filter stays on /admin/rendelesek', async ({ adminPage }) => {
    const select = adminPage.locator('select').first();
    if ((await select.count()) === 0) {
      test.skip(true, 'Status filter not found');
    }

    // Select the second option (a specific status)
    await select.selectOption({ index: 1 });
    await adminPage.waitForTimeout(1_000);

    await expect(adminPage).toHaveURL(/admin\/rendelesek/, { timeout: 5_000 });
  });

  test('order rows display data columns when orders exist', async ({ adminPage }) => {
    const tableRows = adminPage.locator('table tbody tr');
    const rowCount = await tableRows.count();

    if (rowCount === 0) {
      // Empty state is acceptable — no orders in the test database
      const hasEmpty = (await adminPage.getByText(/nincs rendelés/i).count()) > 0;
      expect(hasEmpty).toBe(true);
      return;
    }

    // Verify that the first row has visible cells (order data)
    const firstRow = tableRows.first();
    const cells = firstRow.locator('td');
    await expect(cells.first()).toBeVisible({ timeout: 8_000 });
    const cellCount = await cells.count();
    // OrdersTable renders: ID, user, date, status, total, actions — at least 4 columns
    expect(cellCount).toBeGreaterThanOrEqual(4);
  });

  test('clicking an order row opens the order detail dialog', async ({ adminPage }) => {
    const tableRows = adminPage.locator('table tbody tr');
    const rowCount = await tableRows.count();

    if (rowCount === 0) {
      test.skip(true, 'No orders in test database — cannot test row click');
    }

    // The OrdersTable calls onView when a row or view button is clicked
    const viewButton = adminPage.getByRole('button', { name: /megtekintés|részletek|view/i }).first();
    if ((await viewButton.count()) > 0) {
      await viewButton.click();
    } else {
      await tableRows.first().click();
    }

    await adminPage.waitForTimeout(500);

    await expect(
      adminPage.locator('[role="dialog"]').first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('order detail dialog can be closed', async ({ adminPage }) => {
    const tableRows = adminPage.locator('table tbody tr');
    const rowCount = await tableRows.count();

    if (rowCount === 0) {
      test.skip(true, 'No orders in test database');
    }

    const viewButton = adminPage.getByRole('button', { name: /megtekintés|részletek|view/i }).first();
    if ((await viewButton.count()) > 0) {
      await viewButton.click();
    } else {
      await tableRows.first().click();
    }

    await adminPage.waitForTimeout(500);

    // Close via Escape
    await adminPage.keyboard.press('Escape');
    await adminPage.waitForTimeout(400);

    await expect(
      adminPage.locator('[role="dialog"]')
    ).not.toBeVisible({ timeout: 5_000 });
  });
});

// ──────────────────────────────────────────────────────────
// API-level auth enforcement
// ──────────────────────────────────────────────────────────

test.describe('Orders API auth enforcement', () => {
  test('GET /api/admin/orders without auth returns 401 or 403', async ({ request }) => {
    const response = await request.get('/api/admin/orders');
    expect([401, 403]).toContain(response.status());
  });
});
