import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { publicProgressionSearchTerms } from './progression';

export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type PublicationField = {
    id: string;
    publication?: string;
    spoilerLevel: SpoilerLevel;
    value: JsonValue;
};

export type PublicationRecord = {
    key: string;
    recordType: string;
    id: string;
    fields: PublicationField[];
    public: {
        name: string;
        slug: string;
        typeLabel: string;
        summary: string | null;
        href: string;
        aliases: string[];
        spoilerLevel: SpoilerLevel;
        category: string;
        presentation: 'collection' | 'detail' | 'guide' | 'embedded';
    } | null;
    publication:
        | {
              status: 'published';
              category: string;
              presentation: 'collection' | 'detail' | 'guide' | 'embedded';
          }
        | {
              status: 'excluded';
              reason: 'missing-public-name' | 'no-reader-facing-view' | 'unsupported-record-type';
          };
};

export type PublicationPage = {
    id: string;
    pageKind: 'progression' | 'reference' | 'tier-list';
    title: string;
    aliases: string[];
    spoilerLevel: SpoilerLevel;
    recordKeys: string[];
};

export type PublicationSearchEntry = {
    term: string;
    normalizedTerm: string;
    recordKey: string;
};

export type PublicationRelationship = {
    sourceKey: string;
    targetKey: string;
    fields: string[];
};

export type PublicationDataset = {
    schema: 'neodes2-publication-3' | 'neonhades2-publication-1';
    source: {
        datasetAcquisitionId?: string;
        datasetSha256?: string;
        dataReadyAcquisitionId?: string;
        editorialAcquisitionId?: string;
        steamBuildId: string;
        executableVersion: string;
        packageVersion: string;
    };
    records: PublicationRecord[];
    pages: PublicationPage[];
    search: PublicationSearchEntry[];
    relationships: {
        forward: PublicationRelationship[];
        reverse: PublicationRelationship[];
    };
    conditions: Array<{
        key: string;
        expression: JsonValue;
        dependentRecordKeys: string[];
        fields: string[];
    }>;
};

export type SpoilerLevel = 'none' | 'progression' | 'story' | 'ending';

export type SearchDocument = {
    key: string;
    name: string;
    type: string;
    typeLabel: string;
    href: string;
    terms: string[];
    spoilerLevel: SpoilerLevel;
};

const spoilerRank: Readonly<Record<SpoilerLevel, number>> = {
    none: 0,
    progression: 1,
    story: 2,
    ending: 3,
};

/**
 * Internal records can describe different versions of the same public item.
 * Search presents that public identity once while retaining every useful term.
 */
export function dedupeSearchDocuments(documents: readonly SearchDocument[]): SearchDocument[] {
    const merged = new Map<string, SearchDocument>();

    for (const document of documents) {
        const identity = [document.href, document.name, document.typeLabel]
            .map((value) => value.normalize('NFKC').toLocaleLowerCase())
            .join('\u0000');
        const existing = merged.get(identity);
        if (!existing) {
            merged.set(identity, { ...document, terms: [...new Set(document.terms)] });
            continue;
        }

        existing.terms = [...new Set([...existing.terms, ...document.terms])];
        if (spoilerRank[document.spoilerLevel] > spoilerRank[existing.spoilerLevel]) {
            existing.spoilerLevel = document.spoilerLevel;
        }
    }

    return [...merged.values()].sort((a, b) => a.name.localeCompare(b.name));
}

const PUBLICATION_ENV = 'NEONHADES2_PUBLICATION_PATH';
const COMMITTED_PUBLICATION = resolve(process.cwd(), 'src/content/publication.json');

let datasetCache: PublicationDataset | undefined;
let recordMapCache: Map<string, PublicationRecord> | undefined;

function parseJson<T>(path: string): T {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function resolvePublicationFile(): string {
    const configured = process.env[PUBLICATION_ENV];
    if (configured) {
        const target = resolve(configured);
        const candidate = statSync(target).isDirectory() ? join(target, 'publication.json') : target;
        if (!existsSync(candidate)) {
            throw new Error(`${PUBLICATION_ENV} does not contain publication.json: ${candidate}`);
        }
        return candidate;
    }

    if (!existsSync(COMMITTED_PUBLICATION)) {
        throw new Error(`Committed publication snapshot is missing: ${COMMITTED_PUBLICATION}`);
    }
    return COMMITTED_PUBLICATION;
}

export function getPublication(): PublicationDataset {
    if (datasetCache) return datasetCache;

    const publicationFile = resolvePublicationFile();
    const dataset = parseJson<PublicationDataset>(publicationFile);
    if (!['neodes2-publication-3', 'neonhades2-publication-1'].includes(dataset.schema)) {
        throw new Error(`Unsupported publication schema in ${publicationFile}`);
    }

    datasetCache = dataset;
    recordMapCache = new Map(dataset.records.map((record) => [record.key, record]));
    return dataset;
}

export function getRecordMap(): Map<string, PublicationRecord> {
    getPublication();
    return recordMapCache as Map<string, PublicationRecord>;
}

export function getRecord(key: string): PublicationRecord | undefined {
    return getRecordMap().get(key);
}

export function getField<T extends JsonValue = JsonValue>(record: PublicationRecord, fieldId: string): T | undefined {
    return record.fields.find((field) => field.id === fieldId)?.value as T | undefined;
}

export function getFieldBySuffix<T extends JsonValue = JsonValue>(
    record: PublicationRecord,
    suffix: string
): T | undefined {
    return record.fields.find((field) => field.id.endsWith(`/${suffix}`))?.value as T | undefined;
}

export function getRecordName(recordOrKey: PublicationRecord | string): string {
    const record = typeof recordOrKey === 'string' ? getRecord(recordOrKey) : recordOrKey;
    if (!record || record.public === null) {
        const recordKey = typeof recordOrKey === 'string' ? recordOrKey : recordOrKey.key;
        throw new Error(`Record has no explicit public identity: ${recordKey}`);
    }
    const repeated = record.public.name.match(/^([^ ]+) \1 \1$/u);
    return repeated ? `${repeated[1]}, ${repeated[1]}, ${repeated[1]}` : record.public.name;
}

const ASPECT_WEAPON_NAMES: Readonly<Record<string, string>> = {
    'moonstone-axe': 'Moonstone Axe',
    'witchs-staff': "Witch's Staff",
    'sister-blades': 'Sister Blades',
    'umbral-flames': 'Umbral Flames',
    'argent-skull': 'Argent Skull',
    'black-coat': 'Black Coat',
};

export function getRecordLinkLabel(record: PublicationRecord): string {
    const name = getRecordName(record);
    if (!record.public?.href.startsWith('/knowledge/builds/') || !record.public.href.includes('-aspect-of-')) {
        return name;
    }

    const routeSlug = record.public.href.slice('/knowledge/builds/'.length).replace(/\/$/u, '');
    const weaponSlug = routeSlug.split('-aspect-of-')[0];
    const weaponName = ASPECT_WEAPON_NAMES[weaponSlug];
    if (!weaponName) {
        throw new Error(`Aspect guide has no explicit public weapon label: ${record.key}`);
    }
    return `${name} · ${weaponName}`;
}

export function getRecordSpoilerLevel(record: PublicationRecord): SpoilerLevel {
    if (record.public === null) throw new Error(`Record has no explicit public model: ${record.key}`);
    return record.public.spoilerLevel;
}

export function getRecordAliases(record: PublicationRecord): string[] {
    if (record.public === null) throw new Error(`Record has no explicit public model: ${record.key}`);
    return record.public.aliases;
}

export function getContentRecords(): PublicationRecord[] {
    return getPublication().records.filter(
        (record) =>
            record.recordType !== 'foundation/record-metadata' &&
            record.recordType !== 'editorial/page-definition' &&
            isReaderFacingRecord(record)
    );
}

export function isReaderFacingRecord(record: PublicationRecord): boolean {
    return record.public !== null && record.publication.status === 'published';
}

export function getReferencePage(record: PublicationRecord): PublicationPage | undefined {
    const publication = getPublication();
    const routedCollection = record.public?.href.match(/^\/knowledge\/records\/([^/]+)\//u)?.[1];
    if (routedCollection) {
        const routedPage = publication.pages.find(
            (page) => page.pageKind === 'reference' && page.id === `reference/${routedCollection}`
        );
        if (routedPage) return routedPage;
    }

    const directPage = publication.pages.find(
        (page) => page.pageKind === 'reference' && page.recordKeys.includes(record.key)
    );
    if (directPage) return directPage;

    const supplementalCollections: Record<string, string> = {
        'mechanics/grasp-progression': 'reference/arcana',
        'mechanics/run-reward': 'reference/resources',
        'mechanics/status-element': 'reference/boons',
    };
    const pageId = supplementalCollections[record.recordType];
    return pageId ? publication.pages.find((page) => page.id === pageId) : undefined;
}

export function slugify(value: string): string {
    return value
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase()
        .replace(/['’]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

export function aspectGuideSlug(guide: PublicationRecord): string {
    if (guide.public === null || !guide.public.href.startsWith('/knowledge/builds/')) {
        throw new Error(`Aspect guide has no explicit public route: ${guide.key}`);
    }
    return guide.public.href.slice('/knowledge/builds/'.length).replace(/\/$/u, '');
}

export function recordRouteSlug(record: PublicationRecord): string {
    if (record.public === null || !record.public.href.startsWith('/knowledge/records/')) {
        throw new Error(`Record does not have a public detail route: ${record.key}`);
    }
    return record.public.href.slice('/knowledge/records/'.length).replace(/\/$/u, '');
}

export function recordHref(recordOrKey: PublicationRecord | string): string {
    const record = typeof recordOrKey === 'string' ? getRecord(recordOrKey) : recordOrKey;
    if (!record || record.public === null) {
        const recordKey = typeof recordOrKey === 'string' ? recordOrKey : recordOrKey.key;
        throw new Error(`Record has no explicit public route: ${recordKey}`);
    }
    return record.public.href;
}

export function pageHref(page: PublicationPage): string {
    const [, slug = page.id] = page.id.split('/');
    if (page.pageKind === 'progression') return '/guide/';
    if (page.pageKind === 'tier-list') return `/knowledge/tier-lists/${slug}/`;
    return `/knowledge/${slug}/`;
}

export function getRelationships(recordKey: string): {
    forward: PublicationRelationship[];
    reverse: PublicationRelationship[];
} {
    const { relationships } = getPublication();
    return {
        forward: relationships.forward.filter((relationship) => relationship.sourceKey === recordKey),
        reverse: relationships.reverse.filter((relationship) => relationship.sourceKey === recordKey),
    };
}

export function buildSearchDocuments(): SearchDocument[] {
    const publication = getPublication();
    const termsByRecord = new Map<string, Set<string>>();
    for (const entry of publication.search) {
        const terms = termsByRecord.get(entry.recordKey) ?? new Set<string>();
        terms.add(entry.term);
        terms.add(entry.normalizedTerm);
        termsByRecord.set(entry.recordKey, terms);
    }

    return dedupeSearchDocuments(
        getContentRecords().flatMap((record) => {
            const progressionTerms = publicProgressionSearchTerms(record.recordType, record.fields, (reference) => {
                const resource = getRecord(`${reference.recordType}:${reference.id}`);
                return resource && isReaderFacingRecord(resource) ? getRecordLinkLabel(resource) : undefined;
            });
            if (record.public?.presentation === 'embedded' && progressionTerms.length === 0) return [];
            return [
                {
                    key: record.key,
                    name: getRecordLinkLabel(record),
                    type: record.recordType,
                    typeLabel: recordTypeLabel(record.recordType),
                    href: recordHref(record),
                    terms: [
                        getRecordLinkLabel(record),
                        getRecordName(record),
                        ...getRecordAliases(record),
                        ...progressionTerms,
                        ...(termsByRecord.get(record.key) ?? []),
                    ],
                    spoilerLevel: getRecordSpoilerLevel(record),
                },
            ];
        })
    );
}

export function recordTypeLabel(recordType: string): string {
    const record = getPublication().records.find(
        (candidate) => candidate.recordType === recordType && candidate.public
    );
    if (!record?.public) throw new Error(`Record type has no explicit public label: ${recordType}`);
    return record.public.typeLabel;
}

export function publicationDirectory(): string {
    return dirname(resolvePublicationFile());
}
