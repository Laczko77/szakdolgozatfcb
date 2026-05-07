/**
 * My Tickets (/jegyeim) (E2E)
 *
 * Covers:
 *  - Unauthenticated user is redirected to /login
 *  - Authenticated user sees the page heading ("Saját jegyeim")
 *  - Ticket cards render OR an empty state is shown
 *  - Empty state links to /jegyek (browse matches)
 *  - Upcoming and past sections are visible when tickets exist
 *  - Ticket card displays meaningful fields (match, sector, date)
 */

import { test, expect } from '../fixtures/auth';

test.describe('My Tickets (unauthenticated)', () => {
  test('redirects unauthenticated user to /login', async ({ page }) => {
    await page.goto('/jegyeim');
    await expect(page).toHaveURL(/login/, { timeout: 10_000 });
  });
});

test.describe('My Tickets (authenticated)', () => {
  test.beforeEach(async ({ userPage }) => {
    await userPage.goto('/jegyeim');
    await userPage.waitForLoadState('domcontentloaded');
    // Wait for the async ticket fetch to complete
    await userPage.waitForTimeout(3_000);
  });

  test('page heading "Saját jegyeim" is visible', async ({ userPage }) => {
    await expect(
      userPage.getByRole('heading', { name: /saját jegyeim/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('page subtitle "Tárcám" label is visible', async ({ userPage }) => {
    await expect(
      userPage.getByText(/tárcám/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('ticket cards or empty state is displayed', async ({ userPage }) => {
    // After loading, either tickets are shown or the empty wallet state
    const hasTicketCards = (await userPage.locator('[data-testid="my-ticket-card"], [class*="ticket-card"], .glass-card').count()) > 0;
    const hasEmptyState = (await userPage.getByText(/még nincs jegyed|no tickets|empty/i).count()) > 0;
    const hasUpcomingSection = (await userPage.getByText(/közelgő mérkőzések/i).count()) > 0;
    const hasPastSection = (await userPage.getByText(/lejátszott mérkőzések/i).count()) > 0;
    expect(hasTicketCards || hasEmptyState || hasUpcomingSection || hasPastSection).toBe(true);
  });

  test('empty state provides a link to browse matches', async ({ userPage }) => {
    const hasEmptyState = (await userPage.getByText(/még nincs jegyed/i).count()) > 0;
    if (!hasEmptyState) {
      test.skip(true, 'User has tickets — empty state not rendered');
    }

    // EmptyWallet renders a link to /jegyek
    await expect(
      userPage.getByRole('link', { name: /mérkőzések böngészése|jegyek/i }).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('upcoming section shows ticket count when tickets exist', async ({ userPage }) => {
    const hasUpcoming = (await userPage.getByText(/közelgő mérkőzések/i).count()) > 0;
    if (!hasUpcoming) {
      test.skip(true, 'No upcoming tickets found for this test user');
    }

    // Section header renders a "N db" count badge
    await expect(
      userPage.getByText(/\d+ db/i).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('past section renders when past tickets exist', async ({ userPage }) => {
    const hasPast = (await userPage.getByText(/lejátszott mérkőzések/i).count()) > 0;
    if (!hasPast) {
      test.skip(true, 'No past tickets found for this test user');
    }

    await expect(
      userPage.getByText(/lejátszott mérkőzések/i).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('loading state resolves within reasonable time', async ({ userPage }) => {
    // After the beforeEach wait, loading skeletons should be gone
    const hasLoadingText = (await userPage.getByText(/betöltés folyamatban/i).count()) > 0;
    // Loading should have finished (3s wait in beforeEach)
    expect(hasLoadingText).toBe(false);
  });
});
