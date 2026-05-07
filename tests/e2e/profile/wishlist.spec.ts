/**
 * Wishlist (/wishlist) (E2E)
 *
 * Covers:
 *  - Unauthenticated user is redirected to /login
 *  - Authenticated user sees the page heading
 *  - Wishlist items are shown OR empty state is rendered
 *  - Empty state provides a link back to /shop
 *  - Remove button (Trash icon) is present on wishlist items
 *  - Clicking a wishlist item navigates to the product page
 *  - Removing an item triggers a success toast
 */

import { test, expect } from '../fixtures/auth';

test.describe('Wishlist (unauthenticated)', () => {
  test('redirects unauthenticated user to /login', async ({ page }) => {
    await page.goto('/wishlist');
    await expect(page).toHaveURL(/login/, { timeout: 10_000 });
  });
});

test.describe('Wishlist (authenticated)', () => {
  test.beforeEach(async ({ userPage }) => {
    await userPage.goto('/wishlist');
    await userPage.waitForLoadState('domcontentloaded');
    // Give the CartProvider wishlist fetch time to resolve
    await userPage.waitForTimeout(2_500);
  });

  test('page heading is visible', async ({ userPage }) => {
    // h1 = "Amit majd elviszel"; eyebrow = "Kívánságlista"
    await expect(
      userPage.getByRole('heading', { level: 1 }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('wishlist items are shown or empty state renders', async ({ userPage }) => {
    // Check for wishlist product links (not navbar ul/li which always exist)
    const hasItems = (await userPage.locator('a[href*="/shop/"]').count()) > 0;
    const hasEmpty = (await userPage.getByText(/még nincs kívánságod|no wishlist items/i).count()) > 0;
    expect(hasItems || hasEmpty).toBe(true);
  });

  test('empty state provides a "Tovább a shopba" link', async ({ userPage }) => {
    const hasEmpty = (await userPage.getByText(/még nincs kívánságod/i).count()) > 0;
    if (!hasEmpty) {
      test.skip(true, 'Wishlist has items — empty state not rendered');
    }

    await expect(
      userPage.getByRole('link', { name: /tovább a shopba|shopba/i }).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('remove button (trash icon) is visible on wishlist items', async ({ userPage }) => {
    // Check for actual remove buttons, not navbar ul/li items
    const hasRemoveButton = (await userPage.getByRole('button', { name: /eltávolítás a kívánságlistáról/i }).count()) > 0;
    if (!hasRemoveButton) {
      test.skip(true, 'No wishlist items found — skipping remove button test');
    }

    // The Trash2 button has aria-label="Eltávolítás a kívánságlistáról"
    await expect(
      userPage.getByRole('button', { name: /eltávolítás a kívánságlistáról/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('clicking a wishlist item navigates to the product page', async ({ userPage }) => {
    // Check for actual product links in wishlist (not navbar links to /shop)
    const hasItems = (await userPage.locator('a[href*="/shop/"]').count()) > 0;
    if (!hasItems) {
      test.skip(true, 'No wishlist items found — skipping navigation test');
    }

    // Each card is a Link to /shop/:id
    const productLink = userPage.locator('a[href*="/shop/"]').first();
    if ((await productLink.count()) === 0) {
      test.skip(true, 'No product links found in wishlist');
    }

    await productLink.click();
    await expect(userPage).toHaveURL(/shop\//, { timeout: 10_000 });
  });

  test('removing a wishlist item shows success toast', async ({ userPage }) => {
    const hasItems = (await userPage.getByRole('button', { name: /eltávolítás a kívánságlistáról/i }).count()) > 0;
    if (!hasItems) {
      test.skip(true, 'No wishlist items to remove');
    }

    const removeButton = userPage
      .getByRole('button', { name: /eltávolítás a kívánságlistáról/i })
      .first();

    if ((await removeButton.count()) === 0) {
      test.skip(true, 'No remove button found');
    }

    await removeButton.click();
    await userPage.waitForTimeout(1_000);

    // Toast should confirm removal
    await expect(
      userPage.getByText(/eltávolítva|removed|kívánságlistáról/i).first()
    ).toBeVisible({ timeout: 8_000 });
  });
});
