import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const outputPath = resolve('src/content/publication.json');
const publicationRoots = [resolve('../data/.local/publication'), resolve('../data/.local/publication-review-final')];
const validatedRenderPublicationPath = resolve('../data/.local/render-validation/publication.json');
const requiredBuildSlots = new Set(['attack', 'special', 'cast', 'sprint', 'omega']);

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

function assertCompleteBuildSlots(publication, sourcePath) {
    const aspectGuides = publication.records.filter((record) => record.recordType === 'editorial/aspect-guide');
    if (aspectGuides.length !== 24) {
        throw new Error(
            `Publication source must contain 24 aspect guides, found ${aspectGuides.length}: ${sourcePath}`
        );
    }

    for (const guide of aspectGuides) {
        const variants = guide.fields.find((field) => field.id === 'editorial/aspect-guide/build-variants')?.value;
        const goals = variants && typeof variants === 'object' ? Object.keys(variants).sort() : [];
        if (goals.length !== 2 || goals[0] !== 'safest' || goals[1] !== 'strongest') {
            throw new Error(
                `Aspect guide ${guide.key} must contain exactly safest and strongest builds: ${sourcePath}`
            );
        }

        for (const goal of goals) {
            const variant = variants[goal];
            const priorities = Array.isArray(variant?.boonPriorities) ? variant.boonPriorities : [];
            const slots = priorities.map((priority) => priority?.slot);
            const uniqueSlots = new Set(slots);
            const missing = [...requiredBuildSlots].filter((slot) => !uniqueSlots.has(slot));
            const unexpected = slots.filter((slot) => !requiredBuildSlots.has(slot));
            const incomplete = priorities.some(
                (priority) =>
                    !Array.isArray(priority?.preferred) ||
                    priority.preferred.length === 0 ||
                    !Array.isArray(priority?.fallback) ||
                    priority.fallback.length === 0
            );

            if (
                variant?.goal !== goal ||
                slots.length !== requiredBuildSlots.size ||
                uniqueSlots.size !== requiredBuildSlots.size ||
                missing.length ||
                unexpected.length ||
                incomplete
            ) {
                throw new Error(
                    `Aspect guide ${guide.key} ${goal} build must contain one complete choice for each core Boon slot (${[...requiredBuildSlots].join(', ')}): ${sourcePath}`
                );
            }
        }

        const preferredCore = (goal) =>
            variants[goal].boonPriorities.map((priority) => priority.preferred[0]?.reference?.id).sort();
        if (JSON.stringify(preferredCore('safest')) === JSON.stringify(preferredCore('strongest'))) {
            throw new Error(
                `Aspect guide ${guide.key} safest and strongest builds must not use the same five first-choice Boons: ${sourcePath}`
            );
        }
    }
}

function isCompletedPublication(candidate) {
    return (
        existsSync(join(candidate, 'publication.json')) &&
        existsSync(join(candidate, 'publication-report.json')) &&
        existsSync(join(candidate, 'complete.json')) &&
        readJson(join(candidate, 'publication-report.json')).complete === true
    );
}

function resolvePublication() {
    const configured = process.env.NEONHADES2_PUBLICATION_PATH;
    if (configured) {
        const target = resolve(configured);
        const candidate = statSync(target).isDirectory() ? join(target, 'publication.json') : target;
        if (!existsSync(candidate)) throw new Error(`Publication file does not exist: ${candidate}`);
        return candidate;
    }

    const candidates = publicationRoots
        .filter(existsSync)
        .flatMap((root) => readdirSync(root).map((name) => join(root, name)))
        .filter((candidate) => statSync(candidate).isDirectory())
        .filter(isCompletedPublication)
        .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs);

    if (candidates.length > 0) return join(candidates[0], 'publication.json');

    if (existsSync(validatedRenderPublicationPath)) {
        const publication = readJson(validatedRenderPublicationPath);
        assertCompleteBuildSlots(publication, validatedRenderPublicationPath);
        return validatedRenderPublicationPath;
    }

    throw new Error(
        'No completed local data build or validated render publication is available. Set NEONHADES2_PUBLICATION_PATH or generate the website data under project/data/.local/publication.'
    );
}

function publicSnapshot(publication) {
    if (publication.schema !== 'neodes2-publication-3') {
        throw new Error(`Unsupported source publication schema: ${publication.schema}`);
    }

    assertCompleteBuildSlots(publication, publicationPath);

    const records = publication.records.filter(
        (record) => record.public !== null && record.publication?.status === 'published'
    );
    const recordKeys = new Set(records.map((record) => record.key));
    const relationships = (items) =>
        items.filter(
            (relationship) => recordKeys.has(relationship.sourceKey) && recordKeys.has(relationship.targetKey)
        );

    return {
        schema: 'neonhades2-publication-1',
        source: {
            steamBuildId: publication.source.steamBuildId,
            executableVersion: publication.source.executableVersion,
            packageVersion: publication.source.packageVersion,
        },
        records,
        pages: publication.pages.map((page) => ({
            ...page,
            recordKeys: page.recordKeys.filter((key) => recordKeys.has(key)),
        })),
        search: publication.search.filter((entry) => recordKeys.has(entry.recordKey)),
        relationships: {
            forward: relationships(publication.relationships.forward),
            reverse: relationships(publication.relationships.reverse),
        },
        conditions: publication.conditions
            .map((condition) => ({
                ...condition,
                dependentRecordKeys: condition.dependentRecordKeys.filter((key) => recordKeys.has(key)),
            }))
            .filter((condition) => condition.dependentRecordKeys.length > 0),
    };
}

const publicationPath = resolvePublication();
const snapshot = publicSnapshot(readJson(publicationPath));
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(snapshot)}\n`, 'utf8');
console.warn(
    JSON.stringify({
        output: outputPath,
        source: publicationPath,
        records: snapshot.records.length,
        pages: snapshot.pages.length,
        searchEntries: snapshot.search.length,
    })
);
