import { expect, test } from '@playwright/test';

const storageKey = 'neodes2-guide-progress';
const guideRoute = '/guide/the-first-night/';

test('guide checklist progress persists after a reload', async ({ page }) => {
    await page.goto(guideRoute);

    const checklist = page.locator('[data-guide-checklist]');
    const firstCheck = checklist.locator('[data-progress-check]').first();
    const completeCount = checklist.locator('[data-complete-count]');
    const checkId = await firstCheck.getAttribute('data-progress-check');

    if (!checkId) throw new Error('The first guide checklist input is missing its progress identifier.');
    await firstCheck.check();
    await expect(firstCheck).toBeChecked();
    await expect(completeCount).toHaveText('1');
    await expect
        .poll(() =>
            page.evaluate(
                ({ key, id }) => JSON.parse(window.localStorage.getItem(key) ?? '{}').completedChecks?.[id] === true,
                { key: storageKey, id: checkId }
            )
        )
        .toBe(true);

    await page.reload();

    await expect(firstCheck).toBeChecked();
    await expect(completeCount).toHaveText('1');
});

test('malformed guide storage disables the checklist until the user resets it', async ({ page }) => {
    const malformedStorage = '{not valid JSON';
    await page.addInitScript(({ key, value }) => window.localStorage.setItem(key, value), {
        key: storageKey,
        value: malformedStorage,
    });
    await page.goto(guideRoute);

    const checklist = page.locator('[data-guide-checklist]');
    const warning = checklist.locator('[data-progress-warning]');
    const firstCheck = checklist.locator('[data-progress-check]').first();

    await expect(warning).toBeVisible();
    await expect(firstCheck).toBeDisabled();
    await expect
        .poll(() => page.evaluate((key) => window.localStorage.getItem(key), storageKey))
        .toBe(malformedStorage);

    await checklist.getByRole('button', { name: 'Start a new local checklist' }).click();

    await expect(warning).toBeHidden();
    await expect(firstCheck).toBeEnabled();
    await expect
        .poll(() =>
            page.evaluate((key) => {
                const saved = window.localStorage.getItem(key);
                return saved ? JSON.parse(saved).schemaVersion : null;
            }, storageKey)
        )
        .toBe(1);
});
