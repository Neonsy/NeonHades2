import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const values = new Map();
for (let index = 2; index < process.argv.length; index += 2) values.set(process.argv[index], process.argv[index + 1]);

const mappingPath = resolve(values.get('--mapping'));
const referenceRoot = resolve(values.get('--reference-root'));
const preparedDirectory = values.has('--prepared-directory') ? resolve(values.get('--prepared-directory')) : null;
const recordType = values.get('--record-type');
const assetPrefix = values.get('--asset-prefix');
const outputDirectory = resolve(values.get('--output-directory'));
const vtracer = resolve(values.get('--vtracer'));
const slugField = values.get('--slug-field') ?? 'public-name';
if (!['public-name', 'record-id'].includes(slugField)) throw new Error(`Invalid --slug-field: ${slugField}`);

if (![mappingPath, referenceRoot, recordType, assetPrefix, outputDirectory, vtracer].every(Boolean)) {
    throw new Error('Required: --mapping --reference-root --record-type --asset-prefix --output-directory --vtracer');
}

const slugify = (value) =>
    value
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/gu, '')
        .toLocaleLowerCase()
        .replace(/['’]/gu, '')
        .replace(/[^a-z0-9]+/gu, '-')
        .replace(/^-+|-+$/gu, '');

const sourceSlug = (row) =>
    slugField === 'record-id' ? slugify(row.record_key.split(':').at(-1)) : slugify(row.public_name);

const parseTsv = (path) => {
    const [headerLine, ...lines] = readFileSync(path, 'utf8').trimEnd().split(/\r?\n/u);
    const headers = headerLine.split('\t');
    return lines.map((line) => Object.fromEntries(line.split('\t').map((value, index) => [headers[index], value])));
};

const rows = parseTsv(mappingPath)
    .filter(
        (row) =>
            row.record_type === recordType && row.map_status === 'resolved' && row.game_asset.startsWith(assetPrefix)
    )
    .sort((left, right) => left.game_asset.localeCompare(right.game_asset));

mkdirSync(outputDirectory, { recursive: true });
let traced = 0;
let skipped = 0;

for (const row of rows) {
    const source = preparedDirectory
        ? resolve(preparedDirectory, `${sourceSlug(row)}.png`)
        : resolve(referenceRoot, row.package, 'textures', `${row.game_asset.replaceAll('\\', '/')}.png`);
    const output = resolve(outputDirectory, `${sourceSlug(row)}-baseline.svg`);
    if (!existsSync(source)) throw new Error(`Missing source: ${source}`);
    if (existsSync(output) && values.get('--overwrite') !== 'true') {
        skipped += 1;
        continue;
    }
    mkdirSync(dirname(output), { recursive: true });
    const result = spawnSync(
        vtracer,
        [
            source,
            output,
            '--preset',
            'poster',
            '--hierarchical',
            'stacked',
            '--mode',
            'spline',
            '--filter-speckle',
            '8',
            '--color-precision',
            '6',
            '--gradient-step',
            '10',
            '--simplify',
            '1.6',
            '--path-precision',
            '2',
            '--max-colors',
            '24',
            '--optimize',
            '1',
        ],
        { encoding: 'utf8' }
    );
    if (result.status !== 0) throw new Error(`VTracer failed for ${row.public_name}: ${result.stderr}`);
    traced += 1;
}

console.warn(JSON.stringify({ familyAssets: rows.length, traced, skipped }));
