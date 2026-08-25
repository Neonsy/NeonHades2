import { expect, test } from '@playwright/test';

test('mobile navigation closes on Escape and returns focus to its toggle', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const toggle = page.locator('.world-menu-toggle');
    const navigation = page.locator('#world-primary-navigation');
    const firstNavigationLink = navigation.locator('a').first();

    await expect(toggle).toHaveAttribute('aria-label', 'Open navigation');
    await toggle.click();

    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(navigation).toHaveAttribute('aria-hidden', 'false');
    await expect(firstNavigationLink).toBeFocused();

    await page.keyboard.press('Escape');

    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(navigation).toHaveAttribute('aria-hidden', 'true');
    await expect(toggle).toBeFocused();
});
