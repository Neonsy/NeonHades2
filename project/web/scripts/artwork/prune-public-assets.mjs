import { readdirSync, readFileSync, rmdirSync, statSync, unlinkSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const apply = process.argv.includes('--apply');
const publicRoot = resolve('public');
const artRoot = resolve(publicRoot, 'art');
const registry = JSON.parse(readFileSync(resolve('scripts/artwork/accepted-artwork.json'), 'utf8'));
const allowed = new Set([
    '/art/scenes/build-workbench.svg',
    '/art/scenes/first-night-route.svg',
    '/art/scenes/home-crossroads.svg',
    '/art/scenes/the-crossroads-landscape.webp',
    '/art/symbols/materials.svg',
    '/art/symbols/record-icons.svg',
    '/art/symbols/records.svg',
    '/art/regions/chaos.webp',
    '/art/regions/city-of-ephyra-side-rooms.webp',
    '/art/regions/city-of-ephyra.webp',
    '/art/regions/erebus.webp',
    '/art/regions/fields-of-mourning.webp',
    '/art/regions/mount-olympus.webp',
    '/art/regions/oceanus.webp',
    '/art/regions/rift-of-thessaly.webp',
    '/art/regions/tartarus.webp',
    '/art/regions/the-crossroads.webp',
    '/art/regions/the-summit.webp',
]);

for (const delivery of Object.values(registry)) {
    for (const candidate of [delivery, ...Object.values(delivery.publicDeliveries ?? {})]) {
        if (candidate.source) allowed.add(candidate.source.split(/[?#]/u, 1)[0]);
    }
}

const directories = [];
const files = (directory) => {
    directories.push(directory);
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? files(path) : [path];
    });
};
const stale = files(artRoot).filter((path) => {
    if (!path.startsWith(`${artRoot}\\`)) throw new Error(`Refusing to inspect outside public art: ${path}`);
    const route = `/${relative(publicRoot, path).replaceAll('\\', '/')}`;
    return !allowed.has(route);
});
const bytes = stale.reduce((total, path) => total + statSync(path).size, 0);

if (apply) {
    for (const path of stale) unlinkSync(path);
    for (const directory of directories.sort((left, right) => right.length - left.length)) {
        if (directory !== artRoot && readdirSync(directory).length === 0) rmdirSync(directory);
    }
}

console.warn(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', stale: stale.length, bytes }));
if (!apply && stale.length > 0) process.exitCode = 1;
