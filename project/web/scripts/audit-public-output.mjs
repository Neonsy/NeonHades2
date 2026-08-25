import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import sharp from 'sharp';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const root = fileURLToPath(new URL('../dist/', import.meta.url));
const fileEnv = loadEnv('production', projectRoot, '');
const publicSiteValue =
    process.env.PUBLIC_SITE_URL?.trim() || fileEnv.PUBLIC_SITE_URL?.trim() || 'http://127.0.0.1:4321';
const publicSite = new URL(publicSiteValue);
const failures = [];
const buildPageSource = readFileSync(join(projectRoot, 'src/pages/knowledge/builds/[aspect].astro'), 'utf8');
const buildPanelSource = readFileSync(join(projectRoot, 'src/components/builds/BuildVariantPanel.astro'), 'utf8');
for (const behavior of ['ArrowRight', 'ArrowLeft', 'Home', 'End', 'popstate', 'pushState']) {
    if (!buildPageSource.includes(behavior)) {
        failures.push(`Build goal control source is missing ${behavior} behavior.`);
    }
}
for (const view of ['setup', 'strongest', 'safest']) {
    if (!buildPageSource.includes(`data-build-view-button='${view}'`)) {
        failures.push(`Build goal control source is missing its ${view} tab.`);
    }
}
for (const enhancement of [
    "tablist?.setAttribute('role', 'tablist')",
    "button.setAttribute('role', 'tab')",
    "panel.setAttribute('role', 'tabpanel')",
]) {
    if (!buildPageSource.includes(enhancement)) {
        failures.push(`Build goal control source is missing progressive enhancement: ${enhancement}`);
    }
}
for (const requirementCardBehavior of ["card.matches(':popover-open')", 'card.hidePopover()']) {
    if (!buildPageSource.includes(requirementCardBehavior)) {
        failures.push(`Build requirement card is missing ${requirementCardBehavior} behavior.`);
    }
}
if (
    !buildPanelSource.includes("popover='auto'") ||
    !buildPanelSource.includes('popovertarget=') ||
    !buildPanelSource.includes('style={`anchor-name:') ||
    !buildPanelSource.includes('style={`position-anchor:')
) {
    failures.push('Build requirement cards no longer use exclusive top-layer popovers.');
}
for (const removedRequirementBehavior of [
    'rare-target-preview',
    'positionRequirementPopover',
    'positionRequirementCard',
    "card.addEventListener('toggle'",
    'data-positioned',
    'previewSuppressed',
    'Hover or focus a target',
]) {
    if (buildPageSource.includes(removedRequirementBehavior) || buildPanelSource.includes(removedRequirementBehavior)) {
        failures.push(`Build requirement disclosure restored removed hover behavior: ${removedRequirementBehavior}.`);
    }
}
if (!buildPanelSource.includes('<span>Requirement</span>')) {
    failures.push('Build requirement disclosure control is no longer singular.');
}
if (buildPanelSource.includes("<span aria-hidden='true'> + </span>")) {
    failures.push('Build requirement disclosure has restored plus-sign separators between the plan choices.');
}
for (const removedBuildSlotPattern of ['supportLanes', 'support-lanes', 'Optional slot']) {
    if (buildPanelSource.includes(removedBuildSlotPattern)) {
        failures.push(`Build page demotes a required five-slot recommendation: ${removedBuildSlotPattern}.`);
    }
}
if (!buildPanelSource.includes('mainLanes.map((lane, index)')) {
    failures.push('Build page no longer renders every Attack, Special, Cast, Dash, and Gain lane as a main choice.');
}
for (const removedSplitPlanPattern of [
    "class='build-variant-summary'",
    "class='build-loop'",
    "class='strength-line'",
    'How the pieces work together',
]) {
    if (buildPanelSource.includes(removedSplitPlanPattern)) {
        failures.push(`Build page splits related run-plan information again: ${removedSplitPlanPattern}.`);
    }
}
const crossroadsLandscapeProvenance = JSON.parse(
    readFileSync(join(projectRoot, 'scripts/artwork/the-crossroads-landscape.json'), 'utf8')
);

function sha256(path) {
    return createHash('sha256').update(readFileSync(path)).digest('hex');
}

const crossroadsLandscapeDelivery = join(
    projectRoot,
    'public',
    crossroadsLandscapeProvenance.asset.replace(/^\/+/, '')
);

if (!existsSync(crossroadsLandscapeDelivery)) {
    failures.push(`Crossroads landscape delivery is missing: ${crossroadsLandscapeProvenance.asset}`);
} else {
    if (sha256(crossroadsLandscapeDelivery) !== crossroadsLandscapeProvenance.delivery.sha256) {
        failures.push('Crossroads landscape delivery hash does not match its provenance record.');
    }
    const crossroadsLandscapeMetadata = await sharp(crossroadsLandscapeDelivery).metadata();
    if (
        crossroadsLandscapeMetadata.width !== crossroadsLandscapeProvenance.delivery.width ||
        crossroadsLandscapeMetadata.height !== crossroadsLandscapeProvenance.delivery.height ||
        crossroadsLandscapeMetadata.format !== crossroadsLandscapeProvenance.delivery.format
    ) {
        failures.push('Crossroads landscape delivery metadata does not match its provenance record.');
    }
}
const publication = JSON.parse(readFileSync(join(projectRoot, 'src/content/publication.json'), 'utf8'));
const fieldBySuffix = (record, suffix) => record.fields.find((field) => field.id.endsWith(`/${suffix}`))?.value;
const buildSlotLabels = {
    attack: 'Attack',
    special: 'Special',
    cast: 'Cast',
    sprint: 'Dash',
    omega: 'Gain',
};
const aspectGuides = publication.records.filter((record) => record.recordType === 'editorial/aspect-guide');
const buildExpectationsByRoute = new Map(
    aspectGuides.map((guide) => {
        const weaponGuide = publication.records.find((record) => {
            if (record.recordType !== 'editorial/weapon-guide') return false;
            const subjects = fieldBySuffix(record, 'subject-aspects');
            return subjects?.aspects?.some(
                (reference) => reference?.recordType === 'mechanics/weapon-aspect' && reference.id === guide.id
            );
        });
        const ranks = fieldBySuffix(guide, 'rank-evaluations');
        const capability =
            typeof ranks?.overallReason === 'string'
                ? ranks.overallReason.split(' Main limitation: ')[0].trim().replace(/\.$/u, '')
                : '';
        const variants = fieldBySuffix(guide, 'build-variants');
        const modes = Object.fromEntries(
            ['strongest', 'safest'].map((goal) => {
                const variant = variants?.[goal];
                const lanes = Array.isArray(variant?.boonPriorities) ? variant.boonPriorities : [];
                const targets = Array.isArray(variant?.duoLegendaryTargets) ? variant.duoLegendaryTargets : [];
                return [
                    goal,
                    {
                        goal: variant?.goal,
                        slotOrder: lanes.map((lane) => buildSlotLabels[lane?.slot]).filter(Boolean),
                        mainSlotOrder: lanes.map((lane) => buildSlotLabels[lane?.slot]).filter(Boolean),
                        completeChoices: lanes.every(
                            (lane) =>
                                Array.isArray(lane?.preferred) &&
                                lane.preferred.length > 0 &&
                                Array.isArray(lane?.fallback) &&
                                lane.fallback.length > 0
                        ),
                        completeBreakpoints:
                            Array.isArray(variant?.powerBreakpoints) &&
                            variant.powerBreakpoints.length >= 2 &&
                            variant.powerBreakpoints.some((breakpoint) => breakpoint?.stage === 'online') &&
                            new Set(
                                variant.powerBreakpoints.map(
                                    (breakpoint) =>
                                        `${breakpoint?.condition}|${JSON.stringify(breakpoint?.references ?? [])}`
                                )
                            ).size === variant.powerBreakpoints.length,
                        completeTargets: targets.every(
                            (target) =>
                                Array.isArray(target?.requirementGroups) &&
                                target.requirementGroups.length > 0 &&
                                target.requirementGroups.every((group) => Array.isArray(group) && group.length > 0) &&
                                Array.isArray(target?.selectedPrerequisites) &&
                                target.selectedPrerequisites.length === target.requirementGroups.length &&
                                target.selectedPrerequisites.every((selected, index) =>
                                    target.requirementGroups[index]?.some(
                                        (candidate) =>
                                            candidate?.recordType === selected?.recordType &&
                                            candidate?.id === selected?.id
                                    )
                                ) &&
                                typeof target?.requirementSummary === 'string' &&
                                target.requirementSummary.length > 0
                        ),
                        hasReusedTargetSelection: targets.some(
                            (target) =>
                                new Set(
                                    target?.selectedPrerequisites?.map(
                                        (reference) => `${reference?.recordType}:${reference?.id}`
                                    ) ?? []
                                ).size < (target?.selectedPrerequisites?.length ?? 0)
                        ),
                    },
                ];
            })
        );
        const route = `${guide.public?.href?.replace(/^\/+|\/+$/gu, '')}/index.html`;
        return [
            route,
            {
                aspect: guide.public?.name ?? '',
                capability,
                modes,
                weapon: weaponGuide?.public?.name ?? '',
            },
        ];
    })
);
if (aspectGuides.length !== 24) {
    failures.push(`publication contains ${aspectGuides.length} aspect builds; expected 24`);
}
for (const [route, expectation] of buildExpectationsByRoute) {
    const modeNames = Object.keys(expectation.modes).sort();
    if (modeNames.length !== 2 || modeNames[0] !== 'safest' || modeNames[1] !== 'strongest') {
        failures.push(`${route}: publication must contain exactly safest and strongest build modes`);
        continue;
    }
    for (const [mode, variant] of Object.entries(expectation.modes)) {
        if (variant.goal !== mode) {
            failures.push(`${route}: ${mode} publication variant has mismatched goal ${String(variant.goal)}`);
        }
        if (variant.slotOrder.length !== Object.keys(buildSlotLabels).length) {
            failures.push(
                `${route}: ${mode} publication variant has ${variant.slotOrder.length} Boon slots; expected ${Object.keys(buildSlotLabels).length}`
            );
        }
        if (!variant.completeChoices) {
            failures.push(
                `${route}: ${mode} publication variant has a Boon slot without preferred and fallback choices`
            );
        }
        if (!variant.completeBreakpoints) {
            failures.push(`${route}: ${mode} publication variant has no complete online breakpoint sequence`);
        }
        if (!variant.completeTargets) {
            failures.push(`${route}: ${mode} publication variant has an incomplete Duo or Legendary requirement`);
        }
    }
}
const incantations = publication.records.filter((record) => record.recordType === 'mechanics/incantation');
let delayedIncantationCount = 0;
for (const incantation of incantations) {
    const availability = incantation.fields.find((field) => field.id === 'mechanics/incantation/availability');
    if (!availability) {
        failures.push(`${incantation.key}: missing Cauldron availability field`);
        continue;
    }
    if (availability.value === null) continue;
    const rules = availability.value?.rules;
    if (
        !Array.isArray(rules) ||
        rules.length !== 2 ||
        !rules.some((rule) => /reveals at most \d+ new Incantations.+each night/u.test(rule)) ||
        !rules.some((rule) => /fixed Cauldron order.+do not need to be completed/u.test(rule))
    ) {
        failures.push(`${incantation.key}: invalid Cauldron reveal timing`);
        continue;
    }
    delayedIncantationCount += 1;
}
if (incantations.length === 0 || delayedIncantationCount === 0) {
    failures.push('publication does not contain source-derived Incantation reveal timing');
}
const kingVerminKey = 'world-progression/enemy:CrawlerMiniboss';
const kingVermin = publication.records.find((record) => record.key === kingVerminKey);
const kingVerminAliases = new Set(kingVermin?.public?.aliases ?? []);
if (
    kingVermin?.public?.name !== 'King Vermin (Uh-oh)' ||
    kingVermin.public.href !== '/knowledge/records/enemies/uh-oh/' ||
    !['Uh-oh', 'King Vermin', 'Vermin King'].every((alias) => kingVerminAliases.has(alias))
) {
    failures.push("publication does not preserve King Vermin's full public identity, aliases, and existing route");
}
const kingVerminSearchTerms = new Set(
    publication.search.filter((entry) => entry.recordKey === kingVerminKey).map((entry) => entry.normalizedTerm)
);
if (!['uh-oh', 'king vermin', 'vermin king'].every((term) => kingVerminSearchTerms.has(term))) {
    failures.push('publication search does not find King Vermin by both in-game names and the common reversed name');
}
const productionArtwork = JSON.parse(
    readFileSync(join(projectRoot, 'src/content/artwork-production-manifest.json'), 'utf8')
);
const codexDerivedArtwork = JSON.parse(
    readFileSync(join(projectRoot, 'scripts/artwork/codex-derived-subjects.json'), 'utf8')
);
const supplementalEnemyArtwork = JSON.parse(
    readFileSync(join(projectRoot, 'scripts/artwork/supplemental-enemy-art.json'), 'utf8')
);
const sourceDerivedArtwork = [...codexDerivedArtwork.subjects, ...supplementalEnemyArtwork.subjects];
const craftedSprite = fileURLToPath(new URL('../public/art/symbols/record-icons.svg', import.meta.url));
const craftedSpriteText = existsSync(craftedSprite) ? readFileSync(craftedSprite, 'utf8') : '';
const craftedSymbolDetails = new Map(
    [...craftedSpriteText.matchAll(/<symbol\s+id="([^"]+)"[^>]*><title>([^<]+)<\/title>([\s\S]*?)<\/symbol>/gu)].map(
        (match) => [match[1], { title: match[2], body: match[3] }]
    )
);
const craftedSymbols = new Set(craftedSymbolDetails.keys());
const renderedCraftedIds = new Set();
const recordArtTitles = new Map();
const canonicalRoutes = new Set();
const routesByTitle = new Map();
const routesByDescription = new Map();
const socialImagePaths = new Set();
const forbidden = [
    /\{\$Keywords\./u,
    /\{IP\}/u,
    /\bQuest Progress Incomplete\b/iu,
    /\b(?:MetaRank\d+|FNightshade|HBoss|CrystalGrasp|SuitHexAspect)\b/u,
    /\b(?:No Tooltip|Boon Hack)\b/iu,
    /\b(?:TalentDrop|ArtemisCombatG2|NR)\b/u,
    /\b[A-Za-z]+CombatG\d+\b/u,
    /\b(?:Drink Drop|Mana Drop Zeus|Health Restore|Reserve Mana|Meta Reward|Run Reward|Money Drop|Health Up Total|Extra Chance Athena)\b/u,
    /\bthe listed value\b/iu,
    /\bYour (?:Attack|Special|Cast|Sprint)(?: also)? (?:deal|create|inflict|have|gain|expire)\b/u,
    /\byour (?:Attack|Special|Cast|Sprint) have\b/u,
    /\byour Attack or Special deal\b/u,
    /\bYour Omega deal\b/u,
    /\bYour Omega also deal\b/u,
    /\b(?:While at the Random|inflict m on)\b/iu,
    /\bchance\(s\)/iu,
    /\+[0-9]+level\b/u,
    /\bThis entry is useful through the game systems\b/iu,
    /\bOpen a connection for the exact effect\b/iu,
    /\bYour place is saved in this browser\b/iu,
    /\bCheck each result on this device\b/iu,
    /\bAshes, then a Centaur Heart, then Psyche\b/iu,
];
const forbiddenVisible = [
    /\b(?:required|first) core Boon\b/iu,
    /\bcore Boon slots?\b/iu,
    /\bcore slots?\b/iu,
    /\bcore build\b/iu,
    /\bcore loadout\b/iu,
    /\bArcana package\b/iu,
    /\bBoon package\b/iu,
    /\b(?:recommended|primary) package\b/iu,
    /\bcore board\b/iu,
    /\bcore action\b/iu,
    /\bcore loop\b/iu,
    /\bcombat loop\b/iu,
    /\bcore cards?\b/iu,
    /\bpreferred core choice\b/iu,
    /\bspecialized ceiling\b/iu,
    /\bShell routing\b/iu,
    /\bFill the core\b/iu,
];
const forbiddenMetadata = [
    /\bknowledge world\b/iu,
    /\bverified record\b/iu,
    /\breference collection\b/iu,
    /\b(?:publication|schema|artifact|dataset|record type|canonical asset)\b/iu,
    /\b(?:mechanics|world-progression|editorial)\//iu,
];
const familiarPortraitSourceByRoute = {
    'knowledge/records/familiars/frinos/index.html': '/art/familiars/frinos.webp',
    'knowledge/records/familiars/gale/index.html': '/art/familiars/gale.webp',
    'knowledge/records/familiars/hecuba/index.html': '/art/familiars/hecuba.webp',
    'knowledge/records/familiars/raki/index.html': '/art/familiars/raki.webp',
    'knowledge/records/familiars/toula/index.html': '/art/familiars/toula.webp',
};

function files(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? files(path) : path.endsWith('.html') ? [path] : [];
    });
}

function allFiles(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? allFiles(path) : [path];
    });
}

const clientScriptCache = new Map();
function clientScriptText(html) {
    return [...html.matchAll(/<script[^>]+src="([^"]+\.js(?:\?[^"]*)?)"/gu)]
        .map((match) => {
            const source = match[1].split('?')[0];
            if (clientScriptCache.has(source)) return clientScriptCache.get(source);
            const path = join(root, decodeURIComponent(source).replace(/^\/+/, ''));
            const code = existsSync(path) ? readFileSync(path, 'utf8') : '';
            clientScriptCache.set(source, code);
            return code;
        })
        .join('\n');
}

function visibleText(fragment) {
    return fragment
        .replaceAll(/<script\b[\s\S]*?<\/script>/giu, ' ')
        .replaceAll(/<style\b[\s\S]*?<\/style>/giu, ' ')
        .replaceAll(/<[^>]+>/gu, ' ')
        .replaceAll('&amp;', '&')
        .replaceAll('&#39;', "'")
        .replaceAll('&quot;', '"')
        .replaceAll(/\s+/gu, ' ')
        .trim();
}

function internalTarget(href) {
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return null;
    const url = new URL(href, 'https://neodes2.local');
    if (url.origin !== 'https://neodes2.local') return null;
    const pathname = decodeURIComponent(url.pathname);
    const local = join(root, pathname.replace(/^\/+/, ''));
    return pathname.endsWith('/') ? join(local, 'index.html') : local;
}

function expectedSocialImage() {
    return '/og/social-preview.webp';
}

const htmlFiles = files(root);
const indexableHtmlFiles = htmlFiles.filter((file) => relative(root, file).replaceAll('\\', '/') !== '404.html');
for (const file of htmlFiles) {
    const html = readFileSync(file, 'utf8');
    const route = relative(root, file).replaceAll('\\', '/');
    const isNotFoundPage = route === '404.html';
    const pageText = visibleText(html);
    const routePath = isNotFoundPage ? '/404/' : `/${route.replace(/index\.html$/u, '')}`;
    if (route.startsWith('knowledge/records/')) {
        const hasRecordDepthLink = html.includes('href="#record-depth"');
        const recordDepthStart = html.indexOf('id="record-depth"');
        const hasRecordDepth = recordDepthStart >= 0;
        if (hasRecordDepthLink && !hasRecordDepth) {
            failures.push(`${route}: record-depth link has no target section`);
        }
        if (hasRecordDepth) {
            const recordDepthMarkup = html.slice(recordDepthStart, recordDepthStart + 1200);
            if (!/class="[^"]*(?:record-dossier|relationship-rail)/u.test(recordDepthMarkup)) {
                failures.push(`${route}: record-depth section has no details or relationships`);
            }
        }
    }
    if (route === 'knowledge/records/boons/nova-flourish/index.html') {
        const sharedAreaIncreaseCount = pageText.match(/Area increase/gu)?.length ?? 0;
        const comparisonValueCount = html.match(/class="progression-matrix-value"/gu)?.length ?? 0;
        if (!html.includes('class="progression-shared-effects"') || sharedAreaIncreaseCount !== 1) {
            failures.push(`${route}: shared Pom scaling values are repeated inside the comparison matrix`);
        }
        if (comparisonValueCount !== 20) {
            failures.push(`${route}: Pom scaling comparison has ${comparisonValueCount} values; expected 20`);
        }
    }
    const expectedCanonical = new URL(routePath, publicSite).href;
    const encodedTitle = html.match(/<title>([^<]+)<\/title>/u)?.[1]?.trim();
    const headTitle = encodedTitle ? visibleText(encodedTitle) : undefined;
    const encodedDescription = html.match(/<meta name="description" content="([^"]+)"/u)?.[1]?.trim();
    const description = encodedDescription ? visibleText(encodedDescription) : undefined;
    const encodedKeywords = html.match(/<meta name="keywords" content="([^"]+)"/u)?.[1]?.trim();
    const keywords = encodedKeywords ? visibleText(encodedKeywords) : undefined;
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/u)?.[1];
    const ogUrl = html.match(/<meta property="og:url" content="([^"]+)"/u)?.[1];
    const encodedOgTitle = html.match(/<meta property="og:title" content="([^"]+)"/u)?.[1];
    const ogTitle = encodedOgTitle ? visibleText(encodedOgTitle) : undefined;
    const encodedOgDescription = html.match(/<meta property="og:description" content="([^"]+)"/u)?.[1];
    const ogDescription = encodedOgDescription ? visibleText(encodedOgDescription) : undefined;
    const ogImage = html.match(/<meta property="og:image" content="([^"]+)"/u)?.[1];
    const ogSecureImage = html.match(/<meta property="og:image:secure_url" content="([^"]+)"/u)?.[1];
    const ogImageType = html.match(/<meta property="og:image:type" content="([^"]+)"/u)?.[1];
    const ogImageWidth = html.match(/<meta property="og:image:width" content="([^"]+)"/u)?.[1];
    const ogImageHeight = html.match(/<meta property="og:image:height" content="([^"]+)"/u)?.[1];
    const ogImageAlt = html.match(/<meta property="og:image:alt" content="([^"]+)"/u)?.[1];
    const twitterCard = html.match(/<meta name="twitter:card" content="([^"]+)"/u)?.[1];
    const encodedTwitterTitle = html.match(/<meta name="twitter:title" content="([^"]+)"/u)?.[1];
    const twitterTitle = encodedTwitterTitle ? visibleText(encodedTwitterTitle) : undefined;
    const encodedTwitterDescription = html.match(/<meta name="twitter:description" content="([^"]+)"/u)?.[1];
    const twitterDescription = encodedTwitterDescription ? visibleText(encodedTwitterDescription) : undefined;
    const twitterImage = html.match(/<meta name="twitter:image" content="([^"]+)"/u)?.[1];
    const twitterImageAlt = html.match(/<meta name="twitter:image:alt" content="([^"]+)"/u)?.[1];
    const themeColor = html.match(/<meta name="theme-color" content="([^"]+)"/u)?.[1];
    const robots = html.match(/<meta name="robots" content="([^"]+)"/u)?.[1];
    const readerPunctuation = [
        ['visible copy', pageText],
        ['title', headTitle],
        ['description', description],
        ['Open Graph title', ogTitle],
        ['Open Graph description', ogDescription],
        ['Open Graph image alt', ogImageAlt],
        ['Twitter title', twitterTitle],
        ['Twitter description', twitterDescription],
        ['Twitter image alt', twitterImageAlt],
    ];
    for (const [surface, copy] of readerPunctuation) {
        const mark = copy?.match(/[—;]/u)?.[0];
        if (mark) failures.push(`${route}: ${surface} contains forbidden reader punctuation ${JSON.stringify(mark)}`);
    }
    if (!headTitle) failures.push(`${route}: missing title`);
    if (!isNotFoundPage && headTitle && !/\bHades (?:II|2)\b/u.test(headTitle)) {
        failures.push(`${route}: search title does not identify Hades II`);
    }
    if (!description) failures.push(`${route}: missing meta description`);
    if (!keywords) {
        failures.push(`${route}: missing common search keywords`);
    } else {
        const keywordSet = new Set(keywords.split(',').map((keyword) => keyword.trim()));
        for (const requiredKeyword of [
            'Hades 2',
            'Hades II',
            'Hades2 guide',
            'Hades 2 build',
            'Hades II build',
            'Hades2 build',
            'Hades 2 wiki',
            'NeonHades2',
        ]) {
            if (!keywordSet.has(requiredKeyword)) {
                failures.push(`${route}: common search keywords omit ${requiredKeyword}`);
            }
        }
    }
    if (description && description.length > 160) failures.push(`${route}: meta description exceeds 160 characters`);
    if (description?.endsWith('…')) failures.push(`${route}: meta description was mechanically truncated`);
    if (isNotFoundPage && robots !== 'noindex,follow') {
        failures.push(`${route}: expected noindex,follow robots directive`);
    }
    for (const pattern of forbiddenMetadata) {
        const match = `${headTitle ?? ''} ${description ?? ''} ${ogImageAlt ?? ''}`.match(pattern);
        if (match) failures.push(`${route}: internal metadata wording "${match[0]}"`);
    }
    if (description) {
        const descriptionRoutes = routesByDescription.get(description) ?? [];
        descriptionRoutes.push(route);
        routesByDescription.set(description, descriptionRoutes);
    }
    if (headTitle) {
        const titleRoutes = routesByTitle.get(headTitle) ?? [];
        titleRoutes.push(route);
        routesByTitle.set(headTitle, titleRoutes);
    }
    if (canonical !== expectedCanonical)
        failures.push(`${route}: expected canonical ${expectedCanonical}, found ${canonical ?? 'none'}`);
    if (ogUrl !== expectedCanonical) failures.push(`${route}: Open Graph URL does not match its canonical URL`);
    if (ogTitle !== headTitle) failures.push(`${route}: Open Graph title does not match the page title`);
    if (ogDescription !== description) {
        failures.push(`${route}: Open Graph description does not match the page description`);
    }
    if (!ogImage) {
        failures.push(`${route}: missing Open Graph image`);
    } else {
        const imageUrl = new URL(ogImage);
        const expectedImagePath = expectedSocialImage();
        const imagePath = join(root, decodeURIComponent(imageUrl.pathname).replace(/^\/+/, ''));
        if (imageUrl.origin !== publicSite.origin)
            failures.push(`${route}: Open Graph image is not on the canonical origin`);
        if (!existsSync(imagePath)) failures.push(`${route}: Open Graph image is missing ${imageUrl.pathname}`);
        if (imageUrl.pathname !== expectedImagePath) {
            failures.push(`${route}: expected social image ${expectedImagePath}, found ${imageUrl.pathname}`);
        }
        socialImagePaths.add(imageUrl.pathname);
    }
    if (ogSecureImage !== ogImage) failures.push(`${route}: secure Open Graph image does not match og:image`);
    if (ogImageType !== 'image/webp') failures.push(`${route}: Open Graph image is not declared as WebP`);
    if (ogImageWidth !== '1200' || ogImageHeight !== '630') {
        failures.push(`${route}: Open Graph image dimensions are not 1200 by 630`);
    }
    if (!ogImageAlt) failures.push(`${route}: missing Open Graph image alt text`);
    if (twitterCard !== 'summary_large_image') failures.push(`${route}: missing large Twitter card metadata`);
    if (twitterTitle !== headTitle) failures.push(`${route}: Twitter title does not match the page title`);
    if (twitterDescription !== description) {
        failures.push(`${route}: Twitter description does not match the page description`);
    }
    if (twitterImage !== ogImage) failures.push(`${route}: Twitter image does not match Open Graph image`);
    if (twitterImageAlt !== ogImageAlt)
        failures.push(`${route}: Twitter image alt does not match Open Graph image alt`);
    if (themeColor !== '#32b9aa') failures.push(`${route}: social embed theme color is missing or incorrect`);
    const structuredDataText = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/u)?.[1];
    if (!structuredDataText) {
        failures.push(`${route}: missing structured data`);
    } else {
        try {
            const structuredData = JSON.parse(structuredDataText);
            const graph = Array.isArray(structuredData) ? structuredData : [structuredData];
            const webPage = graph.find((entry) => entry?.['@type'] === 'WebPage');
            if (webPage?.url !== expectedCanonical) failures.push(`${route}: structured WebPage URL is not canonical`);
            if (webPage?.name !== headTitle || webPage?.description !== description) {
                failures.push(`${route}: structured page wording does not match the visible metadata`);
            }
            if (webPage?.keywords !== keywords) {
                failures.push(`${route}: structured page keywords do not match the common search keywords`);
            }
            if (webPage?.primaryImageOfPage?.contentUrl !== ogImage) {
                failures.push(`${route}: structured primary image does not match Open Graph image`);
            }
            if (route === 'index.html') {
                const website = graph.find((entry) => entry?.['@type'] === 'WebSite');
                if (website?.name !== 'NeonHades2' || website?.alternateName !== 'NH2') {
                    failures.push(`${route}: homepage WebSite identity is incomplete`);
                }
                if (website?.keywords !== keywords) {
                    failures.push(`${route}: homepage WebSite keywords do not match the common search keywords`);
                }
            }
        } catch {
            failures.push(`${route}: structured data is not valid JSON`);
        }
    }
    if (!html.includes('rel="icon"') || !html.includes('rel="apple-touch-icon"') || !html.includes('rel="manifest"')) {
        failures.push(`${route}: site identity links are incomplete`);
    }
    if (!html.includes('rel="icon" type="image/png" sizes="192x192" href="/icon-192.png"')) {
        failures.push(`${route}: Google Search favicon link is missing or unstable`);
    }
    if (canonical) {
        if (canonicalRoutes.has(canonical)) failures.push(`${route}: duplicate canonical ${canonical}`);
        if (!isNotFoundPage) canonicalRoutes.add(canonical);
    }
    if (!html.includes('data-world-atmosphere=')) failures.push(`${route}: page has no authored environment`);
    if (!html.includes('class="world-atmosphere-rim"')) failures.push(`${route}: page has no directional light layer`);
    if (!html.includes('class="world-atmosphere-particles"'))
        failures.push(`${route}: page has no semantic particle layer`);
    for (const [, artId] of html.matchAll(/<use\s+href="\/art\/symbols\/record-icons\.svg#([^"]+)"/gu)) {
        renderedCraftedIds.add(artId);
        if (!craftedSymbols.has(artId)) failures.push(`${route}: crafted artwork symbol ${artId} is missing`);
    }
    for (const [, artId] of html.matchAll(
        /<use\s+href="\/art\/symbols\/records\.svg#(record-generic|boon-generic|incantation|hammer|arcana|keepsake|hex|prophecy|achievement|oath|relationship|region|fish|tool|exchange|aid|guide)"/gu
    )) {
        failures.push(`${route}: retired family placeholder ${artId} is still rendered`);
    }
    for (const pattern of forbidden) {
        const match = html.match(pattern);
        if (match) failures.push(`${route}: unresolved internal text "${match[0]}"`);
    }
    for (const pattern of forbiddenVisible) {
        const match = pageText.match(pattern);
        if (match) failures.push(`${route}: unexplained editorial shorthand "${match[0]}"`);
    }
    if (/across any number of nights:\s+\S/iu.test(pageText)) {
        failures.push(`${route}: a named requirement list is flattened into unlinked text`);
    }

    const mainCount = html.match(/<main\b/gu)?.length ?? 0;
    const headingCount = html.match(/<h1\b/gu)?.length ?? 0;
    if (mainCount !== 1) failures.push(`${route}: expected one main landmark, found ${mainCount}`);
    if (headingCount !== 1) failures.push(`${route}: expected one h1, found ${headingCount}`);
    if (route.startsWith('knowledge/tier-lists/') && route !== 'knowledge/tier-lists/index.html') {
        const sectionHeadingCount = html.match(/<h2\b/gu)?.length ?? 0;
        if (sectionHeadingCount === 0) failures.push(`${route}: tier list has no section headings`);
    }

    const ids = [...html.matchAll(/\sid="([^"]+)"/gu)].map((match) => match[1]);
    const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
    if (duplicateIds.length > 0) failures.push(`${route}: duplicate ids ${duplicateIds.join(', ')}`);

    for (const [image] of html.matchAll(/<img\b[^>]*>/gu)) {
        if (!/\swidth="\d+"/u.test(image) || !/\sheight="\d+"/u.test(image)) {
            failures.push(`${route}: image is missing intrinsic width and height`);
        }
        if (!/\sloading="(?:eager|lazy)"/u.test(image)) {
            failures.push(`${route}: image has no explicit loading policy`);
        }
        if (!/\sdecoding="async"/u.test(image)) {
            failures.push(`${route}: image has no asynchronous decoding policy`);
        }
    }

    for (const [link, href] of html.matchAll(/<a\b[^>]*\shref="([^"]+)"[^>]*>[\s\S]*?<\/a>/gu)) {
        const target = internalTarget(href);
        if (target && !existsSync(target)) failures.push(`${route}: broken internal link ${href}`);
        if (
            href.startsWith('/knowledge/records/boons/') &&
            !/\bsubject-art\b/u.test(link) &&
            !/\bdata-subject-art(?:-raster)?=/u.test(link)
        ) {
            failures.push(`${route}: named Boon link ${href} has no identity-specific artwork`);
        }
        if (target && /\bph-arrow-(?:up-right|square-out)\b/u.test(link)) {
            failures.push(`${route}: internal link ${href} uses an external or new-context icon`);
        }
    }
    for (const [link] of html.matchAll(/<a\b[^>]*\shref="https?:\/\/[^"]+"[^>]*>[\s\S]*?<\/a>/gu)) {
        if (!/\starget="_blank"/u.test(link) || !/\srel="[^"]*\bnoopener\b[^"]*"/u.test(link)) {
            failures.push(`${route}: external link does not open safely in a new tab`);
        }
        const hasContextIcon = /\bph-arrow-square-out\b/u.test(link);
        const hasGitHubDestinationIcon =
            /\shref="https:\/\/github\.com\//u.test(link) && /\bph-github-logo\b/u.test(link);
        const announcesNewTab =
            /\saria-label="[^"]*opens in a new tab[^"]*"/iu.test(link) ||
            /opens in a new tab/iu.test(visibleText(link));
        if (!hasContextIcon && !hasGitHubDestinationIcon && !announcesNewTab) {
            failures.push(`${route}: new-tab link lacks an approved visible icon or accessible context announcement`);
        }
    }

    for (const [row] of html.matchAll(/<li\b[^>]*\bdata-record-row\b[^>]*>[\s\S]*?<\/li>/gu)) {
        const href = row.match(/<a\b[^>]*\shref="([^"]+)"/u)?.[1];
        if (href && new URL(href, 'https://neodes2.local').pathname === routePath) {
            failures.push(`${route}: collection row links back to its own page`);
        }
    }

    if (pageText.includes('—')) failures.push(`${route}: public copy contains an em dash`);
    if (pageText.includes('Same at every level')) {
        failures.push(`${route}: invariant progression values are repeated inside the comparison matrix`);
    }

    if (route.startsWith('knowledge/records/')) {
        if (/Show \d+ more (?:connections|uses)/u.test(pageText) && !html.includes('record-layout-relations-dense')) {
            failures.push(`${route}: dense relationships are still constrained to a narrow side rail`);
        }
        const titleBlock = html.match(/class="record-title-block"[\s\S]*?<\/div>/u)?.[0] ?? '';
        const heroBlock = html.match(/<header\b[^>]*class="[^"]*\brecord-hero\b[^"]*"[^>]*>[\s\S]*?<\/header>/u)?.[0];
        if (heroBlock?.includes('progression-table')) {
            failures.push(`${route}: progression table is constrained inside the record quick-facts panel`);
        }
        if (html.includes('<h2>Olympian</h2>')) {
            failures.push(`${route}: boon giver is repeated as a full record field instead of title metadata`);
        }
        const giverExpectations = new Map([
            ['knowledge/records/boons/nova-flourish/index.html', ['Apollo']],
            ['knowledge/records/boons/arterial-spray/index.html', ['Ares', 'Poseidon']],
        ]);
        const expectedGivers = giverExpectations.get(route);
        if (expectedGivers) {
            const giverBlock = titleBlock.match(
                /<dl\b[^>]*class="[^"]*\brecord-givers\b[^"]*"[^>]*>[\s\S]*?<\/dl>/u
            )?.[0];
            if (!giverBlock || expectedGivers.some((giver) => !visibleText(giverBlock).includes(giver))) {
                failures.push(`${route}: expected giver metadata ${expectedGivers.join(', ')} beside the title`);
            }
        }
        const hero = titleBlock.match(/<p>([\s\S]*?)<\/p>/u)?.[1];
        const dossier = html.match(/class="record-dossier"[\s\S]*?<\/article>/u)?.[0];
        if (hero && dossier) {
            const summary = visibleText(hero);
            if (summary.length > 20 && visibleText(dossier).includes(summary)) {
                failures.push(`${route}: hero summary is repeated in the dossier`);
            }
        }
        const collection = route.split('/')[2];
        const expectedReturn = `/knowledge/${collection}/`;
        const returnBlock = html.match(/<nav\b[^>]*class="[^"]*\brecord-return\b[^"]*"[^>]*>[\s\S]*?<\/nav>/u)?.[0];
        const returnHref = returnBlock?.match(/<a\b[^>]*\shref="([^"]+)"/u)?.[1];
        if (returnHref !== expectedReturn) {
            failures.push(`${route}: expected collection return ${expectedReturn}, found ${returnHref ?? 'none'}`);
        }

        const title = visibleText(html.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/u)?.[0] ?? '');
        if (route === 'knowledge/records/enemies/uh-oh/index.html' && title !== 'King Vermin (Uh-oh)') {
            failures.push(`${route}: expected the full King Vermin and Uh-oh identity in the rendered title`);
        }
        const heroArtwork = heroBlock?.match(
            /class="[^"]*\bsubject-art--hero\b[^"]*"[^>]*data-subject-art(-raster)?="([^"]+)"/u
        );
        const regionArtwork = html.match(
            /class="[^"]*\bregion-map\b[^"]*"[^>]*data-region-map="([^"]+)"[\s\S]*?<\/figure>/u
        );
        const regionId = regionArtwork?.[1];
        if (regionId) {
            const expectedRegionSource = `/art/regions/${regionId}.webp`;
            if (!regionArtwork[0].includes(expectedRegionSource)) {
                failures.push(`${route}: expected painted region environment ${expectedRegionSource}`);
            }
            if (!existsSync(join(root, expectedRegionSource.replace(/^\//u, '')))) {
                failures.push(`${route}: painted region environment is missing ${expectedRegionSource}`);
            }
        }
        const artId = heroArtwork?.[2] ?? (regionArtwork ? `region-map:${regionArtwork[1]}` : undefined);
        if (!artId) {
            failures.push(`${route}: record hero has no identity-specific artwork`);
        } else {
            const source = heroArtwork?.[1]
                ? (heroBlock?.match(/data-subject-art-raster="[^"]+"[\s\S]*?<img\b[^>]*\ssrc="([^"]+)"/u)?.[1] ??
                  'missing-raster-source')
                : (heroBlock?.match(/<use\s+href="([^"]+)"/u)?.[1] ?? 'authored-region-map');
            if (
                /\/(?:records\.svg)#(?:record-generic|boon-generic|incantation|hammer|arcana|keepsake|hex|prophecy|achievement|oath|relationship|region|fish|tool|exchange|aid|guide)$/u.test(
                    source
                )
            ) {
                failures.push(`${route}: record hero still uses family placeholder ${source}`);
            }
            if (source.startsWith('/art/symbols/record-icons.svg#') && !craftedSymbols.has(artId)) {
                failures.push(`${route}: crafted artwork symbol ${artId} is missing`);
            }
            const identity = `${source.split('#')[0]}#${artId}`;
            const titles = recordArtTitles.get(identity) ?? new Set();
            titles.add(title);
            recordArtTitles.set(identity, titles);
        }
    }

    if (/^knowledge\/tier-lists\/[^/]+\/index\.html$/u.test(route)) {
        for (const match of html.matchAll(/<a\b[^>]*class="tier-entry-record-link"[^>]*href="([^"]+)"/gu)) {
            if (match[1]?.includes('#')) {
                failures.push(`${route}: tier entry link includes a fragment target ${match[1]}`);
            }
        }
    }

    if (
        route.startsWith('knowledge/records/prophecies/') &&
        /required (?:Boons|entries) across any number of nights/iu.test(pageText) &&
        !html.includes('class="record-reference-requirement"')
    ) {
        failures.push(`${route}: prophecy requirements do not render icon-backed references`);
    }

    if (route === 'knowledge/records/prophecies/godsent-favor/index.html') {
        for (const [name, path, href] of [
            [
                'Temper of Zeus',
                '/art/hexes/talents/temper-of-zeus.webp',
                '/knowledge/records/hexes/twilight-curse/#temper-of-zeus',
            ],
            [
                'Nurture of Hera',
                '/art/hexes/talents/nurture-of-hera.webp',
                '/knowledge/records/hexes/night-bloom/#nurture-of-hera',
            ],
            [
                'Hearth of Hestia',
                '/art/hexes/talents/hearth-of-hestia.webp',
                '/knowledge/records/hexes/total-eclipse/#hearth-of-hestia',
            ],
            [
                'Squall of Demeter',
                '/art/hexes/talents/squall-of-demeter.webp',
                '/knowledge/records/hexes/phase-shift/#squall-of-demeter',
            ],
            [
                'Allure of Aphrodite',
                '/art/hexes/talents/allure-of-aphrodite.webp',
                '/knowledge/records/hexes/dark-side/#allure-of-aphrodite',
            ],
            [
                'Hand of Hephaestus',
                '/art/hexes/talents/hand-of-hephaestus.webp',
                '/knowledge/records/hexes/wolf-howl/#hand-of-hephaestus',
            ],
            [
                'Pride of Poseidon',
                '/art/hexes/talents/pride-of-poseidon.webp',
                '/knowledge/records/hexes/moon-water/#pride-of-poseidon',
            ],
            [
                'Lance of Ares',
                '/art/hexes/talents/lance-of-ares.webp',
                '/knowledge/records/hexes/sky-fall/#lance-of-ares',
            ],
            [
                'Shine of Apollo',
                '/art/hexes/talents/shine-of-apollo.webp',
                '/knowledge/records/hexes/lunar-ray/#shine-of-apollo',
            ],
        ]) {
            if (!html.includes(name) || !html.includes(path) || !html.includes(`href="${href}"`)) {
                failures.push(`${route}: ${name} is missing its exact icon or stat-bearing Hex link`);
            }
        }
    }
    if (route === 'knowledge/records/prophecies/close-companions/index.html') {
        if (!pageText.includes('Record at least 3 of 5 required entries across any number of nights.')) {
            failures.push(`${route}: summary does not preserve the at-least-three Familiar requirement`);
        }
        const familiarLinks = html.match(/class="record-link[^"]*"/gu)?.length ?? 0;
        if (!html.includes('class="record-reference-requirement"') || familiarLinks < 5) {
            failures.push(`${route}: Familiar requirements do not render as structured links`);
        }
    }

    const familiarPortraitSource = familiarPortraitSourceByRoute[route];
    if (familiarPortraitSource && !html.includes(familiarPortraitSource)) {
        failures.push(`${route}: expected ${familiarPortraitSource}`);
    }
    if (route === 'knowledge/builds/index.html') {
        if (!html.includes('id="aspect-unlock-overview-title"')) {
            failures.push(`${route}: aspect unlock overview is missing`);
        }
        if (!html.includes('/knowledge/records/incantations/aspects-of-night-and-darkness/')) {
            failures.push(`${route}: aspect unlock overview does not link to its incantation`);
        }
    } else if (route.startsWith('knowledge/builds/')) {
        if (!html.includes('id="build-unlock-title"')) {
            failures.push(`${route}: aspect build has no unlock guidance`);
        }
        if (!html.includes('/knowledge/records/incantations/aspects-of-night-and-darkness/')) {
            failures.push(`${route}: aspect build does not link to its unlock incantation`);
        }

        const expectation = buildExpectationsByRoute.get(route);
        if (!expectation) {
            failures.push(`${route}: aspect build has no publication-backed audit expectation`);
        } else {
            const normalizedTitle = headTitle?.toLocaleLowerCase() ?? '';
            const normalizedDescription = description?.toLocaleLowerCase() ?? '';
            for (const [label, value] of [
                ['aspect', expectation.aspect],
                ['weapon', expectation.weapon],
            ]) {
                if (!value || !normalizedTitle.includes(value.toLocaleLowerCase())) {
                    failures.push(`${route}: title does not identify its published ${label}`);
                }
                if (!value || !normalizedDescription.includes(value.toLocaleLowerCase())) {
                    failures.push(`${route}: description does not identify its published ${label}`);
                }
            }
            if (!normalizedTitle.includes('build') || !normalizedDescription.includes('build')) {
                failures.push(`${route}: build metadata does not identify the page as a build`);
            }
            if (!normalizedDescription.includes('strongest') || !normalizedDescription.includes('safest')) {
                failures.push(`${route}: description does not identify both build goals`);
            }
            if (
                !html.includes('<nav class="build-view-tabs" aria-label="Build goal"') ||
                !['setup', 'strongest', 'safest'].every((view) => html.includes(`data-build-view-button="${view}"`)) ||
                !html.includes('href="#setup-build"') ||
                !html.includes('href="?view=strongest#strongest-breakpoints"') ||
                !html.includes('href="?view=safest#safest-breakpoints"') ||
                !html.includes('data-build-plan-link="strongest"') ||
                !html.includes('data-build-plan-link="safest"')
            ) {
                failures.push(`${route}: build goal control is missing its progressive navigation links`);
            }
            const setupStart = html.indexOf('id="setup-build"');
            const strongestStart = html.indexOf('id="strongest-build"');
            if (setupStart < 0 || strongestStart < 0 || setupStart > strongestStart) {
                failures.push(`${route}: Setup must be the first rendered build panel`);
            }
            for (const [mode, variant] of Object.entries(expectation.modes)) {
                const panelStart = html.indexOf(`id="${mode}-build"`);
                const candidates = ['setup', 'strongest', 'safest']
                    .map((view) => html.indexOf(`id="${view}-build"`, panelStart + 1))
                    .filter((index) => index > panelStart);
                const panelEnd = candidates.length > 0 ? Math.min(...candidates) : html.length;
                const panelHtml = panelStart >= 0 ? html.slice(panelStart, panelEnd) : '';
                if (!panelHtml) {
                    failures.push(`${route}: ${mode} build panel is missing`);
                    continue;
                }
                const openingTag = panelHtml.slice(0, panelHtml.indexOf('>') + 1);
                if (openingTag.includes(' hidden')) {
                    failures.push(`${route}: ${mode} is unavailable without JavaScript`);
                }
                const runSheetStart = panelHtml.indexOf(`id="${mode}-run-sheet"`);
                const breakpointsStart = panelHtml.indexOf(`id="${mode}-breakpoints"`);
                const boonsStart = panelHtml.indexOf(`id="${mode}-main-boons"`);
                const combatStart = panelHtml.indexOf(`id="${mode}-combat-loop"`);
                const usefulStart = panelHtml.indexOf(`id="${mode}-useful-boons"`);
                const hammersStart = panelHtml.indexOf(`id="${mode}-hammers"`);
                if (!(
                    combatStart >= 0 &&
                    runSheetStart > combatStart &&
                    breakpointsStart > runSheetStart &&
                    boonsStart > breakpointsStart &&
                    usefulStart > boonsStart &&
                    hammersStart > usefulStart
                )) {
                    failures.push(
                        `${route}: ${mode} does not group the run summary, combat sequence, strengths, weaknesses, and ratings before the five-slot run sheet, breakpoints, detailed Boons, and later upgrades`
                    );
                }
                const planOverviewHtml =
                    combatStart >= 0 && runSheetStart > combatStart ? panelHtml.slice(combatStart, runSheetStart) : '';
                for (const requiredPlanSignal of ['Excels at', 'Watch for', 'Combat sequence', 'Overall grade']) {
                    if (!planOverviewHtml.includes(requiredPlanSignal)) {
                        failures.push(`${route}: ${mode} compact run overview is missing ${requiredPlanSignal}`);
                    }
                }
                if (/id="(?:strongest|safest)-arcana"/u.test(panelHtml)) {
                    failures.push(`${route}: ${mode} still mixes pre-run Arcana into the in-run panel`);
                }
                const boonsEnd =
                    boonsStart >= 0 ? panelHtml.indexOf(`<section id="${mode}-rare-targets"`, boonsStart) : -1;
                const boonsHtml =
                    boonsStart >= 0 ? panelHtml.slice(boonsStart, boonsEnd > boonsStart ? boonsEnd : usefulStart) : '';
                if (/optional\s+\w+\s+slot/iu.test(boonsHtml)) {
                    failures.push(
                        `${route}: ${mode} still describes one of the five recommended Boon slots as optional`
                    );
                }
                const overviewStart = panelHtml.indexOf('class="boon-priority-overview"');
                const overviewEnd = overviewStart >= 0 ? panelHtml.indexOf('</ol>', overviewStart) : -1;
                const overviewHtml =
                    overviewStart >= 0 && overviewEnd > overviewStart
                        ? panelHtml.slice(overviewStart, overviewEnd)
                        : '';
                const overviewSlotOrder = [...overviewHtml.matchAll(/<strong>([^<]+)<\/strong>/gu)].map((match) =>
                    visibleText(match[1])
                );
                if (overviewSlotOrder.join('|') !== variant.slotOrder.join('|')) {
                    failures.push(
                        `${route}: ${mode} top run sheet does not show all five Boon slots in publication order`
                    );
                }
                const renderedSlotOrder = [...boonsHtml.matchAll(/<span>\s*Priority \d+ · ([^<]+)<\/span>/gu)].map(
                    (match) => visibleText(match[1])
                );
                if (renderedSlotOrder.length !== variant.mainSlotOrder.length) {
                    failures.push(
                        `${route}: ${mode} build renders ${renderedSlotOrder.length} main Boon slots; expected ${variant.mainSlotOrder.length}`
                    );
                }
                if (renderedSlotOrder.join('|') !== variant.mainSlotOrder.join('|')) {
                    failures.push(`${route}: ${mode} rendered main Boon order does not match publication`);
                }
                if (panelHtml.includes('Duo and Legendary targets')) {
                    if (
                        !panelHtml.includes('class="rare-target-requirements"') ||
                        !panelHtml.includes('This plan uses') ||
                        !panelHtml.includes('Other options')
                    ) {
                        failures.push(
                            `${route}: ${mode} rare targets do not present plan choices before other options`
                        );
                    }
                    if (panelHtml.includes('The listed preferred and fallback choices can include')) {
                        failures.push(`${route}: ${mode} still uses the generic rare-target prerequisite template`);
                    }
                    if (
                        variant.hasReusedTargetSelection &&
                        !panelHtml.includes('One selected Boon satisfies more than one prerequisite group.')
                    ) {
                        failures.push(`${route}: ${mode} does not explain a reused rare-target prerequisite`);
                    }
                }
            }
            if (
                route === 'knowledge/builds/witchs-staff-aspect-of-melinoe/index.html' &&
                html.slice(strongestStart, html.indexOf('id="safest-build"')).includes('Flutter Flourish')
            ) {
                failures.push(`${route}: strongest ranged Staff plan still recommends Flutter Flourish`);
            }
        }
    }

    if (route === 'knowledge/index.html') {
        for (const guide of ['legendary', 'duo']) {
            if (!html.includes(`/knowledge/boons/#${guide}-boon-requirements`)) {
                failures.push(`${route}: search is missing ${guide} Boon requirement guidance`);
            }
        }
        if (!html.includes('/guide/before-the-first-night/') || !html.toLocaleLowerCase().includes('god mode')) {
            failures.push(`${route}: search is missing source-backed God Mode guidance`);
        }
        if (
            !html.includes('/knowledge/records/regions/the-crossroads/') ||
            !pageText.includes('Crossroads return checklist')
        ) {
            failures.push(`${route}: Crossroads return guidance is not directly discoverable`);
        }
    }

    if (route === 'knowledge/boons/index.html') {
        for (const guide of ['legendary', 'duo']) {
            if (!html.includes(`id="${guide}-boon-requirements"`)) {
                failures.push(`${route}: ${guide} Boon requirement guidance is missing`);
            }
        }
    }

    if (route === 'knowledge/resources/index.html') {
        const toolsSection = html.match(/<section id="gathering-tools"[\s\S]*?<section id="cultivation"/u)?.[0] ?? '';
        const gardenSection = html.match(/<section id="cultivation"[\s\S]*?<details/u)?.[0] ?? '';
        if (toolsSection.includes('data-table-sort')) {
            failures.push(`${route}: garden sorting control is attached to the gathering tools table`);
        }
        if (!gardenSection.includes('data-table-sort') || !gardenSection.includes('data-sort-table')) {
            failures.push(`${route}: garden harvest rows are not connected to their sorting control`);
        }
    }

    if (route === 'knowledge/relationships/index.html') {
        if (!html.includes('record-index--relationships')) {
            failures.push(`${route}: relationship portraits do not use their full-body row layout`);
        }
        if (/relationship event/iu.test(pageText)) {
            failures.push(`${route}: relationship lock guidance is still vague`);
        }
        if (!/style\.removeProperty\([`'"]opacity/u.test(`${html}\n${clientScriptText(html)}`)) {
            failures.push(`${route}: collection filtering can leave matched rows hidden by entrance motion`);
        }
    }

    if (route === 'guide/first-return/index.html') {
        if (!html.includes('/art/scenes/the-crossroads-landscape.webp')) {
            failures.push(`${route}: first Crossroads circuit is missing its painted Crossroads environment`);
        }
        for (const requiredTiming of [
            'being purified',
            'second return',
            'after the second night',
            'Altar',
            'Silver Pool',
        ]) {
            if (!pageText.toLocaleLowerCase().includes(requiredTiming.toLocaleLowerCase())) {
                failures.push(`${route}: first Crossroads timing is missing "${requiredTiming}"`);
            }
        }
        for (const falseTiming of [
            'after the first completed run',
            'The Cauldron is usable now',
            'Inspect the Cauldron on the first return',
        ]) {
            if (pageText.toLocaleLowerCase().includes(falseTiming.toLocaleLowerCase())) {
                failures.push(`${route}: first Crossroads timing contains impossible guidance "${falseTiming}"`);
            }
        }
    }

    if (route === 'guide/second-night/index.html') {
        for (const guidance of ['second night', '1 Moly', 'not a reward-door', 'Ashes', 'second return']) {
            if (!pageText.toLocaleLowerCase().includes(guidance.toLocaleLowerCase())) {
                failures.push(`${route}: second-night guidance is missing "${guidance}"`);
            }
        }
    }

    if (route === 'guide/second-return/index.html') {
        for (const guidance of [
            'Cauldron is now usable',
            'at most 3 new Incantations',
            "Night's Craftwork",
            '1 Moly',
            'Crescent Pick',
            '1 Ash',
        ]) {
            if (!pageText.toLocaleLowerCase().includes(guidance.toLocaleLowerCase())) {
                failures.push(`${route}: second-return guidance is missing "${guidance}"`);
            }
        }
    }

    if (route === 'guide/index.html') {
        const chapterOrder = [
            'before-the-first-night',
            'the-first-night',
            'first-return',
            'second-night',
            'second-return',
            'first-permanent-choices',
            'tools-incantations-fated-list',
            'first-clear-build',
            'productive-night-loop',
            'guardian-preparation',
            'first-route-clear',
            'open-the-surface',
            'gods-and-field-allies',
            'weapons-and-aspects',
            'complete-loadout',
            'advanced-boon-planning',
            'advance-both-routes',
            'true-ending',
            'rescue-the-fates',
            'fear-testaments-nightmare',
            'trials-bounties-ranks',
            'relationship-cleanup',
            'fated-list-cleanup',
            'exhaustive-completion',
        ];
        let previousIndex = -1;
        for (const chapter of chapterOrder) {
            const currentIndex = html.indexOf(`href="/guide/${chapter}/"`);
            if (currentIndex < 0 || currentIndex <= previousIndex) {
                failures.push(`${route}: chapter order is missing or incorrect at ${chapter}`);
                break;
            }
            previousIndex = currentIndex;
        }
    }

    if (route === 'guide/overview/index.html') {
        for (const chapter of [
            'before-the-first-night',
            'second-night',
            'second-return',
            'tools-incantations-fated-list',
            'first-clear-build',
            'gods-and-field-allies',
            'rescue-the-fates',
            'exhaustive-completion',
        ]) {
            if (!html.includes(`href="/guide/${chapter}/"`)) {
                failures.push(`${route}: fast-track stage links are missing ${chapter}`);
            }
        }
        for (const heading of ['Start here if', 'Move on when', 'Wait on', 'Detailed chapters']) {
            if (!pageText.includes(heading)) failures.push(`${route}: fast-track scan label is missing "${heading}"`);
        }
        for (const prematureSpoiler of [
            'Gigaros',
            'Typhon',
            'Chronos on both routes',
            'Hecate and Moros bond events',
        ]) {
            if (pageText.includes(prematureSpoiler)) {
                failures.push(`${route}: fast track exposes a premature story detail "${prematureSpoiler}"`);
            }
        }
    }

    if (route === 'guide/productive-night-loop/index.html') {
        for (const guidance of ['Hestia requires', 'Nemesis', 'choose promptly', 'take a door before you do']) {
            if (!pageText.includes(guidance)) failures.push(`${route}: run-loop guidance is missing "${guidance}"`);
        }
    }

    if (route === 'guide/tools-incantations-fated-list/index.html') {
        for (const guidance of [
            'at most 3 new Incantations',
            'fixed Cauldron order',
            'Forget-Me-Not',
            'lead, not a guarantee',
        ]) {
            if (!pageText.includes(guidance)) failures.push(`${route}: system guidance is missing "${guidance}"`);
        }
    }

    if (route === 'knowledge/records/regions/the-crossroads/index.html') {
        for (const guidance of [
            'Use the circuit your return has opened',
            'First return',
            'Second return and later',
            'The Cauldron first becomes usable on the second return.',
            'Talk to every marked character',
            'Why a Cauldron recipe may be missing',
            'Know what each stop is for',
            'What Forget-Me-Not means on a door',
            'lead, not a guarantee',
        ]) {
            if (!pageText.includes(guidance)) failures.push(`${route}: Crossroads guidance is missing "${guidance}"`);
        }
        for (const requiredHref of [
            '/knowledge/incantations/',
            '/knowledge/arcana/',
            '/knowledge/weapons/',
            '/knowledge/relationships/',
            '/knowledge/prophecies/',
            '/guide/first-return/',
            '/guide/second-night/',
            '/guide/second-return/',
        ]) {
            if (!html.includes(`href="${requiredHref}"`)) {
                failures.push(`${route}: Crossroads guidance is missing link ${requiredHref}`);
            }
        }
    }

    if (route === 'guide/first-permanent-choices/index.html') {
        const requiredPsycheGuidance = [
            'Psyche is not a normal chamber-door reward.',
            'Compel Lost Shades with the Tablet of Peace',
            'buy 5 Psyche from the Wretched Broker for 30 Bones',
            "Narcissus's Mystic Secrets",
        ];
        for (const guidance of requiredPsycheGuidance) {
            if (!pageText.includes(guidance)) {
                failures.push(`${route}: Psyche guidance is missing "${guidance}"`);
            }
        }

        const requiredPsycheLinks = [
            ['Psyche', '/knowledge/records/resources/psyche/'],
            ['Tablet of Peace', '/knowledge/resources/'],
            ['Psyche exchange', '/knowledge/resources/'],
            ['Mystic Secrets', '/knowledge/records/regions/mystic-secrets/'],
        ];
        for (const [label, href] of requiredPsycheLinks) {
            const escapedHref = href.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
            const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
            const linkedLabel = new RegExp(
                `<a\\b[^>]*href="${escapedHref}"[^>]*>[\\s\\S]*?${escapedLabel}[\\s\\S]*?<\\/a>`,
                'u'
            );
            if (!linkedLabel.test(html)) {
                failures.push(`${route}: Psyche guidance does not link ${label} to ${href}`);
            }
        }
    }
}

for (const [title, routes] of routesByTitle) {
    if (routes.length > 1) failures.push(`duplicate title "${title}" on ${routes.join(', ')}`);
}
for (const [description, routes] of routesByDescription) {
    if (routes.length > 1) failures.push(`duplicate meta description "${description}" on ${routes.join(', ')}`);
}

for (const route of buildExpectationsByRoute.keys()) {
    if (!htmlFiles.some((file) => relative(root, file).replaceAll('\\', '/') === route)) {
        failures.push(`${route}: published aspect build page is missing`);
    }
}

const expectedSocialImages = new Set(['/og/social-preview.webp']);
for (const imagePath of expectedSocialImages) {
    if (!socialImagePaths.has(imagePath))
        failures.push(`${imagePath}: generated social image is not assigned to a page family`);
    const file = join(root, imagePath.replace(/^\//u, ''));
    if (!existsSync(file)) continue;
    const metadata = await sharp(file).metadata();
    if (metadata.format !== 'webp' || metadata.width !== 1200 || metadata.height !== 630) {
        failures.push(`${imagePath}: expected an optimized 1200 by 630 WebP image`);
    }
}

const sitemapIndexPath = join(root, 'sitemap-index.xml');
const sitemapPath = join(root, 'sitemap-0.xml');
if (!existsSync(sitemapIndexPath) || !existsSync(sitemapPath)) {
    failures.push('generated sitemap index or route sitemap is missing');
} else {
    const sitemapIndex = readFileSync(sitemapIndexPath, 'utf8');
    const sitemap = readFileSync(sitemapPath, 'utf8');
    if (!sitemapIndex.includes(new URL('/sitemap-0.xml', publicSite).href)) {
        failures.push('sitemap index does not use the canonical origin');
    }
    const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/gu)].map((match) => match[1]);
    if (sitemapUrls.length !== indexableHtmlFiles.length) {
        failures.push(
            `sitemap contains ${sitemapUrls.length} URLs for ${indexableHtmlFiles.length} indexable HTML pages`
        );
    }
    for (const canonical of canonicalRoutes) {
        if (!sitemapUrls.includes(canonical)) failures.push(`sitemap is missing ${canonical}`);
    }
    const hintCount = sitemap.match(/<changefreq>/gu)?.length ?? 0;
    const priorityCount = sitemap.match(/<priority>/gu)?.length ?? 0;
    if (hintCount !== sitemapUrls.length || priorityCount !== sitemapUrls.length) {
        failures.push('sitemap refresh and priority hints do not cover every route');
    }
}

if (existsSync(join(root, 'robots.txt'))) {
    failures.push('robots.txt must be supplied by Cloudflare, not the static site');
}

const searchFaviconPath = join(root, 'icon-192.png');
if (!existsSync(searchFaviconPath)) {
    failures.push('Google Search favicon /icon-192.png is missing');
} else {
    const metadata = await sharp(searchFaviconPath).metadata();
    if (metadata.format !== 'png' || metadata.width !== 192 || metadata.height !== 192) {
        failures.push('Google Search favicon must be a square 192 by 192 PNG');
    }
}

const manifestPath = join(root, 'site.webmanifest');
if (!existsSync(manifestPath)) {
    failures.push('site.webmanifest is missing');
} else {
    try {
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
        if (manifest.name !== 'NeonHades2' || manifest.short_name !== 'NH2' || manifest.id !== '/') {
            failures.push('site.webmanifest has incomplete public identity');
        }
        for (const icon of ['/favicon.svg', '/icon-192.png', '/icon-512.png']) {
            if (!manifest.icons?.some((candidate) => candidate.src === icon)) {
                failures.push(`site.webmanifest is missing ${icon}`);
            }
            if (!existsSync(join(root, icon.replace(/^\//u, '')))) failures.push(`${icon}: manifest icon is missing`);
        }
    } catch {
        failures.push('site.webmanifest is not valid JSON');
    }
}

const publicPngAssets = allFiles(join(root, 'art')).filter((file) => file.toLowerCase().endsWith('.png'));
for (const file of publicPngAssets) {
    failures.push(`${relative(root, file).replaceAll('\\', '/')}: public art must use SVG or WebP, not PNG`);
}

const publicArtFiles = allFiles(join(root, 'art'));
const allowedSvgDirectories = new Set(['art/scenes', 'art/symbols']);
const forbiddenPublicPath =
    /(?:^|\/)(?:subjects|theatre|lottie|reconstructed|codex)(?:\/|$)|(?:^|\/)(?:crafted|characters-out|materials-out|records-out|toolexorcismbook2?|toolpickaxe2?|toolshovel2?|toolfishingrod2?|weaponupgrade|stackupgrade|metacardpointscommondrop)(?:\.|\/|$)/u;
for (const file of publicArtFiles) {
    const assetPath = relative(root, file).replaceAll('\\', '/');
    const directory = assetPath.slice(0, assetPath.lastIndexOf('/'));
    const fileName = assetPath.slice(assetPath.lastIndexOf('/') + 1);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*\.(?:webp|svg|json)$/u.test(fileName)) {
        failures.push(`${assetPath}: public asset filename is not reader-facing kebab-case`);
    }
    if (forbiddenPublicPath.test(assetPath)) {
        failures.push(`${assetPath}: public asset path exposes internal workflow vocabulary`);
    }
    if (fileName.endsWith('.svg') && !allowedSvgDirectories.has(directory)) {
        failures.push(`${assetPath}: individual complex artwork must be published as optimized WebP`);
    }
}

const referencePattern = /\/art\/[a-z0-9][a-z0-9./-]*\.(?:webp|svg|json)/giu;
const referencedArt = new Set();
for (const file of allFiles(root)) {
    if (!/\.(?:html|css|js|json|xml|txt|webmanifest)$/iu.test(file)) continue;
    for (const match of readFileSync(file, 'utf8').matchAll(referencePattern)) referencedArt.add(match[0]);
}
for (const file of publicArtFiles) {
    const assetPath = `/${relative(root, file).replaceAll('\\', '/')}`;
    if (!referencedArt.has(assetPath)) failures.push(`${assetPath}: public asset is not referenced by the built site`);
}

if (craftedSymbols.size < 900) {
    failures.push(`crafted subject sprite contains only ${craftedSymbols.size} symbols`);
}
const craftedCss = craftedSpriteText.match(/<style>([\s\S]*?)<\/style>/u)?.[1] ?? '';
if (
    craftedCss.indexOf('.fine{') < craftedCss.indexOf('.accent{') ||
    craftedCss.indexOf('.nofill{') < craftedCss.indexOf('.accent{')
) {
    failures.push('crafted subject sprite lets color classes refill fine or outline-only paths');
}
const renderedBodies = new Map();
for (const artId of renderedCraftedIds) {
    const details = craftedSymbolDetails.get(artId);
    if (!details) continue;
    const entries = renderedBodies.get(details.body) ?? [];
    entries.push({ id: artId, title: details.title });
    renderedBodies.set(details.body, entries);
}
for (const entries of renderedBodies.values()) {
    const titles = new Set(entries.map((entry) => entry.title));
    if (titles.size > 1) {
        failures.push(
            `crafted artwork is visually duplicated across different public subjects: ${[...titles].slice(0, 8).join(', ')}`
        );
    }
}
for (const [identity, titles] of recordArtTitles) {
    if (titles.size > 1) {
        failures.push(`${identity}: reused across different public subjects ${[...titles].slice(0, 5).join(', ')}`);
    }
}

const publicationRecords = Array.isArray(publication.records)
    ? publication.records
    : Object.values(publication.records);
const publicationByKey = new Map(publicationRecords.map((record) => [record.key, record]));
for (const subject of sourceDerivedArtwork) {
    const record = publicationByKey.get(subject.recordKey);
    const productionRecord = productionArtwork.records[subject.recordKey];
    if (!record?.public?.href) {
        failures.push(`${subject.recordKey}: source-derived artwork has no public detail route`);
        continue;
    }
    if (
        productionRecord?.status !== 'accepted' ||
        productionRecord?.route !== 'opencv-raster' ||
        productionRecord?.delivery?.source !== subject.delivery.source
    ) {
        failures.push(`${subject.recordKey}: source-derived artwork is not accepted in the production manifest`);
    }
    const deliveryPath = join(root, subject.delivery.source.replace(/^\/+/, ''));
    if (!existsSync(deliveryPath)) {
        failures.push(`${subject.recordKey}: source-derived delivery is missing ${subject.delivery.source}`);
    }
    const detailPath = join(root, record.public.href.replace(/^\/+|\/+$/gu, ''), 'index.html');
    const detailHtml = existsSync(detailPath) ? readFileSync(detailPath, 'utf8') : '';
    const rendersSourceDerivedArtwork =
        subject.recordType === 'world-progression/region'
            ? detailHtml.includes(`data-region-map="${subject.id}"`) &&
              detailHtml.includes(`href="${subject.delivery.source}"`)
            : detailHtml.includes(`data-subject-art-raster="${subject.id}"`) &&
              detailHtml.includes(`src="${subject.delivery.source}"`);
    if (!rendersSourceDerivedArtwork) {
        failures.push(`${subject.recordKey}: detail page does not render its source-derived artwork`);
    }
}

if (failures.length > 0) {
    throw new Error(`Public output audit failed:\n${failures.slice(0, 80).join('\n')}`);
}

console.warn('Public output audit passed.');
