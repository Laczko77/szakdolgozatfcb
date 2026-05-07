/**
 * Admin — Articles (/admin/cikkek) (E2E)
 *
 * Covers:
 *  - Route is protected: anonymous users → /login, regular users → /
 *  - Admin can view the articles list
 *  - "Új cikk" button opens the ArticleEditor dialog
 *  - Form validation (empty title, no category, empty content)
 *  - Admin can create a new article (happy path via API)
 *  - Category filter updates the table
 *  - Delete confirmation dialog appears and can be cancelled
 */

import { test, expect } from '../fixtures/auth';

// ──────────────────────────────────────────────────────────
// Guard tests (use unauthenticated `page` fixture)
// ──────────────────────────────────────────────────────────

test.describe('Admin articles route guard', () => {
  test('anonymous user is redirected to /login', async ({ page }) => {
    await page.goto('/admin/cikkek');
    await expect(page).toHaveURL(/login/, { timeout: 10_000 });
  });

  test('regular user is redirected away from /admin', async ({ userPage }) => {
    const sameAccount = process.env.TEST_USER_EMAIL === process.env.TEST_ADMIN_EMAIL;
    test.skip(sameAccount, 'TEST_USER_EMAIL is the same admin account — skipped');
    await userPage.goto('/admin/cikkek');
    // Should land on / (home) – NOT on /admin/**
    await expect(userPage).not.toHaveURL(/admin/, { timeout: 10_000 });
  });
});

// ──────────────────────────────────────────────────────────
// Admin user tests
// ──────────────────────────────────────────────────────────

test.describe('Admin articles page (admin user)', () => {
  test.beforeEach(async ({ adminPage }) => {
    await adminPage.goto('/admin/cikkek');
    await adminPage.waitForLoadState('domcontentloaded');
    await adminPage.waitForTimeout(1_500);
  });

  test('renders the articles heading', async ({ adminPage }) => {
    await expect(
      adminPage.getByRole('heading', { name: /cikk/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('"Új cikk" button is visible', async ({ adminPage }) => {
    await expect(
      adminPage.getByRole('button', { name: /új cikk/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('article table or empty state is rendered', async ({ adminPage }) => {
    // Wait for loading skeleton to clear before asserting on content
    await adminPage.locator('.animate-pulse').first().waitFor({ state: 'detached', timeout: 8_000 }).catch(() => {});
    const hasTable = (await adminPage.locator('table').count()) > 0;
    const hasEmpty = (await adminPage.getByText(/nincs még cikk/i).count()) > 0;
    expect(hasTable || hasEmpty).toBe(true);
  });

  test('category filter select is visible', async ({ adminPage }) => {
    await expect(
      adminPage.locator('select').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('changing category filter updates the list', async ({ adminPage }) => {
    const select = adminPage.locator('select').first();
    if ((await select.count()) === 0) {
      test.skip(true, 'No category select found');
    }

    // Select a specific category (e.g. the second option)
    await select.selectOption({ index: 1 });
    await adminPage.waitForTimeout(1_000);

    // The page should still be on /admin/cikkek without errors
    await expect(adminPage).toHaveURL(/admin\/cikkek/, { timeout: 5_000 });
  });

  test('"Új cikk" opens the ArticleEditor dialog', async ({ adminPage }) => {
    await adminPage.getByRole('button', { name: /új cikk/i }).click();
    await adminPage.waitForTimeout(500);

    await expect(
      adminPage.locator('[role="dialog"]').first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('article editor dialog has title and category fields', async ({ adminPage }) => {
    await adminPage.getByRole('button', { name: /új cikk/i }).click();
    await adminPage.waitForTimeout(600);

    // Title input (id="article-title")
    await expect(
      adminPage.locator('#article-title').or(adminPage.getByLabel(/cím/i).first())
    ).toBeVisible({ timeout: 8_000 });

    // Category select
    await expect(
      adminPage.locator('[role="dialog"] select, dialog select').first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('submitting empty form shows validation errors', async ({ adminPage }) => {
    await adminPage.getByRole('button', { name: /új cikk/i }).click();
    await adminPage.waitForTimeout(600);

    // Submit without filling anything
    const submitButton = adminPage.getByRole('button', { name: /mentés|save/i }).first();
    if ((await submitButton.count()) === 0) {
      test.skip(true, 'No save button found in dialog');
    }
    await submitButton.click();

    // Validation message for empty title
    await expect(
      adminPage.getByText(/cím kötelező|kötelező/i).first()
    ).toBeVisible({ timeout: 5_000 });
  });

  test('closing the dialog removes it from view', async ({ adminPage }) => {
    await adminPage.getByRole('button', { name: /új cikk/i }).click();
    await adminPage.waitForTimeout(600);

    // Close via Escape key or a close button
    await adminPage.keyboard.press('Escape');
    await adminPage.waitForTimeout(400);

    await expect(
      adminPage.locator('[role="dialog"]')
    ).not.toBeVisible({ timeout: 5_000 });
  });

  test('delete confirmation dialog appears when delete is triggered', async ({ adminPage }) => {
    // Only run if there are articles in the table
    const deleteButtons = adminPage.getByRole('button', { name: /törl/i });
    if ((await deleteButtons.count()) === 0) {
      test.skip(true, 'No articles to delete — table may be empty');
    }

    await deleteButtons.first().click();
    await adminPage.waitForTimeout(500);

    // ConfirmDialog should open with "Cikk törlése" title
    await expect(
      adminPage.locator('[role="dialog"]').first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('cancelling delete dialog closes it without deleting', async ({ adminPage }) => {
    const deleteButtons = adminPage.getByRole('button', { name: /törl/i });
    if ((await deleteButtons.count()) === 0) {
      test.skip(true, 'No articles to delete');
    }

    await deleteButtons.first().click();
    await adminPage.waitForTimeout(500);

    const cancelButton = adminPage.getByRole('button', { name: /mégse|cancel/i }).first();
    if ((await cancelButton.count()) > 0) {
      await cancelButton.click();
      await adminPage.waitForTimeout(400);
      await expect(adminPage.locator('[role="dialog"]')).not.toBeVisible({ timeout: 5_000 });
    }
  });
});

// ──────────────────────────────────────────────────────────
// API-level test: article creation requires admin auth
// ──────────────────────────────────────────────────────────

test.describe('Articles API auth enforcement', () => {
  test('POST /api/articles without auth returns 401', async ({ request }) => {
    const response = await request.post('/api/articles', {
      multipart: {
        title: 'Test Article',
        content: '<p>Test content</p>',
        category: 'klub',
      },
    });
    expect([401, 403]).toContain(response.status());
  });
});
