import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
    args.set(process.argv[index], process.argv[index + 1]);
}

const registryPath = resolve(args.get('--registry') ?? 'scripts/artwork/accepted-artwork.json');
const candidateRoot = resolve(args.get('--candidate-root'));
const sourceListPath = resolve(args.get('--source-list'));
const projectRoot = resolve(args.get('--project-root') ?? '.');

if (!args.has('--candidate-root') || !args.has('--source-list')) {
    throw new Error('Both --candidate-root and --source-list are required.');
}

const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
const sourceList = JSON.parse(readFileSync(sourceListPath, 'utf8'));
const deliveries = new Map();

const indexDelivery = (delivery) => {
    const existing = deliveries.get(delivery.source) ?? new Set();
    existing.add(delivery.master);
    deliveries.set(delivery.source, existing);
};

for (const base of Object.values(registry)) {
    indexDelivery(base);
    for (const override of Object.values(base.publicDeliveries ?? {})) {
        indexDelivery({ ...base, ...override });
    }
}

const promoted = [];
for (const source of sourceList) {
    const masters = deliveries.get(source);
    if (!masters?.size) {
        throw new Error(`No registered delivery for ${source}`);
    }

    const relativePublicPath = source.replace(/^\//u, '');
    const candidate = resolve(candidateRoot, relativePublicPath);
    if (!existsSync(candidate)) {
        throw new Error(`Missing candidate ${candidate}`);
    }

    const destinations = new Set([
        resolve(projectRoot, 'public', relativePublicPath),
        ...[...masters].map((master) => resolve(projectRoot, master)),
    ]);
    for (const destination of destinations) {
        mkdirSync(dirname(destination), { recursive: true });
        copyFileSync(candidate, destination);
    }
    promoted.push({ source, destinations: [...destinations] });
}

console.warn(JSON.stringify({ promoted: promoted.length, assets: promoted }, null, 2));
