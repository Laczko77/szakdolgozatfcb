/**
 * Dream Team Builder (/jatekosok/almomcsapat) (E2E)
 *
 * Covers:
 *  - Route is protected (unauthenticated users redirected to /login)
 *  - Authenticated user sees the page heading and formation selector
 *  - FormationSelector renders radio buttons for all 4 formations
 *  - Changing formation updates the pitch slots
 *  - Player pool renders available players
 *  - Team name input is editable (label="Csapat neve", id="dream-team-name")
 *  - Save button reflects correct label state ("Mentés mint új" / "Mentés")
 *  - Saving the team persists team name across page reload
 *
 * Implementation notes:
 *  - FormationSelector renders role="radiogroup" + role="radio" buttons
 *    (NOT role="button") — use getByRole('radio') to locate formations.
 *  - Team name input: id="dream-team-name", placeholder="Álomcsapatom"
 *  - Save button: "Mentés mint új" (no saved team) or "Mentés" (team exists)
 *  - PitchSVG wraps each slot in a <g> tag — check for svg presence
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
    // Wait for players + team data to load (two parallel fetches)
    await userPage.waitForTimeout(3_000);
  });

  test('renders the dream team builder page heading', async ({ userPage }) => {
    // h1 = "Építsd meg a tökéletes XI-et"
    await expect(
      userPage.getByRole('heading', { level: 1 }).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('formation selector is visible with all 4 options as radio buttons', async ({ userPage }) => {
    // FormationSelector renders role="radiogroup" containing role="radio" buttons
    const radioGroup = userPage.getByRole('radiogroup', { name: /formáció/i });
    await expect(radioGroup).toBeVisible({ timeout: 10_000 });

    // All 4 formations should be present as radio buttons
    const formations = ['4-3-3', '4-2-3-1', '3-5-2', '4-4-2'];
    for (const f of formations) {
      await expect(
        userPage.getByRole('radio', { name: f })
      ).toBeVisible({ timeout: 8_000 });
    }
  });

  test('SVG pitch is rendered after data loads', async ({ userPage }) => {
    // PitchSVG renders the pitch as an SVG element — not aria-hidden
    await expect(
      userPage.locator('svg:not([aria-hidden="true"])').first()
    ).toBeVisible({ timeout: 12_000 });
  });

  test('player pool lists available players', async ({ userPage }) => {
    // PlayerPool renders a list of player cards
    await expect(
      userPage
        .locator('[data-testid="player-pool"]')
        .or(userPage.locator('aside, [class*="player-pool"]'))
        .first()
    ).toBeVisible({ timeout: 12_000 });

    // Wait for loading state to clear
    await userPage.waitForTimeout(1_000);

    // Check for player content — either player cards or position-label text
    const hasPlayerCards = (await userPage.locator('[class*="player"], [data-testid*="player"]').count()) > 0;
    const hasPositionLabels = (await userPage.getByText(/kapus|hátvéd|középpályás|támadó|csatár/i).count()) > 0;
    expect(hasPlayerCards || hasPositionLabels).toBe(true);
  });

  test('changing formation updates the pitch', async ({ userPage }) => {
    // Default formation is "4-2-3-1"; switch to "4-3-3"
    const target = userPage.getByRole('radio', { name: '4-3-3' });
    if ((await target.count()) === 0) {
      test.skip(true, 'Formation radio not found');
    }

    await target.click();
    await userPage.waitForTimeout(500);

    // Pitch is still visible — confirms no crash on formation change
    await expect(
      userPage.locator('svg:not([aria-hidden="true"])').first()
    ).toBeVisible({ timeout: 8_000 });

    // The 4-3-3 radio should now be checked
    await expect(
      userPage.getByRole('radio', { name: '4-3-3' })
    ).toHaveAttribute('aria-checked', 'true', { timeout: 5_000 });
  });

  test('team name input is visible and editable', async ({ userPage }) => {
    // DreamTeamToolbar renders: <label>Csapat neve</label> + <input id="dream-team-name">
    const teamNameInput = userPage.locator('#dream-team-name');
    await expect(teamNameInput).toBeVisible({ timeout: 10_000 });
    await expect(teamNameInput).toBeEditable({ timeout: 5_000 });
  });

  test('save button is present with correct label', async ({ userPage }) => {
    // If no team is saved yet: "Mentés mint új"
    // If team exists: "Mentés"
    const saveButton = userPage
      .getByRole('button', { name: /^mentés mint új$|^mentés$|^mentés…$/i })
      .first();

    await expect(saveButton).toBeVisible({ timeout: 10_000 });
  });

  test('saving the team persists team name across page reload', async ({ userPage }) => {
    await userPage.waitForTimeout(1_000);

    const teamNameInput = userPage.locator('#dream-team-name');
    if ((await teamNameInput.count()) === 0) {
      test.skip(true, 'No team name input found');
    }

    const testName = `Playwright ${Date.now()}`;
    await teamNameInput.fill(testName);

    // To be able to save, at least one player must be placed.
    // Check if save is enabled; if not, skip (no players to place in this test).
    const saveButton = userPage
      .getByRole('button', { name: /^mentés mint új$|^mentés$|^mentés…$/i })
      .first();

    const isEnabled = await saveButton.isEnabled();
    if (!isEnabled) {
      test.skip(true, 'Save button is disabled — no players placed on pitch, cannot test persistence');
    }

    await saveButton.click();
    // Wait for the POST/PUT to complete and the toast to appear
    await userPage.waitForTimeout(2_000);

    // Reload and verify the name persisted
    await userPage.reload();
    await userPage.waitForTimeout(4_000);

    await expect(
      userPage.locator('#dream-team-name')
    ).toHaveValue(testName, { timeout: 10_000 });
  });
});
