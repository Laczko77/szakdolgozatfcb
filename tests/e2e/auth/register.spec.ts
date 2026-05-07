/**
 * Auth — Registration (E2E)
 *
 * Covers:
 *  - Form renders correctly
 *  - Client-side validation: empty fields, weak password, mismatch confirm
 *  - Password min-length rule (8 chars)
 *  - After submit shows "check your inbox" state (email-confirm flow)
 *  - Login link navigates back to /login
 *  - Google OAuth button present
 */

import { test, expect } from '@playwright/test';

test.describe('Registration page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
  });

  test('renders registration form with all fields', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /csatlakozás|regisztráció/i })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Jelszó', { exact: false }).first()).toBeVisible();
    await expect(page.getByLabel(/jelszó megerősítése/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Regisztráció', exact: true })).toBeVisible();
  });

  test('shows validation errors on empty submission', async ({ page }) => {
    await page.getByRole('button', { name: 'Regisztráció', exact: true }).click();
    await expect(page.getByText(/add meg az email/i)).toBeVisible();
    await expect(page.getByText(/adj meg egy jelszót/i)).toBeVisible();
    await expect(page.getByText(/erősítsd meg a jelszót/i)).toBeVisible();
  });

  test('enforces minimum 8-character password', async ({ page }) => {
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Jelszó', { exact: false }).first().fill('short');
    await page.getByLabel(/jelszó megerősítése/i).fill('short');
    await page.getByRole('button', { name: 'Regisztráció', exact: true }).click();
    await expect(page.getByText(/legalább 8 karakter/i)).toBeVisible();
  });

  test('shows error when passwords do not match', async ({ page }) => {
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Jelszó', { exact: false }).first().fill('Password123!');
    await page.getByLabel(/jelszó megerősítése/i).fill('DifferentPass123!');
    await page.getByRole('button', { name: 'Regisztráció', exact: true }).click();
    await expect(page.getByText(/a két jelszó nem egyezik/i)).toBeVisible();
  });

  test('shows invalid email error', async ({ page }) => {
    await page.getByLabel('Email').fill('notvalid');
    await page.getByLabel('Jelszó', { exact: false }).first().fill('Password123!');
    await page.getByLabel(/jelszó megerősítése/i).fill('Password123!');
    await page.getByRole('button', { name: 'Regisztráció', exact: true }).click();
    await expect(page.getByText(/érvénytelen email/i)).toBeVisible();
  });

  test('login link navigates to /login', async ({ page }) => {
    await page.getByRole('link', { name: /jelentkezz be/i }).click();
    await expect(page).toHaveURL(/login/);
  });

  test('Google OAuth button is present and enabled', async ({ page }) => {
    await expect(page.getByRole('button', { name: /google/i })).toBeEnabled();
  });

  test('successful submission with unique email shows email-sent state or logs in', async ({ page }) => {
    // Skip unless ALLOW_REGISTRATION_TEST=1 is set — this test creates a real Supabase account.
    test.skip(!process.env.ALLOW_REGISTRATION_TEST, 'Skipped by default — set ALLOW_REGISTRATION_TEST=1 to run (creates a real DB account)');
    // Use a timestamped email so the account does not exist in the database.
    // Two outcomes are valid:
    //   A) Email confirmation required → "Ellenőrizd a postaládádat" screen
    //   B) Auto-confirm enabled → immediate redirect to /dashboard
    const uniqueEmail = `playwright-test-${Date.now()}@example.com`;
    await page.getByLabel('Email').fill(uniqueEmail);
    await page.getByLabel('Jelszó', { exact: false }).first().fill('PlaywrightTest123!');
    await page.getByLabel(/jelszó megerősítése/i).fill('PlaywrightTest123!');
    await page.getByRole('button', { name: 'Regisztráció', exact: true }).click();

    // Accept either outcome: confirmation screen OR dashboard redirect
    await Promise.race([
      page.getByText(/ellenőrizd a postaládádat|küldtünk.*emailt/i).waitFor({ timeout: 15_000 }),
      page.waitForURL('**/dashboard', { timeout: 15_000 }),
    ]);
    // Either the confirmation text is visible, or we're on the dashboard
    const onDashboard = page.url().includes('/dashboard');
    const hasConfirmation = await page.getByText(/ellenőrizd a postaládádat|küldtünk.*emailt/i).count() > 0;
    expect(onDashboard || hasConfirmation).toBe(true);
  });
});
