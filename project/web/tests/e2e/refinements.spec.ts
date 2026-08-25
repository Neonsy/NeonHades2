import { expect, test } from '@playwright/test';

test('Boon god icons stay inside their summaries on desktop and mobile', async ({ page }) => {
    await page.goto('/knowledge/boons/');
    for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        const icons = page.locator('.divine-house > summary .divine-signature img');
        expect(await icons.count()).toBeGreaterThan(10);
        const sizes = await icons.evaluateAll((images) =>
            images.map((image) => {
                const box = image.getBoundingClientRect();
                const owner = image.closest('summary')?.getBoundingClientRect();
                if (!owner) throw new Error('God icon has no summary');
                return {
                    ratio: box.width / box.height,
                    inside: box.top >= owner.top && box.bottom <= owner.bottom,
                };
            })
        );
        for (const size of sizes) {
            expect(size.ratio).toBeCloseTo(1, 2);
            expect(size.inside).toBe(true);
        }
        if (width === 390) {
            const description = page.locator('#aphrodite .divine-house-copy > span');
            expect(await description.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThan(300);
        }
    }
});

test('identical preparation is shown once without losing either combat plan', async ({ page }) => {
    await page.goto('/knowledge/builds/black-coat-aspect-of-shiva/');
    const preparation = page.locator('#setup-loadouts');
    await expect(preparation.locator(':scope > div > article')).toHaveCount(1);
    await expect(preparation).toContainText('Shared preparation');
    await preparation.getByRole('link', { name: 'Safest plan', exact: true }).click();
    await expect(page.locator('[data-build-panel="safest"]')).toBeVisible();
    await page.locator('[data-build-view-button="setup"]').click();
    await preparation.getByRole('link', { name: 'Strongest plan', exact: true }).click();
    await expect(page.locator('[data-build-panel="strongest"]')).toBeVisible();
    await page.goto('/knowledge/builds/witchs-staff-aspect-of-melinoe/');
    await expect(page.locator('#setup-loadouts > div > article')).toHaveCount(2);
    await expect(page.locator('#setup-loadouts')).toContainText('Iridescent Fan');
    await expect(page.locator('#setup-loadouts')).toContainText('Harmonic Photon');
});

test('home search answers inline with one focus ring and keyboard access', async ({ page }) => {
    await page.goto('/');
    const input = page.locator('#home-query');
    const results = page.locator('#search-results');
    await input.fill('Apollo');
    await expect(results.locator('a').first()).toContainText('Apollo');
    await expect(page).toHaveURL(/:4322\/$/);
    expect(await input.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe('none');
    expect(
        await page.locator('.home-direct-search').evaluate((element) => getComputedStyle(element).outlineStyle)
    ).toBe('solid');
    await input.press('ArrowDown');
    await expect(results.locator('a').first()).toBeFocused();
    await input.focus();
    await input.press('Escape');
    await expect(page.locator('.home-search-response')).toBeHidden();
    await input.fill('no-such-olympian-xyz');
    await expect(page.locator('#search-status')).toContainText('No result');
    await input.fill('');
    await expect(page.locator('.home-search-response')).toBeHidden();
});

test('tier motion closes the old tier before unfolding the new and survives reversal', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/knowledge/tier-lists/aspects/');
    await page.evaluate(() => document.fonts.ready);
    const a = page.locator('#safest-tier-A');
    const s = page.locator('#safest-tier-S');
    await a.locator('summary').focus();
    await a.locator('summary').press('Enter');
    await expect
        .poll(() => a.locator('.tier-band-panel').evaluate((element) => element.getAnimations().length))
        .toBe(0);
    await s.locator('summary').focus();
    await s.locator('summary').press('Enter');
    const frames = await page.evaluate(async () => {
        const a = document.querySelector<HTMLDetailsElement>('#safest-tier-A');
        const s = document.querySelector<HTMLDetailsElement>('#safest-tier-S');
        const panel = s?.querySelector('.tier-band-panel');
        if (!a || !s || !panel) throw new Error('Missing aspect tier panels');
        const samples = [];
        for (let frame = 0; frame < 36; frame += 1) {
            await new Promise(requestAnimationFrame);
            samples.push({
                bothOpen: a.open && s.open,
                height: panel.getBoundingClientRect().height,
            });
        }
        return samples;
    });
    expect(frames.some((frame) => frame.bothOpen)).toBe(false);
    const finalHeights = frames.slice(-2).map((frame) => frame.height);
    expect(Math.max(...finalHeights) - Math.min(...finalHeights)).toBeLessThan(1);
    await expect(s).toHaveJSProperty('open', true);
    await expect(a).toHaveJSProperty('open', false);
    await a.locator('summary').focus();
    await a.locator('summary').press('Enter');
    await s.locator('summary').focus();
    await s.locator('summary').press('Enter');
    await expect
        .poll(() => s.locator('.tier-band-panel').evaluate((element) => element.getAnimations().length))
        .toBe(0);
    await expect(s).toHaveJSProperty('open', true);
    await expect(a).toHaveJSProperty('open', false);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await a.locator('summary').focus();
    await a.locator('summary').press('Enter');
    await expect(a).toHaveJSProperty('open', true);
    await expect(s).toHaveJSProperty('open', false);
});

test('guide progress stays compact and mobile steps keep the reading width', async ({ page }) => {
    await page.goto('/guide/');
    await expect(page.locator('.guide-resume')).toBeHidden();
    await page.goto('/guide/before-the-first-night/');
    await page.locator('[data-progress-check]').first().check();
    await page.goto('/guide/');
    const resume = page.locator('.guide-resume');
    await expect(resume).toBeVisible();
    expect(await resume.evaluate((element) => element.getBoundingClientRect().height)).toBeLessThan(400);
    await expect(resume.locator('[data-resume-guide]')).toContainText('Continue');
    await page.setViewportSize({ width: 390, height: 844 });
    const art = page.locator('.milestone-art').first();
    expect(await art.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThan(230);
    expect(await art.evaluate((element) => getComputedStyle(element).objectPosition)).toBe('50% 50%');
    await page.goto('/guide/true-ending/');
    const step = page.locator('.chapter-actions-v2 > ol > li').nth(2);
    const body = step.locator('p').first();
    const bodyWidth = await body.evaluate((element) => element.getBoundingClientRect().width);
    const stepWidth = await step.evaluate((element) => element.getBoundingClientRect().width);
    expect(bodyWidth / stepWidth).toBeGreaterThan(0.95);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/knowledge/tier-lists/');
    expect(
        await page.locator('.tier-hall-copy > p').evaluate((element) => element.getBoundingClientRect().width)
    ).toBeGreaterThan(500);
});
