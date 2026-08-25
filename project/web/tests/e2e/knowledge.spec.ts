import { expect, test } from '@playwright/test';

test('knowledge search finds Apollo and reports a no-result query', async ({ page }) => {
    await page.goto('/knowledge/');

    const search = page.locator('#knowledge-query');
    const results = page.locator('#search-results');
    const status = page.locator('#search-status');

    await search.fill('Apollo');
    await expect(results).toBeVisible();
    await expect(results).toContainText('Apollo');
    await expect(status).toContainText('Showing the closest matches for "Apollo".');

    await search.fill('no such Hades II guide answer');
    await expect(results.locator('li')).toHaveCount(0);
    await expect(status).toHaveText('No result. Try a shorter official name, familiar term, or system.');
});

test('home search sends its query to knowledge and renders the matching result', async ({ page }) => {
    await page.goto('/');

    await page.locator('#home-query').fill('Apollo');
    await Promise.all([
        page.waitForURL(/\/knowledge\/\?q=Apollo#search$/),
        page.getByRole('button', { name: 'Search' }).click(),
    ]);

    await expect(page.locator('#knowledge-query')).toHaveValue('Apollo');
    await expect(page.locator('#search-results')).toContainText('Apollo');
});

test('collection filtering hides non-matches and restores the complete index when cleared', async ({ page }) => {
    await page.goto('/knowledge/weapons/');

    const filter = page.locator('#collection-filter');
    const rows = page.locator('[data-record-row]');
    const totalRows = await rows.count();

    expect(totalRows).toBeGreaterThan(1);

    await filter.fill('staff');
    const visibleRows = page.locator('[data-record-row]:visible');
    await expect(visibleRows).toHaveCount(1);
    await expect(visibleRows).toContainText(/staff/i);

    await filter.fill('');
    await expect(page.locator('[data-record-row]:visible')).toHaveCount(totalRows);
});

test('filtering a virtualized collection searches its complete index and restores virtualization when cleared', async ({
    page,
}) => {
    await page.goto('/knowledge/enemies/');

    const filter = page.locator('#collection-filter');
    const index = page.locator('[data-virtual-record-index]');
    const visibleRows = index.locator('[data-record-row]');

    await expect(index).toHaveClass(/is-virtualized/);
    const completeIndexSize = await visibleRows.first().getAttribute('aria-setsize');
    if (!completeIndexSize) throw new Error('The virtualized enemies index is missing its complete index size.');

    await filter.fill('Aetos');
    await expect(index.locator('[data-record-row]').filter({ hasText: 'Aetos' })).toBeVisible();
    await expect(index.locator('[data-record-row]').filter({ hasText: 'Bloodless' })).toBeHidden();

    await filter.fill('');
    await expect(index).toHaveClass(/is-virtualized/);
    await expect(index.locator('[data-record-row]').first()).toHaveAttribute('aria-setsize', completeIndexSize);
});
