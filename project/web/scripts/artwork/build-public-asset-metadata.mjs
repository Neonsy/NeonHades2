import { mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { format, resolveConfig } from 'prettier';
import sharp from 'sharp';

const publicRoot = resolve('public');
const responsiveArtRoot = resolve(publicRoot, 'art-responsive');
const trackedOutputPath = resolve('src/content/public-asset-metadata.json');
const outputPath = resolve(process.argv[2] ?? trackedOutputPath);

const files = (directory) =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? files(path) : [path];
    });
const isWithin = (root, path) => {
    const relativePath = relative(root, path);
    return (
        relativePath !== '' &&
        relativePath !== '..' &&
        !relativePath.startsWith(`..${sep}`) &&
        !isAbsolute(relativePath)
    );
};

const rasterFiles = files(publicRoot)
    .filter((path) => !isWithin(responsiveArtRoot, path) && ['.png', '.webp'].includes(extname(path).toLowerCase()))
    .sort((left, right) => left.localeCompare(right));
const assets = {};

const visibleAlphaBounds = async (path, width, height) => {
    const { data, info } = await sharp(path, { limitInputPixels: false })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    let left = width;
    let top = height;
    let right = -1;
    let bottom = -1;

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const alpha = data[(y * width + x) * info.channels + 3];
            if (alpha <= 12) continue;
            left = Math.min(left, x);
            top = Math.min(top, y);
            right = Math.max(right, x);
            bottom = Math.max(bottom, y);
        }
    }

    return right < left
        ? { x: 0, y: 0, width, height }
        : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
};

for (const path of rasterFiles) {
    const metadata = await sharp(path, { limitInputPixels: false }).metadata();
    if (!metadata.width || !metadata.height) throw new Error(`Raster asset has no intrinsic dimensions: ${path}`);
    const publicPath = `/${relative(publicRoot, path).replaceAll('\\', '/')}`;
    if (publicPath.startsWith('/art/') && Math.max(metadata.width, metadata.height) > 1600) {
        throw new Error(`Public artwork exceeds the 1600px delivery limit: ${publicPath}`);
    }
    if (publicPath.startsWith('/art/') && statSync(path).size > 1024 * 1024) {
        throw new Error(`Public artwork exceeds the 1 MiB delivery limit: ${publicPath}`);
    }
    assets[publicPath] = {
        width: metadata.width,
        height: metadata.height,
        ...(publicPath.startsWith('/art/characters/')
            ? { visibleAlpha: await visibleAlphaBounds(path, metadata.width, metadata.height) }
            : {}),
    };
}

mkdirSync(dirname(outputPath), { recursive: true });
const prettierConfig = (await resolveConfig(trackedOutputPath)) ?? {};
writeFileSync(
    outputPath,
    await format(JSON.stringify(assets), { ...prettierConfig, filepath: trackedOutputPath }),
    'utf8'
);
console.warn(JSON.stringify({ output: outputPath, rasterAssets: Object.keys(assets).length }));
