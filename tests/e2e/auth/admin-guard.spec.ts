/**
 * Auth — Admin route guard (E2E)
 *
 * Verifies that:
 *  - Anonymous users hitting /admin are redirected to /login with ?redirect=
 *  - Regular (non-admin) users hitting /admin are redirected to /
 *  - Admin users can access /admin
 */

import { test, expect } from '../fixtures/auth';

test.describe('Admin route guard', () => {
  test('anonymous user is redirected to /login with redirect param', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/login.*redirect.*admin/, { timeout: 8_000 });
  });

  test('regular user is redirected to home when hitting /admin', async ({ userPage }) => {
    // Skip when TEST_USER_EMAIL == TEST_ADMIN_EMAIL (single admin account used for both fixtures).
    // In that case the user IS admin and won't be redirected — this test requires a separate
    // non-admin test account to be meaningful.
    const sameAccount = process.env.TEST_USER_EMAIL === process.env.TEST_ADMIN_EMAIL;
    test.skip(sameAccount, 'TEST_USER_EMAIL is the same admin account — skipped (needs a separate non-admin account)');

    await userPage.goto('/admin');
    await expect(userPage).toHaveURL(/^https?:\/\/[^/]+\/?$/, { timeout: 8_000 });
  });

  test('admin user can access /admin dashboard', async ({ adminPage }) => {
    await adminPage.goto('/admin');
    // Should stay on /admin (not redirected)
    await expect(adminPage).toHaveURL(/admin/, { timeout: 8_000 });
    // The admin panel renders some admin-specific heading
    await expect(
      adminPage.getByText(/admin|kezelőpanel|vezérlőpult/i).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('admin can access /admin/cikkek (articles)', async ({ adminPage }) => {
    await adminPage.goto('/admin/cikkek');
    await expect(adminPage).toHaveURL(/admin\/cikkek/, { timeout: 8_000 });
  });

  test('admin can access /admin/termekek (products)', async ({ adminPage }) => {
    await adminPage.goto('/admin/termekek');
    await expect(adminPage).toHaveURL(/admin\/termekek/, { timeout: 8_000 });
  });

  test('admin can access /admin/rendelesek (orders)', async ({ adminPage }) => {
    await adminPage.goto('/admin/rendelesek');
    await expect(adminPage).toHaveURL(/admin\/rendelesek/, { timeout: 8_000 });
  });
});
