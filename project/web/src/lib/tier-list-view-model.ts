import {
    getFieldBySuffix,
    getPublication,
    getRecord,
    getRecordName,
    type JsonValue,
    type PublicationPage,
    type PublicationRecord,
} from './publication';
import { cleanReaderText, isObject, isReference } from './presentation';
import {
    hasExplicitStrongestRanking,
    publicTierOrder,
    strongestPlacementFor,
    type PublicTierRating,
} from './tier-comparisons';

export type TierListProps = {
    page: PublicationPage;
    records: PublicationRecord[];
};

type TierEntry = {
    record: PublicationRecord;
    subject?: { id: string; recordType: string };
    rating: string;
    reason: string;
    recommendation: string;
    limitation: string;
    fallback: string;
    switchCondition: string;
    comparisonRatings?: {
        safest: TierComparison;
        strongest: TierComparison;
    };
    rankingSignals?: RankingSignals;
};

type TierComparison = {
    rating: string;
    reason: string;
    limitation: string;
};

type TierView = 'safest' | 'strongest';

type RatingContext = 'consistency' | 'speed' | 'safety' | 'high-fear';

type RankingSignals = {
    contextRatings: Partial<Record<RatingContext, string>>;
    overallRating: string;
    beginnerDifficulty?: number;
};

type RecordReference = { id: string; recordType: string };

export function getTierListStaticPaths() {
    const publication = getPublication();
    return publication.pages
        .filter((page) => page.pageKind === 'tier-list')
        .map((page) => ({
            params: { tier: page.id.split('/')[1] },
            props: {
                page,
                records: page.recordKeys.flatMap((key) => {
                    const record = getRecord(key);
                    return record ? [record] : [];
                }),
            },
        }));
}

export function createTierListViewModel({ page, records }: TierListProps) {
    const publication = getPublication();

    const stringValue = (value: JsonValue | undefined, key: string): string =>
        isObject(value) && typeof value[key] === 'string' ? String(value[key]) : '';

    const subjectFrom = (value: JsonValue | undefined): TierEntry['subject'] => {
        if (!isObject(value)) return undefined;
        if (isReference(value.subject)) return value.subject;
        if (isReference(value.aspect)) return value.aspect;
        if (isReference(value.weapon)) return value.weapon;
        return undefined;
    };

    const contextRatingsFrom = (value: JsonValue | undefined): Partial<Record<RatingContext, string>> => {
        const ratings = Array.isArray(value)
            ? value
            : isObject(value) && Array.isArray(value.contextRatings)
              ? value.contextRatings
              : [];
        return Object.fromEntries(
            ratings.flatMap((entry) => {
                if (
                    !isObject(entry) ||
                    !['consistency', 'speed', 'safety', 'high-fear'].includes(String(entry.context)) ||
                    typeof entry.rating !== 'string'
                ) {
                    return [];
                }
                return [[String(entry.context), entry.rating]];
            })
        );
    };

    const comparisonFrom = (value: JsonValue | undefined, context: 'safety' | 'speed'): TierComparison | undefined => {
        const ratings = Array.isArray(value)
            ? value
            : isObject(value) && Array.isArray(value.contextRatings)
              ? value.contextRatings
              : [];
        const match = ratings.find((entry) => isObject(entry) && entry.context === context);
        if (!isObject(match) || typeof match.rating !== 'string') return undefined;
        return {
            rating: match.rating,
            reason: cleanReaderText(typeof match.reason === 'string' ? match.reason : ''),
            limitation: cleanReaderText(typeof match.limitation === 'string' ? match.limitation : ''),
        };
    };

    const toEntry = (record: PublicationRecord): TierEntry => {
        const context = getFieldBySuffix(record, 'subject-context');
        const aspect = getFieldBySuffix(record, 'rank-evaluations');
        const weapon = getFieldBySuffix(record, 'context-ratings-guidance');
        const aspectContexts = getFieldBySuffix(record, 'context-ratings');
        const aspectShape = getFieldBySuffix(record, 'strengths-weaknesses');
        const guidance =
            getFieldBySuffix(record, 'rating-guidance') ??
            getFieldBySuffix(record, 'rating-choice-guidance') ??
            getFieldBySuffix(record, 'reason-prerequisites-limitation') ??
            getFieldBySuffix(record, 'leveling-priority') ??
            aspect ??
            weapon;
        const subject =
            subjectFrom(context) ??
            subjectFrom(guidance) ??
            (record.recordType === 'mechanics/keepsake' ? { id: record.id, recordType: record.recordType } : undefined);
        const rating =
            getFieldBySuffix<string>(record, 'rating') ||
            stringValue(guidance, 'rating') ||
            stringValue(guidance, 'priority') ||
            stringValue(guidance, 'overallRating') ||
            '';
        const readerReason = stringValue(guidance, 'reason') || stringValue(guidance, 'overallReason');
        const safest = comparisonFrom(aspectContexts ?? weapon, 'safety');
        const strongest = comparisonFrom(aspectContexts ?? weapon, 'speed');
        const contextRatings = contextRatingsFrom(aspectContexts ?? weapon);
        const overallRating = stringValue(aspect, 'overallRating') || stringValue(weapon, 'overallRating');
        const beginnerDifficulty =
            isObject(aspectShape) && typeof aspectShape.beginnerDifficulty === 'number'
                ? aspectShape.beginnerDifficulty
                : undefined;
        return {
            record,
            subject,
            rating,
            reason: readerReason ? cleanReaderText(readerReason) : '',
            recommendation: cleanReaderText(stringValue(guidance, 'recommendation')),
            limitation: cleanReaderText(
                stringValue(guidance, 'limitation') || stringValue(guidance, 'overallLimitation')
            ),
            fallback: cleanReaderText(stringValue(guidance, 'fallback')),
            switchCondition: cleanReaderText(stringValue(guidance, 'switchWhenInactive')),
            ...(safest && strongest ? { comparisonRatings: { safest, strongest } } : {}),
            ...(safest && strongest ? { rankingSignals: { contextRatings, overallRating, beginnerDifficulty } } : {}),
        };
    };

    const entries = records.map(toEntry).filter((entry) => entry.rating);
    const tierSlug = page.id.split('/')[1] ?? '';
    const metadataSubjects: Record<string, string> = {
        arcana: 'Arcana Cards',
        aspects: 'weapon aspects',
        boons: 'Boons',
        familiars: 'Familiars',
        hexes: 'Hexes',
        keepsakes: 'keepsakes',
        weapons: 'weapons',
    };
    const metadataSubject = metadataSubjects[tierSlug];
    if (!metadataSubject) throw new Error(`${page.id} has no authored metadata subject.`);
    const ratingOrder = publicTierOrder;
    if (
        hasExplicitStrongestRanking(tierSlug) &&
        entries.some((entry) => !strongestPlacementFor(tierSlug, entry.subject?.id ?? entry.record.id))
    ) {
        throw new Error(`${page.id} has a published item missing from its explicit Strongest ranking.`);
    }
    const ratingScore = (rating: string | undefined): number => {
        const index = rating ? ratingOrder.indexOf(rating as PublicTierRating) : -1;
        return index === -1 ? 1 : ratingOrder.length - index;
    };
    const evidenceRatingScore = (rating: string | undefined): number =>
        ({ S: 4, A: 3, B: 2, C: 1, D: 0 })[rating ?? ''] ?? 0;
    const rankingVector = (entry: TierEntry, view: TierView): readonly number[] => {
        const signals = entry.rankingSignals;
        if (!signals) return [];
        const { contextRatings, overallRating, beginnerDifficulty } = signals;
        const beginnerEase = beginnerDifficulty === undefined ? 0 : 6 - beginnerDifficulty;
        return view === 'safest'
            ? [
                  ratingScore(contextRatings.safety),
                  ratingScore(contextRatings.consistency),
                  beginnerEase,
                  ratingScore(contextRatings['high-fear']),
                  ratingScore(overallRating),
                  ratingScore(contextRatings.speed),
              ]
            : [
                  ratingScore(contextRatings.speed),
                  ratingScore(contextRatings.consistency),
                  ratingScore(contextRatings['high-fear']),
                  ratingScore(overallRating),
                  ratingScore(contextRatings.safety),
                  beginnerEase,
              ];
    };
    const entryName = (entry: TierEntry): string =>
        getRecordName(entry.subject ? `${entry.subject.recordType}:${entry.subject.id}` : entry.record);
    const entrySubjectKey = (entry: TierEntry): string =>
        entry.subject ? `${entry.subject.recordType}:${entry.subject.id}` : entry.record.key;
    const referenceKey = (value: JsonValue | undefined): string | undefined =>
        isObject(value) && isReference(value.reference)
            ? `${value.reference.recordType}:${value.reference.id}`
            : undefined;
    const publicRating = (rating: string | undefined): PublicTierRating =>
        ratingOrder.includes(rating as PublicTierRating) ? (rating as PublicTierRating) : 'C';
    const aspectGuides = publication.records.filter((record) => record.recordType === 'editorial/aspect-guide');
    const tierViews: readonly TierView[] = ['safest', 'strongest'];
    const guideContextWeight = (guide: PublicationRecord, view: TierView): number => {
        const contexts = contextRatingsFrom(getFieldBySuffix(guide, 'context-ratings'));
        const primary = view === 'safest' ? contexts.safety : contexts.speed;
        const secondary = view === 'safest' ? contexts.consistency : contexts['high-fear'];
        return ratingScore(primary) * 2 + ratingScore(secondary);
    };
    const evidenceItemsFor = (guide: PublicationRecord): JsonValue[] => {
        if (tierSlug === 'boons') {
            const value = getFieldBySuffix(guide, 'boon-rankings');
            return Array.isArray(value) ? value : [];
        }
        if (tierSlug === 'arcana') {
            const value = getFieldBySuffix(guide, 'arcana-loadout');
            return isObject(value) && Array.isArray(value.cards) ? value.cards : [];
        }
        if (tierSlug === 'familiars' || tierSlug === 'hexes') {
            const value = getFieldBySuffix(guide, 'familiar-hex');
            const expectedType = `mechanics/${tierSlug === 'familiars' ? 'familiar' : 'hex'}`;
            return Array.isArray(value)
                ? value.filter(
                      (item) =>
                          isObject(item) && isReference(item.reference) && item.reference.recordType === expectedType
                  )
                : [];
        }
        if (tierSlug === 'keepsakes') {
            const value = getFieldBySuffix(guide, 'keepsake-route');
            return Array.isArray(value) ? value : [];
        }
        return [];
    };

    type EvidenceSignal = {
        weightedScore: number;
        weightedPriority: number;
        weightedPresence: number;
        matches: number;
        ratingCounts: readonly number[];
    };

    const emptyEvidenceSignal: EvidenceSignal = {
        weightedScore: 0,
        weightedPriority: 0,
        weightedPresence: 0,
        matches: 0,
        ratingCounts: [0, 0, 0, 0, 0],
    };
    const evidenceSignals: Record<TierView, Map<string, EvidenceSignal>> = {
        safest: new Map(),
        strongest: new Map(),
    };

    for (const guide of aspectGuides) {
        const evidenceByKey = new Map<string, { index: number; score: number }>();
        for (const [index, evidence] of evidenceItemsFor(guide).entries()) {
            const key = referenceKey(evidence);
            if (!key || evidenceByKey.has(key)) continue;
            const evidenceRating = isObject(evidence) && typeof evidence.rating === 'string' ? evidence.rating : 'S';
            evidenceByKey.set(key, { index, score: isObject(evidence) ? evidenceRatingScore(evidenceRating) : 0 });
        }

        for (const view of tierViews) {
            const weight = guideContextWeight(guide, view);
            for (const [key, evidence] of evidenceByKey) {
                if (evidence.score === 0) continue;
                const current = evidenceSignals[view].get(key) ?? emptyEvidenceSignal;
                const ratingCounts = [...current.ratingCounts];
                ratingCounts[4 - evidence.score] += 1;
                evidenceSignals[view].set(key, {
                    weightedScore: current.weightedScore + weight * evidence.score,
                    weightedPriority: current.weightedPriority + (weight * evidence.score) / (evidence.index + 1),
                    weightedPresence: current.weightedPresence + weight,
                    matches: current.matches + 1,
                    ratingCounts,
                });
            }
        }
    }

    const evidenceSignalFor = (entry: TierEntry, view: TierView): EvidenceSignal =>
        evidenceSignals[view].get(entrySubjectKey(entry)) ?? emptyEvidenceSignal;

    const strongestEvidencePeak = Math.max(
        0,
        ...entries.map((entry) => evidenceSignalFor(entry, 'strongest').weightedScore)
    );
    const strongestEvidenceRatio = (entry: TierEntry): number => {
        const score = evidenceSignalFor(entry, 'strongest').weightedScore;
        return strongestEvidencePeak > 0 ? score / strongestEvidencePeak : 0;
    };
    const ratingFromStrongestEvidence = (entry: TierEntry): PublicTierRating => {
        const ratio = strongestEvidenceRatio(entry);
        if (ratio >= 0.9) return 'S';
        if (ratio >= 0.55) return 'A';
        if (ratio > 0) return 'B';
        return 'C';
    };

    const contextualScore = (entry: TierEntry, view: TierView): number => {
        const explicitStrongest = strongestPlacementFor(tierSlug, entry.subject?.id ?? entry.record.id);
        if (view === 'strongest' && explicitStrongest) return 4 - explicitStrongest.order / 100;
        if (entry.comparisonRatings) {
            const rating = entry.comparisonRatings[view].rating;
            const vector = rankingVector(entry, view);
            return ratingScore(rating) + vector.reduce((total, value, index) => total + value / 10 ** (index + 2), 0);
        }
        if (view === 'safest') return ratingScore(publicRating(entry.rating));
        return strongestEvidenceRatio(entry) * 4;
    };
    const ratingFor = (entry: TierEntry, view: TierView): PublicTierRating => {
        const strongestPlacement = strongestPlacementFor(tierSlug, entry.subject?.id ?? entry.record.id);
        if (view === 'strongest' && strongestPlacement) return strongestPlacement.rating;
        if (entry.comparisonRatings) return publicRating(entry.comparisonRatings[view].rating);
        return view === 'safest' ? publicRating(entry.rating) : ratingFromStrongestEvidence(entry);
    };

    type RankingData = {
        rating: PublicTierRating;
        explicitOrder?: number;
        contextualScore: number;
        evidence: EvidenceSignal;
        vector: readonly number[];
        originalRatingScore: number;
        name: string;
    };

    const rankingData: Record<TierView, Map<TierEntry, RankingData>> = {
        safest: new Map(),
        strongest: new Map(),
    };
    for (const view of tierViews) {
        for (const entry of entries) {
            const explicit =
                view === 'strongest'
                    ? strongestPlacementFor(tierSlug, entry.subject?.id ?? entry.record.id)
                    : undefined;
            rankingData[view].set(entry, {
                rating: ratingFor(entry, view),
                explicitOrder: explicit?.order,
                contextualScore: contextualScore(entry, view),
                evidence: evidenceSignalFor(entry, view),
                vector: rankingVector(entry, view),
                originalRatingScore: ratingScore(publicRating(entry.rating)),
                name: entryName(entry),
            });
        }
    }

    const compareCachedEvidence = (a: EvidenceSignal, b: EvidenceSignal): number => {
        const direct =
            b.weightedScore - a.weightedScore ||
            b.weightedPriority - a.weightedPriority ||
            b.weightedPresence - a.weightedPresence ||
            b.matches - a.matches;
        if (direct !== 0) return direct;
        for (let index = 0; index < a.ratingCounts.length; index += 1) {
            const difference = (b.ratingCounts[index] ?? 0) - (a.ratingCounts[index] ?? 0);
            if (difference !== 0) return difference;
        }
        return 0;
    };
    const compareCachedVectors = (a: readonly number[], b: readonly number[]): number => {
        for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
            const difference = (b[index] ?? 0) - (a[index] ?? 0);
            if (difference !== 0) return difference;
        }
        return 0;
    };
    const rankedByView: Record<TierView, TierEntry[]> = {
        safest: [],
        strongest: [],
    };
    for (const view of tierViews) {
        rankedByView[view] = [...entries].sort((a, b) => {
            const aData = rankingData[view].get(a);
            const bData = rankingData[view].get(b);
            if (!aData || !bData) return 0;
            return (
                ratingOrder.indexOf(aData.rating) - ratingOrder.indexOf(bData.rating) ||
                (aData.explicitOrder !== undefined && bData.explicitOrder !== undefined
                    ? aData.explicitOrder - bData.explicitOrder
                    : 0) ||
                bData.contextualScore - aData.contextualScore ||
                compareCachedEvidence(aData.evidence, bData.evidence) ||
                compareCachedVectors(aData.vector, bData.vector) ||
                bData.originalRatingScore - aData.originalRatingScore ||
                aData.name.localeCompare(bData.name)
            );
        });
    }

    const groupedByView = Object.fromEntries(
        tierViews.map((view) => [
            view,
            ratingOrder
                .map((rating) => ({
                    rating,
                    entries: rankedByView[view].filter((entry) => rankingData[view].get(entry)?.rating === rating),
                }))
                .filter((group) => group.entries.length > 0),
        ])
    ) as Record<TierView, Array<{ rating: PublicTierRating; entries: TierEntry[] }>>;

    for (const view of tierViews) {
        const ranked = rankedByView[view];
        if (ranked.length !== entries.length || ranked.some((entry) => !ratingOrder.includes(ratingFor(entry, view)))) {
            throw new Error(`${page.id} does not have a complete S–C ${view} ranking.`);
        }
    }

    const descriptionFor = (record: PublicationRecord | undefined): string =>
        record ? cleanReaderText(getFieldBySuffix<string>(record, 'description') || '') : '';
    const hasExactProgressionFor = (record: PublicationRecord | undefined): boolean => {
        if (!record) return false;
        const upgradeFields = new Set(record.fields.map((field) => field.id.split('/').at(-1)));
        const hasPlayerProgression = [
            'abilities-upgrades',
            'level-scaling',
            'path-upgrades',
            'rank-costs',
            'rank-costs-effects',
            'rank-effects',
        ].some((field) => upgradeFields.has(field));
        return hasPlayerProgression;
    };

    const boonFitsFor = (record: PublicationRecord | undefined): RecordReference[] => {
        if (!record || record.recordType !== 'mechanics/boon') return [];
        const affinity = getFieldBySuffix(record, 'weapon-affinity');
        if (!Array.isArray(affinity)) return [];
        return affinity
            .flatMap((value) => {
                if (!isObject(value) || value.rating !== 'S' || !isReference(value.aspect)) return [];
                return [value.aspect];
            })
            .slice(0, 4);
    };

    const boonRequirementsFor = (record: PublicationRecord | undefined): RecordReference[] => {
        if (!record || record.recordType !== 'mechanics/boon') return [];
        const prerequisites = getFieldBySuffix(record, 'prerequisites');
        if (!isObject(prerequisites) || !Array.isArray(prerequisites.boons)) return [];
        return prerequisites.boons.filter(isReference);
    };

    const keepsakeAdviceFor = (entry: TierEntry, description: string): string => {
        const godKeepsake = description.match(/^A boon of (.+?) is likely\./);
        if (godKeepsake) {
            const god = godKeepsake[1];
            return `Use this when your planned build needs ${god}. It makes ${god} more likely to appear and lets you improve one Common ${god} Boon.`;
        }
        return entry.reason;
    };
    const introductions: Record<string, string> = {
        arcana: 'These ranks compare cards for reliable progression before a specialized aspect board changes the order. Open a card to see its Grasp cost, activation, and strongest aspect links.',
        aspects:
            'These ranks compare complete aspect plans at their stated investment. A lower general rank can still be the correct choice for a preferred weapon or route.',
        boons: 'These ranks compare pick value when the Boon is already on screen. S marks build-defining capstones and broad standouts, prerequisite difficulty affects whether a Boon appears, not how strong the offered choice is. Build pages still decide whether it fits the selected aspect and move.',
        familiars:
            'These ranks weigh combat help, gathering access, and the point in progression when each companion solves a real need.',
        hexes: 'These ranks compare safety, payoff, and how much a Hex interrupts the weapon plan. The best choice still depends on how the aspect spends Magick.',
        keepsakes:
            'These ranks compare progression value and how long each effect stays useful. God Keepsakes share one rule: replace one at the next cabinet after its guaranteed offer appears or the required Boon is secured. Other entries say when their individual job ends.',
        weapons:
            'These ranks compare each weapon family before a specific aspect and build reshape it. Use them to choose what to learn next, not to replace the aspect guide.',
    };

    const comparisonIntroductions: Record<TierView, string> = {
        safest: 'Safest ranks the options that give a player the most room to recover from positioning, timing, and resource mistakes. The order combines each published tier judgment with how often the option is favored by the safer authored aspect plans. Within each tier, reading order runs from best to weakest.',
        strongest:
            'Strongest ranks practical output in complete builds, not the largest isolated hit. The order combines each published tier judgment with how often the option is favored by the faster authored aspect plans. Within each tier, reading order runs from best to weakest.',
    };

    const tierMeanings: Record<string, string> = {
        S: 'Defining choice for this ranking goal',
        A: 'Strong choice with a clear tradeoff',
        B: 'Useful when its conditions match',
        C: 'Specialized or demanding',
    };

    const choiceCount = (count: number): string => `${count} ranked ${count === 1 ? 'choice' : 'choices'}`;

    return {
        publication,
        metadataSubject,
        tierSlug,
        introductions,
        tierViews,
        comparisonIntroductions,
        groupedByView,
        choiceCount,
        tierMeanings,
        descriptionFor,
        keepsakeAdviceFor,
        boonFitsFor,
        boonRequirementsFor,
        hasExactProgressionFor,
    };
}
