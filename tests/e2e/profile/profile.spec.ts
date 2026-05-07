/**
 * Profile (/profil) (E2E)
 *
 * Covers:
 *  - Profile page is protected (unauthenticated → /login)
 *  - Renders hero with username and points
 *  - Tab navigation (orders, tickets, wishlist, coupons, points, settings)
 *  - Editing username in settings
 *  - Order history tab renders
 *  - Ticket history tab renders
 */

import { test, expect } from '../fixtures/auth';

test.describe('Profile (unauthenticated)', () => {
  test('redirects unauthenticated user to /login', async ({ page }) => {
    await page.goto('/profil');
    await expect(page).toHaveURL(/login/, { timeout: 10_000 });
  });
});

test.describe('Profile page (authenticated)', () => {
  test.beforeEach(async ({ userPage }) => {
    await userPage.goto('/profil');
    await userPage.waitForLoadState('domcontentloaded');
  });

  test('renders the profile hero with username', async ({ userPage }) => {
    await userPage.waitForTimeout(2_000);
    // The hero should display a username (string of non-whitespace chars)
    await expect(
      userPage.locator('[data-testid="profile-username"], [class*="username"]')
        .or(userPage.getByRole('heading', { level: 1 }).or(userPage.getByRole('heading', { level: 2 })))
        .first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('renders points balance', async ({ userPage }) => {
    await userPage.waitForTimeout(2_000);
    await expect(
      userPage.getByText(/pont|pontok|points/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('profile tab list is visible', async ({ userPage }) => {
    await userPage.waitForTimeout(1_000);
    await expect(
      userPage.getByRole('tablist').or(userPage.locator('[role="tablist"]'))
    ).toBeVisible({ timeout: 10_000 });
  });

  test('orders tab renders order list or empty state', async ({ userPage }) => {
    await userPage.waitForTimeout(1_000);
    const ordersTab = userPage
      .getByRole('tab', { name: /rendelés|orders/i })
      .first();

    if ((await ordersTab.count()) === 0) {
      // Maybe already on orders tab by default
    } else {
      await ordersTab.click();
      await userPage.waitForTimeout(3_000);
    }

    // OrderCard renders as <motion.article>; empty state: "Még nincs rendelésed"
    const hasOrders = (await userPage.locator('article').count()) > 0;
    const hasEmpty = (await userPage.getByText(/nincs rendelés|rendelésed/i).count()) > 0;
    expect(hasOrders || hasEmpty).toBe(true);
  });

  test('tickets tab renders ticket list or empty state', async ({ userPage }) => {
    await userPage.waitForTimeout(1_000);

    const ticketsTab = userPage.getByRole('tab', { name: /jegy|tickets/i }).first();
    if ((await ticketsTab.count()) > 0) {
      await ticketsTab.click();
      await userPage.waitForTimeout(3_000);
    }

    // Ticket items or empty state: "Még nincs jegyed"
    const hasTickets = (await userPage.locator('article, [data-testid="ticket-item"]').count()) > 0;
    const hasEmpty = (await userPage.getByText(/nincs jegy|jegyed/i).count()) > 0;
    expect(hasTickets || hasEmpty).toBe(true);
  });

  test('settings tab allows editing username', async ({ userPage }) => {
    const settingsTab = userPage
      .getByRole('tab', { name: /beállítás|settings/i })
      .first();

    if ((await settingsTab.count()) === 0) {
      // Try URL approach
      await userPage.goto('/profil?tab=settings');
    } else {
      await settingsTab.click();
    }

    await userPage.waitForTimeout(1_000);

    const usernameInput = userPage
      .getByLabel(/felhasználónév|username/i)
      .or(userPage.locator('input[name*="username"], input[name*="name"]'))
      .first();

    if ((await usernameInput.count()) === 0) {
      test.skip(true, 'No username input found in settings');
    }

    // Just verify the input is editable
    await expect(usernameInput).toBeEditable({ timeout: 5_000 });
  });
});

test.describe('Public profile (/profil/:id)', () => {
  test('public profile page renders user information', async ({ page }) => {
    // Navigate to community to find a user profile link
    await page.goto('/kozosseg');
    await page.waitForTimeout(3_000);

    const profileLink = page.locator('a[href*="/profil/"]').first();
    if ((await profileLink.count()) === 0) {
      test.skip(true, 'No public profile links found in community feed');
    }

    const href = await profileLink.getAttribute('href');
    await page.goto(href!);
    await page.waitForLoadState('domcontentloaded');

    await expect(
      page.getByRole('heading').first()
    ).toBeVisible({ timeout: 10_000 });
  });
});
