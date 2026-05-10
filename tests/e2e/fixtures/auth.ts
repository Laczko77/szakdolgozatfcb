/* eslint-disable react-hooks/rules-of-hooks */
/**
 * Shared auth fixture for FC Barcelona Szurkolói Portál E2E tests.
 *
 * Provides pre-authenticated browser contexts for a regular user and an admin.
 * Each fixture creates its own isolated BrowserContext so tests never share
 * cookies and cannot interfere with each other's session.
 *
 * Required environment variables (see tests/e2e/README.md):
 *   TEST_USER_EMAIL      - email of a regular (role=user) test account
 *   TEST_USER_PASSWORD   - password of that account
 *   TEST_ADMIN_EMAIL     - email of an admin (role=admin) test account
 *   TEST_ADMIN_PASSWORD  - password of that account
 *   BASE_URL             - defaults to http://localhost:3000
 */

import { test as base, expect, type Page, type BrowserContext } from '@playwright/test';

type AuthFixtures = {
  userPage: Page;
  adminPage: Page;
  userContext: BrowserContext;
  adminContext: BrowserContext;
};

export const test = base.extend<AuthFixtures>({
  userContext: async ({ browser }, use) => {
    const context = await browser.newContext();
    await use(context);
    await context.close();
  },

  adminContext: async ({ browser }, use) => {
    const context = await browser.newContext();
    await use(context);
    await context.close();
  },

  userPage: async ({ userContext }, use) => {
    const page = await userContext.newPage();
    await loginAs(page, {
      email: process.env.TEST_USER_EMAIL!,
      password: process.env.TEST_USER_PASSWORD!,
    });
    await use(page);
  },

  adminPage: async ({ adminContext }, use) => {
    const page = await adminContext.newPage();
    await loginAs(page, {
      email: process.env.TEST_ADMIN_EMAIL!,
      password: process.env.TEST_ADMIN_PASSWORD!,
    });
    await use(page);
  },
});

export { expect };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Log in via the /login form and wait for navigation to /dashboard.
 * Throws if the login fails so tests fail fast with a clear message.
 */
export async function loginAs(
  page: Page,
  credentials: { email: string; password: string },
): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(credentials.email);
  await page.getByLabel('Jelszó', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Belépés', exact: true }).click();
  await page.waitForURL('**/dashboard', { timeout: 15_000 });
}

/**
 * Log out the currently-logged-in user.
 * Looks for any "Kijelentkezés" trigger in the page (navbar dropdown or sidebar).
 */
export async function logout(page: Page): Promise<void> {
  // The navbar has a user menu button — click it to open, then click logout.
  // We try two known patterns; the test fails if neither is found.
  // Open the UserMenu dropdown (aria-label="Felhasználói menü")
  const menuTrigger = page.getByRole('button', { name: 'Felhasználói menü' });
  await menuTrigger.waitFor({ state: 'visible', timeout: 10_000 });
  await menuTrigger.click();
  // The logout item has role="menuitem" not "button"
  const logoutItem = page.getByRole('menuitem', { name: 'Kijelentkezés', exact: true });
  await logoutItem.waitFor({ state: 'visible', timeout: 5_000 });
  await logoutItem.click();
  await page.waitForURL(/\/login/, { timeout: 10_000 });
}
