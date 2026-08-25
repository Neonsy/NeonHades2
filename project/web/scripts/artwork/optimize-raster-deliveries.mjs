import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

const registryPath = resolve(process.argv[2] ?? 'scripts/artwork/accepted-artwork.json');
const publicRoot = resolve('public');
const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
const sources = new Set();

for (const delivery of Object.values(registry)) {
    for (const candidate of [delivery, ...Object.values(delivery.publicDeliveries ?? {})]) {
        const source = candidate.source;
        if (source?.startsWith('/art/characters/') && source.endsWith('.webp')) {
            sources.add(source);
        }
    }
}

let optimized = 0;
let bytesBefore = 0;
let bytesAfter = 0;
for (const source of [...sources].sort()) {
    const inputPath = resolve(publicRoot, source.slice(1));
    if (!inputPath.startsWith(`${publicRoot}\\`)) throw new Error(`Refusing to optimize outside public/: ${source}`);
    const metadata = await sharp(inputPath).metadata();
    if (Math.max(metadata.width ?? 0, metadata.height ?? 0) <= 1600) continue;

    const temporaryPath = `${inputPath}.optimized.webp`;
    const before = statSync(inputPath).size;
    await sharp(inputPath, { limitInputPixels: false })
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 90, alphaQuality: 100, effort: 4, smartSubsample: true })
        .toFile(temporaryPath);
    const result = await sharp(temporaryPath).metadata();
    if (Math.max(result.width ?? 0, result.height ?? 0) > 1600) {
        throw new Error(`Optimized delivery still exceeds 1600px: ${source}`);
    }
    optimized += 1;
    bytesBefore += before;
    bytesAfter += statSync(temporaryPath).size;
}

console.warn(JSON.stringify({ optimized, maximumDimension: 1600, bytesBefore, bytesAfter }));
