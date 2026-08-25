import { expect, test } from '@playwright/test';

const buildRoute = '/knowledge/builds/witchs-staff-aspect-of-melinoe/';

test('build goals switch between Setup, Strongest, and Safest through fragments and history', async ({ page }) => {
    await page.goto(buildRoute);

    const setup = page.locator('[data-build-view-button="setup"]');
    const strongest = page.locator('[data-build-view-button="strongest"]');
    const safest = page.locator('[data-build-view-button="safest"]');
    const setupPanel = page.locator('[data-build-panel="setup"]');
    const strongestPanel = page.locator('[data-build-panel="strongest"]');
    const safestPanel = page.locator('[data-build-panel="safest"]');

    await expect(setup).toHaveAttribute('aria-selected', 'true');
    await expect(setupPanel).toBeVisible();
    await expect(strongestPanel).toBeHidden();
    await expect(safestPanel).toBeHidden();

    await strongest.click();
    await expect(page).toHaveURL(/\/knowledge\/builds\/witchs-staff-aspect-of-melinoe\/\?view=strongest$/);
    await expect(strongest).toHaveAttribute('aria-selected', 'true');
    await expect(strongestPanel).toBeVisible();

    await strongestPanel.locator('a[href="#strongest-main-boons"]').click();
    await expect(page).toHaveURL(/\?view=strongest#strongest-main-boons$/);

    await safest.click();
    await expect(page).toHaveURL(/\?view=safest#safest-main-boons$/);
    await expect(safest).toHaveAttribute('aria-selected', 'true');
    await expect(safestPanel).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\?view=strongest#strongest-main-boons$/);
    await expect(strongest).toHaveAttribute('aria-selected', 'true');
    await expect(strongestPanel).toBeVisible();

    await page.goForward();
    await expect(page).toHaveURL(/\?view=safest#safest-main-boons$/);
    await expect(safest).toHaveAttribute('aria-selected', 'true');
    await expect(safestPanel).toBeVisible();

    await setup.click();
    await expect(page).toHaveURL(/\/knowledge\/builds\/witchs-staff-aspect-of-melinoe\/$/);
    await expect(setup).toHaveAttribute('aria-selected', 'true');
    await expect(setupPanel).toBeVisible();
});

test('tier lists update their ranking goal and matching panel', async ({ page }) => {
    await page.goto('/knowledge/tier-lists/arcana/');

    const safest = page.locator('[data-tier-view-button="safest"]');
    const strongest = page.locator('[data-tier-view-button="strongest"]');
    const safestPanel = page.locator('[data-tier-view-panel="safest"]');
    const strongestPanel = page.locator('[data-tier-view-panel="strongest"]');

    await expect(safest).toHaveAttribute('aria-pressed', 'true');
    await expect(safestPanel).toBeVisible();
    await expect(strongestPanel).toBeHidden();

    await strongest.click();
    await expect(page).toHaveURL(/\/knowledge\/tier-lists\/arcana\/\?view=strongest$/);
    await expect(strongest).toHaveAttribute('aria-pressed', 'true');
    await expect(strongestPanel).toBeVisible();
    await expect(safestPanel).toBeHidden();

    await safest.click();
    await expect(page).toHaveURL(/\/knowledge\/tier-lists\/arcana\/\?view=safest$/);
    await expect(safest).toHaveAttribute('aria-pressed', 'true');
    await expect(safestPanel).toBeVisible();
});
