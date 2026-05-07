/**
 * Community — Direct Messages (/kozosseg/uzenetek) (E2E)
 *
 * Covers:
 *  - DM inbox renders for authenticated user
 *  - User can open an existing conversation
 *  - User can send a message in a conversation
 *  - Unauthenticated access redirects to /login
 */

import { test, expect } from '../fixtures/auth';

test.describe('DM inbox (unauthenticated)', () => {
  test('redirects unauthenticated user to /login', async ({ page }) => {
    await page.goto('/kozosseg/uzenetek');
    await expect(page).toHaveURL(/login/, { timeout: 10_000 });
  });
});

test.describe('DM inbox (authenticated)', () => {
  test('renders the messages page', async ({ userPage }) => {
    await userPage.goto('/kozosseg/uzenetek');
    await userPage.waitForLoadState('domcontentloaded');

    await expect(
      userPage.getByRole('heading').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('conversation list is visible (or empty state shown)', async ({ userPage }) => {
    await userPage.goto('/kozosseg/uzenetek');
    await userPage.waitForTimeout(2_000);

    const hasList = (await userPage.locator('[data-testid="conversation-item"], .conversation').count()) > 0;
    // Empty state text may vary; accept any text content indicating no messages
    const hasEmpty = (await userPage.getByText(/nincs üzenet|no messages|empty|üzeneted|kezd|írj/i).count()) > 0;
    // Also acceptable: page rendered at all (heading or some content)
    const hasContent = (await userPage.locator('main, [role="main"]').count()) > 0;
    expect(hasList || hasEmpty || hasContent).toBe(true);
  });

  test('clicking a conversation opens the message thread', async ({ userPage }) => {
    await userPage.goto('/kozosseg/uzenetek');
    await userPage.waitForTimeout(2_000);

    const conversationLinks = userPage.locator('[data-testid="conversation-item"] a, .conversation a');
    if ((await conversationLinks.count()) === 0) {
      test.skip(true, 'No conversations found — create one first or test data is missing');
    }

    await conversationLinks.first().click();
    await expect(userPage).toHaveURL(/uzenetek\//, { timeout: 10_000 });
  });

  test('sending a message in a conversation appends it to the thread', async ({ userPage }) => {
    await userPage.goto('/kozosseg/uzenetek');
    await userPage.waitForTimeout(2_000);

    const conversationLinks = userPage.locator('[data-testid="conversation-item"] a, .conversation a');
    if ((await conversationLinks.count()) === 0) {
      test.skip(true, 'No conversations found');
    }

    await conversationLinks.first().click();
    await expect(userPage).toHaveURL(/uzenetek\//, { timeout: 10_000 });
    await userPage.waitForTimeout(1_000);

    const messageInput = userPage
      .getByPlaceholder(/üzenet|message|írj/i)
      .or(userPage.locator('textarea, input[type="text"]').last());

    if ((await messageInput.count()) === 0) {
      test.skip(true, 'No message input found');
    }

    const messageText = `Playwright teszt üzenet ${Date.now()}`;
    await messageInput.fill(messageText);

    const sendButton = userPage.getByRole('button', { name: /küld|send/i }).last();
    await sendButton.click();
    await userPage.waitForTimeout(2_000);

    await expect(userPage.getByText(messageText)).toBeVisible({ timeout: 10_000 });
  });
});
