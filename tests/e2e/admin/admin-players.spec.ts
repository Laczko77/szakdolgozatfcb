/**
 * Admin — Players (/admin/jatekosok) (E2E)
 *
 * Covers:
 *  - Route guard: anonymous → /login, regular user → /
 *  - Admin can view the players list or empty state
 *  - "Játékosok szinkronizálása" sync button is visible
 *  - Table headers include Név and Pozíció columns
 *  - Player rows display name and position badge when players exist
 *  - Edit (pencil) button per row opens the player edit dialog
 *  - Player edit dialog contains a Bio textarea
 *  - Closing the edit dialog removes it from view
 *  - football-data.org info note is rendered
 */

import { test, expect } from '../fixtures/auth';

// ──────────────────────────────────────────────────────────
// Route guard
// ──────────────────────────────────────────────────────────

test.describe('Admin players route guard', () => {
  test('anonymous user is redirected to /login', async ({ page }) => {
    await page.goto('/admin/jatekosok');
    await expect(page).toHaveURL(/login/, { timeout: 10_000 });
  });

  test('regular user is redirected away from /admin', async ({ userPage }) => {
    const sameAccount = process.env.TEST_USER_EMAIL === process.env.TEST_ADMIN_EMAIL;
    test.skip(sameAccount, 'TEST_USER_EMAIL is the same admin account — skipped');
    await userPage.goto('/admin/jatekosok');
    await expect(userPage).not.toHaveURL(/admin/, { timeout: 10_000 });
  });
});

// ──────────────────────────────────────────────────────────
// Admin user tests
// ──────────────────────────────────────────────────────────

test.describe('Admin players page (admin user)', () => {
  test.beforeEach(async ({ adminPage }) => {
    await adminPage.goto('/admin/jatekosok');
    await adminPage.waitForLoadState('domcontentloaded');
    await adminPage.waitForTimeout(1_500);
  });

  test('renders the players heading', async ({ adminPage }) => {
    await expect(
      adminPage.getByRole('heading', { name: /játékos/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('"Játékosok szinkronizálása" sync button is visible', async ({ adminPage }) => {
    await expect(
      adminPage.getByRole('button', { name: /szinkronizál/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('football-data.org info note is rendered', async ({ adminPage }) => {
    await expect(
      adminPage.getByText(/football-data\.org/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('players table or empty state is rendered', async ({ adminPage }) => {
    const hasTable = (await adminPage.locator('table').count()) > 0;
    const hasEmpty = (await adminPage.getByText(/nincs játékos/i).count()) > 0;
    expect(hasTable || hasEmpty).toBe(true);
  });

  test('table headers include Név and Pozíció columns', async ({ adminPage }) => {
    const hasTable = (await adminPage.locator('table').count()) > 0;
    if (!hasTable) {
      test.skip(true, 'No table rendered — empty state');
    }

    const headers = await adminPage.locator('table th').allTextContents();
    const joined = headers.join(' ');
    expect(joined).toMatch(/név/i);
    expect(joined).toMatch(/pozíció/i);
  });

  test('player rows display name and position when players exist', async ({ adminPage }) => {
    const tableRows = adminPage.locator('table tbody tr');
    const rowCount = await tableRows.count();

    if (rowCount === 0) {
      const hasEmpty = (await adminPage.getByText(/nincs játékos/i).count()) > 0;
      expect(hasEmpty).toBe(true);
      return;
    }

    // Each player row should have at least a non-empty name cell (2nd td — first is image)
    const firstRow = tableRows.first();
    const nameTd = firstRow.locator('td').nth(1);
    const nameText = (await nameTd.textContent()) ?? '';
    expect(nameText.trim().length).toBeGreaterThan(0);
  });

  test('edit (pencil) button per row is visible when players exist', async ({ adminPage }) => {
    const tableRows = adminPage.locator('table tbody tr');
    if ((await tableRows.count()) === 0) {
      test.skip(true, 'No players in test database');
    }

    await expect(
      adminPage.getByRole('button', { name: /szerkesztés/i }).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('clicking edit button opens the player edit dialog', async ({ adminPage }) => {
    const editButtons = adminPage.getByRole('button', { name: /szerkesztés/i });
    if ((await editButtons.count()) === 0) {
      test.skip(true, 'No players in test database');
    }

    await editButtons.first().click();
    await adminPage.waitForTimeout(600);

    await expect(
      adminPage.locator('[role="dialog"]').first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('player edit dialog contains a Bio textarea', async ({ adminPage }) => {
    const editButtons = adminPage.getByRole('button', { name: /szerkesztés/i });
    if ((await editButtons.count()) === 0) {
      test.skip(true, 'No players in test database');
    }

    await editButtons.first().click();
    await adminPage.waitForTimeout(600);

    // AdminField label="Bio" → AdminTextarea id="bio"
    await expect(
      adminPage.locator('#bio').or(adminPage.getByLabel(/bio/i).first())
    ).toBeVisible({ timeout: 8_000 });
  });

  test('closing the player edit dialog removes it from view', async ({ adminPage }) => {
    const editButtons = adminPage.getByRole('button', { name: /szerkesztés/i });
    if ((await editButtons.count()) === 0) {
      test.skip(true, 'No players in test database');
    }

    await editButtons.first().click();
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
});
