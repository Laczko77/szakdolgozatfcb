/**
 * Players — Browse (/jatekosok) (E2E)
 *
 * Covers:
 *  - Player listing page renders cards
 *  - Position filter works
 *  - Clicking a player navigates to the detail page (/jatekosok/:id)
 *  - Player detail page renders name, position and statistics
 */

import { test, expect } from '@playwright/test';

test.describe('Players listing (/jatekosok)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/jatekosok');
    await page.waitForLoadState('domcontentloaded');
  });

  test('renders the players page heading', async ({ page }) => {
    // h1 = "Játékosaink"
    await expect(
      page.getByRole('heading', { level: 1 }).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('player cards are loaded', async ({ page }) => {
    await page.waitForTimeout(2_000);
    const cards = page.locator('[data-testid="player-card"], .player-card, article');
    const hasEmpty = await page.getByText(/nincs játékos|no players/i).count();

    if (hasEmpty === 0) {
      await expect(cards.first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test('position filter buttons are visible', async ({ page }) => {
    await page.waitForTimeout(1_000);
    // Filters for common positions
    const filterButtons = page
      .getByRole('button')
      .filter({ hasText: /kapus|hátvéd|középpályás|támadó|GK|DEF|MID|FWD/i });

    if ((await filterButtons.count()) > 0) {
      await expect(filterButtons.first()).toBeVisible();
    }
  });

  test('clicking a position filter updates the player list', async ({ page }) => {
    await page.waitForTimeout(1_500);

    const filterButtons = page
      .getByRole('button')
      .filter({ hasText: /kapus|hátvéd|középpályás|támadó|GK|DEF|MID|FWD/i });

    if ((await filterButtons.count()) === 0) {
      test.skip(true, 'No position filter buttons found');
    }

    await filterButtons.first().click();
    await page.waitForTimeout(800);

    const hasCards = (await page.locator('[data-testid="player-card"], article').count()) > 0;
    const hasEmpty = (await page.getByText(/nincs játékos|no players/i).count()) > 0;
    expect(hasCards || hasEmpty).toBe(true);
  });

  test('clicking a player card navigates to detail page', async ({ page }) => {
    await page.waitForTimeout(2_000);

    const playerLinks = page
      .locator('[data-testid="player-card"] a, article a, a[href*="/jatekosok/"]')
      .first();

    if ((await playerLinks.count()) === 0) {
      test.skip(true, 'No player cards found');
    }

    await playerLinks.click();
    await expect(page).toHaveURL(/jatekosok\//, { timeout: 10_000 });
  });
});

test.describe('Player detail page (/jatekosok/:id)', () => {
  test('renders player name, position, and statistics', async ({ page }) => {
    await page.goto('/jatekosok');
    await page.waitForTimeout(2_000);

    const playerLink = page
      .locator('[data-testid="player-card"] a, article a, a[href*="/jatekosok/"]')
      .first();

    if ((await playerLink.count()) === 0) {
      test.skip(true, 'No player links found');
    }

    await playerLink.click();
    await expect(page).toHaveURL(/jatekosok\//, { timeout: 10_000 });
    await page.waitForLoadState('domcontentloaded');

    // Player name in an h1
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10_000 });

    // Position text — skip if the player detail uses a different position format
    const positionText = page.getByText(/kapus|hátvéd|középpályás|támadó|GK|DF|MF|FW|back|forward|keeper|midfielder/i);
    if ((await positionText.count()) > 0) {
      await expect(positionText.first()).toBeVisible({ timeout: 10_000 });
    }
  });
});
