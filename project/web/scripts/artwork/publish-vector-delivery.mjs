import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import sharp from 'sharp';

export async function publishVectorDelivery(masterPath, outputPath) {
    mkdirSync(dirname(outputPath), { recursive: true });
    return sharp(masterPath, { density: 192, limitInputPixels: false })
        .resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: false })
        .webp({ quality: 90, alphaQuality: 100, effort: 4, smartSubsample: true })
        .toFile(outputPath);
}
