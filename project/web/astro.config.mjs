// @ts-check
import { defineConfig } from 'astro/config';
import sitemap, { ChangeFreqEnum } from '@astrojs/sitemap';
import { loadEnv } from 'vite';

import tailwindcss from '@tailwindcss/vite';

const PUBLIC_SITE_ENV = 'PUBLIC_SITE_URL';
const LOCAL_SITE = 'http://127.0.0.1:4321';

/**
 * @param {'build' | 'dev'} command
 * @param {Record<string, string>} fileEnv
 */
function publicSite(command, fileEnv) {
    const configured = process.env[PUBLIC_SITE_ENV]?.trim() || fileEnv[PUBLIC_SITE_ENV]?.trim();
    if (!configured) return LOCAL_SITE;

    const url = new URL(configured);
    if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.pathname !== '/' ||
        url.search ||
        url.hash ||
        url.username ||
        url.password
    ) {
        throw new Error(`${PUBLIC_SITE_ENV} must be an absolute site origin such as https://example.com.`);
    }
    if (command === 'build' && url.protocol !== 'https:') {
        throw new Error(`${PUBLIC_SITE_ENV} must use HTTPS for production builds.`);
    }
    return url.href;
}

/** @param {string} pathname */
function sitemapPolicy(pathname) {
    if (pathname === '/') return { changefreq: ChangeFreqEnum.WEEKLY, priority: 1 };
    if (pathname === '/guide/' || pathname === '/knowledge/') {
        return { changefreq: ChangeFreqEnum.WEEKLY, priority: 0.9 };
    }
    if (pathname === '/knowledge/builds/' || pathname === '/knowledge/tier-lists/') {
        return { changefreq: ChangeFreqEnum.WEEKLY, priority: 0.85 };
    }
    if (pathname.startsWith('/guide/')) return { changefreq: ChangeFreqEnum.MONTHLY, priority: 0.78 };
    if (pathname.startsWith('/knowledge/builds/')) return { changefreq: ChangeFreqEnum.MONTHLY, priority: 0.72 };
    if (pathname.startsWith('/knowledge/tier-lists/')) {
        return { changefreq: ChangeFreqEnum.MONTHLY, priority: 0.7 };
    }
    if (pathname.startsWith('/knowledge/records/')) {
        return { changefreq: ChangeFreqEnum.MONTHLY, priority: 0.62 };
    }
    if (pathname.startsWith('/knowledge/')) return { changefreq: ChangeFreqEnum.MONTHLY, priority: 0.74 };
    return { changefreq: ChangeFreqEnum.MONTHLY, priority: 0.5 };
}

// https://astro.build/config
const command = process.argv.includes('build') ? 'build' : 'dev';
const modeFlagIndex = process.argv.indexOf('--mode');
const mode = process.argv[modeFlagIndex + 1] ?? (command === 'build' ? 'production' : 'development');
const site = publicSite(command, loadEnv(mode, process.cwd(), ''));
export default defineConfig({
    site,
    devToolbar: { enabled: false },
    integrations: [
        sitemap({
            serialize(item) {
                return { ...item, ...sitemapPolicy(new URL(item.url).pathname) };
            },
        }),
    ],
    vite: {
        plugins: [tailwindcss()],
    },
});
