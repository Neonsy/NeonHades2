export type Breadcrumb = {
    name: string;
    href: string;
};

export const SITE_KEYWORDS = [
    'Hades 2',
    'Hades II',
    'Hades2',
    'Hades 2 guide',
    'Hades II guide',
    'Hades2 guide',
    'Hades 2 build',
    'Hades 2 builds',
    'Hades II build',
    'Hades II builds',
    'Hades2 build',
    'Hades2 builds',
    'Hades 2 wiki',
    'Hades II wiki',
    'Hades2 wiki',
    'Hades 2 walkthrough',
    'Hades II walkthrough',
    'Hades 2 boons',
    'Hades 2 weapons',
    'Hades 2 tier list',
    'Hades 2 progression',
    'Hades 2 unlocks',
    'NeonHades2',
].join(', ');

type SocialImage = {
    alt: string;
    height: number;
    path: string;
    width: number;
};

const SOCIAL_IMAGE = {
    path: '/og/social-preview.webp',
    alt: 'NeonHades2 social preview with a teal and violet guide codex, route line, and search ring.',
} as const satisfies Omit<SocialImage, 'height' | 'width'>;

export function socialImageFor(): SocialImage {
    return { ...SOCIAL_IMAGE, width: 1200, height: 630 };
}

export function absoluteUrl(path: string, site: URL): string {
    return new URL(path, site).href;
}

export function titleForMetadata(title: string): string {
    const topic = title.replaceAll(/\s+/gu, ' ').trim();
    const contextualTitle = /\bHades (?:II|2)\b/u.test(topic) ? topic : `${topic} | Hades II`;
    const brandedTitle = `${contextualTitle} | NeonHades2`;
    return brandedTitle.length <= 70 ? brandedTitle : contextualTitle;
}

export function descriptionForMetadata(value: string, maximumLength = 160): string {
    const compact = value.replaceAll(/\s+/gu, ' ').trim();
    if (compact.length > maximumLength) {
        throw new Error(`Metadata description exceeds ${maximumLength} characters: ${compact}`);
    }
    return compact;
}

export function safeJsonLd(value: unknown): string {
    return JSON.stringify(value).replaceAll('<', '\\u003c');
}
