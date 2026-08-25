import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const styleDirectory = resolve('src/styles');
const readStylesheet = (path, loaded = new Set()) => {
    if (loaded.has(path)) return '';
    loaded.add(path);

    const source = readFileSync(path, 'utf8');
    const imports = [...source.matchAll(/@import\s+['"]([^'"]+\.css)['"][^;]*;/gu)]
        .map((match) => match[1])
        .filter((specifier) => specifier.startsWith('.'))
        .map((specifier) => readStylesheet(resolve(dirname(path), specifier), loaded));
    return [source, ...imports].join('\n');
};
const routeStylePaths = readdirSync(resolve(styleDirectory, 'routes'))
    .filter((file) => file.endsWith('.css'))
    .sort()
    .map((file) => resolve(styleDirectory, 'routes', file));
const loadedStylesheets = new Set();
const styles = routeStylePaths.map((path) => readStylesheet(path, loadedStylesheets)).join('\n');
const baseStyles = readStylesheet(resolve(styleDirectory, 'routes', 'base.css'));
const homeStyles = readStylesheet(resolve(styleDirectory, 'routes', 'home.css'));
const collectionStyles = readStylesheet(resolve(styleDirectory, 'routes', 'collection.css'));
const buildStyles = readStylesheet(resolve(styleDirectory, 'routes', 'builds.css'));
const buildDetailStyles = readStylesheet(resolve(styleDirectory, 'routes', 'build-detail.css'));
const tierStyles = readStylesheet(resolve(styleDirectory, 'routes', 'tiers.css'));

const failures = [];
const collectionSourcePaths = [
    'src/pages/knowledge/[section].astro',
    'src/components/collections/CollectionPresentation.astro',
    'src/components/collections/CollectionRuntime.astro',
    'src/components/collections/CollectionToolbar.astro',
    'src/components/collections/RecordIndex.astro',
    'src/components/collections/ResourceCollection.astro',
    'src/components/collections/StoryCollection.astro',
    'src/components/collections/WeaponCollection.astro',
    'src/components/collections/BoonCollection.astro',
    'src/lib/collection-view-model.ts',
    'src/lib/collection-view-model/boons.ts',
    'src/lib/collection-view-model/resources.ts',
    'src/lib/collection-view-model/story.ts',
    'src/scripts/collection-runtime.ts',
    ...readdirSync(resolve('src/scripts/collections'))
        .sort()
        .map((file) => `src/scripts/collections/${file}`),
];
const collectionSource = collectionSourcePaths.map((path) => readFileSync(resolve(path), 'utf8')).join('\n');
const buildDetailSource = readFileSync(resolve('src/components/builds/BuildVariantPanel.astro'), 'utf8');
const guideChecklistSource = readFileSync(resolve('src/components/GuideChecklist.astro'), 'utf8');
const recordFieldSource = readFileSync(resolve('src/components/RecordField.astro'), 'utf8');
const readerRuleSetSource = readFileSync(resolve('src/components/ReaderRuleSet.astro'), 'utf8');
const readerSectionsSource = readFileSync(resolve('src/components/ReaderSections.astro'), 'utf8');
const storyCollectionSource = readFileSync(resolve('src/components/collections/StoryCollection.astro'), 'utf8');
const presentationSource = [
    'src/lib/presentation.ts',
    'src/lib/presentation-reader-text.ts',
    'src/lib/presentation-value-formatting.ts',
    'src/lib/presentation-record-family.ts',
]
    .map((path) => readFileSync(resolve(path), 'utf8'))
    .join('\n');
const balancedGridSource = readFileSync(resolve('src/scripts/balanced-grid.ts'), 'utf8');
const contentRuntimeSource = readFileSync(resolve('src/scripts/content-runtime.ts'), 'utf8');
const buildPageSource = readFileSync(resolve('src/pages/knowledge/builds/[aspect].astro'), 'utf8');
const tierDetailSource = readFileSync(resolve('src/pages/knowledge/tier-lists/[tier].astro'), 'utf8');
const viewFragmentSource = readFileSync(resolve('src/scripts/view-fragment-navigation.ts'), 'utf8');
const exclusiveDetailsSource = readFileSync(resolve('src/scripts/exclusive-details-runtime.ts'), 'utf8');
const siteHeaderSource = readFileSync(resolve('src/components/SiteHeader.astro'), 'utf8');
const navigationStyles = baseStyles;
const tokenStyles = baseStyles;
const homeResponsiveStyles = homeStyles;
const knowledgeCollectionStyles = collectionStyles;
const buildSpacingStyles = buildStyles;
const buildDetailResponsiveStyles = buildDetailStyles;
const tierResponsiveStyles = tierStyles;
const styleRules = [...styles.matchAll(/([^{}]+)\{([^{}]*)\}/gsu)].map((match) => ({
    declarations: match[2],
    selectors: match[1]
        .split(',')
        .map((selector) => selector.trim().replaceAll(/\s+/gu, ' '))
        .filter(Boolean),
}));
const boxedSurfaces = [
    '.world-header',
    '.world-footer',
    '.home-route',
    '.home-offering',
    '.home-questions nav a',
    '.knowledge-search',
    '.search-line',
    '.collection-purpose',
    '.collection-toolbar',
    '.record-index > li > a',
    '.record-quick-facts',
    '.record-field',
    '.build-hero-instrument',
    '.build-view-control',
    '.build-view-tabs [data-build-view-button]',
    '.build-setup-intro',
    '.build-setup-loadouts > div > article',
    '.build-breakpoints > ol > li',
    '.boon-lanes > article',
    '.rare-targets > .rare-target-card',
    '.tier-view-toggle button',
    '.knowledge-beginner-bridge',
    '.chapter-orientation blockquote',
    '.context-ribbon > div',
    '.tier-principles > div',
    '.tier-catalogue > a',
    '.relationship-rail a',
    '.story-codex-card__label',
    '.weapon-family-copy',
    '.divine-house > summary',
];

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
const requireStyleContract = (pattern, failure) => {
    if (!pattern.test(styles)) failures.push(failure);
};
const pageFamilyContracts = {
    'not-found': ['src/pages/404.astro', ['not-found', 'not-found-signal', 'not-found-copy', 'not-found-actions']],
    home: ['src/pages/index.astro', ['home-hero', 'home-routes', 'home-offerings', 'home-questions']],
    'guide-index': ['src/pages/guide/index.astro', ['guide-threshold', 'guide-route-index']],
    'guide-overview': ['src/pages/guide/overview.astro', ['overview-threshold', 'overview-stage-list']],
    'guide-chapter': [
        'src/pages/guide/[chapter].astro',
        ['chapter-composition', 'chapter-hero', 'chapter-learning-list', 'chapter-action-list'],
    ],
    'knowledge-index': ['src/pages/knowledge/index.astro', ['knowledge-hero', 'knowledge-search', 'collection-atlas']],
    'knowledge-collection': [
        collectionSourcePaths,
        ['collection-intro-grid', 'collection-toolbar', 'record-index-viewport'],
    ],
    'record-detail': ['src/pages/knowledge/records/[...slug].astro', ['record-title-block', 'record-dossier']],
    'build-index': ['src/pages/knowledge/builds/index.astro', ['builds-workshop', 'weapon-lines']],
    'build-detail': [
        ['src/pages/knowledge/builds/[aspect].astro', 'src/components/builds/BuildVariantPanel.astro'],
        [
            'build-detail-hero',
            'build-view-control',
            'build-setup-panel',
            'build-variant-panel',
            'build-breakpoints',
            'build-plan-overview',
            'build-section',
        ],
    ],
    'tier-index': ['src/pages/knowledge/tier-lists/index.astro', ['tier-hall', 'tier-principles', 'tier-catalogue']],
    'tier-detail': [
        'src/pages/knowledge/tier-lists/[tier].astro',
        ['tier-list-hero', 'tier-view-control', 'tier-bands'],
    ],
};
const collectionLayouts = {
    achievements: '.record-index--achievements',
    arcana: '.record-index--arcana',
    boons: '.boon-pantheon',
    enemies: '.record-index--enemies',
    familiars: '.record-index--familiars',
    hammers: '.record-index--hammers',
    hexes: '.record-index--hexes',
    incantations: '.record-index--incantations',
    keepsakes: '.record-index--keepsakes',
    oath: '.record-index--oath',
    prophecies: '.record-index--prophecies',
    regions: '.record-index--regions',
    relationships: '.record-index--relationships',
    resources: '.economy-reference',
    story: '.story-codex-grid',
    weapons: '.weapon-family-index',
};

for (const [family, [sourcePath, requiredClasses]] of Object.entries(pageFamilyContracts)) {
    const source = (Array.isArray(sourcePath) ? sourcePath : [sourcePath])
        .map((path) => readFileSync(resolve(path), 'utf8'))
        .join('\n');
    for (const requiredClass of requiredClasses) {
        if (!source.includes(requiredClass))
            failures.push(`${family}: missing page-family layout marker ${requiredClass}`);
    }
}

for (const [collection, selector] of Object.entries(collectionLayouts)) {
    if (!styles.includes(selector) && !collectionSource.includes(selector.slice(1))) {
        failures.push(`${collection}: Knowledge collection has no collection-specific layout contract`);
    }
}

const collectionPresentationSource = readFileSync(
    resolve('src/components/collections/CollectionPresentation.astro'),
    'utf8'
);
const siteFooterSource = readFileSync(resolve('src/components/SiteFooter.astro'), 'utf8');

if (!tokenStyles.includes('--section-space: clamp(2.75rem, 4vw, 4rem)')) {
    failures.push('section rhythm: primary inter-section spacing has returned to an oversized desktop scale');
}

if (!tokenStyles.includes('--section-space-compact: clamp(1.75rem, 2.5vw, 2.75rem)')) {
    failures.push('section rhythm: compact transitions no longer use the shared reduced spacing scale');
}

requireStyleContract(
    /\.home-hero\s*\{[^}]*min-height:\s*clamp\(35rem,\s*72vh,\s*49rem\)[^}]*padding-block:\s*4rem\s+5rem/u,
    'home spacing: the hero no longer reserves its bounded entry and exit rhythm'
);

requireStyleContract(
    /\.home-offerings\s*\{[^}]*display:\s*grid[^}]*padding-block:\s*clamp\(4rem,\s*6vw,\s*7rem\)/u,
    'home spacing: the offerings no longer own their separate reader transition'
);

requireStyleContract(
    /\[data-surface='collection'\]\s+\.collection-intro-grid\s*\{[^}]*padding-block:\s*clamp\(1rem,\s*3vw,\s*2\.5rem\)\s+clamp\(1\.25rem,\s*3vw,\s*2\.5rem\)[^}]*border-bottom:\s*2px solid/u,
    'collection spacing: the orientation no longer has one bounded transition into its index'
);

requireStyleContract(
    /\[data-surface='collection'\]\s+\.collection-toolbar\s*\{[^}]*margin-block:\s*clamp\(1\.25rem,\s*3vw,\s*2\.5rem\)[^}]*padding-block:\s*var\(--space-3\)[^}]*border-block:\s*1px solid/u,
    'collection spacing: the filtering controls no longer retain their separate divider rhythm'
);

requireStyleContract(
    /\.build-detail-hero\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(15rem,\s*22rem\)[^}]*align-items:\s*end[^}]*padding-block:\s*clamp\(2\.5rem,\s*6vw,\s*7rem\)\s+clamp\(2rem,\s*4vw,\s*4rem\)/u,
    'build spacing: the detail hero no longer separates the decision from its supporting art'
);

requireStyleContract(
    /\.build-goal-sheet\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1\.15fr\)\s+minmax\(19rem,\s*0\.85fr\)[^}]*margin-top:\s*clamp\(3rem,\s*6vw,\s*6rem\)[^}]*padding-block:\s*clamp\(1\.5rem,\s*3vw,\s*2\.5rem\)[^}]*border-block:\s*2px solid/u,
    'build spacing: the active plan no longer has a distinct bounded decision surface'
);

if (siteFooterSource.includes('world-footer-status-mark')) {
    failures.push('site footer: decorative verification tile has returned');
}

requireStyleContract(
    /\.world-footer-meta\s*\{[^}]*display:\s*flex/u,
    'site footer: verification and repository metadata no longer share a compact row'
);

if (!/slug !== 'weapons'[\s\S]*?<RecordIndex/u.test(collectionPresentationSource)) {
    failures.push('weapons: authored weapon-family layout is followed by a duplicate generic record index');
}

for (const rule of styleRules) {
    const selector = rule.selectors.join(', ');
    const declarations = rule.declarations;
    if (!/:focus(?:-visible|-within)?\b/u.test(selector) || /::[\w-]+/u.test(selector)) continue;
    if (/\b(?:padding|margin|inset|top|right|bottom|left|width|height)\s*:/u.test(declarations)) {
        failures.push(`${selector.trim().replace(/\s+/gu, ' ')}: focus styling changes element geometry`);
    }
}

for (const selector of boxedSurfaces) {
    const padded = styleRules.some(
        (rule) =>
            rule.selectors.some((candidate) => candidate === selector || candidate.endsWith(` ${selector}`)) &&
            /\bpadding(?:-inline|-block|-left|-right|-top|-bottom)?\s*:/u.test(rule.declarations)
    );
    if (!padded) failures.push(`${selector}: visible surface has no declared internal spacing`);
}

const compoundInputTextInsets = ['.search-line input'];

for (const selector of compoundInputTextInsets) {
    const inset = styleRules.some(
        (rule) =>
            rule.selectors.includes(selector) &&
            /\b(?:padding|padding-inline|padding-left)\s*:\s*(?!0(?:\s|;|$))/u.test(rule.declarations)
    );
    if (!inset) failures.push(`${selector}: compound control text has no internal horizontal inset`);
}

const wrappingJumpNavigations = ['.build-jump', '.resource-jump-nav'];

for (const selector of wrappingJumpNavigations) {
    const wrapsWithoutClipping = styleRules.some(
        (rule) =>
            rule.selectors.includes(selector) &&
            /\bflex-wrap\s*:\s*wrap\b/u.test(rule.declarations) &&
            !/\boverflow-x\s*:\s*(?:auto|scroll|hidden|clip)\b/u.test(rule.declarations)
    );
    if (!wrapsWithoutClipping) {
        failures.push(`${selector}: jump navigation can clip or hide labels instead of wrapping`);
    }
}

if (
    !tierStyles.match(
        /\.tier-view-panel\s*>\s*\.tier-jump\s*\{[^}]*grid-auto-flow:\s*column[^}]*grid-auto-columns:\s*minmax\(5\.5rem,\s*1fr\)[^}]*overflow-x:\s*auto/u
    ) ||
    !contentRuntimeSource.includes(
        "const overflowFocusSelector = '.build-jump a, .tier-jump a, .resource-jump-nav a'"
    ) ||
    !contentRuntimeSource.includes("link?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' })")
) {
    failures.push('tier jump: the deliberate overflow row no longer reveals focused tiers to keyboard users');
}

const wideMultiColumnSurfaces = [
    '.guide-threshold',
    '.knowledge-hero',
    '.collection-intro-grid',
    '.builds-workshop',
    '.tier-hall',
    '.record-hero',
];

for (const selector of wideMultiColumnSurfaces) {
    const rule = new RegExp(
        `${escapeRegExp(selector)}(?:\\s*,[^{}]+)*\\s*\\{[^}]*grid-template-columns:\\s*(?!1fr(?:;|\\s))[^;}]+`,
        'gsu'
    );
    if (!rule.test(styles))
        failures.push(`${selector}: wide layout does not distribute independent content across columns`);
}

requireStyleContract(
    /\[data-surface='collection'\]\s+\.collection-intro-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1\.2fr\)\s+minmax\(18rem,\s*0\.8fr\)[^}]*align-items:\s*end/u,
    'collection intro: the wide orientation and purpose rail no longer have their deliberate editorial split'
);

requireStyleContract(
    /@media \(max-width: 900px\)[\s\S]*?\[data-surface='collection'\]\s+\.collection-intro-grid(?:\s*,[^{}]+)*\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/u,
    'collection intro: the editorial split does not stack before its supporting rail becomes too narrow'
);

if (
    /@media \(min-width: 761px\) and \(max-width: 1100px\)[\s\S]*?\.world-header\s*\{[^}]*grid-template-rows:\s*auto auto/u.test(
        styles
    )
) {
    failures.push('header: intermediate widths reintroduce the oversized two-row layout');
}

if (
    !/@media \(max-width: 1100px\)[\s\S]*?\.world-header\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto\s+3rem[^}]*grid-template-rows:\s*auto[^}]*min-height:\s*5rem/u.test(
        navigationStyles
    )
) {
    failures.push('header: compact widths no longer use the one-row, five-rem vertical-space budget');
}

requireStyleContract(
    /@media \(max-width: 900px\)[\s\S]*?\[data-surface='collection'\]\s+\.story-destinations\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/u,
    'story destinations: intermediate widths do not reduce the five-column layout'
);

requireStyleContract(
    /\.boon-priority-overview\s*\{[^}]*display:\s*grid[^}]*gap:\s*0[^}]*border-top:\s*1px solid/u,
    'build priority: recommendations no longer share one ordered reading ledger'
);

requireStyleContract(
    /\.boon-priority-overview\s*>\s*li\s*\{[^}]*grid-template-columns:\s*4\.5rem\s+minmax\(0,\s*1fr\)[^}]*border-bottom:\s*1px solid/u,
    'build priority: recommendation order no longer has its readable numeric rail and separators'
);

requireStyleContract(
    /@media \(max-width: 760px\)[\s\S]*?\.build-view-tabs\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/u,
    'build modes: view controls do not stack at narrow widths'
);

requireStyleContract(
    /@media \(max-width: 540px\)[\s\S]*?\.build-plan-summary\s*>\s*div(?:\s*,[^{}]+)*\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/u,
    'build modes: plan summaries do not stack their labels and values on narrow screens'
);

requireStyleContract(
    /\.record-layout\s*\{[^}]*align-items:\s*start/u,
    'record detail: dossier and relationship columns can stretch each other'
);

requireStyleContract(
    /\.tier-view-control\s+p\s*\{[^}]*max-width:\s*52rem/u,
    'tier detail: the ranking-goal explanation no longer keeps a bounded reading width'
);

requireStyleContract(
    /\.knowledge-starts\s*>\s*div\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/u,
    'knowledge index: starting points no longer form the intended three-column desktop index'
);

if (
    !/@media \(max-width: 1200px\)[\s\S]*?\.knowledge-starts\s*>\s*div\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/u.test(
        knowledgeCollectionStyles
    ) ||
    !/@media \(max-width: 760px\)[\s\S]*?\.knowledge-starts\s*>\s*div[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/u.test(
        knowledgeCollectionStyles
    )
) {
    failures.push('knowledge index: starting points do not reduce from three columns to a readable phone row');
}

requireStyleContract(
    /\.knowledge-gateways\s*>\s*a\s*\{[^}]*grid-template-columns:\s*5rem\s+minmax\(0,\s*1fr\)\s+auto[^}]*align-items:\s*center/u,
    'knowledge index: gateway rows no longer preserve the art, decision copy, and direction affordance'
);

requireStyleContract(
    /\.crossroads-departure\s*>\s*div\s*\{[^}]*display:\s*grid[^}]*gap:\s*0[^}]*border-top:\s*1px solid/u,
    'first return: departure steps no longer use the ordered divider treatment'
);

requireStyleContract(
    /\.overview-stage-priority\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*repeat\(3,/u,
    'guide overview: priority summaries no longer provide a grid fallback for count-aware balancing'
);

for (const marker of ["class='boon-priority-overview'", "class='useful-tier-grid'"]) {
    if (!buildDetailSource.includes(marker) || !buildDetailSource.includes('data-balanced-grid')) {
        failures.push(`build detail: missing count-aware grid contract near ${marker}`);
    }
}

if (
    !buildDetailSource.includes("'interaction-ledger'") ||
    !buildDetailSource.includes('data-interaction-count={preservedInteractions.length}') ||
    !buildDetailSource.includes('data-interaction-break-wide={wideInteractionBreaks.has(index) || undefined}') ||
    !buildDetailSource.includes('data-interaction-break-two={twoColumnInteractionBreaks.has(index) || undefined}') ||
    buildDetailSource.includes("class='interaction-grid'")
) {
    failures.push('build detail: Useful interactions do not use the shared continuous ledger');
}

requireStyleContract(
    /\.interaction-ledger\s*\{[^}]*column-count:\s*3[^}]*column-rule:\s*1px solid[^}]*border-top-width:\s*2px[^}]*box-shadow:/u,
    'build detail: Useful interactions lack the continuous three-column surface'
);

requireStyleContract(
    /\.interaction-ledger\s*>\s*li\s*\{[^}]*break-inside:\s*avoid[^}]*box-shadow:\s*inset 0 -1px/u,
    'build detail: Useful interaction entries can split or lose their shared ledger rhythm'
);

requireStyleContract(
    /\.interaction-ledger\s*>\s*li\[data-interaction-break-wide\]\s*\{[^}]*break-before:\s*column/u,
    'build detail: wide Useful interaction columns do not receive deterministic balanced breaks'
);

if (
    !buildDetailResponsiveStyles.match(
        /@media \(max-width:\s*1200px\)[\s\S]*?li\[data-interaction-break-wide\]\s*\{[^}]*break-before:\s*auto[\s\S]*?li\[data-interaction-break-two\]\s*\{[^}]*break-before:\s*column/u
    ) ||
    !buildDetailResponsiveStyles.match(
        /@media \(max-width:\s*900px\)[\s\S]*?li\[data-interaction-break-two\]\s*\{[^}]*break-before:\s*auto/u
    )
) {
    failures.push('build detail: Useful interaction column breaks do not adapt from wide to phone layouts');
}

requireStyleContract(
    /\.interaction-ledger article\s*\{[^}]*border-radius:\s*0[^}]*background:\s*transparent[^}]*box-shadow:\s*none/u,
    'build detail: Useful interactions have reverted to disjoint floating cards'
);

if (buildSpacingStyles.includes('.interaction-plan article')) {
    failures.push('build detail: refinement styles restore individual shadows to the Useful interactions ledger');
}

requireStyleContract(
    /\.rare-target-heading\s*>\s*\.record-link\s*\{[^}]*width:\s*100%[^}]*min-width:\s*0/u,
    'build detail: long rare-target names do not own a full-width title row'
);

requireStyleContract(
    /\.rare-target-group \.rare-targets\s*\{[^}]*display:\s*flex[^}]*flex-wrap:\s*wrap[^}]*justify-content:\s*center/u,
    'build detail: incomplete rare-target rows do not retain normal centered card widths'
);

requireStyleContract(
    /\.rare-targets\s*>\s*\.rare-target-card\s*\{[^}]*grid-template-rows:\s*auto minmax\(4\.8em,\s*auto\) auto auto/u,
    'build detail: rare-target effects and footers no longer share a stable card rhythm'
);

requireStyleContract(
    /\.rare-target-popover\s*\{[^}]*position:\s*fixed[^}]*z-index:\s*40[^}]*inset:\s*50% auto auto 50%[^}]*max-height:\s*calc\(100dvh\s*-\s*2rem\)[^}]*overflow-y:\s*auto[^}]*translate:\s*-50% -50%/u,
    'build detail: Requirement details do not remain a bounded separate overlay card'
);

requireStyleContract(
    /@supports \(position-area:\s*bottom span-left\) and \(anchor-name:\s*--requirement-card\)[\s\S]*?\.rare-target-popover\s*\{[^}]*inset:\s*auto[^}]*position-area:\s*bottom span-left[^}]*position-try-fallbacks:\s*flip-block,\s*flip-inline,\s*flip-block flip-inline[^}]*translate:\s*none/u,
    'build detail: supported browsers do not anchor Requirement cards before their first painted frame'
);

requireStyleContract(
    /\.rare-target-popover:popover-open\s*\{[^}]*display:\s*grid/u,
    'build detail: Requirement popovers have no explicit open-card layout'
);

if (
    !buildDetailSource.includes("popover='auto'") ||
    !buildDetailSource.includes('popovertarget=') ||
    !buildDetailSource.includes('style={`anchor-name:') ||
    !buildDetailSource.includes('style={`position-anchor:') ||
    buildDetailSource.includes('name={`${prefix}-rare-target-requirements`}')
) {
    failures.push('build detail: Requirement content can still resize its owning boon card');
}

if (
    !buildDetailSource.includes("class='rare-target-groups'") ||
    !buildDetailSource.includes("class='rare-target-opens-with'") ||
    !buildDetailSource.includes("'rare-target-group', `rare-target-group--${group.key}`") ||
    !/class='rare-target-card'[\s\S]*?<header class='rare-target-heading'>[\s\S]*?<footer>[\s\S]*?class='rare-target-requirements'/u.test(
        buildDetailSource
    )
) {
    failures.push('build detail: rare targets do not preserve title, effect, Boon chips, and footer control zones');
}

if (
    !buildDetailSource.includes("heading: 'Duo Boons'") ||
    !buildDetailSource.includes("heading: 'Legendary Boons'") ||
    !styles.includes('.rare-target-group--legendary')
) {
    failures.push('build detail: Legendary targets are not separated from Duo targets');
}

if (
    !buildDetailSource.match(
        /class='boon-lanes boon-lanes--complete'\s+data-balanced-grid\s+data-balanced-grid-layout='justified'\s+data-balanced-grid-align='row'\s+data-balanced-grid-min='22rem'\s+data-balanced-grid-max='3'/u
    )
) {
    failures.push('build detail: five-slot Boon cards retain the disjoint fixed 3+2 placement');
}

for (const contract of [
    ['ResizeObserver', 'does not react to container-width changes'],
    ['MutationObserver', 'does not react to filtering or disclosure changes'],
    [
        'mutationObserver.observe(document.body',
        'does not relayout content-weighted rows when an ancestor panel or disclosure becomes visible',
    ],
    ['window.requestAnimationFrame(update)', 'does not batch layout reads and writes'],
    ['itemCount % naturalColumns !== 1', 'does not detect a one-card final row'],
    ['grid.style.gridTemplateColumns', 'does not apply the balanced column count'],
    ["grid.dataset.balancedGridOrphan = 'center'", 'does not center an unavoidable final singleton'],
    ["grid.dataset.balancedGridLayout === 'justified'", 'does not distinguish content-weighted rows from equal grids'],
    ['const distributeWidths', 'does not distribute each default row according to its content load'],
    ['const raggedness =', 'does not compare candidate widths by rendered row raggedness'],
    ['pass < 4', 'does not converge card widths after text reflows'],
    ['widths = bestWidths', 'does not preserve the least-ragged measured row'],
    ["item.setAttribute('data-balanced-grid-justified-item'", 'does not expose justified-item layout state'],
    ["row[0]?.setAttribute('data-balanced-grid-row-start'", 'does not expose row edges to anchored overlays'],
    ['minimumItemWidth * 1.35', 'allows a singleton card to expand to the full container width'],
    ['columns === 1 ? rowWidth', 'caps every card in a single-column layout as though it were an orphan'],
    ["grid.dataset.balancedGridAlign === 'row'", 'does not distinguish aligned from independent rows'],
    ["item.style.alignSelf = alignRows ? 'stretch' : 'flex-start'", 'allows page CSS to defeat opt-in row alignment'],
    ['item.style.flexBasis', 'does not apply resolved row widths'],
    ['const tightenRowWidths', 'does not close visible row holes through bounded width transfers'],
    ['heightRange * 1000', 'does not prioritize occupied row silhouette over equal card widths'],
    ["grid.dataset.balancedGridBalance === 'tight'", 'does not scope tight balancing to opted-in grids'],
    ["grid.dataset.balancedGridBalance !== 'equal'", 'does not preserve equal widths for explicitly uniform rows'],
    ["'balanced-grid:change'", 'does not expose an explicit filter-driven relayout signal'],
]) {
    if (!balancedGridSource.includes(contract[0])) failures.push(`balanced grids: ${contract[1]}`);
}

if (
    balancedGridSource.includes("grid.dataset.balancedGridLayout === 'masonry'") ||
    balancedGridSource.includes('translate3d(')
) {
    failures.push('balanced grids: rejected masonry positioning has been reintroduced');
}

if (
    !collectionSource.includes("slug === 'familiars' ? '28rem' : '26rem'") ||
    !collectionSource.includes("data-balanced-grid-layout={balancesCardGrid ? 'justified' : undefined}") ||
    !collectionSource.includes('data-balanced-grid-min={balancesCardGrid ? balancedCardMinimum : undefined}') ||
    !collectionSource.includes("list.dataset.balancedGridLayout === 'justified'") ||
    !collectionSource.includes("!row.hasAttribute('data-balanced-grid-justified-item')") ||
    !collectionSource.includes("new Event('balanced-grid:change')")
) {
    failures.push(
        'collection cards: illustrated copy can be balanced into columns too narrow for its artwork and text'
    );
}

if (
    !recordFieldSource.match(
        /class='fact-list'[\s\S]{0,180}data-balanced-grid-layout='justified'[\s\S]{0,180}data-balanced-grid-min='14rem'/u
    )
) {
    failures.push('record facts: prose values can be balanced into unreadably narrow cards');
}

if (
    !recordFieldSource.match(
        /'prerequisite-groups',[\s\S]{0,240}data-balanced-grid\s+data-balanced-grid-min='17rem'\s+data-balanced-grid-max='4'/u
    ) ||
    /'prerequisite-groups',[\s\S]{0,240}data-balanced-grid-layout='justified'/u.test(recordFieldSource)
) {
    failures.push('record prerequisites: direct choice groups do not remain a uniform comparison row');
}

if (
    readerRuleSetSource.includes('border-radius: 999px') ||
    !readerRuleSetSource.match(/\.condition-groups\s*>\s*li\s*\{[^}]*border:\s*2px[^}]*box-shadow:/u) ||
    !readerRuleSetSource.match(/\.condition-groups ul\s*>\s*li\s*\{[^}]*border-block-end:/u) ||
    !readerRuleSetSource.includes('{detail && <small>{detail}</small>}')
) {
    failures.push('record conditions: static requirement entries have reverted to interactive-looking pills');
}

if (
    !readFileSync(resolve('src/pages/guide/[chapter].astro'), 'utf8').match(
        /class='chapter-action-list'\s+data-balanced-grid\s+data-balanced-grid-layout='independent'\s+data-balanced-grid-min='34rem'\s+data-balanced-grid-max='3'/u
    )
) {
    failures.push('guide actions: instruction cards no longer preserve independent readable columns');
}

if (
    !readFileSync(resolve('src/pages/guide/[chapter].astro'), 'utf8').match(
        /data-balanced-grid-layout='justified'\s+data-balanced-grid-align='row'\s+data-balanced-grid-balance='equal'\s+data-balanced-grid-min='18rem'/u
    )
) {
    failures.push('guide loadout: uniform cards no longer opt into equal aligned rows');
}

requireStyleContract(
    /\.chapter-actions-v2\s*>\s*ol\s*\{[^}]*--chapter-step-stagger:\s*0[^}]*border-top:\s*1px solid/u,
    'guide actions: the ordered instruction list no longer resets its decorative stagger'
);

if (!tierDetailSource.includes("<ol data-balanced-grid data-balanced-grid-min='20rem' data-balanced-grid-max='2'>")) {
    failures.push('tier details: two-column editorial lists can leave an unbalanced final entry');
}

for (const [page, source] of [
    ['build details', buildPageSource],
    ['tier details', tierDetailSource],
]) {
    if (
        !source.includes('captureInitialFragment') ||
        !source.includes('restoreInitialFragment') ||
        !source.includes('queueFragmentScroll')
    ) {
        failures.push(`${page}: view-dependent fragment links can use the pre-switch layout on first load`);
    }
}

if (
    !tierDetailSource.includes('tierAccordions.reveal(hash, scroll)') ||
    !exclusiveDetailsSource.includes('sibling !== detail && (sibling.open || states.get(sibling)?.intendedOpen)') ||
    !exclusiveDetailsSource.includes(
        'await Promise.all(siblings.map((sibling) => setOpen(sibling, false, animate)))'
    ) ||
    !exclusiveDetailsSource.includes('if (isCurrent()) await setOpen(detail, true, animate)')
) {
    failures.push('tier details: a direct fragment can leave both the default and requested tier open');
}

if (
    !viewFragmentSource.includes("document.documentElement.style.scrollBehavior = 'auto'") ||
    !viewFragmentSource.includes("url.hash = ''") ||
    !viewFragmentSource.includes("document.readyState === 'complete'") ||
    !viewFragmentSource.includes('if (pageReady && (stableFrames >= 3') ||
    !viewFragmentSource.includes("grid.hasAttribute('data-balanced-grid-columns')") ||
    !viewFragmentSource.includes("document.fonts.status === 'loaded'") ||
    !viewFragmentSource.includes('target.getBoundingClientRect().top + window.scrollY') ||
    !viewFragmentSource.includes('stableFrames >= 3') ||
    !viewFragmentSource.includes('layout === previousLayout') ||
    !viewFragmentSource.includes('!movingContent') ||
    !viewFragmentSource.includes('headerHeight + 16') ||
    !viewFragmentSource.includes("behavior: instant ? 'instant' : 'smooth'") ||
    !viewFragmentSource.includes("['wheel', 'touchstart', 'pointerdown', 'keydown']") ||
    !tierDetailSource.includes('event.preventDefault()') ||
    !viewFragmentSource.includes("document.dispatchEvent(new Event('balanced-grid:change'))") ||
    !viewFragmentSource.includes('document.documentElement.style.scrollBehavior = initialInlineScrollBehavior')
) {
    failures.push('view fragments: initial anchors can race view activation or retain forced non-animated scrolling');
}

requireStyleContract(
    /\[data-balanced-grid-orphan='center'\]\s*>\s*\[data-balanced-grid-orphan-item\]\s*\{[^}]*grid-column:\s*1\s*\/\s*-1[^}]*justify-self:\s*center/u,
    'balanced grids: unavoidable final entries are not centered at their original card width'
);

if (!baseStyles.match(/\[data-balanced-grid-layout='justified'\]\s*\{[^}]*display:\s*flex[^}]*flex-wrap:\s*wrap/u)) {
    failures.push('balanced grids: stable equal-width rows are not rendered as wrapping card rows');
}

if (
    !storyCollectionSource.match(
        /class='story-destinations'[\s\S]{0,180}data-balanced-grid\s+data-balanced-grid-min='11rem'\s+data-balanced-grid-max='5'/u
    ) ||
    !storyCollectionSource.match(
        /class='story-codex-grid'\s+data-balanced-grid\s+data-balanced-grid-min='18rem'\s+data-balanced-grid-max='4'/u
    ) ||
    storyCollectionSource.includes("data-balanced-grid-layout='justified'")
) {
    failures.push('Story cards: the original uniform collection grids were not preserved');
}

for (const contract of [
    ['boonPoolReferenceGroups(references)', 'god boon pools are not divided into reader-facing groups'],
    ['collectReferences(boons, 100)', 'god boon pools truncate providers with more than 24 Boons'],
    ["group('core', 'Core Boons'", 'god boon pools do not identify the five main slots'],
    ["'Legendary Boons'", 'Legendary Boons are not kept in their own group'],
    ["'Duo Boons'", 'Duo Boons are not kept in their own group'],
]) {
    if (!presentationSource.includes(contract[0])) failures.push(`record details: ${contract[1]}`);
}

if (
    !readerSectionsSource.includes("class='boon-pool-groups'") ||
    !readerSectionsSource.includes('data-boon-group={group.key}') ||
    !readerSectionsSource.includes('group.references.map((reference)')
) {
    failures.push('record details: boon pool groups are flattened before rendering');
}

requireStyleContract(
    /\.boon-pool-group\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*minmax\(10rem,\s*14rem\)\s+minmax\(0,\s*1fr\)/u,
    'record details: boon pool group labels and contents do not form readable rows'
);

requireStyleContract(
    /\.boon-pool-group\s*\{[^}]*max-width:\s*none/u,
    'record details: boon pool groups inherit the reading-width cap instead of using the available record width'
);

requireStyleContract(
    /\.boon-pool-group--legendary\s*>\s*header\s*\{[^}]*border-inline-start-color:\s*var\(--ember\)/u,
    'record details: Legendary Boons have no distinct group signal'
);

requireStyleContract(
    /@media \(max-width:\s*620px\)[\s\S]*?\.boon-pool-group\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/u,
    'record details: boon pool groups do not stack on narrow screens'
);

if (
    !contentRuntimeSource.includes("import { startBalancedGridLayout } from './balanced-grid'") ||
    !contentRuntimeSource.includes("startIsolated('balanced grid layout', startBalancedGridLayout)")
) {
    failures.push('balanced grids: the shared content runtime no longer starts the layout controller in isolation');
}

requireStyleContract(
    /\.record-title-block\s*>\s*p\s*\{[^}]*font-size:\s*clamp\(1\.3rem,/u,
    'record detail: summary text falls below the large-copy reading contract'
);

requireStyleContract(
    /html\s*\{[^}]*font-size:\s*clamp\(111\.111%,\s*calc\(0\.7222rem\s*\+\s*0\.3241vw\),\s*150%\)/u,
    'global typography: the anti-zoom root scale no longer reaches 20px labels and 24px body copy'
);

requireStyleContract(
    /--type-body:\s*1\.35rem/u,
    'global typography: body copy falls below the 24px comfort role at ordinary widths'
);

requireStyleContract(
    /--type-support:\s*clamp\(1\.125rem,\s*1\.0875rem\s*\+\s*0\.2vw,\s*1\.25rem\)/u,
    'global typography: support copy falls below the 20px comfort floor'
);

requireStyleContract(/--type-label:\s*1\.125rem/u, 'global typography: labels fall below the 20px comfort floor');

for (const role of ['body', 'support', 'label']) {
    const declarations = [...styles.matchAll(new RegExp(`--type-${role}\\s*:`, 'gu'))];
    if (declarations.length !== 1) {
        failures.push(`global typography: --type-${role} must have one shared owner, found ${declarations.length}`);
    }
}

requireStyleContract(
    /\.progression-matrix-value\s*\{[^}]*font-size:\s*clamp\(1\.3rem,/u,
    'record progression: comparison values fall below the large-copy reading contract'
);

requireStyleContract(
    /\.progression-table--matrix\s*\{[^}]*width:\s*100%/u,
    'record progression: comparison table no longer uses the available reading width'
);

requireStyleContract(
    /\.prerequisite-choice\s*>\s*\.field-lead\s*\{[^}]*font-size:\s*clamp\(1\.125rem,/u,
    'record prerequisites: lead copy falls below the minimum reading size'
);

requireStyleContract(
    /@media \(max-width: 1100px\)[\s\S]*?\.world-primary-nav\s*\{[^}]*position:\s*fixed[^}]*transform:\s*translateX\(100%\)/u,
    'compact navigation: primary links no longer enter as a right-side overlay'
);

requireStyleContract(
    /@media \(max-width: 1100px\)[\s\S]*?\.world-primary-nav a\s*\{[^}]*font-size:\s*clamp\(1\.25rem,/u,
    'compact navigation: drawer labels fall below the large touch-reading contract'
);

requireStyleContract(
    /\.world-header\.is-navigation-open \.world-primary-nav\s*\{[^}]*transform:\s*translateX\(0\)/u,
    'compact navigation: open state does not settle the drawer onscreen'
);

requireStyleContract(
    /@media \(max-width: 760px\)[\s\S]*?\.world-search-icon\s*\{[^}]*display:\s*inline-block/u,
    'mobile navigation: search no longer condenses to an icon at phone widths'
);

for (const marker of [
    "aria-controls='world-primary-navigation'",
    "aria-expanded='false'",
    "class='ph ph-magnifying-glass world-search-icon'",
    "event.key === 'Escape'",
    "primaryNavigation.addEventListener('focusout'",
    "document.addEventListener('pointerdown'",
]) {
    if (!siteHeaderSource.includes(marker)) failures.push(`mobile navigation: missing interaction contract ${marker}`);
}

requireStyleContract(
    /@media \(max-width: 1180px\)[\s\S]*?\.record-index-link--illustrated\s*\{[^}]*grid-template-columns:\s*5\.25rem\s*minmax\(0,\s*1fr\)/u,
    'collection records: intermediate widths retain the wide four-column card layout'
);

requireStyleContract(
    /\.region-map__key\s*\{[^}]*font-size:\s*var\(--type-support\)/u,
    'region maps: labels no longer use the shared readable HTML key'
);

if (
    !/@media \(max-width: 1200px\)[\s\S]*?\.context-ribbon\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/u.test(
        buildDetailResponsiveStyles
    )
) {
    failures.push('build context ratings: intermediate widths can squeeze four cards until their labels collide');
}

if (
    !/@media \(max-width: 620px\)[\s\S]*?\.context-ribbon\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/u.test(
        buildDetailResponsiveStyles
    )
) {
    failures.push('build context ratings: phone widths do not switch to a readable single-card row');
}

if (
    !/@media \(max-width: 620px\)[\s\S]*?\.rare-target-group \.rare-targets\s*\{[^}]*--rare-target-columns:\s*1/u.test(
        buildDetailResponsiveStyles
    )
) {
    failures.push('build rare targets: the desktop four-card selector still wins at phone widths');
}

if (/\.surface-tiers\s+\.content-main\s*\{[^}]*max-width:/u.test(styles)) {
    failures.push('tier routes: the main content rail no longer shares the header and footer world width');
}

if (
    !/@media \(max-width: 350px\)[\s\S]*?\.home-offering\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/u.test(
        homeResponsiveStyles
    )
) {
    failures.push('home offerings: narrow phones leave too little width for long offer titles');
}

if (
    !/@media \(max-width: 430px\)[\s\S]*?\.tier-view-panel\s*>\s*\.tier-jump\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)[^}]*overflow:\s*visible/u.test(
        tierResponsiveStyles
    )
) {
    failures.push('tier jump: phone widths hide the final tier behind an unannounced horizontal scroll');
}

if (!/@media \(max-width: 620px\)[\s\S]*?\.tier-entry-record-link\s*\{[^}]*width:\s*100%/u.test(tierResponsiveStyles)) {
    failures.push('tier entries: phone-width record links collapse their copy column to its min-content width');
}

if (
    !/@media \(max-width: 430px\)[\s\S]*?\.tier-entry-record-link\s*\{[^}]*grid-template-columns:\s*3\.75rem\s+minmax\(0,\s*1fr\)/u.test(
        tierResponsiveStyles
    )
) {
    failures.push('tier entries: narrow phones reserve too much of each record row for artwork');
}

if (/@media \(max-width: 1100px\)[\s\S]*?\.overview-stage-priority\s*\{[^}]*align-items:\s*stretch/u.test(styles)) {
    failures.push('guide overview: intermediate priority summaries re-enable equal-height stretching');
}

requireStyleContract(
    /\.chapter-composition\[data-chapter-id='advanced-boon-planning'\] \.chapter-actions-v2\s*>\s*ol\s*\{[^}]*grid-template-columns:\s*repeat\(2,[^}]*align-items:\s*start/u,
    'advanced boon planning: desktop actions do not use content-height paired columns'
);

requireStyleContract(
    /\.chapter-orientation\s*\{[^}]*display:\s*grid[^}]*gap:\s*1\.25rem/u,
    'guide chapters: orientation no longer keeps its compact single-column reading flow'
);

requireStyleContract(
    /\.chapter-orientation\s+blockquote\s*\{[^}]*padding:\s*1\.25rem\s+0\s+1\.25rem\s+1\.35rem[^}]*border-left:\s*2px solid/u,
    'guide chapters: orientation callouts no longer retain their left-rule reading cue'
);

requireStyleContract(
    /\.choice-table\s*>\s*ul\s*>\s*li\s*\{[^}]*grid-template-columns:\s*minmax\(14rem,\s*0\.9fr\)\s+minmax\(11rem,\s*0\.72fr\)\s+minmax\(22rem,\s*1\.6fr\)[^}]*align-items:\s*baseline/u,
    'guide choices: decision rows no longer present condition, action, and reason on one aligned line'
);

requireStyleContract(
    /\.choice-table\s*>\s*ul\s*>\s*li\s*>\s*\*\s*\{[^}]*text-align:\s*left/u,
    'guide choices: decision-row copy no longer follows the shared left reading edge'
);

requireStyleContract(
    /\.choice-table__situation\s*\{[^}]*font-size:\s*clamp\(1\.375rem,\s*2vw,\s*1\.625rem\)/u,
    'guide choices: the white condition no longer leads the cyan action and body copy'
);

requireStyleContract(
    /@media \(max-width: 800px\)[\s\S]*?\.choice-table\s*>\s*ul\s*>\s*li\s*\{[^}]*grid-template-columns:\s*1fr/u,
    'guide choices: constrained viewports do not stack decision-row content'
);

requireStyleContract(
    /\.chapter-learning\s*>\s*ul,[\s\S]*?\.choice-table\s*>\s*ul,[\s\S]*?\.chapter-overlap\s*>\s*div\s*\{[^}]*display:\s*grid[^}]*list-style:\s*none/u,
    'guide chapters: learning facts no longer participate in the shared bullet-free list reset'
);

requireStyleContract(
    /\.chapter-learning\s*>\s*ul\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)[^}]*gap:\s*0/u,
    'guide chapters: learning facts no longer use one compact reading column'
);

requireStyleContract(
    /\.chapter-learning\s*>\s*ul\s*>\s*li\s*\{[^}]*padding:\s*1rem\s+0\s+1rem\s+1\.25rem[^}]*border-top:\s*1px solid/u,
    'guide chapters: learning facts no longer retain their divider and reading inset'
);

if (
    !guideChecklistSource.match(
        /class='guide-checklist-heading'[\s\S]{0,180}<h2[^>]*>[\s\S]{0,120}<p class='guide-checklist-count'/u
    )
) {
    failures.push('guide checklists: the progress count is no longer grouped beside its heading');
}

requireStyleContract(
    /\.guide-checklist-heading\s*\{[^}]*display:\s*flex[^}]*flex-wrap:\s*wrap[^}]*align-items:\s*center[^}]*justify-content:\s*space-between/u,
    'guide checklists: heading and progress count no longer share their responsive heading row'
);

requireStyleContract(
    /@media \(min-width:\s*1201px\)[\s\S]*?\.guide-checklist\s*>\s*ul\s*\{[^}]*margin-inline:\s*auto/u,
    'guide checklists: the desktop checklist loses its centered panel alignment'
);

requireStyleContract(
    /\.build-section\s*>\s*header,[\s\S]*?\.build-synergy\s*>\s*header\s*\{[^}]*max-width:\s*var\(--reading\)[^}]*margin-inline:\s*auto[^}]*text-align:\s*center/u,
    'build sections: centered header containers no longer center their internal heading and supporting copy'
);

requireStyleContract(
    /\.route-plan-prose\s*\{[^}]*display:\s*grid[^}]*gap:\s*1rem[^}]*width:\s*min\(100%,\s*var\(--reading-compact\)\)[^}]*margin-inline:\s*auto/u,
    'build route decisions: the prose block no longer shares the centered reading axis of its section heading'
);

requireStyleContract(
    /\.route-plan-prose\s*>\s*p\s*\{[^}]*margin:\s*0[^}]*color:\s*var\(--paper-soft\)[^}]*line-height:\s*1\.7/u,
    'build route decisions: the prose treatment has lost its paragraph rhythm'
);

if (
    !buildDetailSource.includes("class='route-plan-prose'") ||
    !buildDetailSource.includes('variant.bossRouteConsiderations.map((consideration) => <p>{consideration}</p>)') ||
    /class='build-section route-plan'[\s\S]{0,220}<ul/u.test(buildDetailSource)
) {
    failures.push('build route decisions: ordinary prose is still rendered as a bulleted list');
}

requireStyleContract(
    /\.builds-workshop\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(21rem,\s*34rem\)/u,
    'build index: the artwork rail has returned to an unbounded fractional column'
);

requireStyleContract(
    /\.builds-workshop-art\s*\{[^}]*width:\s*100%[^}]*max-width:\s*34rem[^}]*justify-self:\s*end/u,
    'build index: the artwork shrink-wraps inside its centered rail and leaves a wide inert gap'
);

requireStyleContract(
    /\.build-plan-sequence\s+ol\s*\{[^}]*display:\s*flex[^}]*flex-wrap:\s*wrap[^}]*align-items:\s*center[^}]*background:\s*linear-gradient/u,
    'build combat sequence: desktop steps no longer share one content-aware sequence rail'
);

requireStyleContract(
    /\.build-plan-sequence\s+ol\s*>\s*li\s*\{[^}]*flex:\s*var\(--sequence-width-share\)\s+1\s+0[^}]*min-width:\s*min\(100%,\s*10\.5rem\)[^}]*max-width:\s*100%/u,
    'build combat sequence: step width no longer follows its rendered copy length'
);

if (!buildDetailSource.includes('style={`--sequence-width-share: ${sequenceWidthShare(step)}`}')) {
    failures.push('build combat sequence: the shared template no longer publishes a proportional width per step');
}

if (!buildDetailSource.includes('<ol data-sequence-size={variant.playstyleCombatSequence.length}>')) {
    failures.push('build combat sequence: the shared template no longer exposes its step count to responsive layout');
}

if (!buildDetailSource.includes('<article data-boon-priority={index + 1}>')) {
    failures.push('build main Boons: the shared template no longer exposes priority for asymmetric layout');
}

requireStyleContract(
    /\.boon-lanes\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)[^}]*grid-template-rows:\s*auto auto[^}]*align-items:\s*start/u,
    'build main Boons: desktop lanes return to equal-height rows instead of the priority-led composition'
);

for (const [priority, column, row] of [
    ['1', '1', '1 / span 2'],
    ['2', '2', '1'],
    ['3', '3', '1'],
    ['4', '2', '2'],
    ['5', '3', '2'],
]) {
    const pattern = new RegExp(
        `\\.boon-lanes\\s*>\\s*article\\[data-boon-priority='${priority}'\\]\\s*\\{[^}]*grid-column:\\s*${column}[^}]*grid-row:\\s*${row.replaceAll('/', '\\/')}`,
        'u'
    );
    if (!pattern.test(styles)) failures.push(`build main Boons: Priority ${priority} lost its desktop placement`);
}

if (
    !/@media \(max-width: 101rem\)[\s\S]*?\.build-plan-sequence\s+ol\[data-sequence-size='4'\]\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/u.test(
        buildDetailResponsiveStyles
    )
) {
    failures.push('build combat sequence: four-step plans no longer use the compact two-by-two fallback');
}

if (
    !/@media \(max-width: 1100px\)[\s\S]*?\.boon-lanes\s*>\s*article\[data-boon-priority='1'\]\s*\{[^}]*grid-column:\s*1[^}]*grid-row:\s*1\s*\/\s*span 4/u.test(
        buildDetailResponsiveStyles
    )
) {
    failures.push('build main Boons: intermediate widths no longer keep Priority 1 beside the supporting stack');
}

if (
    !/@media \(max-width: 760px\)[\s\S]*?\.boon-lanes\s*>\s*article\[data-boon-priority\]\s*\{[^}]*grid-column:\s*auto[^}]*grid-row:\s*auto/u.test(
        buildDetailResponsiveStyles
    )
) {
    failures.push('build main Boons: narrow widths retain multi-column priority placement');
}

if (
    !/@media \(max-width: 900px\)[\s\S]*?\.build-plan-sequence\s+ol\[data-sequence-size\]\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/u.test(
        buildDetailResponsiveStyles
    )
) {
    failures.push('build combat sequence: the four-step tablet rule can override the readable phone stack');
}

if (/\.chapter-learning\s*>\s*ul\s*\{[^}]*grid-template-columns:\s*repeat\(/u.test(styles)) {
    failures.push('guide chapters: learning facts return to an uneven multi-column grid');
}

requireStyleContract(
    /@media \(min-width: 1201px\)[\s\S]*?\.chapter-actions-v2\s*>\s*ol\s*\{[^}]*align-items:\s*start/u,
    'guide chapters: desktop action cards stretch to their tallest row partner'
);

requireStyleContract(
    /\.chapter-actions-v2\s*>\s*ol\s*>\s*li:nth-child\(even\)\s*\{[^}]*margin-top:\s*var\(--chapter-step-stagger\)/u,
    'guide chapters: even action cards no longer share one deliberate stagger'
);

if (
    /@media \(min-width: 1201px\)[\s\S]*?\.chapter-actions-v2\s*>\s*ol\s*>\s*li\s*\{[^}]*height:\s*100%/u.test(styles)
) {
    failures.push('guide chapters: desktop action cards re-enable equal-height stretching');
}

requireStyleContract(
    /@media \(max-width: 980px\)[\s\S]*?\.overview-stage\s*>\s*header,\s*\.overview-stage-priority,\s*\.overview-stage-lanes\s*\{[^}]*grid-column:\s*1/u,
    'guide overview: the intermediate single-column stage leaves content assigned to an implicit second column'
);

if (/record-index-viewport[^}]*overflow-y\s*:/u.test(styles)) {
    failures.push('record index: collection viewport creates a nested vertical scrollbar');
}

if (
    !/observeWindowOffset/u.test(collectionSource) ||
    !/observeWindowRect/u.test(collectionSource) ||
    !/getScrollElement:\s*\(\)\s*=>\s*window/u.test(collectionSource)
) {
    failures.push('record index: long collections do not share document-scroll virtualization across widths');
}

if (!/@media \(max-width: 900px\)[\s\S]*?\.home-hero-copy\s*\{[^}]*padding-inline:\s*var\(--space-4\)/u.test(styles)) {
    failures.push('mobile home hero: the visible copy panel does not reserve an internal text inset');
}

if (
    !/class='world-footer-repository'[\s\S]*?aria-label='GitHub repository and methodology \(opens in a new tab\)'[\s\S]*?\bph-github-logo\b/u.test(
        siteFooterSource
    )
) {
    failures.push('site footer: icon-only repository control is missing its accessible GitHub destination');
}

if (siteFooterSource.includes('Repository &amp; methodology')) {
    failures.push('site footer: repository control has regained a visible text label');
}

requireStyleContract(
    /\.world-footer-repository\s*\{[^}]*display:\s*inline-grid[^}]*width:\s*var\(--control-height\)[^}]*height:\s*var\(--control-height\)[^}]*place-items:\s*center[^}]*padding:\s*0[^}]*background:\s*transparent/u,
    'site footer: repository control is no longer a compact icon-only target'
);

requireStyleContract(
    /\.world-footer-repository\s+\.ph-github-logo\s*\{[^}]*font-size:\s*1\.75rem/u,
    'site footer: GitHub icon no longer has a readable destination-icon scale'
);

requireStyleContract(
    /\.world-footer\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\) auto auto/u,
    'site footer: the desktop GitHub control no longer follows the verification link'
);

requireStyleContract(
    /@media \(max-width:\s*760px\)[\s\S]*?\.world-footer\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\) auto[^}]*\}[\s\S]*?\.world-footer-meta\s*\{[^}]*grid-column:\s*1\s*\/\s*-1[^}]*grid-row:\s*2[^}]*\}[\s\S]*?\.world-footer-repository\s*\{[^}]*grid-column:\s*2[^}]*grid-row:\s*1/u,
    'site footer: narrow screens do not keep GitHub at the top right and verification below'
);

if (
    siteFooterSource.includes('ph-arrow-square-out') ||
    !siteFooterSource.includes('aria-label={`${steamPatch.name} (${steamPatch.releasedOn}) (opens in a new tab)`}')
) {
    failures.push('site footer: the verification link lacks its arrow-free accessible new-tab treatment');
}

requireStyleContract(
    /@media \(max-width:\s*760px\)[\s\S]*?\.world-footer-patch\s*\{[^}]*justify-content:\s*center[^}]*text-align:\s*center/u,
    'site footer: the mobile verification link is not horizontally centered'
);

requireStyleContract(
    /\.world-footer-meta a\s*\{[^}]*border:\s*0[^}]*border-radius:\s*0[^}]*background:\s*transparent[^}]*box-shadow:\s*none/u,
    'site footer: the verification link has regained a fake button treatment'
);

const headerFocus = styles.match(
    /\.world-header :is\(\.world-wordmark, \.world-primary-nav a, \.world-search, \.world-menu-toggle\):focus-visible\s*\{([^}]*)\}/u
)?.[1];
if (!headerFocus) {
    failures.push('header focus: custom focus rule is missing');
} else if (/\b(?:padding|margin|width|height)\s*:/u.test(headerFocus)) {
    failures.push('header focus: focus styling changes element geometry');
}

if (failures.length > 0) {
    console.error(`Layout contract audit failed with ${failures.length} issue(s):`);
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exitCode = 1;
} else {
    console.warn(JSON.stringify({ layoutContractAudit: 'passed', boxedSurfaces: boxedSurfaces.length }));
}
