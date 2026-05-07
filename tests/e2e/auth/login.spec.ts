/**
 * Auth — Login (E2E)
 *
 * Covers:
 *  - Happy path: valid credentials → redirect to /dashboard
 *  - Field validation: empty form, invalid email format
 *  - Wrong credentials → Hungarian error message
 *  - Already-authenticated user is bounced away from /login
 *  - Google OAuth button is visible (actual OAuth flow is untested — requires
 *    a live Google consent screen which cannot be automated in CI)
 */

import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth';

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('renders the login form', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /belépés/i })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Jelszó', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Belépés', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /google/i })).toBeVisible();
  });

  test('shows validation error for empty form submission', async ({ page }) => {
    await page.getByRole('button', { name: 'Belépés', exact: true }).click();
    await expect(page.getByText(/add meg az email/i)).toBeVisible();
    await expect(page.getByText(/add meg a jelszavad/i)).toBeVisible();
  });

  test('shows validation error for invalid email format', async ({ page }) => {
    await page.getByLabel('Email').fill('notanemail');
    await page.getByLabel('Jelszó', { exact: true }).fill('somepassword');
    await page.getByRole('button', { name: 'Belépés', exact: true }).click();
    await expect(page.getByText(/érvénytelen email/i)).toBeVisible();
  });

  test('shows Hungarian error for wrong credentials', async ({ page }) => {
    await page.getByLabel('Email').fill('wrong@example.com');
    await page.getByLabel('Jelszó', { exact: true }).fill('WrongPassword123!');
    await page.getByRole('button', { name: 'Belépés', exact: true }).click();
    // Wait for the API call to complete
    await expect(
      page.getByRole('alert').or(page.getByText(/hibás email|hibás jelszó|érvénytelen/i))
    ).toBeVisible({ timeout: 10_000 });
  });

  test('happy path: valid user credentials redirect to /dashboard', async ({ page }) => {
    const email = process.env.TEST_USER_EMAIL;
    const password = process.env.TEST_USER_PASSWORD;
    if (!email || !password) {
      test.skip(!email || !password, 'TEST_USER_EMAIL / TEST_USER_PASSWORD env vars not set');
    }
    await page.getByLabel('Email').fill(email!);
    await page.getByLabel('Jelszó', { exact: true }).fill(password!);
    await page.getByRole('button', { name: 'Belépés', exact: true }).click();
    await page.waitForURL('**/dashboard', { timeout: 15_000 });
    await expect(page).toHaveURL(/dashboard/);
  });

  test('already-authenticated user is redirected away from /login', async ({ browser }) => {
    const email = process.env.TEST_USER_EMAIL;
    const password = process.env.TEST_USER_PASSWORD;
    if (!email || !password) {
      test.skip(!email || !password, 'TEST_USER_EMAIL / TEST_USER_PASSWORD env vars not set');
    }
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAs(page, { email: email!, password: password! });
    // Navigate to /login while authenticated
    await page.goto('/login');
    // Should be bounced to /dashboard
    await expect(page).toHaveURL(/dashboard/, { timeout: 8_000 });
    await context.close();
  });

  test('registration link leads to /register', async ({ page }) => {
    await page.getByRole('link', { name: /regisztrálj/i }).click();
    await expect(page).toHaveURL(/register/);
  });

  test('Google OAuth button is present and not disabled', async ({ page }) => {
    const googleBtn = page.getByRole('button', { name: /google/i });
    await expect(googleBtn).toBeEnabled();
  });
});
