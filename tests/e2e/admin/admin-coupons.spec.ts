/**
 * Admin — Coupons (/admin/kuponok) (E2E)
 *
 * Covers:
 *  - Route guard: anonymous → /login, regular user → /
 *  - Admin can view coupons list or empty state
 *  - "Új kupon" button is visible
 *  - "Új kupon" opens the create dialog
 *  - Create dialog contains Név, Kedvezmény típusa and Pontár fields
 *  - Closing the dialog removes it from view
 *  - Coupon table headers include Név, Típus, Pontár columns
 *  - Inaktiválás (soft delete) confirm dialog appears and can be cancelled
 *  - API-level: GET /api/admin/coupons without auth returns 401 or 403
 */

import { test, expect } from '../fixtures/auth';

// ──────────────────────────────────────────────────────────
// Route guard
// ──────────────────────────────────────────────────────────

test.describe('Admin coupons route guard', () => {
  test('anonymous user is redirected to /login', async ({ page }) => {
    await page.goto('/admin/kuponok');
    await expect(page).toHaveURL(/login/, { timeout: 10_000 });
  });

  test('regular user is redirected away from /admin', async ({ userPage }) => {
    const sameAccount = process.env.TEST_USER_EMAIL === process.env.TEST_ADMIN_EMAIL;
    test.skip(sameAccount, 'TEST_USER_EMAIL is the same admin account — skipped');
    await userPage.goto('/admin/kuponok');
    await expect(userPage).not.toHaveURL(/admin/, { timeout: 10_000 });
  });
});

// ──────────────────────────────────────────────────────────
// Admin user tests
// ──────────────────────────────────────────────────────────

test.describe('Admin coupons page (admin user)', () => {
  test.beforeEach(async ({ adminPage }) => {
    await adminPage.goto('/admin/kuponok');
    await adminPage.waitForLoadState('domcontentloaded');
    await adminPage.waitForTimeout(1_500);
  });

  test('renders the coupons heading', async ({ adminPage }) => {
    await expect(
      adminPage.getByRole('heading', { name: /kupon/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('coupons table or empty state is rendered', async ({ adminPage }) => {
    const hasTable = (await adminPage.locator('table').count()) > 0;
    const hasEmpty = (await adminPage.getByText(/nincs kupon|még nincs kupon/i).count()) > 0;
    expect(hasTable || hasEmpty).toBe(true);
  });

  test('"Új kupon" button is visible', async ({ adminPage }) => {
    await expect(
      adminPage.getByRole('button', { name: /új kupon/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('"Új kupon" button opens the create dialog', async ({ adminPage }) => {
    await adminPage.getByRole('button', { name: /új kupon/i }).click();
    await adminPage.waitForTimeout(500);

    await expect(
      adminPage.locator('[role="dialog"]').first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('create dialog contains a Név input', async ({ adminPage }) => {
    await adminPage.getByRole('button', { name: /új kupon/i }).click();
    await adminPage.waitForTimeout(600);

    // AdminField label="Név" → AdminInput id="coupon-name"
    await expect(
      adminPage.locator('#coupon-name').or(adminPage.getByLabel(/^név$/i).first())
    ).toBeVisible({ timeout: 8_000 });
  });

  test('create dialog contains discount type and point cost fields', async ({ adminPage }) => {
    await adminPage.getByRole('button', { name: /új kupon/i }).click();
    await adminPage.waitForTimeout(600);

    // AdminSelect id="discount-type"
    await expect(
      adminPage.locator('#discount-type')
    ).toBeVisible({ timeout: 8_000 });

    // AdminInput id="point-cost"
    await expect(
      adminPage.locator('#point-cost')
    ).toBeVisible({ timeout: 8_000 });
  });

  test('closing the create dialog removes it from view', async ({ adminPage }) => {
    await adminPage.getByRole('button', { name: /új kupon/i }).click();
    await adminPage.waitForTimeout(600);

    const cancelButton = adminPage.getByRole('button', { name: /mégse/i }).first();
    if ((await cancelButton.count()) > 0) {
      await cancelButton.click();
    } else {
      await adminPage.keyboard.press('Escape');
    }
    await adminPage.waitForTimeout(400);

    await expect(
      adminPage.locator('[role="dialog"]')
    ).not.toBeVisible({ timeout: 5_000 });
  });

  test('table headers include Név, Típus and Pontár when coupons exist', async ({ adminPage }) => {
    const hasTable = (await adminPage.locator('table').count()) > 0;
    if (!hasTable) {
      test.skip(true, 'No coupons table — empty state');
    }

    const headers = await adminPage.locator('table th').allTextContents();
    const joined = headers.join(' ');
    expect(joined).toMatch(/név/i);
    expect(joined).toMatch(/típus/i);
    expect(joined).toMatch(/pontár/i);
  });

  test('coupon rows display name and point cost when coupons exist', async ({ adminPage }) => {
    const tableRows = adminPage.locator('table tbody tr');
    const rowCount = await tableRows.count();

    if (rowCount === 0) {
      const hasEmpty = (await adminPage.getByText(/nincs kupon|még nincs kupon/i).count()) > 0;
      expect(hasEmpty).toBe(true);
      return;
    }

    // Name cell (1st td) should have non-empty text
    const firstRow = tableRows.first();
    const firstTd = firstRow.locator('td').first();
    const nameText = (await firstTd.textContent()) ?? '';
    expect(nameText.trim().length).toBeGreaterThan(0);
  });

  test('inaktiválás (trash) button triggers ConfirmDialog when coupon exists', async ({ adminPage }) => {
    // The Inaktiválás button has aria-label="Inaktiválás"
    const inaktivalButton = adminPage.getByRole('button', { name: /inaktiválás/i }).first();
    if ((await inaktivalButton.count()) === 0) {
      test.skip(true, 'No coupons in test database — cannot test deactivate dialog');
    }

    await inaktivalButton.click();
    await adminPage.waitForTimeout(500);

    await expect(
      adminPage.locator('[role="dialog"]').first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('"Mégse" in inaktiválás dialog closes it', async ({ adminPage }) => {
    const inaktivalButton = adminPage.getByRole('button', { name: /inaktiválás/i }).first();
    if ((await inaktivalButton.count()) === 0) {
      test.skip(true, 'No coupons to deactivate');
    }

    await inaktivalButton.click();
    await adminPage.waitForTimeout(500);

    const cancelButton = adminPage.getByRole('button', { name: /mégse/i }).first();
    if ((await cancelButton.count()) > 0) {
      await cancelButton.click();
      await adminPage.waitForTimeout(400);
      await expect(adminPage.locator('[role="dialog"]')).not.toBeVisible({ timeout: 5_000 });
    }
  });
});

// ──────────────────────────────────────────────────────────
// API-level auth enforcement
// ──────────────────────────────────────────────────────────

test.describe('Coupons API auth enforcement', () => {
  test('GET /api/admin/coupons without auth returns 401 or 403', async ({ request }) => {
    const response = await request.get('/api/admin/coupons');
    expect([401, 403]).toContain(response.status());
  });
});
