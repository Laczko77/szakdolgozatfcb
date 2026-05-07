/**
 * Auth — Logout (E2E)
 *
 * Verifies that a logged-in user can sign out and is redirected to /login
 * or the home page, and that protected routes are no longer accessible
 * after logout.
 */

import { test, expect } from '../fixtures/auth';

/** Open the UserMenu dropdown and click Kijelentkezés. */
async function clickLogout(page: import('@playwright/test').Page): Promise<void> {
  // The UserMenu trigger has aria-label="Felhasználói menü"
  const trigger = page.getByRole('button', { name: 'Felhasználói menü' });
  await trigger.waitFor({ state: 'visible', timeout: 10_000 });
  await trigger.click();
  // The dropdown animates in — the logout item has role="menuitem"
  const logoutBtn = page.getByRole('menuitem', { name: 'Kijelentkezés', exact: true });
  await logoutBtn.waitFor({ state: 'visible', timeout: 5_000 });
  await logoutBtn.click();
}

test.describe('Logout', () => {
  test('logged-in user can log out via navbar', async ({ userPage }) => {
    await expect(userPage).toHaveURL(/dashboard/);
    await clickLogout(userPage);
    await expect(userPage).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('protected /dashboard route redirects to /login after logout', async ({ userPage }) => {
    await clickLogout(userPage);
    await userPage.waitForURL(/\/login/, { timeout: 10_000 });
    await userPage.goto('/dashboard');
    await expect(userPage).toHaveURL(/login/, { timeout: 8_000 });
  });
});
