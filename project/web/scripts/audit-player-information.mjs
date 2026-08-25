import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const distRoot = join(projectRoot, 'dist');
const publication = JSON.parse(readFileSync(join(projectRoot, 'src/content/publication.json'), 'utf8'));
const failures = [];

const requiredTypes = {
    'editorial/arcana-rating': { count: 25, fields: ['rating-guidance', 'subject-context'] },
    'editorial/aspect-guide': { count: 24 },
    'editorial/boon-rating': {
        count: 209,
        fields: ['rating', 'reason-prerequisites-limitation', 'subject-context'],
    },
    'editorial/familiar-rating': { count: 5, fields: ['rating-choice-guidance', 'subject-context'] },
    'editorial/hex-rating': { count: 9, fields: ['rating-choice-guidance', 'subject-context'] },
    'editorial/progression-stage': { count: 5 },
    'editorial/weapon-guide': { count: 6 },
    'mechanics/arcana-card': {
        count: 25,
        fields: ['description', 'grasp-cost', 'rank-costs-effects', 'unlock-requirements'],
    },
    'mechanics/boon': {
        count: 209,
        fields: ['description', 'effects', 'elements', 'level-scaling', 'prerequisites', 'rarity-scaling'],
    },
    'mechanics/cultivation': { count: 17 },
    'mechanics/encounter-aid': { count: 83 },
    'mechanics/familiar': { count: 5, fields: ['abilities-upgrades', 'unlock-requirements'] },
    'mechanics/fish': { count: 27 },
    'mechanics/gathering-tool': { count: 8 },
    'mechanics/god': { count: 11 },
    'mechanics/grasp-progression': {
        count: 1,
        fields: ['name-description', 'starting-capacity', 'upgrade-series'],
    },
    'mechanics/hammer-upgrade': { count: 92, fields: ['compatibility', 'description', 'effects'] },
    'mechanics/hex': { count: 9, fields: ['base-effect', 'path-upgrades'] },
    'mechanics/incantation': { count: 95, fields: ['costs', 'effects', 'unlock-requirements'] },
    'mechanics/keepsake': { count: 33, fields: ['acquisition', 'description', 'rank-effects'] },
    'mechanics/market-offer': { count: 67 },
    'mechanics/resource': { count: 93 },
    'mechanics/run-reward': { count: 13 },
    'mechanics/status-element': { count: 9, fields: ['behavior'] },
    'mechanics/weapon': { count: 6, fields: ['unlock-costs', 'unlock-requirements'] },
    'mechanics/weapon-aspect': {
        count: 24,
        fields: ['attack-pattern', 'rank-costs', 'rank-effects', 'unlock-requirements'],
    },
    'world-progression/achievement': { count: 50, fields: ['trigger'] },
    'world-progression/encounter': { count: 1, fields: ['classification', 'enemies', 'region', 'rewards'] },
    'world-progression/encounter-friend': { count: 12, fields: ['aid', 'appearance'] },
    'world-progression/enemy': { count: 98, fields: ['attacks-behavior', 'classification', 'stats'] },
    'world-progression/narrative-milestone': { count: 37 },
    'world-progression/oath-condition': { count: 17, fields: ['description', 'rank-effects'] },
    'world-progression/opening-state': { count: 1, fields: ['forced-boon-choice', 'room-encounter'] },
    'world-progression/prophecy': { count: 89, fields: ['objectives', 'rewards', 'unlock-requirements'] },
    'world-progression/region': { count: 11, fields: ['encounters', 'unlock-requirements'] },
    'world-progression/relationship': { count: 33, fields: ['gift-track', 'rewards'] },
    'world-progression/strife-curse': { count: 1, fields: ['appearance', 'effect', 'name-description'] },
    'world-progression/surface-penalty': { count: 1, fields: ['activation', 'effect', 'removal'] },
    'world-progression/testament-bounty': { count: 34, fields: ['requirements', 'rewards'] },
};

const publishedTypes = new Set(
    publication.records.filter((record) => record.public).map((record) => record.recordType)
);
for (const recordType of publishedTypes) {
    if (!requiredTypes[recordType])
        failures.push(`${recordType}: published record type has no player-information contract`);
}

const fieldSuffixes = (record) => new Set(record.fields.map((field) => field.id.split('/').at(-1)));

for (const [recordType, contract] of Object.entries(requiredTypes)) {
    const records = publication.records.filter((record) => record.recordType === recordType && record.public);
    if (records.length !== contract.count) {
        failures.push(`${recordType}: expected ${contract.count} published records, found ${records.length}`);
    }
    for (const record of records) {
        const suffixes = fieldSuffixes(record);
        for (const field of contract.fields ?? []) {
            if (!suffixes.has(field)) failures.push(`${record.key}: missing player field ${field}`);
        }
    }
}

const requiredCollections = [
    'achievements',
    'arcana',
    'boons',
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
    'story',
    'weapons',
];
for (const collection of requiredCollections) {
    const page = publication.pages.find((candidate) => candidate.id === `reference/${collection}`);
    if (!page || page.recordKeys.length === 0) failures.push(`${collection}: missing populated Knowledge collection`);
    const output = join(distRoot, 'knowledge', collection, 'index.html');
    if (!existsSync(output)) failures.push(`${collection}: missing built Knowledge route`);
}

const routeVisibleText = (route) => {
    const path = join(distRoot, ...route.split('/'), 'index.html');
    return existsSync(path)
        ? readFileSync(path, 'utf8')
              .replaceAll(/<script\b[\s\S]*?<\/script>/giu, ' ')
              .replaceAll(/<style\b[\s\S]*?<\/style>/giu, ' ')
              .replaceAll(/<[^>]+>/gu, ' ')
              .replaceAll('&amp;', '&')
              .replaceAll('&#39;', "'")
              .replaceAll('&quot;', '"')
              .replaceAll(/\s+/gu, ' ')
              .trim()
        : '';
};
const routeText = (route) => routeVisibleText(route).toLocaleLowerCase();
const visibleFragmentText = (value) =>
    value
        .replaceAll(/<script\b[\s\S]*?<\/script>/giu, ' ')
        .replaceAll(/<style\b[\s\S]*?<\/style>/giu, ' ')
        .replaceAll(/<[^>]+>/gu, ' ')
        .replaceAll('&amp;', '&')
        .replaceAll('&#39;', "'")
        .replaceAll('&quot;', '"')
        .replaceAll(/\s+/gu, ' ')
        .trim();
const readerWords = (value) =>
    value
        .normalize('NFKD')
        .replaceAll(/[^\p{Letter}\p{Number}]+/gu, ' ')
        .replaceAll(/\s+/gu, ' ')
        .trim()
        .toLocaleLowerCase();

for (const record of publication.records.filter(
    (candidate) => candidate.public?.presentation === 'detail' && candidate.public.href
)) {
    const route = record.public.href.replace(/^\/+|\/+$/gu, '').split('#')[0];
    const path = join(distRoot, ...route.split('/'), 'index.html');
    if (!existsSync(path)) continue;
    const html = readFileSync(path, 'utf8');
    const plainLists = [...html.matchAll(/<ul\b[^>]*class="[^"]*\bplain-list\b[^"]*"[^>]*>([\s\S]*?)<\/ul>/gu)];
    for (const list of plainLists) {
        for (const item of list[1].matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gu)) {
            const text = visibleFragmentText(item[1]);
            if (text.length > 320) {
                failures.push(
                    `${record.key}: raw list item exceeds the 320-character reading contract (${text.length})`
                );
            }
        }
    }
}

const beyondFamiliarRoute = 'knowledge/records/prophecies/beyond-familiar';
const beyondFamiliarHtml = readFileSync(join(distRoot, ...beyondFamiliarRoute.split('/'), 'index.html'), 'utf8');
for (const familiar of ['Frinos', 'Raki', 'Toula', 'Hecuba', 'Gale']) {
    if (!new RegExp(`<h3[^>]*>${familiar}</h3>`, 'u').test(beyondFamiliarHtml)) {
        failures.push(`Beyond Familiar: missing grouped ${familiar} upgrade path`);
    }
}
if (
    !beyondFamiliarHtml.includes('data-condition-set') ||
    !routeVisibleText(beyondFamiliarRoute).includes(
        'Choose one Familiar and unlock any 3 upgrades from its rank paths.'
    ) ||
    routeVisibleText(beyondFamiliarRoute).includes('Meet one of these conditions: at least 3 from Familiar upgrades')
) {
    failures.push('Beyond Familiar: Familiar alternatives remain flattened into one unreadable rule');
}

for (const record of publication.records.filter(
    (candidate) => candidate.public?.presentation === 'detail' && candidate.public.href
)) {
    const route = record.public.href.replace(/^\/+|\/+$/gu, '').split('#')[0];
    const path = join(distRoot, ...route.split('/'), 'index.html');
    if (!existsSync(path)) continue;
    const html = readFileSync(path, 'utf8');
    if (!html.includes('data-condition-set')) continue;
    const text = routeVisibleText(route);
    if (
        /Requires at least \d+ from|Give at least \d+ gifts to any one of\.|required rewards obtained|boons recorded across nights/iu.test(
            text
        )
    ) {
        failures.push(`${record.key}: grouped condition still exposes a generator-shaped label`);
    }
}

const prophecyIndexText = routeVisibleText('knowledge/prophecies');
if (
    !prophecyIndexText.includes('The Invoker Complete any 10 eligible Incantations.') ||
    prophecyIndexText.includes('The Invoker Complete at least 10 of these incantations:')
) {
    failures.push('Prophecies index: The Invoker still exposes its full objective as the collection summary');
}

const buildDirectory = join(distRoot, 'knowledge', 'builds');
let legendaryTargetGroupCount = 0;
for (const entry of readdirSync(buildDirectory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const html = readFileSync(join(buildDirectory, entry.name, 'index.html'), 'utf8');
    const cardCount = (html.match(/class="rare-target-card"/gu) ?? []).length;
    if (cardCount === 0) continue;
    const opensWithCount = (html.match(/class="rare-target-opens-with"/gu) ?? []).length;
    const requirementFooterCount = (html.match(/<footer>\s*<button\b[^>]*class="rare-target-requirements"/gu) ?? [])
        .length;
    if (opensWithCount !== cardCount || requirementFooterCount !== cardCount) {
        failures.push(
            `${entry.name}: ${cardCount} rare targets render ${opensWithCount} opening paths and ${requirementFooterCount} footer controls`
        );
    }
    if (!html.includes('rare-target-group--duo')) {
        failures.push(`${entry.name}: Duo targets are not rendered in their named group`);
    }
    legendaryTargetGroupCount += (html.match(/rare-target-group--legendary/gu) ?? []).length;
}
if (legendaryTargetGroupCount === 0) {
    failures.push('Build details: no rendered Legendary target group remains distinct from Duo targets');
}

const fieldValue = (record, suffix) => record?.fields.find((field) => field.id.endsWith(`/${suffix}`))?.value;
const boonRecordsByKey = new Map(
    publication.records.filter((record) => record.recordType === 'mechanics/boon').map((record) => [record.key, record])
);
const coreBoonSuffixes = ['WeaponBoon', 'SpecialBoon', 'CastBoon', 'SprintBoon', 'ManaBoon'];

for (const god of publication.records.filter((record) => record.recordType === 'mechanics/god' && record.public)) {
    const boonReferences = fieldValue(god, 'boons');
    if (!Array.isArray(boonReferences) || boonReferences.length === 0) continue;
    const route = god.public.href.replace(/^\/+|\/+$/gu, '');
    const path = join(distRoot, ...route.split('/'), 'index.html');
    const html = existsSync(path) ? readFileSync(path, 'utf8') : '';
    const pool = html.match(/<ul\b[^>]*class="[^"]*\bboon-pool-groups\b[^"]*"[^>]*>[\s\S]*?<\/ul>/u)?.[0];
    if (!pool) {
        failures.push(`${god.key}: boon pool is not rendered as named groups`);
        continue;
    }

    const entries = boonReferences
        .filter(
            (reference) =>
                reference &&
                typeof reference === 'object' &&
                reference.recordType === 'mechanics/boon' &&
                typeof reference.id === 'string'
        )
        .map((reference) => ({
            record: boonRecordsByKey.get(`${reference.recordType}:${reference.id}`),
            reference,
        }));
    const normalEntries = entries.filter(({ record }) => fieldValue(record, 'kind') === 'normal');
    const corePrefixes = new Set(
        normalEntries.flatMap(({ record }) =>
            coreBoonSuffixes.flatMap((suffix) =>
                record?.id.endsWith(suffix) ? [record.id.slice(0, -suffix.length)] : []
            )
        )
    );
    const corePrefix = [...corePrefixes].find((prefix) =>
        coreBoonSuffixes.every((suffix) => normalEntries.some(({ record }) => record?.id === `${prefix}${suffix}`))
    );
    const hasChaosPairs =
        normalEntries.some(({ record }) => record?.id.endsWith('Curse')) &&
        normalEntries.some(({ record }) => record?.id.endsWith('Blessing'));
    const groupFor = (record) => {
        const kind = fieldValue(record, 'kind');
        if (kind === 'infusion' || kind === 'legendary' || kind === 'duo') return kind;
        if (kind !== 'normal') return 'other';
        if (corePrefix && coreBoonSuffixes.some((suffix) => record.id === `${corePrefix}${suffix}`)) return 'core';
        if (hasChaosPairs && record.id.endsWith('Curse')) return 'curses';
        if (hasChaosPairs && record.id.endsWith('Blessing')) return 'blessings';
        return 'supporting';
    };

    for (const { record } of entries) {
        if (!record?.public?.href) {
            failures.push(`${god.key}: boon pool contains an unresolved record reference`);
            continue;
        }
        const occurrences = pool.split(`href="${record.public.href}"`).length - 1;
        if (occurrences !== 1) {
            failures.push(`${god.key}: expected ${record.public.name} once in its boon pool, found ${occurrences}`);
        }
        const groupKey = groupFor(record);
        const group = pool.match(
            new RegExp(`<li\\b[^>]*data-boon-group="${groupKey}"[^>]*>[\\s\\S]*?<\\/li>`, 'u')
        )?.[0];
        if (!group?.includes(`href="${record.public.href}"`)) {
            failures.push(`${god.key}: ${record.public.name} is not in its ${groupKey} group`);
        }
    }
}

const upgradeSurfaceContracts = [
    { recordType: 'mechanics/arcana-card', field: 'rank-costs-effects', terms: ['Ranks and costs'] },
    {
        recordType: 'mechanics/grasp-progression',
        field: 'upgrade-series',
        terms: ['Starting Grasp', 'Grasp upgrades'],
    },
    { recordType: 'mechanics/keepsake', field: 'rank-effects', terms: ['Rank effects'] },
    { recordType: 'mechanics/weapon-aspect', field: 'rank-costs', terms: ['Aspect rank progression'] },
    { recordType: 'mechanics/boon', field: 'level-scaling', terms: ['Pom scaling'] },
    { recordType: 'mechanics/familiar', field: 'abilities-upgrades', terms: ['Abilities and upgrades'] },
    {
        recordType: 'mechanics/gathering-tool',
        field: 'level-costs',
        terms: ['Greater Favor of Gaia upgrade'],
    },
    { recordType: 'mechanics/hex', field: 'path-upgrades', terms: ['Path of Stars upgrades'] },
    { recordType: 'world-progression/oath-condition', field: 'rank-effects', terms: ['How the vow scales'] },
];
for (const contract of upgradeSurfaceContracts) {
    const records = publication.records.filter(
        (record) =>
            record.recordType === contract.recordType &&
            record.public &&
            record.fields.some((field) => field.id.endsWith(`/${contract.field}`))
    );
    for (const record of records) {
        const route = record.public.href.replace(/^\/+|\/+$/gu, '').split('#')[0];
        const visibleText = routeVisibleText(route);
        for (const term of contract.terms) {
            if (!visibleText.includes(term)) {
                failures.push(`${record.key}: upgrade surface is missing ${JSON.stringify(term)}`);
            }
        }
        if (record.recordType === 'mechanics/keepsake') {
            const rankMarkers = ['Rank 1 Common', 'Rank 2 Rare', 'Rank 3 Epic'];
            const positions = rankMarkers.map((marker) => visibleText.indexOf(marker));
            if (
                positions.some((position) => position < 0) ||
                positions.some((position, index) => index > 0 && position <= positions[index - 1])
            ) {
                failures.push(`${record.key}: Keepsake ranks are not shown in Common, Rare, Epic order`);
            }
        }
        if (record.recordType === 'world-progression/oath-condition') {
            const rankEffects = record.fields.find((field) => field.id.endsWith('/rank-effects'))?.value;
            const ranks =
                rankEffects && typeof rankEffects === 'object' && !Array.isArray(rankEffects) ? rankEffects.ranks : [];
            for (const rank of Array.isArray(ranks) ? ranks : []) {
                if (
                    rank &&
                    typeof rank === 'object' &&
                    !Array.isArray(rank) &&
                    typeof rank.effect === 'string' &&
                    !visibleText.includes(rank.effect)
                ) {
                    failures.push(`${record.key}: rank effect is missing from the built page: ${rank.effect}`);
                }
            }
        }
    }
}

for (const record of publication.records.filter(
    (candidate) => candidate.recordType === 'world-progression/relationship' && candidate.public
)) {
    const route = record.public.href.replace(/^\/+|\/+$/gu, '').split('#')[0];
    const path = join(distRoot, ...route.split('/'), 'index.html');
    const html = existsSync(path) ? readFileSync(path, 'utf8') : '';
    const visibleText = routeVisibleText(route);
    for (const step of [
        'First gift.',
        'Before the heart gate.',
        'Clear the heart gate.',
        'Complete the remaining hearts.',
        'Bond Forged.',
    ]) {
        if (!visibleText.includes(step)) failures.push(`${record.key}: relationship path is missing ${step}`);
    }
    if (!html.includes('<ol class="reader-steps">')) {
        failures.push(`${record.key}: relationship path is not rendered as an ordered list`);
    }
}

const topicCoverage = [
    {
        route: 'guide/before-the-first-night',
        terms: ['life', 'magick', 'omega', 'god mode', '20%', '2 percentage points'],
    },
    { route: 'guide/the-first-night', terms: ['reward door', 'ashes', 'centaur heart'] },
    {
        route: 'guide/first-return',
        terms: ['being purified', 'second return', 'altar', 'silver pool'],
    },
    {
        route: 'guide/second-night',
        terms: ['moly', 'not a reward-door', 'ashes', 'second return'],
    },
    {
        route: 'guide/second-return',
        terms: ['at most 3 new incantations', "night's craftwork", '1 moly', 'crescent pick', '1 ash'],
    },
    {
        route: 'guide/productive-night-loop',
        terms: ['hestia requires', 'nemesis', 'choose promptly', 'take a door before you do'],
    },
    {
        route: 'guide/tools-incantations-fated-list',
        terms: ['fixed cauldron order', 'forget-me-not', 'lead, not a guarantee', 'conversation'],
    },
    { route: 'guide/advanced-boon-planning', terms: ['origination', 'infusion', 'legendary'] },
    { route: 'guide/open-the-surface', terms: ['surface', 'witching-wards', 'blessing of strife'] },
    {
        route: 'guide/first-permanent-choices',
        terms: ['arcana ranks', 'grasp capacity', 'boon rarity and pom levels', 'hex path upgrades'],
    },
    { route: 'guide/trials-bounties-ranks', terms: ['chaos trials', 'pitch-black stone', 'testament'] },
    { route: 'guide/true-ending', terms: ['true ending', 'chaos trial', 'fear'] },
    { route: 'knowledge/achievements', terms: ['exact trigger', 'remaining achievements'] },
    { route: 'knowledge/arcana', terms: ['grasp', 'card'] },
    { route: 'knowledge/boons', terms: ['legendary boon', 'duo boon', 'prerequisite'] },
    { route: 'knowledge/enemies', terms: ['guardian', 'maximum life', 'attack patterns'] },
    { route: 'knowledge/familiars', terms: ['combat passives', 'recruitment requirements', 'upgrade paths'] },
    { route: 'knowledge/hammers', terms: ['daedalus hammer', 'weapon compatibility'] },
    { route: 'knowledge/hexes', terms: ['path of stars', 'magick'] },
    { route: 'knowledge/incantations', terms: ['cauldron', 'what it costs', 'unlock'] },
    { route: 'knowledge/keepsakes', terms: ['acquisition', 'rank effects'] },
    { route: 'knowledge/relationships', terms: ['book of shadows', 'gift', 'heart'] },
    { route: 'knowledge/resources', terms: ['room reward', 'wretched broker', 'cultivation'] },
    { route: 'knowledge/oath', terms: ['oath', 'fear', 'testament'] },
    { route: 'knowledge/prophecies', terms: ['reveal condition', 'completion requirements', 'reward'] },
    { route: 'knowledge/regions', terms: ['underworld', 'surface', 'encounter'] },
    { route: 'knowledge/story', terms: ['main ending', 'epilogue', 'relationship'] },
    { route: 'knowledge/weapons', terms: ['weapon', 'aspect', 'rank'] },
    {
        route: 'knowledge/records/regions/the-crossroads',
        terms: [
            'return circuit',
            'marked character',
            'cauldron recipe may be missing',
            'forget-me-not',
            'training grounds',
        ],
    },
    {
        route: 'knowledge/records/boons/heaven-strike',
        terms: ['blitz damage', 'pom scaling', 'rarity multipliers', 'rare', '×1.2'],
        forbiddenTerms: ['inflict echo', 'echo effects', 'echo damage', 'echo duration', 'how echo triggers'],
    },
    {
        route: 'knowledge/records/boons/proper-upbringing',
        terms: ['at least 2 of every element', 'common boons gain rarity'],
        forbiddenTerms: ['2all elements'],
    },
    {
        route: 'knowledge/records/boons/shocking-loss',
        terms: ['25% before luck', 'rarity multipliers', 'what it needs'],
    },
    {
        route: 'knowledge/records/arcana/the-messenger',
        terms: ['ranks and costs', 'rank 1', 'rank 3', 'speed boost', '50%', 'unlock'],
    },
    {
        route: 'knowledge/records/arcana/grasp',
        terms: ['starting grasp', 'starting capacity', 'grasp upgrades', 'level 15'],
    },
    {
        route: 'knowledge/records/keepsakes/silken-sash',
        terms: ['rank effects', 'rank 1', 'rank 3', 'after 25 chambers'],
    },
    {
        route: 'knowledge/builds/moonstone-axe-aspect-of-charon',
        terms: ['aspect rank progression', 'rank 1', 'rank 5', 'damage', '10%', 'forge cost'],
    },
    {
        route: 'knowledge/records/boons/snuffed-candle',
        terms: ['pom scaling', 'level 1', 'level 5', 'chance', '15%'],
    },
    {
        route: 'knowledge/records/boons/fire-away',
        terms: ['pom scaling', 'damage', '400'],
        forbiddenTerms: ['400%'],
    },
    {
        route: 'knowledge/records/boons/king-tide',
        terms: ['pom scaling', 'damage', '200%'],
    },
    {
        route: 'knowledge/records/boons/nova-strike',
        terms: ['pom scaling', 'area increase', '20% to 40% by weapon'],
    },
    {
        route: 'knowledge/records/boons/nova-flourish',
        terms: ['pom scaling', 'area increase', '20% to 60% by weapon'],
    },
    {
        route: 'knowledge/records/boons/extended-family',
        terms: ['pom scaling', '3% per olympian'],
    },
    {
        route: 'knowledge/builds/sister-blades-aspect-of-artemis',
        terms: ['aspect rank progression', 'crit chance', '50% before luck', 'hits', '9'],
    },
    {
        route: 'knowledge/records/keepsakes/blackened-fleece',
        terms: ['rank effects', 'depends on damage taken'],
    },
];
for (const topic of topicCoverage) {
    const text = routeText(topic.route);
    if (!text) {
        failures.push(`${topic.route}: built topic route is missing`);
        continue;
    }
    for (const term of topic.terms) {
        if (!text.includes(term)) failures.push(`${topic.route}: missing topic language ${JSON.stringify(term)}`);
    }
    for (const term of topic.forbiddenTerms ?? []) {
        if (text.includes(term))
            failures.push(`${topic.route}: contains incorrect topic language ${JSON.stringify(term)}`);
    }
}

const builtHtmlFiles = (directory) =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        return entry.isDirectory()
            ? builtHtmlFiles(path)
            : entry.isFile() && entry.name.endsWith('.html')
              ? [path]
              : [];
    });
const staleBlitzTerminology = [
    /\binflict(?:s|ing)? Echo\b/iu,
    /\bEcho effects?\b/iu,
    /\bEcho damage\b/iu,
    /\bEcho duration\b/iu,
    /\bHow Echo triggers\b/iu,
    /\bRushing into foes with Echo\b/iu,
    /\bHeaven Strike applies Echo\b/iu,
];
for (const path of builtHtmlFiles(distRoot)) {
    const text = readFileSync(path, 'utf8')
        .replaceAll(/<script\b[\s\S]*?<\/script>/giu, ' ')
        .replaceAll(/<style\b[\s\S]*?<\/style>/giu, ' ')
        .replaceAll(/<[^>]+>/gu, ' ')
        .replaceAll(/\s+/gu, ' ');
    for (const pattern of staleBlitzTerminology) {
        if (pattern.test(text))
            failures.push(`${path}: stale internal Echo terminology is visible (${pattern.source})`);
    }
}

const hasResolvedScalingValues = (value) =>
    Array.isArray(value) &&
    value.some(
        (entry) =>
            entry &&
            typeof entry === 'object' &&
            !Array.isArray(entry) &&
            entry.result &&
            typeof entry.result === 'object' &&
            !Array.isArray(entry.result) &&
            Array.isArray(entry.result.values) &&
            entry.result.values.length > 0
    );
const hasRarityMultipliers = (value) =>
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.values(value).some(
        (entry) =>
            entry &&
            typeof entry === 'object' &&
            !Array.isArray(entry) &&
            ['Multiplier', 'MinMultiplier', 'MaxMultiplier'].some((key) => typeof entry[key] === 'number')
    );
const detailRecords = publication.records.filter((record) => record.public?.href?.startsWith('/knowledge/records/'));
for (const record of detailRecords) {
    const route = record.public.href.replace(/^\/+|\/+$/gu, '');
    const visibleText = routeVisibleText(route);
    if (!visibleText) {
        failures.push(`${record.key}: missing built detail route ${record.public.href}`);
        continue;
    }
    if (!readerWords(visibleText).includes(readerWords(record.public.name))) {
        failures.push(`${record.key}: built detail route does not identify ${record.public.name}`);
    }

    const levelScaling = record.fields.find((field) => field.id.endsWith('/level-scaling'))?.value;
    if (hasResolvedScalingValues(levelScaling) && !visibleText.includes('Pom scaling')) {
        failures.push(`${record.key}: resolved level scaling is missing from the detail page`);
    }

    const rarityScaling = record.fields.find((field) => field.id.endsWith('/rarity-scaling'))?.value;
    if (hasRarityMultipliers(rarityScaling) && !visibleText.includes('Rarity multipliers')) {
        failures.push(`${record.key}: rarity multipliers are missing from the detail page`);
    }

    const rawMetric = visibleText.match(/\b(?:Tooltip|Reported|Unmodified)[A-Z][A-Za-z0-9]*\b/u)?.[0];
    if (rawMetric) failures.push(`${record.key}: raw internal metric ${rawMetric} is visible`);
}

const enemies = publication.records.filter(
    (record) => record.recordType === 'world-progression/enemy' && record.public
);
const publicEnemyIds = new Set(enemies.map((enemy) => enemy.id));
for (const encounter of publication.records.filter((record) => record.recordType === 'world-progression/encounter')) {
    const references = encounter.fields.find((field) => field.id.endsWith('/enemies'))?.value;
    if (!Array.isArray(references)) continue;
    for (const reference of references) {
        if (
            !reference ||
            typeof reference !== 'object' ||
            reference.recordType !== 'world-progression/enemy' ||
            typeof reference.id !== 'string' ||
            !publicEnemyIds.has(reference.id)
        ) {
            failures.push(`${encounter.key}: enemy reference does not resolve to a published canonical enemy`);
        }
    }
}
const encounterFriendNames = new Set(['Artemis', 'Heracles', 'Medea', 'Nemesis']);
for (const enemy of enemies) {
    const stats = enemy.fields.find((field) => field.id.endsWith('/stats'))?.value;
    const behavior = enemy.fields.find((field) => field.id.endsWith('/attacks-behavior'))?.value;
    if (!stats || typeof stats !== 'object' || Array.isArray(stats) || typeof stats['maximum-life'] !== 'number') {
        failures.push(`${enemy.key}: missing extracted maximum Life`);
    }
    if (
        !behavior ||
        typeof behavior !== 'object' ||
        Array.isArray(behavior) ||
        !Array.isArray(behavior['attack-patterns']) ||
        behavior['attack-patterns'].length === 0
    ) {
        failures.push(`${enemy.key}: missing extracted attack patterns`);
    }
    if (!existsSync(join(distRoot, enemy.public.href.replace(/^\/+|\/$/gu, ''), 'index.html'))) {
        failures.push(`${enemy.key}: missing built detail route ${enemy.public.href}`);
    }
    if (encounterFriendNames.has(enemy.public.name)) {
        failures.push(`${enemy.key}: encounter friend leaked into the enemy collection`);
    }
}

for (const evidence of [
    { name: 'Chronos', maximumLife: 20000, attack: 'Scythe Throw', region: 'I' },
    { name: 'Hecate', maximumLife: 6050, attack: 'Melee Combo', region: 'F' },
    { name: 'Typhon', maximumLife: 65000, attack: 'Center Eye', region: 'Q' },
]) {
    const enemy = enemies.find((candidate) => candidate.public.name === evidence.name);
    const stats = enemy?.fields.find((field) => field.id.endsWith('/stats'))?.value;
    const behavior = enemy?.fields.find((field) => field.id.endsWith('/attacks-behavior'))?.value;
    const classification = enemy?.fields.find((field) => field.id.endsWith('/classification'))?.value;
    const regions = Array.isArray(classification?.regions) ? classification.regions.map((region) => region?.id) : [];
    if (
        !enemy ||
        stats?.['maximum-life'] !== evidence.maximumLife ||
        !behavior?.['attack-patterns']?.includes(evidence.attack) ||
        !regions.includes(evidence.region)
    ) {
        failures.push(`${evidence.name}: canonical enemy evidence does not match the extracted game data`);
    }
}

if (failures.length > 0) {
    throw new Error(`Player information audit failed:\n${failures.map((failure) => `- ${failure}`).join('\n')}`);
}

console.warn(
    `Player information audit passed for ${Object.keys(requiredTypes).length} record types, ${requiredCollections.length} Knowledge collections, ${topicCoverage.length} guide topics, ${detailRecords.length} detail pages, and ${enemies.length} enemies.`
);
