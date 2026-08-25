import { getRecord, getRecordName, isReaderFacingRecord, type PublicationRecord } from '../publication';
import { getRecordSubjectArt } from '../subject-art';

const storyDestinations = [
    {
        href: '/guide/true-ending/',
        title: 'Reach the main ending',
        detail: 'Follow the fixed route and conversation chain that leads to the credits.',
        icon: 'ph-crown',
    },
    {
        href: '/guide/rescue-the-fates/',
        title: 'Complete the epilogue',
        detail: 'Continue from the credits through the final Fates objective.',
        icon: 'ph-star-four',
    },
    {
        href: '/knowledge/relationships/',
        title: 'Advance a character bond',
        detail: 'Find gift locks, required events, and the next relationship step.',
        icon: 'ph-heart',
    },
    {
        href: '/knowledge/prophecies/',
        title: 'Clear a Fated List blocker',
        detail: 'Check how the prophecy appears, what completes it, and which night can carry it.',
        icon: 'ph-list-checks',
    },
    {
        href: '/knowledge/regions/',
        title: 'Find a route encounter',
        detail: 'Locate characters, story rooms, route conditions, and region-specific events.',
        icon: 'ph-path',
    },
] as const;

export function buildStoryCollectionModel(
    slug: string,
    collectionHref: string,
    sortedRecords: PublicationRecord[],
    publicationRecords: PublicationRecord[]
) {
    if (slug !== 'story') return { storyCodexRecords: [], storyDestinations };

    const detailPriority: Readonly<Record<string, number>> = {
        'world-progression/relationship': 0,
        'world-progression/encounter-friend': 1,
        'mechanics/god': 2,
    };
    const detailByName = new Map(
        publicationRecords
            .filter(
                (record) =>
                    isReaderFacingRecord(record) &&
                    record.public?.presentation === 'detail' &&
                    record.public.href !== collectionHref
            )
            .sort(
                (a, b) =>
                    (detailPriority[a.recordType] ?? Number.MAX_SAFE_INTEGER) -
                    (detailPriority[b.recordType] ?? Number.MAX_SAFE_INTEGER)
            )
            .map((record) => [getRecordName(record), record] as const)
            .reverse()
    );
    const cerberusRecord = getRecord('world-progression/region:H');
    const detailOverrides = new Map<string, PublicationRecord>(cerberusRecord ? [['Cerberus', cerberusRecord]] : []);
    const storyCodexRecords = sortedRecords
        .filter((record) => record.recordType === 'world-progression/narrative-milestone')
        .map((record) => ({
            record,
            detailRecord: detailOverrides.get(getRecordName(record)) ?? detailByName.get(getRecordName(record)),
            subjectArt: getRecordSubjectArt(record),
        }))
        .filter(
            ({ detailRecord, subjectArt }) =>
                detailRecord && subjectArt.kind === 'character' && subjectArt.format === 'raster'
        );

    return { storyCodexRecords, storyDestinations };
}
