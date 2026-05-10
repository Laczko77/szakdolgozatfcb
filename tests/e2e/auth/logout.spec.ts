/**
 * Auth — Logout (E2E)
 *
 * Verifies that a logged-in user can sign out and is redirected to the
 * landing page (/), and that protected routes are no longer accessible
 * after logout.
 *
 * Implementation note:
 *  - AuthProvider.signOut() calls router.push("/") — the landing page.
 *    After logout, the user lands on "/" NOT "/login".
 *  - Navigating to a protected route (e.g. /dashboard) after logout
 *    triggers the middleware redirect to /login.
 */

import { test, expect } from '../fixtures/auth';

/** Open the UserMenu dropdown and click "Kijelentkezés". */
async function clickLogout(page: import('@playwright/test').Page): Promise<void> {
  // The UserMenu trigger has aria-label="Felhasználói menü"
  const trigger = page.getByRole('button', { name: 'Felhasználói menü' });
  await trigger.waitFor({ state: 'visible', timeout: 10_000 });
  await trigger.click();
  // The dropdown animates in — the logout button has role="menuitem"
  const logoutBtn = page.getByRole('menuitem', { name: 'Kijelentkezés', exact: true });
  await logoutBtn.waitFor({ state: 'visible', timeout: 5_000 });
  await logoutBtn.click();
}

test.describe('Logout', () => {
  test('logged-in user can log out via the navbar UserMenu', async ({ userPage }) => {
    await expect(userPage).toHaveURL(/dashboard/);
    await clickLogout(userPage);
    // AuthProvider.signOut() → router.push("/") → landing page
    await expect(userPage).toHaveURL(/^https?:\/\/[^/]+\/?$/, { timeout: 10_000 });
  });

  test('protected /dashboard route redirects to /login after logout', async ({ userPage }) => {
    await clickLogout(userPage);
    // Wait for the landing page to load
    await userPage.waitForURL(/^https?:\/\/[^/]+\/?$/, { timeout: 10_000 });
    // Attempt to visit a protected route
    await userPage.goto('/dashboard');
    // Middleware redirects to /login (with ?redirect=/dashboard)
    await expect(userPage).toHaveURL(/login/, { timeout: 8_000 });
  });

  test('protected /profil route redirects to /login after logout', async ({ userPage }) => {
    await clickLogout(userPage);
    await userPage.waitForURL(/^https?:\/\/[^/]+\/?$/, { timeout: 10_000 });
    await userPage.goto('/profil');
    await expect(userPage).toHaveURL(/login/, { timeout: 8_000 });
  });
});
