import { expect, test, type Locator } from '@playwright/test';

const expectLanded = async (target: Locator): Promise<void> => {
    await expect
        .poll(async () =>
            target.evaluate((element) => {
                const top = element.getBoundingClientRect().top;
                const header = document.querySelector<HTMLElement>('.world-header')?.offsetHeight ?? 0;
                const atPageEnd = scrollY >= document.documentElement.scrollHeight - innerHeight - 1;
                return top >= header + 12 && (top <= header + 64 || atPageEnd);
            })
        )
        .toBe(true);
};

for (const width of [390, 1440]) {
    for (const reducedMotion of ['no-preference', 'reduce'] as const) {
        test(`Tier jumps settle once below the header at ${width}px with ${reducedMotion}`, async ({ page }) => {
            await page.setViewportSize({ width, height: 1000 });
            await page.emulateMedia({ reducedMotion });
            await page.goto('/knowledge/tier-lists/aspects/');
            await page.evaluate(() => document.fonts.ready);
            const link = page.locator('.tier-jump a[href="#safest-tier-B"]');
            await link.evaluate((element) => element.scrollIntoView({ behavior: 'instant', block: 'center' }));
            const sampling = page.evaluate(async () => {
                const target = document.getElementById('safest-tier-B');
                if (!target) throw new Error('Missing tier B');
                const samples = [];
                const started = performance.now();
                do {
                    await new Promise(requestAnimationFrame);
                    samples.push({ y: scrollY, top: target.getBoundingClientRect().top });
                } while (performance.now() - started < 2500);
                return samples;
            });
            await link.click();
            const samples = await sampling;
            const last = samples.at(-1);
            if (!last) throw new Error('No scroll samples were recorded');
            expect(Math.max(...samples.map((sample) => sample.y)) - last.y).toBeLessThanOrEqual(2);
            const headerHeight = await page
                .locator('.world-header')
                .evaluate((header) => header.getBoundingClientRect().height);
            expect(last.top).toBeGreaterThanOrEqual(headerHeight + 12);
            expect(last.top).toBeLessThanOrEqual(headerHeight + 40);
            await expect(page.locator('#safest-tier-B')).toHaveJSProperty('open', true);
        });
    }
}

for (const width of [390, 1440]) {
    test(`Tier fragments, repeated links, history and rapid reversal land correctly at ${width}px`, async ({
        page,
    }) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await page.goto('/knowledge/tier-lists/aspects/#strongest-tier-C');
        await expectLanded(page.locator('#strongest-tier-C'));
        await expect(page.locator('[data-tier-view-panel="strongest"] .tier-band[open]')).toHaveCount(1);
        const b = page.locator('.tier-jump a[href="#strongest-tier-B"]');
        await b.click();
        await expectLanded(page.locator('#strongest-tier-B'));
        await b.click();
        await expectLanded(page.locator('#strongest-tier-B'));
        await page.goBack();
        await expectLanded(page.locator('#strongest-tier-C'));
        await page.goForward();
        await expectLanded(page.locator('#strongest-tier-B'));
        await page.locator('.tier-jump a[href="#strongest-tier-A"]').click();
        await page.locator('.tier-jump a[href="#strongest-tier-S"]').click();
        await expectLanded(page.locator('#strongest-tier-S'));
        await expect(page.locator('[data-tier-view-panel="strongest"] .tier-band[open]')).toHaveCount(1);
    });

    test(`Build plan links, matching sections and history wait for their selected view at ${width}px`, async ({
        page,
    }) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await page.goto('/knowledge/builds/witchs-staff-aspect-of-melinoe/');
        await page.locator('[data-build-plan-link="strongest"]').first().click();
        await expectLanded(page.locator('#strongest-breakpoints'));
        await page.locator('.build-jump a[href="#strongest-hammers"]').click();
        await expectLanded(page.locator('#strongest-hammers'));
        await page.locator('[data-build-view-button="safest"]').click();
        await expectLanded(page.locator('#safest-hammers'));
        await page.goBack();
        await expectLanded(page.locator('#strongest-hammers'));
        await page.reload();
        await expectLanded(page.locator('#strongest-hammers'));
    });

    test(`Boon disclosure fragments and jumps clear the header without changing jump disclosure state at ${width}px`, async ({
        page,
    }) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto('/knowledge/boons/#poseidon');
        await expectLanded(page.locator('#poseidon'));
        await expect(page.locator('#poseidon')).toHaveJSProperty('open', true);
        await page.locator('.divine-index a[href="#apollo"]').click();
        await expectLanded(page.locator('#apollo'));
        await expect(page.locator('#apollo')).toHaveJSProperty('open', false);
        await page.goBack();
        await expectLanded(page.locator('#poseidon'));
        await page.locator('#collection-filter').fill('Apollo');
        await expect(page.locator('.divine-index a[href="#poseidon"]')).toBeHidden();
        await page.locator('.divine-index a[href="#apollo"]').click();
        await expectLanded(page.locator('#apollo'));
        await page.locator('#collection-filter').fill('');
        await expect(page.locator('.divine-index a[href="#poseidon"]')).toBeVisible();
        await page.locator('.divine-index a[href="#poseidon"]').click();
        await expectLanded(page.locator('#poseidon'));
    });

    test(`Search submission and shortcut keep the field visible above changing results at ${width}px`, async ({
        page,
    }) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto('/');
        await page.locator('#home-query').fill('Apollo');
        await page.locator('#home-query').press('Enter');
        await expectLanded(page.locator('#search'));
        await expect(page.locator('#knowledge-query')).toBeFocused();
        await expect(page.locator('#search-results > li')).not.toHaveCount(0);
        await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
        await page.keyboard.press('Control+k');
        await expectLanded(page.locator('#search'));
        await expect(page.locator('#knowledge-query')).toBeFocused();
    });
}

test('User scrolling cancels a pending disclosure jump instead of pulling the page back later', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/knowledge/tier-lists/aspects/');
    await page.locator('.tier-jump a[href="#safest-tier-B"]').click();
    await page.mouse.wheel(0, -10000);
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => scrollY)).toBe(0);
    await expect(page.locator('#safest-tier-B')).toHaveJSProperty('open', true);
});

test('A jump chosen while fonts load supersedes the initial fragment', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 1000 });
    await page.route('**/*.woff2', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        await route.continue();
    });
    await page.goto('/knowledge/tier-lists/aspects/#safest-tier-B', { waitUntil: 'domcontentloaded' });
    await page.locator('.tier-jump a[href="#safest-tier-A"]').click();
    await page.waitForLoadState('load');
    await expectLanded(page.locator('#safest-tier-A'));
    await expect(page).toHaveURL(/#safest-tier-A$/);
});
