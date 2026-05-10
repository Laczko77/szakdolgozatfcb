/**
 * Shop — Checkout flow (E2E)
 *
 * Covers:
 *  - Checkout page renders the two-step flow (Szállítás → Összegzés)
 *  - Step 1: Shipping form renders all required fields
 *  - Step 1: Validation errors appear for empty submission
 *  - Step 1: "Tovább az összegzéshez" button advances to Step 2
 *  - Step 2: Order summary shows cart items and totals
 *  - Step 2: "Megrendelés (demo)" button places the order and navigates to success
 *  - Success page shows a confirmation message
 *
 * Implementation notes:
 *  - Checkout uses ProtectedRoute — unauthenticated users land on /login.
 *  - Empty cart auto-redirects to /shop (CartProvider effect).
 *  - The order button on Step 2 is labeled "Megrendelés (demo)".
 *  - Step 1 submit is "Tovább az összegzéshez" (inside a <form onSubmit>).
 *  - Each <Field> uses an <input id="{key}"> with a matching <label htmlFor>.
 *  - The coupon input has id="coupon".
 */

import { test, expect } from '../fixtures/auth';
import type { Page } from '@playwright/test';

/**
 * Navigate to /shop, add the first product to the cart, and return to
 * wherever we were.  Returns false if no products are found.
 */
async function addFirstProductToCart(page: Page): Promise<boolean> {
  await page.goto('/shop');
  await page.waitForTimeout(2_500);

  const productLinks = page.locator('a[href*="/shop/"]');
  if ((await productLinks.count()) === 0) return false;

  await productLinks.first().click();
  await page.waitForURL(/shop\/[^c]/, { timeout: 10_000 }); // /shop/:id (not /shop/checkout)
  await page.waitForLoadState('domcontentloaded');

  const addBtn = page.getByRole('button', { name: /kosárba/i }).first();
  if ((await addBtn.count()) === 0) return false;
  await addBtn.click();
  await page.waitForTimeout(600);
  return true;
}

/**
 * Fill the Step 1 shipping form and advance to Step 2.
 */
async function fillShippingAndAdvance(page: Page): Promise<void> {
  // Field IDs match the checkout page Field components: full_name, country, city, postal_code, street
  await page.locator('#full_name').fill('Teszt Felhasználó');
  await page.locator('#country').fill('Magyarország');
  await page.locator('#postal_code').fill('1051');
  await page.locator('#city').fill('Budapest');
  await page.locator('#street').fill('Vörösmarty tér 1.');

  await page.getByRole('button', { name: /tovább az összegzéshez/i }).click();
  await page.waitForTimeout(600);
}

// ---------------------------------------------------------------------------
// Unauthenticated
// ---------------------------------------------------------------------------

test.describe('Checkout (unauthenticated)', () => {
  test('unauthenticated user is redirected to /login', async ({ page }) => {
    await page.goto('/shop/checkout');
    await expect(page).toHaveURL(/login/, { timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// Authenticated — Step 1 (shipping form)
// ---------------------------------------------------------------------------

test.describe('Checkout Step 1 — Shipping form (authenticated)', () => {
  test('checkout page renders the shipping form on Step 1', async ({ userPage }) => {
    const hasItem = await addFirstProductToCart(userPage);
    if (!hasItem) {
      test.skip(true, 'No products available to add to cart');
    }

    await userPage.goto('/shop/checkout');
    await userPage.waitForLoadState('domcontentloaded');

    // Step 1 heading
    await expect(
      userPage.getByRole('heading', { name: /szállítási adatok/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('Step 1 renders required address fields', async ({ userPage }) => {
    const hasItem = await addFirstProductToCart(userPage);
    if (!hasItem) {
      test.skip(true, 'No products available');
    }

    await userPage.goto('/shop/checkout');
    await userPage.waitForLoadState('domcontentloaded');

    // Each Field renders <input id="{key}">
    await expect(userPage.locator('#full_name')).toBeVisible({ timeout: 10_000 });
    await expect(userPage.locator('#country')).toBeVisible({ timeout: 10_000 });
    await expect(userPage.locator('#city')).toBeVisible({ timeout: 10_000 });
    await expect(userPage.locator('#postal_code')).toBeVisible({ timeout: 10_000 });
    await expect(userPage.locator('#street')).toBeVisible({ timeout: 10_000 });
  });

  test('Step 1 coupon field is visible', async ({ userPage }) => {
    const hasItem = await addFirstProductToCart(userPage);
    if (!hasItem) {
      test.skip(true, 'No products available');
    }

    await userPage.goto('/shop/checkout');
    await userPage.waitForLoadState('domcontentloaded');

    // CouponField renders <input id="coupon" placeholder="BARCA-XXXX-XXXX">
    await expect(userPage.locator('#coupon')).toBeVisible({ timeout: 10_000 });
  });

  test('Step 1 shows validation errors when required fields are empty', async ({ userPage }) => {
    const hasItem = await addFirstProductToCart(userPage);
    if (!hasItem) {
      test.skip(true, 'No products available');
    }

    await userPage.goto('/shop/checkout');
    await userPage.waitForLoadState('domcontentloaded');

    // Clear the country field (it has a default "Magyarország") and submit
    await userPage.locator('#full_name').fill('');
    await userPage.locator('#country').fill('');
    await userPage.locator('#city').fill('');
    await userPage.locator('#postal_code').fill('');
    await userPage.locator('#street').fill('');

    await userPage.getByRole('button', { name: /tovább az összegzéshez/i }).click();

    // Validation errors are <p> elements under each field
    await expect(
      userPage.getByText(/add meg a nevedet/i)
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      userPage.getByText(/add meg az országot/i)
    ).toBeVisible({ timeout: 5_000 });
  });

  test('Step 1 "Tovább" button advances to Step 2', async ({ userPage }) => {
    const hasItem = await addFirstProductToCart(userPage);
    if (!hasItem) {
      test.skip(true, 'No products available');
    }

    await userPage.goto('/shop/checkout');
    await userPage.waitForLoadState('domcontentloaded');
    await fillShippingAndAdvance(userPage);

    // Step 2 heading
    await expect(
      userPage.getByRole('heading', { name: /rendelés összegzése/i })
    ).toBeVisible({ timeout: 8_000 });
  });
});

// ---------------------------------------------------------------------------
// Authenticated — Step 2 (order summary + place order)
// ---------------------------------------------------------------------------

test.describe('Checkout Step 2 — Order summary (authenticated)', () => {
  test('Step 2 shows order summary heading and total', async ({ userPage }) => {
    const hasItem = await addFirstProductToCart(userPage);
    if (!hasItem) {
      test.skip(true, 'No products available');
    }

    await userPage.goto('/shop/checkout');
    await userPage.waitForLoadState('domcontentloaded');
    await fillShippingAndAdvance(userPage);

    // The right-side summary card shows "Összesítő"
    await expect(
      userPage.getByText(/összesítő/i).first()
    ).toBeVisible({ timeout: 8_000 });

    // "Végösszeg" label is always rendered in the summary
    await expect(
      userPage.getByText(/végösszeg/i).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('Step 2 shows cart line items', async ({ userPage }) => {
    const hasItem = await addFirstProductToCart(userPage);
    if (!hasItem) {
      test.skip(true, 'No products available');
    }

    await userPage.goto('/shop/checkout');
    await userPage.waitForLoadState('domcontentloaded');
    await fillShippingAndAdvance(userPage);

    // Items render inside a <ul> / <li> in the Step 2 motion.section
    await expect(
      userPage.locator('ul li').first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('Step 2 "Megrendelés (demo)" button is visible and enabled', async ({ userPage }) => {
    const hasItem = await addFirstProductToCart(userPage);
    if (!hasItem) {
      test.skip(true, 'No products available');
    }

    await userPage.goto('/shop/checkout');
    await userPage.waitForLoadState('domcontentloaded');
    await fillShippingAndAdvance(userPage);

    const orderButton = userPage.getByRole('button', { name: /megrendelés \(demo\)/i });
    await expect(orderButton).toBeVisible({ timeout: 8_000 });
    await expect(orderButton).toBeEnabled({ timeout: 5_000 });
  });

  test('placing an order navigates to /shop/checkout/success', async ({ userPage }) => {
    const hasItem = await addFirstProductToCart(userPage);
    if (!hasItem) {
      test.skip(true, 'No products available');
    }

    await userPage.goto('/shop/checkout');
    await userPage.waitForLoadState('domcontentloaded');
    await fillShippingAndAdvance(userPage);

    await userPage.getByRole('button', { name: /megrendelés \(demo\)/i }).click();

    // createOrder calls POST /api/orders then redirects to /shop/checkout/success?orderId=...
    await expect(userPage).toHaveURL(/checkout\/success/, { timeout: 20_000 });
  });

  test('order success page renders a confirmation message', async ({ userPage }) => {
    const hasItem = await addFirstProductToCart(userPage);
    if (!hasItem) {
      test.skip(true, 'No products available');
    }

    await userPage.goto('/shop/checkout');
    await userPage.waitForLoadState('domcontentloaded');
    await fillShippingAndAdvance(userPage);

    await userPage.getByRole('button', { name: /megrendelés \(demo\)/i }).click();
    await expect(userPage).toHaveURL(/checkout\/success/, { timeout: 20_000 });
    await userPage.waitForLoadState('domcontentloaded');

    await expect(
      userPage.getByText(/sikeres|köszönjük|rendelés|visszaigazolás/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('"Adatok módosítása" button goes back to Step 1', async ({ userPage }) => {
    const hasItem = await addFirstProductToCart(userPage);
    if (!hasItem) {
      test.skip(true, 'No products available');
    }

    await userPage.goto('/shop/checkout');
    await userPage.waitForLoadState('domcontentloaded');
    await fillShippingAndAdvance(userPage);

    await userPage.getByRole('button', { name: /adatok módosítása/i }).click();
    await userPage.waitForTimeout(400);

    await expect(
      userPage.getByRole('heading', { name: /szállítási adatok/i })
    ).toBeVisible({ timeout: 5_000 });
  });
});
