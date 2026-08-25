import {
    getContentRecords,
    getFieldBySuffix,
    getRecord,
    getRecordName,
    getRelationships,
    isReaderFacingRecord,
    type PublicationRecord,
} from './publication';
import {
    cleanReaderText,
    readableRules,
    type ReaderFact,
    type ReaderReferenceGroup,
    type ReaderSection,
} from './presentation-reader-text';
import { collectReferences, isObject, isReference, type RecordReference } from './presentation-value-formatting';

export function recordSummary(record: PublicationRecord): string {
    const overrides: Record<string, string> = {
        'world-progression/prophecy:QuestBeatChronosWithArcana':
            'Complete an Underworld clear after every Arcana Card has been active during that night.',
        'world-progression/prophecy:QuestCauldronSpellsSmall': 'Complete any 10 eligible Incantations.',
        'world-progression/prophecy:QuestEliteAttributeKills': 'Defeat armored foes with every required trait.',
        'world-progression/prophecy:QuestMeetShrineAltBosses': 'Defeat all six Unrivaled Guardians.',
    };
    if (overrides[record.key]) return overrides[record.key];
    if (record.public?.summary) return cleanReaderText(record.public.summary);
    if (record.public?.presentation === 'detail') {
        throw new Error(`Detail record has no explicit reader-facing summary: ${record.key}`);
    }
    return '';
}

export function derivedRecordSections(record: PublicationRecord): ReaderSection[] {
    switch (record.recordType) {
        case 'mechanics/boon':
            return boonSections(record);
        case 'mechanics/god':
            return godSections(record);
        case 'mechanics/run-reward':
            return runRewardSections(record);
        case 'mechanics/incantation':
            return incantationSections(record);
        case 'mechanics/status-element':
            return summarySection(record, 'What it changes');
        case 'world-progression/encounter-friend':
            return encounterFriendSections(record);
        case 'world-progression/oath-condition':
            return oathSections(record);
        case 'world-progression/region':
            return regionSections(record);
        case 'world-progression/relationship':
            return relationshipSections(record);
        default:
            return [];
    }
}

function boonSections(record: PublicationRecord): ReaderSection[] {
    if (record.id !== 'ZeusWeaponBoon') return [];
    return [
        {
            heading: 'How Blitz triggers',
            paragraphs: [
                'Heaven Strike applies Blitz for 4 seconds. Damage from other sources fills a 120 damage threshold. Reaching that threshold detonates Blitz, and if the timer ends first, Blitz detonates anyway.',
                'The detonation launches Heaven Strike’s listed damage after a 0.45 second delay. The same Blitz cannot be reapplied for 0.6 seconds after it triggers.',
            ],
            facts: [
                { label: 'Blitz duration', value: '4 seconds' },
                { label: 'Damage needed to trigger', value: '120' },
                { label: 'Detonation delay', value: '0.45 seconds' },
                { label: 'Reapply delay', value: '0.6 seconds' },
            ],
            references: [],
        },
    ];
}

function summarySection(record: PublicationRecord, heading: string, facts: ReaderFact[] = []): ReaderSection[] {
    return [
        {
            heading,
            paragraphs: [recordSummary(record)],
            facts,
            references: [],
        },
    ];
}

function godSections(record: PublicationRecord): ReaderSection[] {
    const availability = getFieldBySuffix(record, 'availability');
    const boons = getFieldBySuffix(record, 'boons');
    const references = boons === undefined ? [] : collectReferences(boons, 100);
    const rules =
        isObject(availability) && Array.isArray(availability.rules)
            ? availability.rules.filter((rule): rule is string => typeof rule === 'string')
            : [];
    return [
        {
            heading: `When ${getRecordName(record)} joins the boon pool`,
            paragraphs: [...new Set([recordSummary(record), ...rules])],
            facts: [],
            references,
            referenceGroups: boonPoolReferenceGroups(references),
        },
    ];
}

const CORE_BOON_SUFFIXES = ['WeaponBoon', 'SpecialBoon', 'CastBoon', 'SprintBoon', 'ManaBoon'] as const;

function boonPoolReferenceGroups(references: RecordReference[]): ReaderReferenceGroup[] {
    const entries = references.map((reference) => ({
        reference,
        record: getRecord(`${reference.recordType}:${reference.id}`),
    }));
    const entryKind = ({ record }: (typeof entries)[number]) =>
        record ? getFieldBySuffix<string>(record, 'kind') : undefined;
    const normalEntries = entries.filter((entry) => entryKind(entry) === 'normal');
    const corePrefixes = new Set(
        normalEntries.flatMap(({ record }) =>
            CORE_BOON_SUFFIXES.flatMap((suffix) =>
                record?.id.endsWith(suffix) ? [record.id.slice(0, -suffix.length)] : []
            )
        )
    );
    const corePrefix = [...corePrefixes].find((prefix) =>
        CORE_BOON_SUFFIXES.every((suffix) => normalEntries.some(({ record }) => record?.id === `${prefix}${suffix}`))
    );
    const coreEntries = corePrefix
        ? CORE_BOON_SUFFIXES.flatMap((suffix) =>
              normalEntries.filter(({ record }) => record?.id === `${corePrefix}${suffix}`)
          )
        : [];
    const hasCompleteCore = corePrefix !== undefined;
    const coreKeys = new Set(hasCompleteCore ? coreEntries.map(({ record }) => record?.key) : []);
    const remainingNormalEntries = normalEntries.filter(({ record }) => !coreKeys.has(record?.key));
    const curseEntries = remainingNormalEntries.filter(({ record }) => record?.id.endsWith('Curse'));
    const blessingEntries = remainingNormalEntries.filter(({ record }) => record?.id.endsWith('Blessing'));
    const separatesChaosPairs = curseEntries.length > 0 && blessingEntries.length > 0;
    const pairedKeys = new Set(
        separatesChaosPairs ? [...curseEntries, ...blessingEntries].map(({ record }) => record?.key) : []
    );
    const supportingEntries = remainingNormalEntries.filter(({ record }) => !pairedKeys.has(record?.key));
    const knownKeys = new Set(normalEntries.map(({ record }) => record?.key));

    const sortedReferences = (groupEntries: typeof entries) =>
        [...groupEntries]
            .sort((a, b) => {
                const aName = a.record ? getRecordName(a.record) : a.reference.id;
                const bName = b.record ? getRecordName(b.record) : b.reference.id;
                return aName.localeCompare(bName);
            })
            .map(({ reference }) => reference);
    const group = (key: string, heading: string, groupEntries: typeof entries): ReaderReferenceGroup | undefined =>
        groupEntries.length === 0
            ? undefined
            : {
                  heading,
                  key,
                  references:
                      key === 'core' ? coreEntries.map(({ reference }) => reference) : sortedReferences(groupEntries),
              };

    return [
        group('core', 'Core Boons', hasCompleteCore ? coreEntries : []),
        group(
            'supporting',
            hasCompleteCore ? 'Supporting Boons' : separatesChaosPairs ? 'Other Boons' : 'Boons',
            supportingEntries
        ),
        group('curses', 'Curses', separatesChaosPairs ? curseEntries : []),
        group('blessings', 'Blessings', separatesChaosPairs ? blessingEntries : []),
        group(
            'infusion',
            'Infusion Boons',
            entries.filter((entry) => entryKind(entry) === 'infusion')
        ),
        group(
            'legendary',
            'Legendary Boons',
            entries.filter((entry) => entryKind(entry) === 'legendary')
        ),
        group(
            'duo',
            'Duo Boons',
            entries.filter((entry) => entryKind(entry) === 'duo')
        ),
        group(
            'other',
            'Other Boons',
            entries.filter(
                (entry) =>
                    !knownKeys.has(entry.record?.key) &&
                    !['infusion', 'legendary', 'duo'].includes(entryKind(entry) ?? '')
            )
        ),
    ].filter((entry): entry is ReaderReferenceGroup => entry !== undefined);
}

function runRewardSections(record: PublicationRecord): ReaderSection[] {
    const selection = getFieldBySuffix(record, 'selection');
    const labels: Record<string, string> = {
        'room-door': 'Reward doors',
        scripted: 'Scripted rewards',
        subroom: 'Optional side rooms',
    };
    const sources = Array.isArray(selection)
        ? [
              ...new Set(
                  selection.flatMap((entry) =>
                      isObject(entry) && typeof entry.kind === 'string' && labels[entry.kind]
                          ? [labels[entry.kind]]
                          : []
                  )
              ),
          ]
        : [];
    return summarySection(record, 'Where it can appear', [
        ...(sources.length === 0 ? [] : [{ label: 'Appears through', value: sources.join(', ') }]),
    ]);
}

function encounterFriendSections(record: PublicationRecord): ReaderSection[] {
    const appearance = getFieldBySuffix(record, 'appearance');
    const locations = isObject(appearance) && Array.isArray(appearance.locations) ? appearance.locations : [];
    const regions = locations.flatMap((location) => {
        if (!isObject(location) || !isReference(location.region)) return [];
        return [location.region];
    });
    const maximum =
        isObject(appearance) && typeof appearance.maxAppearancesPerBiome === 'number'
            ? appearance.maxAppearancesPerBiome
            : undefined;
    const relationshipTrack = sameSubjectReferences(record, ['world-progression/relationship']);
    return [
        {
            heading: `Where ${getRecordName(record)} can appear`,
            paragraphs: [recordSummary(record)],
            facts: maximum === undefined ? [] : [{ label: 'Appearance limit', value: `${maximum} per region` }],
            references: [...new Map(regions.map((region) => [`${region.recordType}:${region.id}`, region])).values()],
        },
        ...(relationshipTrack.length === 0
            ? []
            : [
                  {
                      heading: `Gifts and relationship progress with ${getRecordName(record)}`,
                      paragraphs: [
                          'This encounter page owns the meeting location and offered aid. The linked relationship page owns the first gift reward, heart locks, and later story requirements.',
                      ],
                      facts: [],
                      references: relationshipTrack,
                  },
              ]),
    ];
}

function incantationSections(record: PublicationRecord): ReaderSection[] {
    if (record.id === 'WorldUpgradeRelationshipBar') {
        return [
            {
                heading: 'Use it before spending another gift',
                paragraphs: [
                    'After this incantation enhances the Book of Shadows, select the character and read the next-heart prompt. It distinguishes a gift you can offer now from a conversation, route encounter, or story event that must happen first.',
                ],
                facts: [],
                references: relatedRecordReferences(record).filter(
                    (reference) => reference.recordType === 'world-progression/relationship'
                ),
            },
        ];
    }
    if (record.id === 'WorldUpgradeWeaponUpgradeSystem') {
        return [
            {
                heading: 'What this changes at the Silver Pool',
                paragraphs: [
                    'This is the aspect-system unlock. Use the linked weapon and aspect pages for the resulting choices, rank costs, and move identity. Use Builds only after choosing an aspect.',
                ],
                facts: [],
                references: relatedRecordReferences(record).filter((reference) =>
                    ['mechanics/weapon', 'mechanics/weapon-aspect'].includes(reference.recordType)
                ),
            },
        ];
    }
    return [];
}

function oathSections(record: PublicationRecord): ReaderSection[] {
    const effects = getFieldBySuffix(record, 'rank-effects');
    const ranks = isObject(effects) && Array.isArray(effects.ranks) ? effects.ranks : [];
    const facts = ranks.flatMap((value) => {
        if (!isObject(value) || typeof value.rank !== 'number' || typeof value.fear !== 'number') return [];
        const effect = typeof value.effect === 'string' ? cleanReaderText(value.effect) : '';
        return [{ label: `Rank ${value.rank}, ${value.fear} Fear`, value: effect || 'Effect unavailable' }];
    });
    return summarySection(record, 'How the vow scales', facts);
}

function regionSections(record: PublicationRecord): ReaderSection[] {
    const route = getFieldBySuffix(record, 'route');
    const facts: ReaderFact[] = [];
    if (isObject(route) && typeof route.id === 'string') {
        facts.push({
            label: 'Route',
            value: route.id === 'underworld' ? 'Underworld' : route.id === 'surface' ? 'Surface' : route.id,
        });
    }
    if (isObject(route) && typeof route.order === 'number') {
        facts.push({ label: 'Route position', value: String(route.order) });
    }
    const encounters = relatedRecordReferences(record).filter(
        (reference) => reference.recordType === 'world-progression/encounter-friend'
    );
    return [
        ...summarySection(record, 'How it fits the route', facts),
        ...(encounters.length === 0
            ? []
            : [
                  {
                      heading: 'Characters you may meet here',
                      paragraphs: [
                          'Open a character encounter page for its appearance rules and offered aid. That page links onward to the separate gift and relationship track when one exists.',
                      ],
                      facts: [],
                      references: encounters,
                  },
              ]),
    ];
}

function relationshipSections(record: PublicationRecord): ReaderSection[] {
    const name = getRecordName(record);
    const track = getFieldBySuffix(record, 'gift-track');
    if (!isObject(track)) throw new Error(`Relationship has no readable gift track: ${record.key}`);

    const maximum = typeof track.maximumHearts === 'number' ? track.maximumHearts : undefined;
    const locked = typeof track.eventLockAfterHearts === 'number' ? track.eventLockAfterHearts : undefined;
    const firstGiftRequirements = readableRules(track.firstGiftRequirements);
    const bondForgedRequirements = readableRules(track.bondForgedRequirements);
    if (!maximum || locked === undefined || firstGiftRequirements.length === 0 || bondForgedRequirements.length === 0) {
        throw new Error(`Relationship has incomplete public progression facts: ${record.key}`);
    }

    const firstGiftRewards = relatedRecordReferences(record).filter(
        (reference) => reference.recordType === 'mechanics/keepsake'
    );
    const encounterPages = sameSubjectReferences(record, ['world-progression/encounter-friend']);
    return [
        {
            heading: 'How the bond progresses',
            paragraphs: [],
            orderedSteps: [
                `First gift. Meet the first gift requirement, then offer Nectar when ${name} is available. The first accepted gift grants the Keepsake linked below.`,
                `Before the heart gate. Continue offering Nectar until ${locked} hearts. Encounters while that Keepsake is equipped raise its rank, which is separate from this heart track.`,
                `Clear the heart gate. At ${locked} hearts, read ${name}'s next-heart prompt in the Book of Shadows and complete the listed requirement before trying another gift. A returned gift remains in your inventory.`,
                `Complete the remaining hearts. After the heart gate clears, continue offering Nectar through all ${maximum} hearts.`,
                'Bond Forged. The bond completes at the end of the heart track. A linked prophecy or later narrative scene may still remain, and post-bond repeat invitations do not add more hearts.',
            ],
            facts: [
                { label: 'First gift requirement', value: firstGiftRequirements.join(' ') },
                { label: 'Hearts before the lock', value: String(locked) },
                { label: 'Heart-gate requirement', value: bondForgedRequirements.join(' ') },
                { label: 'Maximum bond', value: `${maximum} hearts` },
            ],
            references: firstGiftRewards,
        },
        ...(encounterPages.length === 0
            ? []
            : [
                  {
                      heading: `Where to meet ${name} during a night`,
                      paragraphs: [
                          'The relationship page owns gifts and heart locks. The linked encounter page owns the eligible route, region, and offered aid.',
                      ],
                      facts: [],
                      references: encounterPages,
                  },
              ]),
    ];
}

function sameSubjectReferences(record: PublicationRecord, recordTypes: string[]): RecordReference[] {
    const name = getRecordName(record);
    return getContentRecords()
        .filter(
            (candidate) =>
                candidate.key !== record.key &&
                recordTypes.includes(candidate.recordType) &&
                getRecordName(candidate) === name
        )
        .map((candidate) => ({ id: candidate.id, recordType: candidate.recordType }));
}

function relatedRecordReferences(record: PublicationRecord): RecordReference[] {
    const relationships = getRelationships(record.key);
    const keys = new Set<string>();
    const references: RecordReference[] = [];
    for (const relationship of [...relationships.forward, ...relationships.reverse]) {
        const target = getRecord(relationship.targetKey);
        if (!target || !isReaderFacingRecord(target) || keys.has(target.key)) continue;
        keys.add(target.key);
        references.push({ id: target.id, recordType: target.recordType });
    }
    return references;
}
