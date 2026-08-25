import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format, resolveConfig } from 'prettier';

const mapPath = resolve(process.argv[2] ?? 'scripts/artwork/codex-derived-subjects.json');
const registryPath = resolve(process.argv[3] ?? 'scripts/artwork/accepted-artwork.json');
const sourceMap = JSON.parse(readFileSync(mapPath, 'utf8'));
const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
const grouped = Map.groupBy(sourceMap.subjects, (subject) => subject.canonicalAsset);

for (const [canonicalAsset, subjects] of grouped) {
    const [first] = subjects;
    const deliveryFor = (subject) => ({
        id: subject.id,
        kind: subject.kind,
        tone: subject.tone,
        recordType: subject.recordType,
        media: subject.delivery.media,
        source: subject.delivery.source,
        master: subject.delivery.master,
    });
    const firstDelivery = deliveryFor(first);
    const entry =
        subjects.length > 1
            ? {
                  ...Object.fromEntries(Object.entries(firstDelivery).filter(([key]) => key !== 'recordType')),
                  recordTypes: [...new Set(subjects.map((subject) => subject.recordType))],
                  publicDeliveries: Object.fromEntries(
                      subjects.map((subject) => [subject.publicName, deliveryFor(subject)])
                  ),
              }
            : firstDelivery;
    registry[canonicalAsset] = entry;
}

const prettierConfig = (await resolveConfig(registryPath)) ?? {};
writeFileSync(
    registryPath,
    await format(JSON.stringify(registry), { ...prettierConfig, filepath: registryPath }),
    'utf8'
);
console.warn(`Registered ${sourceMap.subjects.length} Codex-derived subjects from ${grouped.size} source assets.`);
