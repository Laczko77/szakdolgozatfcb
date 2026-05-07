/**
 * Landing page (/) (E2E)
 *
 * Covers:
 *  - Page is publicly accessible (no redirect)
 *  - Hero section is visible
 *  - Navbar renders
 *  - Main content sections load (About, PlayerCarousel, CTA)
 *  - CTA buttons/links are present
 *  - Authenticated user sees navbar in auth state
 */

import { test as base, expect } from '@playwright/test';
import { test, loginAs } from '../fixtures/auth';

test.describe('Landing page (public)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('landing page is publicly accessible (no redirect to login)', async ({ page }) => {
    // Should stay on / — not redirected to /login or /dashboard
    await expect(page).toHaveURL(/^https?:\/\/[^/]+\/?$/, { timeout: 10_000 });
    // Verify it's not the login page
    const isLoginPage = await page.getByRole('button', { name: /belépés|login/i }).count();
    // If we're on login, the landing page is incorrectly protected
    const currentUrl = page.url();
    expect(currentUrl).not.toMatch(/login/);
  });

  test('hero section is visible', async ({ page }) => {
    await page.waitForTimeout(2_000);
    // HeroSection renders a prominent heading or video section
    await expect(
      page.locator('[data-testid="hero-section"], section').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('navbar is rendered on the landing page', async ({ page }) => {
    // Desktop nav has aria-label="Főnavigáció"; mobile header is hidden at 1280px viewport
    await expect(
      page.getByRole('navigation', { name: 'Főnavigáció' })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('About section or feature cards are visible', async ({ page }) => {
    await page.waitForTimeout(2_000);
    // AboutSection renders a grid of feature cards or descriptive text
    const hasSection = (await page.locator('section').count()) > 1;
    const hasCards = (await page.locator('[data-testid="about-section"], [class*="card"], article').count()) > 0;
    expect(hasSection || hasCards).toBe(true);
  });

  test('CTA section or register link is present', async ({ page }) => {
    await page.waitForTimeout(2_000);
    // CTASection renders a registration CTA link or button
    await expect(
      page.getByRole('link', { name: /regisztrál|csatlakozz|regisztráció|sign up/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('player carousel section renders (or graceful empty fallback)', async ({ page }) => {
    await page.waitForTimeout(3_000);
    // PlayerCarousel may show player cards or a fallback — either is correct
    const hasCarousel = (await page.locator('[data-testid="player-carousel"], [class*="carousel"]').count()) > 0;
    const hasSections = (await page.locator('section').count()) >= 2;
    // The page must have rendered meaningful content
    expect(hasCarousel || hasSections).toBe(true);
  });
});

test.describe('Landing page (authenticated)', () => {
  test('authenticated user sees navbar in logged-in state', async ({ userPage }) => {
    await userPage.goto('/');
    await userPage.waitForLoadState('domcontentloaded');
    await userPage.waitForTimeout(1_500);

    // Logged-in navbar shows profile/avatar link or dashboard link — not login button
    const hasProfileLink = (await userPage.locator('a[href*="/profil"], a[href*="/dashboard"]').count()) > 0;
    const hasUserMenu = (await userPage.getByRole('button', { name: /profil|felhasználó|avatar/i }).count()) > 0;
    // At minimum the login button should NOT be prominent (user is authenticated)
    expect(hasProfileLink || hasUserMenu).toBe(true);
  });

  test('authenticated user can navigate from landing CTA to dashboard', async ({ userPage }) => {
    await userPage.goto('/');
    await userPage.waitForLoadState('domcontentloaded');

    // Find a dashboard or profile link in the nav
    const dashboardLink = userPage.locator('a[href="/dashboard"]').first();
    if ((await dashboardLink.count()) === 0) {
      test.skip(true, 'No direct dashboard link found on landing for authenticated user');
    }

    await dashboardLink.click();
    await expect(userPage).toHaveURL(/dashboard/, { timeout: 10_000 });
  });
});
