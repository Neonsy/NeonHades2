import { expect, test, type Locator, type Page } from '@playwright/test';

const expectNoHorizontalOverflow = async (page: Page): Promise<void> => {
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
};

const expectLoaded = async (image: Locator): Promise<void> => {
    await expect(image).toBeVisible();
    await expect
        .poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0))
        .toBe(true);
};

test('knowledge controls and artwork retain their bounds on a wide screen', async ({ page }) => {
    await page.setViewportSize({ width: 2264, height: 1300 });
    await page.goto('/knowledge/');
    await page.keyboard.press('Control+k');
    await expect(page.locator('#knowledge-query')).toBeFocused();
    await expect(page.locator('#knowledge-query')).toHaveCSS('outline-style', 'none');
    await expect(page.locator('.search-line')).toHaveCSS('outline-style', 'solid');
    await expect(page.locator('.search-line kbd')).toHaveCSS('white-space', 'nowrap');
    const geometry = await page.evaluate(() => {
        const bridge = document.querySelector('.knowledge-beginner-bridge');
        const copy = bridge?.querySelector('div');
        const button = bridge?.querySelector('a');
        const artwork = document.querySelector('.knowledge-starts .subject-art');
        const link = artwork?.closest('a');
        if (!bridge || !copy || !button || !artwork || !link) throw new Error('Knowledge layout is incomplete.');
        return {
            inset: copy.getBoundingClientRect().left - bridge.getBoundingClientRect().left,
            buttonText: button.textContent?.trim(),
            color: getComputedStyle(button).color,
            background: getComputedStyle(button).backgroundColor,
            artHeight: artwork.getBoundingClientRect().height,
            linkHeight: link.getBoundingClientRect().height,
        };
    });
    expect(geometry.inset).toBeGreaterThanOrEqual(24);
    expect(geometry.buttonText).toBeTruthy();
    expect(geometry.color).toBe('rgb(7, 13, 14)');
    expect(geometry.background).toBe('rgb(208, 244, 203)');
    expect(geometry.artHeight).toBeLessThanOrEqual(geometry.linkHeight);
    await expectNoHorizontalOverflow(page);
});

test('aspect learning demands align at the bottom of their comparison row', async ({ page }) => {
    await page.setViewportSize({ width: 3840, height: 2160 });
    await page.goto('/knowledge/builds/');
    const bottoms = await page
        .locator('.aspect-catalogue')
        .first()
        .locator('.aspect-learning-demand')
        .evaluateAll((labels) => labels.map((label) => label.getBoundingClientRect().bottom));
    expect(bottoms).toHaveLength(4);
    expect(Math.max(...bottoms) - Math.min(...bottoms)).toBeLessThanOrEqual(1);
});

test('ambient particles respond to the live reduced-motion preference', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/knowledge/');
    const particles = page.locator('.world-atmosphere-particles i').first();
    await expect(particles).toHaveCSS('animation-name', 'world-streak-shoot');
    const start = await particles.evaluate((element) => element.getAnimations()[0]?.currentTime);
    await expect.poll(() => particles.evaluate((element) => element.getAnimations()[0]?.currentTime)).not.toBe(start);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(particles).toHaveCSS('animation-name', 'none');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('record identity leads the artwork without an empty hero column', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/knowledge/records/boons/apollo/');
    const title = page.locator('.record-title-block');
    const art = page.locator('.record-hero > .subject-art');
    await expectLoaded(art.locator('img').first());
    const titleBox = await title.boundingBox();
    const artBox = await art.boundingBox();
    const heroBox = await page.locator('.record-hero').boundingBox();
    if (!titleBox || !artBox || !heroBox) throw new Error('Record header is not visible.');
    expect(titleBox.x + titleBox.width).toBeLessThan(artBox.x);
    expect(artBox.width).toBeGreaterThan(300);
    expect(heroBox.height).toBeLessThan(640);
    await expectNoHorizontalOverflow(page);

    await page.setViewportSize({ width: 390, height: 844 });
    const phoneTitle = await title.boundingBox();
    const phoneArt = await art.boundingBox();
    if (!phoneTitle || !phoneArt) throw new Error('Phone record header is not visible.');
    expect(phoneTitle.y + phoneTitle.height).toBeLessThan(phoneArt.y);
    expect(phoneArt.height).toBeLessThan(320);
    await expectNoHorizontalOverflow(page);
});

test('phone home visual holds its heading and art at the responsive default scale', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /A little wisdom/i })).toBeVisible();
    await expectLoaded(page.locator('.home-scene-hecate'));
    await expectNoHorizontalOverflow(page);
    await expect(page).toHaveScreenshot('home-phone-390.png', {
        animations: 'disabled',
        caret: 'hide',
        scale: 'css',
    });
});

test('desktop builds visual holds its heading and workbench art at the responsive default scale', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/knowledge/builds/');

    await expect(page.getByRole('heading', { name: /Pick your weapon/i })).toBeVisible();
    await expectLoaded(page.locator('.builds-workshop-art img'));
    await expectNoHorizontalOverflow(page);
    await expect(page).toHaveScreenshot('builds-desktop-1440.png', {
        animations: 'disabled',
        caret: 'hide',
        scale: 'css',
    });
});

test('4K first-night visual holds its heading and route art at the responsive default scale', async ({ page }) => {
    await page.setViewportSize({ width: 3840, height: 2160 });
    await page.goto('/guide/the-first-night/');

    await expect(page.getByRole('heading', { name: 'The first night' })).toBeVisible();
    await expectLoaded(page.locator('.night-route img'));
    await expect
        .poll(() => page.evaluate(() => Number.parseFloat(getComputedStyle(document.body).fontSize)))
        .toBeGreaterThanOrEqual(30);
    await expectNoHorizontalOverflow(page);
    await expect(page).toHaveScreenshot('first-night-4k-3840.png', {
        animations: 'disabled',
        caret: 'hide',
        scale: 'css',
    });
});
