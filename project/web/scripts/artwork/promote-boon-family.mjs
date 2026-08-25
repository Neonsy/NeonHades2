import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { publicArtRoute } from './public-art-paths.mjs';
import { publishVectorDelivery } from './publish-vector-delivery.mjs';

const values = new Map();
for (let index = 2; index < process.argv.length; index += 2) values.set(process.argv[index], process.argv[index + 1]);

const mappingPath = resolve(values.get('--mapping'));
const registryPath = resolve(values.get('--registry'));
const publicDirectory = resolve(values.get('--public-directory'));
const masterDirectory = resolve(values.get('--master-directory'));
const family = values.get('--family');
const tone = values.get('--tone');

if (![mappingPath, registryPath, publicDirectory, masterDirectory, family, tone].every(Boolean)) {
    throw new Error('Required: --mapping --registry --public-directory --master-directory --family --tone');
}

const slugify = (value) =>
    value
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/gu, '')
        .toLocaleLowerCase()
        .replace(/['’]/gu, '')
        .replace(/[^a-z0-9]+/gu, '-')
        .replace(/^-+|-+$/gu, '');

const [headerLine, ...lines] = readFileSync(mappingPath, 'utf8').trimEnd().split(/\r?\n/u);
const headers = headerLine.split('\t');
const rows = lines
    .map((line) => Object.fromEntries(line.split('\t').map((value, index) => [headers[index], value])))
    .filter(
        (row) =>
            row.record_type === 'mechanics/boon' &&
            row.map_status === 'resolved' &&
            row.game_asset.startsWith(`GUI\\Screens\\BoonIcons\\${family}_`)
    );

const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
for (const row of rows) {
    const id = slugify(row.public_name);
    const publicAsset = resolve(publicDirectory, `${id}.webp`);
    const masterAsset = resolve(masterDirectory, `${id}.svg`);
    if (!existsSync(masterAsset)) {
        throw new Error(`Cannot promote ${row.public_name}: SVG master is missing`);
    }
    await publishVectorDelivery(masterAsset, publicAsset);
    registry[`${row.package}:${row.game_asset.replaceAll('\\', '/')}`] = {
        id,
        kind: 'record',
        tone,
        media: 'webp',
        source: publicArtRoute('mechanics/boon', id, 'webp'),
        master: `art-source/vector/reconstructed/${id}.svg`,
    };
}

const sorted = Object.fromEntries(Object.entries(registry).sort(([left], [right]) => left.localeCompare(right)));
writeFileSync(registryPath, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');
console.warn(`Promoted ${rows.length} ${family} boon assets`);
