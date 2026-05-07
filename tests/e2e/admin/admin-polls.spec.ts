/**
 * Admin — Polls (/admin/szavazasok) (E2E)
 *
 * Covers:
 *  - Route guard: anonymous → /login, regular user → /
 *  - Admin can view the polls list or empty state
 *  - Status filter (Összes / Aktív / Lezárt) is visible
 *  - "Új szavazás" button is visible and opens the create dialog
 *  - Create dialog contains a question field and at least two option inputs
 *  - Closing the dialog removes it from view
 *  - Delete confirmation dialog appears with "Mégse" button that closes it
 *  - API-level: POST /api/admin/polls without auth returns 401 or 403
 */

import { test, expect } from '../fixtures/auth';

// ──────────────────────────────────────────────────────────
// Route guard
// ──────────────────────────────────────────────────────────

test.describe('Admin polls route guard', () => {
  test('anonymous user is redirected to /login', async ({ page }) => {
    await page.goto('/admin/szavazasok');
    await expect(page).toHaveURL(/login/, { timeout: 10_000 });
  });

  test('regular user is redirected away from /admin', async ({ userPage }) => {
    const sameAccount = process.env.TEST_USER_EMAIL === process.env.TEST_ADMIN_EMAIL;
    test.skip(sameAccount, 'TEST_USER_EMAIL is the same admin account — skipped');
    await userPage.goto('/admin/szavazasok');
    await expect(userPage).not.toHaveURL(/admin/, { timeout: 10_000 });
  });
});

// ──────────────────────────────────────────────────────────
// Admin user tests
// ──────────────────────────────────────────────────────────

test.describe('Admin polls page (admin user)', () => {
  test.beforeEach(async ({ adminPage }) => {
    await adminPage.goto('/admin/szavazasok');
    await adminPage.waitForLoadState('domcontentloaded');
    await adminPage.waitForTimeout(1_500);
  });

  test('renders the polls heading', async ({ adminPage }) => {
    await expect(
      adminPage.getByRole('heading', { name: /szavazás/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('polls list or empty state is rendered', async ({ adminPage }) => {
    const hasPolls = (await adminPage.locator('h2, h3').count()) > 0;
    const hasEmpty = (await adminPage.getByText(/nincs ilyen szavazás/i).count()) > 0;
    const hasBetoltés = (await adminPage.getByText(/betöltés/i).count()) === 0;
    expect(hasBetoltés).toBe(true); // loading has finished
    // Either polls are shown or the empty state card appears
    expect(hasPolls || hasEmpty).toBe(true);
  });

  test('status filter select is visible', async ({ adminPage }) => {
    await expect(
      adminPage.locator('select').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('status filter has Összes, Aktív and Lezárt options', async ({ adminPage }) => {
    const select = adminPage.locator('select').first();
    await expect(select).toBeVisible({ timeout: 10_000 });

    const options = await select.locator('option').allTextContents();
    const joined = options.join(' ');
    expect(joined).toMatch(/összes/i);
    expect(joined).toMatch(/aktív/i);
    expect(joined).toMatch(/lezárt/i);
  });

  test('"Új szavazás" button is visible', async ({ adminPage }) => {
    await expect(
      adminPage.getByRole('button', { name: /új szavazás/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('"Új szavazás" button opens the create dialog', async ({ adminPage }) => {
    await adminPage.getByRole('button', { name: /új szavazás/i }).click();
    await adminPage.waitForTimeout(500);

    await expect(
      adminPage.locator('[role="dialog"]').first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('create dialog contains a question input', async ({ adminPage }) => {
    await adminPage.getByRole('button', { name: /új szavazás/i }).click();
    await adminPage.waitForTimeout(600);

    // AdminField label="Kérdés" → AdminInput id="question"
    await expect(
      adminPage.locator('#question').or(adminPage.getByLabel(/kérdés/i).first())
    ).toBeVisible({ timeout: 8_000 });
  });

  test('create dialog contains at least two option inputs', async ({ adminPage }) => {
    await adminPage.getByRole('button', { name: /új szavazás/i }).click();
    await adminPage.waitForTimeout(600);

    // PollFormDialog renders two option inputs by default (placeholder: "1. opció", "2. opció")
    const optionInputs = adminPage.locator('[role="dialog"] input[placeholder*="opció"]');
    const count = await optionInputs.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('closing the create dialog removes it from view', async ({ adminPage }) => {
    await adminPage.getByRole('button', { name: /új szavazás/i }).click();
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

  test('delete button triggers ConfirmDialog when a poll exists', async ({ adminPage }) => {
    // The Törlés button lives inside PollRow action area
    const deleteButtons = adminPage.getByRole('button', { name: /törlés/i });
    if ((await deleteButtons.count()) === 0) {
      test.skip(true, 'No polls in test database — cannot test delete dialog');
    }

    await deleteButtons.first().click();
    await adminPage.waitForTimeout(500);

    // ConfirmDialog with title "Szavazás törlése"
    await expect(
      adminPage.locator('[role="dialog"]').first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('"Mégse" in delete dialog closes it without deleting', async ({ adminPage }) => {
    const deleteButtons = adminPage.getByRole('button', { name: /törlés/i });
    if ((await deleteButtons.count()) === 0) {
      test.skip(true, 'No polls to delete');
    }

    await deleteButtons.first().click();
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

test.describe('Polls API auth enforcement', () => {
  test('POST /api/admin/polls without auth returns 401 or 403', async ({ request }) => {
    const response = await request.post('/api/admin/polls', {
      data: {
        question: 'Test question?',
        options: [{ label: 'Yes' }, { label: 'No' }],
      },
    });
    expect([401, 403]).toContain(response.status());
  });
});
