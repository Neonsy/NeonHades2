import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { publicArtRoute } from './public-art-paths.mjs';
import { publishVectorDelivery } from './publish-vector-delivery.mjs';

const values = new Map();
for (let index = 2; index < process.argv.length; index += 2) values.set(process.argv[index], process.argv[index + 1]);

const required = [
    '--mapping',
    '--registry',
    '--public-directory',
    '--master-directory',
    '--record-type',
    '--asset-prefix',
    '--kind',
    '--tone',
];
if (!required.every((key) => values.has(key))) throw new Error(`Required: ${required.join(' ')}`);

const mappingPath = resolve(values.get('--mapping'));
const registryPath = resolve(values.get('--registry'));
const publicDirectory = resolve(values.get('--public-directory'));
const masterDirectory = resolve(values.get('--master-directory'));
const recordType = values.get('--record-type');
const assetPrefix = values.get('--asset-prefix');
const kind = values.get('--kind');
const tone = values.get('--tone');
const slugField = values.get('--slug-field') ?? 'public-name';
if (!['public-name', 'href-tail', 'record-id'].includes(slugField)) {
    throw new Error(`Invalid --slug-field: ${slugField}`);
}

const slugify = (value) =>
    value
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/gu, '')
        .toLocaleLowerCase()
        .replace(/['’]/gu, '')
        .replace(/[^a-z0-9]+/gu, '-')
        .replace(/^-+|-+$/gu, '');

const deliverySlug = (row) => {
    if (slugField === 'record-id') return slugify(row.record_key.split(':').at(-1));
    if (slugField === 'href-tail') {
        const path = row.href.split('#', 1)[0].replace(/\/+$/gu, '');
        return slugify(path.split('/').at(-1));
    }
    return slugify(row.public_name);
};

const [headerLine, ...lines] = readFileSync(mappingPath, 'utf8').trimEnd().split(/\r?\n/u);
const headers = headerLine.split('\t');
const allRows = lines.map((line) =>
    Object.fromEntries(line.split('\t').map((value, index) => [headers[index], value]))
);
const rows = allRows.filter(
    (row) => row.record_type === recordType && row.map_status === 'resolved' && row.game_asset.startsWith(assetPrefix)
);

const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
const rowsByCanonicalAsset = new Map();
for (const row of rows) {
    const canonicalAsset = `${row.package}:${row.game_asset.replaceAll('\\', '/')}`;
    const groupedRows = rowsByCanonicalAsset.get(canonicalAsset) ?? [];
    groupedRows.push(row);
    rowsByCanonicalAsset.set(canonicalAsset, groupedRows);
}
for (const [canonicalAsset, groupedRows] of rowsByCanonicalAsset) {
    const existing = registry[canonicalAsset];
    const existingRecordTypes = existing
        ? [...new Set(existing.recordTypes ?? [existing.recordType].filter(Boolean))]
        : [];
    const uniqueRowsByName = new Map(groupedRows.map((row) => [row.public_name, row]));
    const publicDeliveries = { ...(existing?.publicDeliveries ?? {}) };
    if (existing && !existing.publicDeliveries) {
        for (const row of allRows.filter(
            (candidate) =>
                candidate.map_status === 'resolved' &&
                candidate.package &&
                candidate.game_asset &&
                `${candidate.package}:${candidate.game_asset.replaceAll('\\', '/')}` === canonicalAsset &&
                existingRecordTypes.includes(candidate.record_type)
        )) {
            publicDeliveries[row.public_name] = {
                id: existing.id,
                source: existing.source,
                master: existing.master,
            };
        }
    }
    for (const row of [...uniqueRowsByName.values()].sort((left, right) =>
        left.public_name.localeCompare(right.public_name)
    )) {
        const id = deliverySlug(row);
        const masterAsset = resolve(masterDirectory, `${id}.svg`);
        const publicAsset = resolve(publicDirectory, `${id}.webp`);
        if (!existsSync(masterAsset)) {
            throw new Error(`Cannot promote ${row.public_name}: SVG master is missing`);
        }
        await publishVectorDelivery(masterAsset, publicAsset);
        publicDeliveries[row.public_name] = {
            id,
            source: publicArtRoute(recordType, id, 'webp'),
            master: `art-source/vector/reconstructed/${id}.svg`,
        };
    }
    const primary = existing ?? publicDeliveries[Object.keys(publicDeliveries)[0]];
    const recordTypes = [...new Set([...existingRecordTypes, recordType])];
    registry[canonicalAsset] = {
        ...primary,
        kind: existing?.kind ?? kind,
        tone: existing?.tone ?? tone,
        recordType: existing?.recordType ?? recordType,
        ...(recordTypes.length > 1 ? { recordTypes } : {}),
        media: 'webp',
        ...(Object.keys(publicDeliveries).length > 1 ? { publicDeliveries } : {}),
    };
}
const sorted = Object.fromEntries(Object.entries(registry).sort(([left], [right]) => left.localeCompare(right)));
writeFileSync(registryPath, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');
console.warn(
    `Promoted ${rows.length} public records across ${rowsByCanonicalAsset.size} canonical assets for ${recordType} / ${assetPrefix}`
);
