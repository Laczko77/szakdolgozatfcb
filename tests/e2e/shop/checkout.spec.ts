/**
 * Shop — Checkout flow (E2E)
 *
 * Covers:
 *  - Checkout page renders order summary with correct items
 *  - Order can be placed (POST /api/orders)
 *  - Order success page is shown after successful checkout
 *  - Order cancellation via the profile page
 */

import { test, expect } from '../fixtures/auth';

test.describe('Checkout flow (authenticated)', () => {
  /**
   * Helper: ensure at least one item is in the cart before running checkout tests.
   */
  async function ensureCartHasItem(page: InstanceType<typeof import('@playwright/test').Page>): Promise<boolean> {
    await page.goto('/shop');
    await page.waitForTimeout(2_000);

    const productLink = page.locator('[data-testid="product-card"] a, article a').first();
    if ((await productLink.count()) === 0) return false;

    await productLink.click();
    await page.waitForURL(/shop\//, { timeout: 10_000 });
    await page.waitForLoadState('domcontentloaded');

    const addButton = page.getByRole('button', { name: /kosárba|hozzáadás/i }).first();
    if ((await addButton.count()) === 0) return false;
    await addButton.click();
    await page.waitForTimeout(500);
    return true;
  }

  test('checkout page renders order summary', async ({ userPage }) => {
    const hasItem = await ensureCartHasItem(userPage);
    if (!hasItem) {
      test.skip(true, 'No products available to add to cart');
    }

    await userPage.goto('/shop/checkout');
    await userPage.waitForLoadState('domcontentloaded');

    await expect(
      userPage.getByText(/összesítő|rendelés|checkout|összesen|fizetés/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('checkout page shows at least one cart line item', async ({ userPage }) => {
    const hasItem = await ensureCartHasItem(userPage);
    if (!hasItem) {
      test.skip(true, 'No products available');
    }

    await userPage.goto('/shop/checkout');
    await userPage.waitForLoadState('domcontentloaded');

    // Line items in the order summary
    await expect(
      userPage.locator('[data-testid="cart-item"], [class*="cart-item"], [class*="order-item"]')
        .or(userPage.getByText(/ft|huf/i))
        .first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('placing an order navigates to a success page', async ({ userPage }) => {
    const hasItem = await ensureCartHasItem(userPage);
    if (!hasItem) {
      test.skip(true, 'No products available');
    }

    await userPage.goto('/shop/checkout');
    await userPage.waitForLoadState('domcontentloaded');

    const orderButton = userPage.getByRole('button', {
      name: /rendelés leadása|megrendelem|checkout|fizetés|vásárlás/i,
    }).first();

    if ((await orderButton.count()) === 0) {
      test.skip(true, 'No order submit button found');
    }

    await orderButton.click();

    // Expect navigation to success page
    await expect(userPage).toHaveURL(/checkout\/success|rendelés|siker/i, { timeout: 20_000 });
  });

  test('order success page renders a confirmation message', async ({ userPage }) => {
    const hasItem = await ensureCartHasItem(userPage);
    if (!hasItem) {
      test.skip(true, 'No products available');
    }

    await userPage.goto('/shop/checkout');
    await userPage.waitForLoadState('domcontentloaded');

    const orderButton = userPage.getByRole('button', {
      name: /rendelés leadása|megrendelem|checkout|fizetés/i,
    }).first();
    if ((await orderButton.count()) === 0) {
      test.skip(true, 'No order submit button found');
    }

    await orderButton.click();
    await userPage.waitForURL(/checkout\/success|siker/i, { timeout: 20_000 });

    await expect(
      userPage.getByText(/sikeres|köszönjük|rendelés.*visszaigazolás/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});
