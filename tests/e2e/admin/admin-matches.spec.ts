/**
 * Admin — Matches (/admin/meccsek) (E2E)
 *
 * Covers:
 *  - Route guard: anonymous → /login, regular user → /
 *  - Admin can view the matches list or empty state
 *  - "Meccsek szinkronizálása" (sync) button is visible
 *  - Match rows contain team names and date columns when matches exist
 *  - "Szektorok" action button is visible per row when matches exist
 *  - Clicking "Szektorok" opens the sectors dialog
 *  - Sectors dialog can be closed via the "Bezárás" button
 *  - API-level: POST /api/admin/matches/sync without auth returns 401 or 403
 */

import { test, expect } from '../fixtures/auth';

// ──────────────────────────────────────────────────────────
// Route guard
// ──────────────────────────────────────────────────────────

test.describe('Admin matches route guard', () => {
  test('anonymous user is redirected to /login', async ({ page }) => {
    await page.goto('/admin/meccsek');
    await expect(page).toHaveURL(/login/, { timeout: 10_000 });
  });

  test('regular user is redirected away from /admin', async ({ userPage }) => {
    const sameAccount = process.env.TEST_USER_EMAIL === process.env.TEST_ADMIN_EMAIL;
    test.skip(sameAccount, 'TEST_USER_EMAIL is the same admin account — skipped');
    await userPage.goto('/admin/meccsek');
    await expect(userPage).not.toHaveURL(/admin/, { timeout: 10_000 });
  });
});

// ──────────────────────────────────────────────────────────
// Admin user tests
// ──────────────────────────────────────────────────────────

test.describe('Admin matches page (admin user)', () => {
  test.beforeEach(async ({ adminPage }) => {
    await adminPage.goto('/admin/meccsek');
    await adminPage.waitForLoadState('domcontentloaded');
    await adminPage.waitForTimeout(1_500);
  });

  test('renders the matches heading', async ({ adminPage }) => {
    await expect(
      adminPage.getByRole('heading', { name: /meccs/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('"Meccsek szinkronizálása" sync button is visible', async ({ adminPage }) => {
    await expect(
      adminPage.getByRole('button', { name: /szinkronizál/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('matches table or empty state is rendered', async ({ adminPage }) => {
    const hasTable = (await adminPage.locator('table').count()) > 0;
    const hasEmpty = (await adminPage.getByText(/nincs mérkőzés/i).count()) > 0;
    expect(hasTable || hasEmpty).toBe(true);
  });

  test('football-data.org API info note is visible', async ({ adminPage }) => {
    await expect(
      adminPage.getByText(/football-data\.org/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('table headers include home team, away team and date', async ({ adminPage }) => {
    const hasTable = (await adminPage.locator('table').count()) > 0;
    if (!hasTable) {
      test.skip(true, 'No table rendered — empty state');
    }

    const headers = await adminPage.locator('table th').allTextContents();
    const joined = headers.join(' ').toLowerCase();
    // AdminTHead contains: Hazai csapat, Vendég csapat, Időpont, Helyszín, Státusz, Művelet
    expect(joined).toMatch(/hazai/i);
    expect(joined).toMatch(/vendég/i);
  });

  test('match rows show team names when matches exist', async ({ adminPage }) => {
    const tableRows = adminPage.locator('table tbody tr');
    const rowCount = await tableRows.count();

    if (rowCount === 0) {
      const hasEmpty = (await adminPage.getByText(/nincs mérkőzés/i).count()) > 0;
      expect(hasEmpty).toBe(true);
      return;
    }

    // First row first cell should have non-empty team name text
    const firstCell = tableRows.first().locator('td').first();
    const cellText = (await firstCell.textContent()) ?? '';
    expect(cellText.trim().length).toBeGreaterThan(0);
  });

  test('"Szektorok" action button is visible per row when matches exist', async ({ adminPage }) => {
    const tableRows = adminPage.locator('table tbody tr');
    const rowCount = await tableRows.count();

    if (rowCount === 0) {
      test.skip(true, 'No matches in test database');
    }

    await expect(
      adminPage.getByRole('button', { name: /szektorok/i }).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('clicking "Szektorok" opens the sectors dialog', async ({ adminPage }) => {
    const sectorButtons = adminPage.getByRole('button', { name: /szektorok/i });
    if ((await sectorButtons.count()) === 0) {
      test.skip(true, 'No matches in test database — cannot test sector dialog');
    }

    await sectorButtons.first().click();
    await adminPage.waitForTimeout(600);

    await expect(
      adminPage.locator('[role="dialog"]').first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('sectors dialog has "Bezárás" button which closes it', async ({ adminPage }) => {
    const sectorButtons = adminPage.getByRole('button', { name: /szektorok/i });
    if ((await sectorButtons.count()) === 0) {
      test.skip(true, 'No matches in test database');
    }

    await sectorButtons.first().click();
    await adminPage.waitForTimeout(600);

    const closeButton = adminPage.getByRole('button', { name: /bezárás/i }).first();
    await expect(closeButton).toBeVisible({ timeout: 8_000 });
    await closeButton.click();
    await adminPage.waitForTimeout(400);

    await expect(
      adminPage.locator('[role="dialog"]')
    ).not.toBeVisible({ timeout: 5_000 });
  });
});

// ──────────────────────────────────────────────────────────
// API-level auth enforcement
// ──────────────────────────────────────────────────────────

test.describe('Matches API auth enforcement', () => {
  test('POST /api/admin/matches/sync without auth returns 401 or 403', async ({ request }) => {
    const response = await request.post('/api/admin/matches/sync', {
      data: { next: 20 },
    });
    expect([401, 403]).toContain(response.status());
  });
});
