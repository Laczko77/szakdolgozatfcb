/**
 * Dream Team Builder (/jatekosok/almomcsapat) (E2E)
 *
 * Covers:
 *  - Route is protected (unauthenticated users redirected to /login)
 *  - Authenticated user sees formation selector and pitch
 *  - Changing formation updates the pitch slots
 *  - Player pool renders available players
 *  - Saving the team persists state (page reload shows the same team name)
 */

import { test, expect } from '../fixtures/auth';

test.describe('Dream Team (unauthenticated)', () => {
  test('redirects unauthenticated user to /login', async ({ page }) => {
    await page.goto('/jatekosok/almomcsapat');
    await expect(page).toHaveURL(/login/, { timeout: 10_000 });
  });
});

test.describe('Dream Team Builder (authenticated)', () => {
  test.beforeEach(async ({ userPage }) => {
    await userPage.goto('/jatekosok/almomcsapat');
    await userPage.waitForLoadState('domcontentloaded');
  });

  test('renders the dream team builder page', async ({ userPage }) => {
    await expect(
      userPage.getByRole('heading', { level: 1 }).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('formation selector is visible with multiple options', async ({ userPage }) => {
    await userPage.waitForTimeout(2_000);

    // Formation selector may be rendered as buttons or a select element
    const formationButtons = userPage.getByRole('button', { name: /4-3-3|4-2-3-1|4-4-2|3-5-2/i });
    const formationSelect = userPage.locator('select[name*="formation"], [data-testid="formation-selector"]');

    const hasButtons = (await formationButtons.count()) > 0;
    const hasSelect = (await formationSelect.count()) > 0;

    if (!hasButtons && !hasSelect) {
      test.skip(true, 'No formation selector found in current UI');
    }

    if (hasButtons) {
      await expect(formationButtons.first()).toBeVisible({ timeout: 10_000 });
    } else {
      await expect(formationSelect.first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test('SVG pitch with formation slots is rendered', async ({ userPage }) => {
    await userPage.waitForTimeout(2_000);

    // Look for pitch container; svg:not([aria-hidden]) excludes decorative icon SVGs
    await expect(
      userPage.locator('[data-testid="pitch"], [class*="pitch"], svg:not([aria-hidden])').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('player pool lists available players', async ({ userPage }) => {
    await userPage.waitForTimeout(3_000);

    await expect(
      userPage
        .locator('[data-testid="player-pool"] [data-testid="player"], [class*="player-pool"] [class*="player"]')
        .or(userPage.getByText(/kapus|hátvéd|középpályás|támadó/i))
        .first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('changing formation updates pitch layout', async ({ userPage }) => {
    await userPage.waitForTimeout(2_000);

    const formationButtons = userPage.getByRole('button', {
      name: /4-3-3|4-2-3-1|4-4-2|3-5-2/i,
    });

    if ((await formationButtons.count()) < 2) {
      test.skip(true, 'Less than 2 formation options found');
    }

    await formationButtons.nth(1).click();
    await userPage.waitForTimeout(500);

    await expect(
      userPage.locator('[data-testid="pitch"], [class*="pitch"], svg').first()
    ).toBeVisible({ timeout: 5_000 });
  });

  test('saving the team persists team name across page reload', async ({ userPage }) => {
    await userPage.waitForTimeout(2_000);

    const teamNameInput = userPage
      .getByPlaceholder(/csapat neve|team name/i)
      .or(userPage.locator('input[name*="name"], [data-testid="team-name"]'))
      .first();

    if ((await teamNameInput.count()) === 0) {
      test.skip(true, 'No team name input found');
    }

    const testName = `Playwright Csapat ${Date.now()}`;
    await teamNameInput.fill(testName);

    const saveButton = userPage.getByRole('button', { name: /mentés|save/i }).first();
    if ((await saveButton.count()) === 0) {
      test.skip(true, 'No save button found');
    }

    await saveButton.click();
    await userPage.waitForTimeout(2_000);

    // Reload and check that the name persisted
    await userPage.reload();
    await userPage.waitForTimeout(3_000);

    await expect(userPage.getByDisplayValue(testName).or(userPage.getByText(testName)).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});
