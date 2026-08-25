import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import sharp from 'sharp';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
    args.set(process.argv[index], process.argv[index + 1]);
}

const registryPath = resolve(args.get('--registry') ?? 'scripts/artwork/accepted-artwork.json');
const publicRoot = resolve(args.get('--public-root') ?? 'public');
const outputDirectory = resolve(args.get('--output-directory') ?? '.local/reference/quality-audit/renders');
const manifestPath = resolve(args.get('--manifest') ?? '.local/reference/quality-audit/render-manifest.json');
const size = Number.parseInt(args.get('--size') ?? '256', 10);
const sourcePrefix = args.get('--source-prefix') ?? '/art/';
const sourceList = args.has('--source-list')
    ? new Set(JSON.parse(readFileSync(resolve(args.get('--source-list')), 'utf8')))
    : null;

if (!Number.isInteger(size) || size < 32 || size > 2048) {
    throw new Error(`Invalid --size: ${size}`);
}

const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
const deliveries = new Map();

const addDelivery = (canonicalAsset, publicName, delivery) => {
    if (delivery.media !== 'svg' || !delivery.source.startsWith(sourcePrefix)) return;
    if (sourceList && !sourceList.has(delivery.source)) return;
    const existing = deliveries.get(delivery.source) ?? {
        source: delivery.source,
        canonicalAssets: new Set(),
        publicNames: new Set(),
    };
    existing.canonicalAssets.add(canonicalAsset);
    if (publicName) existing.publicNames.add(publicName);
    deliveries.set(delivery.source, existing);
};

for (const [canonicalAsset, baseDelivery] of Object.entries(registry)) {
    addDelivery(canonicalAsset, null, baseDelivery);
    for (const [publicName, override] of Object.entries(baseDelivery.publicDeliveries ?? {})) {
        addDelivery(canonicalAsset, publicName, { ...baseDelivery, ...override });
    }
}

mkdirSync(outputDirectory, { recursive: true });
const rendered = [];

for (const delivery of [...deliveries.values()].sort((left, right) => left.source.localeCompare(right.source))) {
    const input = resolve(publicRoot, delivery.source.replace(/^\//u, ''));
    const outputName = delivery.source
        .replace(/^\/art\//u, '')
        .replaceAll('/', '__')
        .replace(/\.svg$/u, '.png');
    const output = resolve(outputDirectory, outputName);
    await sharp(input, { density: 288 })
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png({ compressionLevel: 9 })
        .toFile(output);
    rendered.push({
        source: delivery.source,
        input,
        output,
        canonicalAssets: [...delivery.canonicalAssets].sort(),
        publicNames: [...delivery.publicNames].sort(),
    });
}

mkdirSync(dirname(manifestPath), { recursive: true });
writeFileSync(manifestPath, `${JSON.stringify({ schema: 1, size, rendered }, null, 2)}\n`, 'utf8');
console.warn(JSON.stringify({ rendered: rendered.length, size, outputDirectory, manifestPath }));
