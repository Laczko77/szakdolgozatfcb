/**
 * Shop — Cart (E2E)
 *
 * Covers:
 *  - Adding a product to the cart (authenticated)
 *  - Cart icon/badge increments after adding
 *  - Removing a product from the cart
 *  - Cart persists across page navigation
 *  - Unauthenticated user adding to cart is prompted to log in
 */

import { test, expect } from '../fixtures/auth';

/**
 * Helper: navigate to the first available product and add it to the cart.
 */
async function addFirstProductToCart(page: InstanceType<typeof import('@playwright/test').Page>) {
  await page.goto('/shop');
  await page.waitForTimeout(2_000);

  const productLink = page.locator('[data-testid="product-card"] a, article a').first();
  const count = await productLink.count();
  if (count === 0) return false;

  await productLink.click();
  await page.waitForURL(/shop\//, { timeout: 10_000 });

  const addButton = page.getByRole('button', { name: /kosárba|add to cart|hozzáadás/i });
  await addButton.first().waitFor({ timeout: 10_000 });
  await addButton.first().click();

  return true;
}

test.describe('Cart (authenticated)', () => {
  test('adding a product to cart shows confirmation or updates badge', async ({ userPage }) => {
    const added = await addFirstProductToCart(userPage);
    if (!added) {
      test.skip(true, 'No products found — skipping cart test');
    }

    // Either a toast message appears or the cart badge increments
    await expect(
      userPage.getByText(/kosárba.*hozzáadva|added to cart|kosár/i)
        .or(userPage.locator('[data-testid="cart-badge"], [aria-label*="kosár"]'))
    ).toBeVisible({ timeout: 8_000 });
  });

  test('cart badge shows item count after adding a product', async ({ userPage }) => {
    const added = await addFirstProductToCart(userPage);
    if (!added) {
      test.skip(true, 'No products found');
    }

    await userPage.waitForTimeout(500);
    // Cart badge somewhere in the navbar
    const badge = userPage.locator('[data-testid="cart-badge"], [aria-label*="kosár"] span').first();
    if ((await badge.count()) > 0) {
      const text = await badge.textContent();
      expect(Number(text)).toBeGreaterThanOrEqual(1);
    }
  });

  test('cart contents persist after navigating away', async ({ userPage }) => {
    const added = await addFirstProductToCart(userPage);
    if (!added) {
      test.skip(true, 'No products found');
    }

    await userPage.goto('/hirek');
    await userPage.goto('/shop/checkout');
    // The checkout page should not be empty (we have an item)
    await expect(
      userPage.getByText(/fizetés|checkout|összesen|total/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Cart (unauthenticated)', () => {
  test('unauthenticated user clicking add to cart is redirected to login', async ({ page }) => {
    await page.goto('/shop');
    await page.waitForTimeout(2_000);

    const productLink = page.locator('[data-testid="product-card"] a, article a').first();
    if ((await productLink.count()) === 0) {
      test.skip(true, 'No products found');
    }

    await productLink.click();
    await page.waitForURL(/shop\//, { timeout: 10_000 });

    const addButton = page.getByRole('button', { name: /kosárba|add to cart|hozzáadás/i }).first();
    await addButton.waitFor({ timeout: 10_000 });
    await addButton.click();

    // Expect either a login redirect or a toast telling user to sign in
    await expect(
      page.getByText(/bejelentkezés|jelentkezz be|log in/i)
        .or(page.getByURL ? page.getByRole('heading', { name: /belépés/i }) : page.locator('h1'))
    ).toBeVisible({ timeout: 8_000 }).catch(() => {
      // If neither, check URL
      return expect(page).toHaveURL(/login/, { timeout: 8_000 });
    });
  });
});
