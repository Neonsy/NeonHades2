import { access, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const markPath = fileURLToPath(new URL('../public/neonhades2-mark.svg', import.meta.url));
const socialImagePath = fileURLToPath(new URL('../public/og/social-preview.webp', import.meta.url));
const publicRoot = fileURLToPath(new URL('../public/', import.meta.url));
const arguments_ = process.argv.slice(2);
if (arguments_.length !== 0 && (arguments_.length !== 2 || arguments_[0] !== '--output-directory')) {
    throw new Error('Usage: node scripts/generate-seo-images.mjs [--output-directory <path>]');
}
const outputDirectory = resolve(arguments_[1] ?? publicRoot);

await access(socialImagePath);
const socialImage = await sharp(socialImagePath).metadata();
if (socialImage.format !== 'webp' || socialImage.width !== 1200 || socialImage.height !== 630) {
    throw new Error('The Open Graph image must be a 1200 by 630 WebP file.');
}
await mkdir(outputDirectory, { recursive: true });

await Promise.all([
    sharp(markPath)
        .resize(180, 180, { fit: 'contain' })
        .png({ compressionLevel: 9 })
        .toFile(resolve(outputDirectory, 'apple-touch-icon.png')),
    sharp(markPath)
        .resize(192, 192, { fit: 'contain' })
        .png({ compressionLevel: 9 })
        .toFile(resolve(outputDirectory, 'icon-192.png')),
    sharp(markPath)
        .resize(512, 512, { fit: 'contain' })
        .png({ compressionLevel: 9 })
        .toFile(resolve(outputDirectory, 'icon-512.png')),
]);

console.warn('Verified the NeonHades2 Open Graph image and generated platform icons.');
