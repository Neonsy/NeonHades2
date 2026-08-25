import { defineConfig, devices } from '@playwright/test';

const testServerUrl = 'http://127.0.0.1:4322';

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: false,
    workers: 1,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 1 : 0,
    timeout: 30_000,
    expect: {
        timeout: 5_000,
    },
    use: {
        baseURL: testServerUrl,
        contextOptions: { reducedMotion: 'reduce' },
        launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH },
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    webServer: {
        command: 'node scripts/serve-test-build.mjs',
        url: testServerUrl,
        reuseExistingServer: false,
        timeout: 30_000,
    },
});
