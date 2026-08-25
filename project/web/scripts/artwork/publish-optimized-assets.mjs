import { readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { publishVectorDelivery } from './publish-vector-delivery.mjs';

const registryPath = resolve(process.argv[2] ?? 'scripts/artwork/accepted-artwork.json');
const publicRoot = resolve('public');
const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
const jobs = new Map();

const register = (delivery, owner) => {
    if (delivery.media !== 'webp' || extname(delivery.master).toLowerCase() !== '.svg') return;
    if (!delivery.source.startsWith('/art/') || !delivery.source.endsWith('.webp')) {
        throw new Error(`Optimized delivery has an invalid public path for ${owner}: ${delivery.source}`);
    }
    const prior = jobs.get(delivery.source);
    if (prior && prior.master !== delivery.master) {
        throw new Error(`Public delivery ${delivery.source} maps to more than one master`);
    }
    jobs.set(delivery.source, { master: delivery.master, owner });
};

for (const [canonicalAsset, delivery] of Object.entries(registry)) {
    register(delivery, canonicalAsset);
    for (const [publicName, publicDelivery] of Object.entries(delivery.publicDeliveries ?? {})) {
        register({ ...delivery, ...publicDelivery }, `${canonicalAsset} (${publicName})`);
    }
}

const queue = [...jobs.entries()];
let index = 0;
let writtenBytes = 0;

const publish = async () => {
    while (index < queue.length) {
        const [source, job] = queue[index++];
        const masterPath = resolve(job.master);
        const outputPath = resolve(publicRoot, source.slice(1));
        if (!outputPath.startsWith(`${publicRoot}\\`) && outputPath !== publicRoot) {
            throw new Error(`Refusing to publish outside public/: ${source}`);
        }
        const info = await publishVectorDelivery(masterPath, outputPath);
        writtenBytes += info.size;
    }
};

await Promise.all(Array.from({ length: Math.min(8, queue.length) }, publish));
console.warn(
    JSON.stringify({
        registry: registryPath,
        published: queue.length,
        format: 'webp',
        maximumDimension: 512,
        quality: 90,
        bytes: writtenBytes,
    })
);
