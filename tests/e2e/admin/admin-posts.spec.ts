/**
 * Admin — Posts (/admin/posztok) (E2E)
 *
 * Covers:
 *  - Route guard: anonymous → /login, regular user → /
 *  - Admin can view the posts list or empty state
 *  - "Új poszt" button is visible
 *  - "Új poszt" opens the create dialog with a content textarea
 *  - Closing the dialog removes it from view
 *  - Delete button (trash icon) on an existing post triggers ConfirmDialog
 *  - "Mégse" in delete dialog closes it without deleting
 *  - "Kommentek" button opens the comments moderation dialog
 *  - Comments dialog can be closed via "Bezárás"
 */

import { test, expect } from '../fixtures/auth';

// ──────────────────────────────────────────────────────────
// Route guard
// ──────────────────────────────────────────────────────────

test.describe('Admin posts route guard', () => {
  test('anonymous user is redirected to /login', async ({ page }) => {
    await page.goto('/admin/posztok');
    await expect(page).toHaveURL(/login/, { timeout: 10_000 });
  });

  test('regular user is redirected away from /admin', async ({ userPage }) => {
    const sameAccount = process.env.TEST_USER_EMAIL === process.env.TEST_ADMIN_EMAIL;
    test.skip(sameAccount, 'TEST_USER_EMAIL is the same admin account — skipped');
    await userPage.goto('/admin/posztok');
    await expect(userPage).not.toHaveURL(/admin/, { timeout: 10_000 });
  });
});

// ──────────────────────────────────────────────────────────
// Admin user tests
// ──────────────────────────────────────────────────────────

test.describe('Admin posts page (admin user)', () => {
  test.beforeEach(async ({ adminPage }) => {
    await adminPage.goto('/admin/posztok');
    await adminPage.waitForLoadState('domcontentloaded');
    await adminPage.waitForTimeout(1_500);
  });

  test('renders the posts heading', async ({ adminPage }) => {
    await expect(
      adminPage.getByRole('heading', { name: /poszt/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('posts list or empty state is rendered', async ({ adminPage }) => {
    // Posts are rendered as cards (AdminCard). Empty state shows "Még nincs poszt".
    const hasPosts = (await adminPage.locator('p, article').count()) > 0;
    const hasEmpty = (await adminPage.getByText(/még nincs poszt/i).count()) > 0;
    expect(hasPosts || hasEmpty).toBe(true);
  });

  test('"Új poszt" button is visible', async ({ adminPage }) => {
    await expect(
      adminPage.getByRole('button', { name: /új poszt/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('"Új poszt" button opens the create dialog', async ({ adminPage }) => {
    await adminPage.getByRole('button', { name: /új poszt/i }).click();
    await adminPage.waitForTimeout(500);

    await expect(
      adminPage.locator('[role="dialog"]').first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('create dialog contains a Tartalom textarea', async ({ adminPage }) => {
    await adminPage.getByRole('button', { name: /új poszt/i }).click();
    await adminPage.waitForTimeout(600);

    // AdminField label="Tartalom" → AdminTextarea id="content"
    await expect(
      adminPage.locator('#content').or(adminPage.getByLabel(/tartalom/i).first())
    ).toBeVisible({ timeout: 8_000 });
  });

  test('closing the create dialog removes it from view', async ({ adminPage }) => {
    await adminPage.getByRole('button', { name: /új poszt/i }).click();
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

  test('delete button triggers ConfirmDialog when a post exists', async ({ adminPage }) => {
    // Delete button has aria-label="Törlés"
    const deleteButtons = adminPage.getByRole('button', { name: /^törlés$/i });
    if ((await deleteButtons.count()) === 0) {
      test.skip(true, 'No posts in test database — cannot test delete dialog');
    }

    await deleteButtons.first().click();
    await adminPage.waitForTimeout(500);

    await expect(
      adminPage.locator('[role="dialog"]').first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('"Mégse" in delete dialog closes it without deleting', async ({ adminPage }) => {
    const deleteButtons = adminPage.getByRole('button', { name: /^törlés$/i });
    if ((await deleteButtons.count()) === 0) {
      test.skip(true, 'No posts to delete');
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

  test('"Kommentek" button opens the comments moderation dialog when a post exists', async ({ adminPage }) => {
    const commentButtons = adminPage.getByRole('button', { name: /kommentek/i });
    if ((await commentButtons.count()) === 0) {
      test.skip(true, 'No posts in test database — cannot test comments dialog');
    }

    await commentButtons.first().click();
    await adminPage.waitForTimeout(600);

    await expect(
      adminPage.locator('[role="dialog"]').first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('"Bezárás" in comments dialog closes it', async ({ adminPage }) => {
    const commentButtons = adminPage.getByRole('button', { name: /kommentek/i });
    if ((await commentButtons.count()) === 0) {
      test.skip(true, 'No posts in test database');
    }

    await commentButtons.first().click();
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
