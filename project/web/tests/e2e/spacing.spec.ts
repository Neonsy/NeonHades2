import { expect, test, type Locator } from '@playwright/test';

const expectInsetRows = async (rows: Locator): Promise<void> => {
    const bounds = await rows.evaluateAll((links) =>
        links.map((link) => {
            const owner = link.getBoundingClientRect();
            const children = [...link.children]
                .map((child) => child.getBoundingClientRect())
                .filter((box) => box.width > 0 && box.height > 0);
            const art = link.querySelector(':scope > .subject-art')?.getBoundingClientRect();
            const copy = link.querySelector(':scope > .record-index-copy')?.getBoundingClientRect();
            return {
                left: Math.min(...children.map((box) => box.left)) - owner.left,
                right: owner.right - Math.max(...children.map((box) => box.right)),
                artGap: art && copy ? Math.max(copy.left - art.right, copy.top - art.bottom) : null,
            };
        })
    );
    expect(bounds.length).toBeGreaterThan(0);
    for (const bound of bounds) {
        expect(bound.left).toBeGreaterThanOrEqual(12);
        expect(bound.right).toBeGreaterThanOrEqual(12);
        if (bound.artGap !== null) expect(bound.artGap).toBeGreaterThanOrEqual(8);
    }
};

for (const width of [320, 390, 430, 560, 620, 768, 1024, 1440, 2048, 3446]) {
    test(`Boon disclosures retain insets and separate artwork from copy at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto('/knowledge/boons/');
        const groups = page.locator('.divine-house');
        for (const group of await groups.all()) {
            await group.locator(':scope > summary').click();
            await expect(group).toHaveJSProperty('open', true);
            await expectInsetRows(group.locator('.record-index > li > a'));
            const overview = group.locator('.record-index-link--divine-overview');
            if (await overview.count()) {
                const art = await overview.locator(':scope > .subject-art').boundingBox();
                const copy = await overview.locator(':scope > .record-index-copy').boundingBox();
                if (!art || !copy) throw new Error('Open god overview is missing its artwork or copy.');
                if (width <= 620) {
                    expect(copy.y - (art.y + art.height)).toBeGreaterThanOrEqual(8);
                    const row = await overview.boundingBox();
                    if (!row) throw new Error('Open overview has no bounds.');
                    expect(copy.width / row.width).toBeGreaterThan(0.8);
                } else {
                    expect(copy.x - (art.x + art.width)).toBeGreaterThanOrEqual(8);
                }
            }
            await group.locator(':scope > summary').click();
        }
        await expectInsetRows(page.locator('.boon-eligibility-guide article'));
    });
}

for (const width of [320, 390, 430, 768, 1440]) {
    test(`Collection rows keep their content inside both edges at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 1000 });
        for (const section of [
            'achievements',
            'arcana',
            'enemies',
            'familiars',
            'hammers',
            'hexes',
            'incantations',
            'keepsakes',
            'oath',
            'prophecies',
            'regions',
            'relationships',
            'resources',
        ]) {
            await page.goto(`/knowledge/${section}/`);
            const rows = page.locator('.record-index > li > a');
            await rows.first().scrollIntoViewIfNeeded();
            await expectInsetRows(rows);
        }
    });
}

test('Resource tables scroll locally without widening their headings or sort controls', async ({ page }) => {
    for (const width of [320, 390, 768, 1024]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto('/knowledge/resources/');
        const bounds = await page.locator('.economy-reference > section, .sort-control-field').evaluateAll((elements) =>
            elements.map((element) => {
                const box = element.getBoundingClientRect();
                return { left: box.left, right: box.right };
            })
        );
        for (const box of bounds) {
            expect(box.left).toBeGreaterThanOrEqual(12);
            expect(box.right).toBeLessThanOrEqual(width - 12);
        }
        const table = page.getByRole('region', { name: 'Scrollable gathering tools table', exact: true });
        if (width <= 620) {
            const hintFits = await table.evaluate(
                (element) =>
                    Number.parseFloat(getComputedStyle(element, '::before').width) <=
                    element.getBoundingClientRect().width
            );
            expect(hintFits).toBe(true);
        }
        if (width <= 768) {
            await table.evaluate((element) => (element.scrollLeft = element.scrollWidth));
            expect(await table.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
        }
    }
});

test('Long aspect titles and their introduction stay within the phone reading rail', async ({ page }) => {
    for (const width of [320, 390, 430, 620]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto('/knowledge/builds/argent-skull-aspect-of-persephone/');
        const bounds = await page.locator('.build-title-copy > *').evaluateAll((elements) =>
            elements.map((element) => {
                const range = document.createRange();
                range.selectNodeContents(element);
                return range.getBoundingClientRect().right;
            })
        );
        for (const right of bounds) expect(right).toBeLessThanOrEqual(width - 12);
    }
});

test('Progression values never wrap between digits on phones', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/knowledge/builds/black-coat-aspect-of-shiva/');
    const values = await page.locator('.progression-effects dd').evaluateAll((elements) =>
        elements.flatMap((element) => {
            const node = element.firstChild;
            if (!node || !/^\s*\d+(?:\.\d+)?\s*$/.test(node.textContent ?? '')) return [];
            const range = document.createRange();
            range.selectNode(node);
            return [range.getBoundingClientRect().height / Number.parseFloat(getComputedStyle(element).lineHeight)];
        })
    );
    expect(values.length).toBeGreaterThan(0);
    for (const lines of values) expect(lines).toBeLessThanOrEqual(1);
});
