import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { format, resolveConfig } from 'prettier';
import sharp from 'sharp';

const publicRoot = resolve('public');
const artRoot = resolve(publicRoot, 'art');
const outputRoot = resolve(publicRoot, 'art-responsive');
const manifestPath = resolve('src/content/responsive-art-metadata.json');
const widths = [256, 640, 1024];
const checkOnly = process.argv.includes('--check');

const isWithin = (root, path) => {
    const relativePath = relative(root, path);
    return (
        relativePath !== '' &&
        relativePath !== '..' &&
        !relativePath.startsWith(`..${sep}`) &&
        !isAbsolute(relativePath)
    );
};

if (!isWithin(publicRoot, artRoot) || !isWithin(publicRoot, outputRoot)) {
    throw new Error('Responsive artwork paths must stay inside public/.');
}

const files = (directory) =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? files(path) : [path];
    });
const sourceFiles = files(artRoot)
    .filter((path) => ['.png', '.webp'].includes(extname(path).toLowerCase()))
    .sort((left, right) => left.localeCompare(right));
const publicPathFor = (path) => `/${relative(publicRoot, path).replaceAll('\\', '/')}`;
const variantPathFor = (sourcePath, width) => {
    const relativePath = relative(artRoot, sourcePath).replace(/\.(?:png|webp)$/iu, '.webp');
    return resolve(outputRoot, String(width), relativePath);
};
const sourceHashFor = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');

const expected = {};
for (const sourcePath of sourceFiles) {
    const metadata = await sharp(sourcePath, { limitInputPixels: false }).metadata();
    if (!metadata.width || !metadata.height) throw new Error(`Raster asset has no intrinsic dimensions: ${sourcePath}`);
    const variantWidths = widths.filter((width) => width < metadata.width);
    if (variantWidths.length === 0) continue;
    expected[publicPathFor(sourcePath)] = {
        sourceHash: sourceHashFor(sourcePath),
        variants: variantWidths.map((width) => ({
            source: publicPathFor(variantPathFor(sourcePath, width)),
            width,
        })),
    };
}

if (checkOnly) {
    if (!existsSync(manifestPath)) throw new Error('Responsive artwork manifest is missing.');
    const actual = JSON.parse(readFileSync(manifestPath, 'utf8'));
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error('Responsive artwork is stale. Run pnpm generate:responsive-art.');
    }
    for (const entry of Object.values(expected)) {
        for (const variant of entry.variants) {
            const path = resolve(publicRoot, variant.source.slice(1));
            if (!isWithin(outputRoot, path) || !existsSync(path)) {
                throw new Error(`Responsive artwork is missing: ${variant.source}`);
            }
            const metadata = await sharp(path, { limitInputPixels: false }).metadata();
            if (metadata.width !== variant.width) {
                throw new Error(`Responsive artwork has the wrong width: ${variant.source}`);
            }
        }
    }
    console.warn(JSON.stringify({ responsiveArtworkAudit: 'passed', sources: Object.keys(expected).length }));
    process.exit(0);
}

rmSync(outputRoot, { recursive: true, force: true });
for (const [source, entry] of Object.entries(expected)) {
    const sourcePath = resolve(publicRoot, source.slice(1));
    for (const variant of entry.variants) {
        const outputPath = resolve(publicRoot, variant.source.slice(1));
        if (!isWithin(outputRoot, outputPath)) {
            throw new Error(`Refusing to write responsive artwork outside ${outputRoot}: ${variant.source}`);
        }
        mkdirSync(dirname(outputPath), { recursive: true });
        await sharp(sourcePath, { limitInputPixels: false })
            .resize({ width: variant.width, withoutEnlargement: true })
            .webp({ quality: 90, alphaQuality: 100, effort: 4, smartSubsample: true })
            .toFile(outputPath);
    }
}

const prettierConfig = (await resolveConfig(manifestPath)) ?? {};
writeFileSync(
    manifestPath,
    await format(JSON.stringify(expected), { ...prettierConfig, filepath: manifestPath }),
    'utf8'
);
console.warn(
    JSON.stringify({
        output: outputRoot,
        sources: Object.keys(expected).length,
        variants: Object.values(expected).reduce((total, entry) => total + entry.variants.length, 0),
    })
);
