import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { format, resolveConfig } from 'prettier';

const inventoryPath = resolve(process.argv[2] ?? '.local/reference/reconstruction/asset-inventory.json');
const registryPath = resolve(process.argv[3] ?? 'scripts/artwork/accepted-artwork.json');
const outputPath = resolve(process.argv[4] ?? 'src/content/artwork-production-manifest.json');
const mappingPath = resolve(process.argv[5] ?? '.local/reference/asset-index/website-subject-asset-map.tsv');
const codexDerivedPath = resolve(process.argv[6] ?? 'scripts/artwork/codex-derived-subjects.json');
const supplementalDerivedPath = resolve(process.argv[7] ?? 'scripts/artwork/supplemental-enemy-art.json');

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const inventory = readJson(inventoryPath);
const accepted = readJson(registryPath);
const codexDerived = readJson(codexDerivedPath);
const supplementalDerived = existsSync(supplementalDerivedPath) ? readJson(supplementalDerivedPath) : { subjects: [] };
const derivedSubjects = [...codexDerived.subjects, ...supplementalDerived.subjects];
const assets = {};
const records = {};

const parseTsv = (path) => {
    const [headerLine, ...lines] = readFileSync(path, 'utf8').trimEnd().split(/\r?\n/u);
    const headers = headerLine.split('\t');
    return lines.map((line) => Object.fromEntries(line.split('\t').map((value, index) => [headers[index], value])));
};

const canonicalAssetFor = (row) => `${row.package}:${row.game_asset.replaceAll('\\', '/')}`;
const codexRows = derivedSubjects.map((subject) => {
    const separator = subject.canonicalAsset.indexOf(':');
    return {
        record_key: subject.recordKey,
        record_type: subject.recordType,
        internal_id: subject.recordKey.split(':').at(-1),
        public_name: subject.publicName,
        presentation: 'detail',
        href: '',
        canonical_record_key: subject.recordKey,
        map_status: 'resolved',
        game_property: subject.sourceNote ?? 'Codex portrait',
        game_asset: subject.canonicalAsset.slice(separator + 1),
        package: subject.canonicalAsset.slice(0, separator),
        definition_file: subject.sourceFile ?? 'Content/Scripts/CodexData.lua',
    };
});
const mappingRows = [...parseTsv(mappingPath), ...codexRows].filter((row) => row.map_status === 'resolved');
const detailCanonicalByName = new Map();
for (const row of mappingRows.filter((candidate) => candidate.presentation === 'detail')) {
    const candidates = detailCanonicalByName.get(row.public_name) ?? new Set();
    candidates.add(canonicalAssetFor(row));
    detailCanonicalByName.set(row.public_name, candidates);
}

const normalizedRows = mappingRows.map((row) => {
    const directCanonicalAsset = canonicalAssetFor(row);
    const detailCandidates = detailCanonicalByName.get(row.public_name);
    const canonicalAsset =
        row.presentation !== 'detail' && !accepted[directCanonicalAsset] && detailCandidates?.size === 1
            ? [...detailCandidates][0]
            : directCanonicalAsset;
    return { ...row, canonicalAsset };
});

const normalizedRowsByCanonical = new Map();
for (const row of normalizedRows) {
    const rows = normalizedRowsByCanonical.get(row.canonicalAsset) ?? [];
    rows.push(row);
    normalizedRowsByCanonical.set(row.canonicalAsset, rows);
}

const allowedKinds = new Set(['character', 'material', 'record']);
const allowedTones = new Set(['ember', 'moon', 'night', 'thread', 'violet']);
const allowedMedia = new Set(['webp']);
const publicRoot = resolve('public');
const publicSourcePattern = /^\/art\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)+[a-z0-9]+(?:-[a-z0-9]+)*\.webp$/u;
const forbiddenPublicPath =
    /(?:^|\/)(?:subjects|theatre|lottie|reconstructed|codex)(?:\/|$)|(?:^|\/)(?:crafted|characters-out|materials-out|records-out|toolexorcismbook2?|toolpickaxe2?|toolshovel2?|toolfishingrod2?|weaponupgrade|stackupgrade|metacardpointscommondrop)(?:\.|\/|$)/u;

const validateDeliveryFiles = (canonicalAsset, delivery, label = 'delivery') => {
    if (!delivery.source.endsWith(`.${delivery.media}`)) {
        throw new Error(`${label} extension does not match media for ${canonicalAsset}: ${delivery.source}`);
    }
    if (!publicSourcePattern.test(delivery.source) || forbiddenPublicPath.test(delivery.source)) {
        throw new Error(`${label} exposes an invalid public path for ${canonicalAsset}: ${delivery.source}`);
    }
    const deliveryPath = resolve(publicRoot, delivery.source.replace(/^\//u, ''));
    if (!deliveryPath.startsWith(`${publicRoot}\\`)) {
        throw new Error(`${label} escapes public/ for ${canonicalAsset}: ${delivery.source}`);
    }
    const masterPath = resolve(delivery.master);
    if (!existsSync(deliveryPath)) throw new Error(`Missing ${label} file for ${canonicalAsset}: ${deliveryPath}`);
    if (!existsSync(masterPath))
        throw new Error(`Missing editable ${label} master for ${canonicalAsset}: ${masterPath}`);
};

for (const [canonicalAsset, delivery] of Object.entries(accepted)) {
    if (!allowedKinds.has(delivery.kind)) throw new Error(`Invalid kind for ${canonicalAsset}: ${delivery.kind}`);
    if (!allowedTones.has(delivery.tone)) throw new Error(`Invalid tone for ${canonicalAsset}: ${delivery.tone}`);
    if (!allowedMedia.has(delivery.media)) throw new Error(`Invalid media for ${canonicalAsset}: ${delivery.media}`);
    if (delivery.recordType && typeof delivery.recordType !== 'string') {
        throw new Error(`Invalid record type for ${canonicalAsset}: ${delivery.recordType}`);
    }
    if (
        delivery.recordTypes &&
        (!Array.isArray(delivery.recordTypes) || delivery.recordTypes.some((value) => typeof value !== 'string'))
    ) {
        throw new Error(`Invalid record types for ${canonicalAsset}`);
    }
    validateDeliveryFiles(canonicalAsset, delivery);
    if (delivery.publicDeliveries) {
        for (const [publicName, publicDelivery] of Object.entries(delivery.publicDeliveries)) {
            validateDeliveryFiles(
                canonicalAsset,
                { ...delivery, ...publicDelivery },
                `public delivery for ${publicName}`
            );
        }
    }
}

const codexRouteByCanonical = new Map(derivedSubjects.map((subject) => [subject.canonicalAsset, subject.route]));
const normalizedInventoryAssets = inventory.assets.map((asset) => ({
    ...asset,
    route: codexRouteByCanonical.get(asset.canonical_asset) ?? asset.route,
}));
const inventoryCanonicalAssets = new Set(normalizedInventoryAssets.map((asset) => asset.canonical_asset));
const syntheticCodexAssets = [...Map.groupBy(derivedSubjects, (subject) => subject.canonicalAsset)].flatMap(
    ([canonicalAsset, subjects]) =>
        inventoryCanonicalAssets.has(canonicalAsset)
            ? []
            : [
                  {
                      canonical_asset: canonicalAsset,
                      route: subjects[0].route,
                  },
              ]
);

for (const asset of [...normalizedInventoryAssets, ...syntheticCodexAssets].sort((left, right) =>
    left.canonical_asset.localeCompare(right.canonical_asset)
)) {
    const delivery = accepted[asset.canonical_asset];
    const normalizedAssetRows = normalizedRowsByCanonical.get(asset.canonical_asset) ?? [];
    const isWebsiteOwned = normalizedAssetRows.length > 0;
    const entry = {
        route: asset.route,
        status: delivery ? 'accepted' : isWebsiteOwned ? 'pending' : 'reference-only',
        publicNames: [...new Set(normalizedAssetRows.map((row) => row.public_name))].sort((left, right) =>
            left.localeCompare(right)
        ),
        recordKeys: [...new Set(normalizedAssetRows.map((row) => row.record_key))].sort((left, right) =>
            left.localeCompare(right)
        ),
        ...(delivery ? { delivery } : {}),
    };
    assets[asset.canonical_asset] = entry;

    const publicationRecordTypes = delivery
        ? new Set(delivery.recordTypes ?? [delivery.recordType].filter(Boolean))
        : new Set();
    const publicationOwnerRows =
        publicationRecordTypes.size > 0
            ? normalizedAssetRows.filter((row) => publicationRecordTypes.has(row.record_type))
            : normalizedAssetRows.filter((row) => row.presentation === 'detail');
    const publicationOwnerNames = new Set(publicationOwnerRows.map((row) => row.public_name));

    for (const row of normalizedAssetRows) {
        const recordKey = row.record_key;
        const prior = records[recordKey];
        if (prior && prior.canonicalAsset !== asset.canonical_asset) {
            throw new Error(`Record ${recordKey} maps to both ${prior.canonicalAsset} and ${asset.canonical_asset}`);
        }
        const publishCanonicalDelivery = delivery && publicationOwnerNames.has(row.public_name);
        const { publicDeliveries, ...baseDelivery } = delivery ?? {};
        const explicitPublicDelivery = publicDeliveries?.[row.public_name];
        if (publishCanonicalDelivery && publicDeliveries && !explicitPublicDelivery) {
            throw new Error(`Missing explicit public delivery for ${recordKey}: ${row.public_name}`);
        }
        const recordDelivery = explicitPublicDelivery ? { ...baseDelivery, ...explicitPublicDelivery } : baseDelivery;
        records[recordKey] = {
            canonicalAsset: asset.canonical_asset,
            route: asset.route,
            status: publishCanonicalDelivery ? 'accepted' : 'pending',
            publicName: row.public_name,
            ...(publishCanonicalDelivery ? { delivery: recordDelivery } : {}),
        };
    }
}

const missingAccepted = Object.keys(accepted).filter((canonicalAsset) => !assets[canonicalAsset]);
if (missingAccepted.length > 0) {
    throw new Error(`Accepted assets missing from inventory: ${missingAccepted.join(', ')}`);
}

const manifest = {
    schema: 1,
    canonicalAssetCount: Object.keys(assets).length,
    websiteOwnedCanonicalAssetCount: Object.values(assets).filter((asset) => asset.status !== 'reference-only').length,
    referenceOnlyCanonicalAssetCount: Object.values(assets).filter((asset) => asset.status === 'reference-only').length,
    publicRecordCount: Object.keys(records).length,
    acceptedCanonicalAssetCount: Object.keys(accepted).length,
    assets,
    records,
};

mkdirSync(dirname(outputPath), { recursive: true });
const prettierConfig = (await resolveConfig(outputPath)) ?? {};
writeFileSync(outputPath, await format(JSON.stringify(manifest), { ...prettierConfig, filepath: outputPath }), 'utf8');
console.warn(
    `Wrote ${manifest.canonicalAssetCount} canonical assets and ${manifest.publicRecordCount} public records to ${outputPath}`
);
