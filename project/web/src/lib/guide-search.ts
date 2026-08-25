import { guideChapters } from '../content/guide';
import { crossroadsKnowledge } from '../content/crossroads';
import {
    aspectGuideSlug,
    buildSearchDocuments,
    dedupeSearchDocuments,
    getPublication,
    getRecord,
    recordHref,
} from './publication';
import { getCollectionSubjectArt, getRecordSubjectArt } from './subject-art';
import { recordSummary } from './presentation';

const publication = getPublication();
const crossroadsRecord = getRecord('world-progression/region:Home');
if (!crossroadsRecord?.public) throw new Error('Crossroads knowledge entry is missing from the publication.');
const recordSearchDocuments = buildSearchDocuments();
const aspectSearchDocuments = publication.records
    .filter((record) => record.recordType === 'editorial/aspect-guide' && record.public)
    .flatMap((guide) => {
        if (!guide.public) return [];
        return [
            {
                key: guide.key,
                name: guide.public.name,
                type: guide.recordType,
                typeLabel: 'Aspect build',
                href: `/knowledge/builds/${aspectGuideSlug(guide)}/`,
                terms: [guide.public.name, ...guide.public.aliases, 'build', 'aspect build'],
                spoilerLevel: guide.public.spoilerLevel,
            },
        ];
    });
const boonRequirementSearchDocuments = [
    {
        key: 'guide/boon-requirements:legendary',
        name: 'How Legendary Boons work',
        type: 'guide/boon-requirements',
        typeLabel: 'Boon requirements',
        href: '/knowledge/boons/#legendary-boon-requirements',
        terms: [
            'legendary boon requirements',
            'legendary boon prerequisites',
            'how to get legendary boons',
            'how legendary boons trigger',
            'unlock legendary boons',
        ],
        spoilerLevel: 'none' as const,
    },
    {
        key: 'guide/boon-requirements:duo',
        name: 'How Duo Boons work',
        type: 'guide/boon-requirements',
        typeLabel: 'Boon requirements',
        href: '/knowledge/boons/#duo-boon-requirements',
        terms: [
            'duo boon requirements',
            'duo boon prerequisites',
            'how to get duo boons',
            'how duo boons trigger',
            'unlock duo boons',
        ],
        spoilerLevel: 'none' as const,
    },
];
const guideSearchDocuments = guideChapters.map((chapter) => ({
    key: `guide/chapter:${chapter.id}`,
    name: chapter.title,
    type: 'guide/chapter',
    typeLabel: 'Walkthrough chapter',
    href: `/guide/${chapter.id}/`,
    terms: [
        chapter.entry,
        chapter.objective,
        chapter.overviewObjective ?? '',
        chapter.why,
        chapter.fallback,
        ...chapter.learn,
        ...(chapter.terms ?? []).flatMap(({ term, meaning }) => [term, meaning]),
        ...chapter.steps.flatMap(({ title, body }) => [title, body]),
        ...(chapter.choices ?? []).flatMap(({ situation, choice, reason }) => [situation, choice, reason]),
        ...(chapter.overlap ?? []).flatMap(({ title, body }) => [title, body]),
        ...(chapter.loadout?.items ?? []).flatMap(({ label, value, reason }) => [label, value, reason]),
    ],
    spoilerLevel: chapter.spoilerLevel,
}));
const crossroadsSearchDocument = {
    key: 'guide/crossroads:return-checklist',
    name: 'What to do on the first and later Crossroads returns',
    type: 'guide/crossroads',
    typeLabel: 'Between-night guide',
    href: recordHref(crossroadsRecord),
    terms: [
        ...crossroadsKnowledge.searchTerms,
        ...crossroadsKnowledge.firstReturnChecklist.flatMap((task) => [task.title, task.body]),
        ...crossroadsKnowledge.laterReturnChecklist.flatMap((task) => [task.title, task.body]),
        ...crossroadsKnowledge.services.flatMap((service) => [service.title, service.when, service.body]),
    ],
    spoilerLevel: 'progression' as const,
};
const searchDocuments = dedupeSearchDocuments([
    ...recordSearchDocuments,
    ...aspectSearchDocuments,
    ...boonRequirementSearchDocuments,
    ...guideSearchDocuments,
    crossroadsSearchDocument,
]);
export const searchableRecordKeys = new Set(recordSearchDocuments.map((document) => document.key));
const artByKey = new Map(
    publication.records.flatMap((record) =>
        record.public ? ([[record.key, getRecordSubjectArt(record)]] as const) : []
    )
);
for (const guide of publication.records.filter((record) => record.recordType === 'editorial/aspect-guide')) {
    const aspect = publication.records.find(
        (record) => record.recordType === 'mechanics/weapon-aspect' && record.id === guide.id
    );
    if (aspect) artByKey.set(guide.key, getRecordSubjectArt(aspect));
}
const boonGuideArt = getCollectionSubjectArt('boons');
artByKey.set('guide/boon-requirements:legendary', boonGuideArt);
artByKey.set('guide/boon-requirements:duo', boonGuideArt);
const walkthroughGuideArt = getCollectionSubjectArt('story');
for (const chapter of guideChapters) artByKey.set(`guide/chapter:${chapter.id}`, walkthroughGuideArt);
artByKey.set(crossroadsSearchDocument.key, getRecordSubjectArt(crossroadsRecord));
const searchContext = new Map(publication.records.map((record) => [record.key, recordSummary(record)]));
for (const chapter of guideChapters) searchContext.set(`guide/chapter:${chapter.id}`, chapter.objective);
export const serializedSearch = JSON.stringify(
    searchDocuments.map(({ key, name, typeLabel, href, terms, spoilerLevel }) => ({
        name,
        context: searchContext.get(key) ?? '',
        typeLabel,
        href,
        terms,
        spoilerLevel,
        art: artByKey.get(key) ?? null,
    }))
).replaceAll('<', '\\u003c');
