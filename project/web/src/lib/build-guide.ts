import { cleanReaderText, isObject, isReference, type RecommendationItem, type RecordReference } from './presentation';
import type { JsonValue } from './publication';

export const BUILD_GOALS = ['strongest', 'safest'] as const;
export type BuildGoal = (typeof BUILD_GOALS)[number];

export const BUILD_SLOT_LABELS = {
    attack: 'Attack',
    special: 'Special',
    cast: 'Cast',
    sprint: 'Dash',
    omega: 'Gain',
} as const;

export type BuildSlot = keyof typeof BUILD_SLOT_LABELS;

export type BuildBoonLane = {
    role: 'core' | 'support';
    slot: BuildSlot;
    preferred: RecommendationItem[];
    fallback: RecommendationItem[];
};

export type BuildTarget = RecommendationItem & {
    requirementGroups: RecordReference[][];
    selectedPrerequisites: RecordReference[];
    requirementSummary: string;
};

export type BuildPowerBreakpoint = {
    stage: 'foundation' | 'online' | 'power-spike';
    title: string;
    condition: string;
    effect: string;
    references: RecordReference[];
};

export type BuildKeepsakeStep = {
    lifecycle: string;
    reason: string;
    reference: RecordReference;
    stage: string;
    switchCondition: string;
};

export type BuildInteraction = {
    condition: string;
    kind: string;
    reason: string;
    references: RecordReference[];
};

export type BuildContextRating = {
    context: 'consistency' | 'speed' | 'safety' | 'high-fear';
    limitation: string;
    rating: string;
    reason: string;
};

export type BuildVariant = {
    goal: BuildGoal;
    overallRating: string;
    overallReason: string;
    overallLimitation: string;
    strengths: string[];
    weaknesses: string[];
    playstyleCombatSequence: string[];
    powerBreakpoints: BuildPowerBreakpoint[];
    arcanaLoadout: { cards: RecommendationItem[]; graspCost: number; constraint: string };
    keepsakeRoute: BuildKeepsakeStep[];
    familiarHex: RecommendationItem[];
    boonPriorities: BuildBoonLane[];
    boonRankings: RecommendationItem[];
    duoLegendaryTargets: BuildTarget[];
    hammerRankings: RecommendationItem[];
    buildInteractions: BuildInteraction[];
    bossRouteConsiderations: string[];
    contextRatings: BuildContextRating[];
};

export type BuildVariants = Record<BuildGoal, BuildVariant>;

const BUILD_SLOTS = Object.keys(BUILD_SLOT_LABELS) as BuildSlot[];

function invalid(path: string, expectation: string): never {
    throw new Error(`Invalid build-variants.${path}: expected ${expectation}.`);
}

function objectAt(value: JsonValue | undefined, path: string): Record<string, JsonValue> {
    if (!isObject(value)) invalid(path, 'an object');
    return value;
}

function stringAt(value: JsonValue | undefined, path: string): string {
    if (typeof value !== 'string' || cleanReaderText(value).trim().length === 0) invalid(path, 'nonempty reader text');
    return cleanReaderText(value);
}

function stringsAt(value: JsonValue | undefined, path: string): string[] {
    if (!Array.isArray(value) || value.length === 0) invalid(path, 'a nonempty text array');
    return value.map((item, index) => stringAt(item, `${path}[${index}]`));
}

function referenceAt(value: JsonValue | undefined, path: string): RecordReference {
    if (!isReference(value)) invalid(path, 'a record reference');
    return { id: value.id, recordType: value.recordType };
}

function recommendationsAt(value: JsonValue | undefined, path: string): RecommendationItem[] {
    if (!Array.isArray(value) || value.length === 0) invalid(path, 'a nonempty recommendation array');
    return value.map((item, index) => {
        const entry = objectAt(item, `${path}[${index}]`);
        return {
            reference: referenceAt(entry.reference, `${path}[${index}].reference`),
            ...(typeof entry.rating === 'string' ? { rating: cleanReaderText(entry.rating) } : {}),
            ...(typeof entry.role === 'string' ? { role: cleanReaderText(entry.role) } : {}),
            ...(typeof entry.slot === 'string' ? { slot: cleanReaderText(entry.slot) } : {}),
            ...(typeof entry.reason === 'string' ? { reason: cleanReaderText(entry.reason) } : {}),
            ...(typeof entry.limitation === 'string' ? { limitation: cleanReaderText(entry.limitation) } : {}),
        };
    });
}

function referencesAt(value: JsonValue | undefined, path: string): RecordReference[] {
    if (!Array.isArray(value) || value.length === 0) invalid(path, 'a nonempty reference array');
    return value.map((item, index) => referenceAt(item, `${path}[${index}]`));
}

function parseTargets(value: JsonValue | undefined, path: string): BuildTarget[] {
    if (!Array.isArray(value)) invalid(path, 'a target array');
    return value.map((item, index) => {
        const entry = objectAt(item, `${path}[${index}]`);
        if (!Array.isArray(entry.requirementGroups) || entry.requirementGroups.length === 0)
            invalid(`${path}[${index}].requirementGroups`, 'nonempty prerequisite groups');
        const requirementGroups = entry.requirementGroups.map((group, groupIndex) =>
            referencesAt(group, `${path}[${index}].requirementGroups[${groupIndex}]`)
        );
        const selectedPrerequisites = referencesAt(
            entry.selectedPrerequisites,
            `${path}[${index}].selectedPrerequisites`
        );
        if (selectedPrerequisites.length !== requirementGroups.length)
            invalid(`${path}[${index}].selectedPrerequisites`, 'one selected prerequisite per group');
        const recommendation = recommendationsAt([item], `${path}[${index}]`)[0];
        if (!recommendation) invalid(`${path}[${index}]`, 'a complete target recommendation');
        return {
            ...recommendation,
            requirementGroups,
            selectedPrerequisites,
            requirementSummary: stringAt(entry.requirementSummary, `${path}[${index}].requirementSummary`),
        };
    });
}

function parsePowerBreakpoints(value: JsonValue | undefined, path: string): BuildPowerBreakpoint[] {
    if (!Array.isArray(value) || value.length < 2) invalid(path, 'at least two power breakpoints');
    const stages = ['foundation', 'online', 'power-spike'] as const;
    return value.map((item, index) => {
        const entry = objectAt(item, `${path}[${index}]`);
        const stage = stringAt(entry.stage, `${path}[${index}].stage`);
        if (!stages.includes(stage as (typeof stages)[number]))
            invalid(`${path}[${index}].stage`, 'foundation, online, or power-spike');
        return {
            stage: stage as BuildPowerBreakpoint['stage'],
            title: stringAt(entry.title, `${path}[${index}].title`),
            condition: stringAt(entry.condition, `${path}[${index}].condition`),
            effect: stringAt(entry.effect, `${path}[${index}].effect`),
            references: referencesAt(entry.references, `${path}[${index}].references`),
        };
    });
}

function parseBoonLanes(value: JsonValue | undefined, path: string): BuildBoonLane[] {
    if (!Array.isArray(value) || value.length !== BUILD_SLOTS.length) invalid(path, 'exactly five Boon lanes');
    const slots = new Set<BuildSlot>();
    const lanes = value.map((item, index) => {
        const entry = objectAt(item, `${path}[${index}]`);
        const slot = stringAt(entry.slot, `${path}[${index}].slot`).toLowerCase();
        if (!BUILD_SLOTS.includes(slot as BuildSlot))
            invalid(`${path}[${index}].slot`, 'Attack, Special, Cast, Sprint, or Magick');
        const typedSlot = slot as BuildSlot;
        if (slots.has(typedSlot)) invalid(`${path}[${index}].slot`, 'a unique Boon slot');
        slots.add(typedSlot);
        const role = stringAt(entry.role, `${path}[${index}].role`);
        if (role !== 'core' && role !== 'support') invalid(`${path}[${index}].role`, 'core or support');
        const typedRole: BuildBoonLane['role'] = role;
        return {
            role: typedRole,
            slot: typedSlot,
            preferred: recommendationsAt(entry.preferred, `${path}[${index}].preferred`),
            fallback: recommendationsAt(entry.fallback, `${path}[${index}].fallback`),
        };
    });
    if (BUILD_SLOTS.some((slot) => !slots.has(slot)))
        invalid(path, 'one each of Attack, Special, Cast, Sprint, and Magick');
    return lanes;
}

function parseKeepsakes(value: JsonValue | undefined, path: string): BuildKeepsakeStep[] {
    if (!Array.isArray(value) || value.length === 0) invalid(path, 'a nonempty Keepsake route');
    return value.map((item, index) => {
        const entry = objectAt(item, `${path}[${index}]`);
        return {
            lifecycle: stringAt(entry.lifecycle, `${path}[${index}].lifecycle`),
            reason: stringAt(entry.reason, `${path}[${index}].reason`),
            reference: referenceAt(entry.reference, `${path}[${index}].reference`),
            stage: stringAt(entry.stage, `${path}[${index}].stage`),
            switchCondition: stringAt(entry.switchCondition, `${path}[${index}].switchCondition`),
        };
    });
}

function parseInteractions(value: JsonValue | undefined, path: string): BuildInteraction[] {
    if (!Array.isArray(value)) invalid(path, 'an interaction array');
    return value.map((item, index) => {
        const entry = objectAt(item, `${path}[${index}]`);
        const references = entry.references;
        if (!Array.isArray(references) || references.length === 0)
            invalid(`${path}[${index}].references`, 'a nonempty reference array');
        return {
            condition: stringAt(entry.condition, `${path}[${index}].condition`),
            kind: stringAt(entry.kind, `${path}[${index}].kind`),
            reason: stringAt(entry.reason, `${path}[${index}].reason`),
            references: references.map((reference, referenceIndex) =>
                referenceAt(reference, `${path}[${index}].references[${referenceIndex}]`)
            ),
        };
    });
}

function parseContextRatings(value: JsonValue | undefined, path: string): BuildContextRating[] {
    const contexts = ['consistency', 'speed', 'safety', 'high-fear'] as const;
    if (!Array.isArray(value) || value.length !== contexts.length) invalid(path, 'exactly four context ratings');
    const seen = new Set<string>();
    const ratings = value.map((item, index) => {
        const entry = objectAt(item, `${path}[${index}]`);
        const context = stringAt(entry.context, `${path}[${index}].context`);
        if (!contexts.includes(context as (typeof contexts)[number]) || seen.has(context)) {
            invalid(`${path}[${index}].context`, 'a unique consistency, speed, safety, or high-fear context');
        }
        seen.add(context);
        return {
            context: context as BuildContextRating['context'],
            limitation: stringAt(entry.limitation, `${path}[${index}].limitation`),
            rating: stringAt(entry.rating, `${path}[${index}].rating`),
            reason: stringAt(entry.reason, `${path}[${index}].reason`),
        };
    });
    return ratings;
}

function parseVariant(value: JsonValue | undefined, goal: BuildGoal): BuildVariant {
    const variant = objectAt(value, goal);
    if (stringAt(variant.goal, `${goal}.goal`) !== goal) invalid(`${goal}.goal`, `the ${goal} goal`);
    const arcana = objectAt(variant.arcanaLoadout, `${goal}.arcanaLoadout`);
    if (typeof arcana.graspCost !== 'number') invalid(`${goal}.arcanaLoadout.graspCost`, 'a number');
    return {
        goal,
        overallRating: stringAt(variant.overallRating, `${goal}.overallRating`),
        overallReason: stringAt(variant.overallReason, `${goal}.overallReason`),
        overallLimitation: stringAt(variant.overallLimitation, `${goal}.overallLimitation`),
        strengths: stringsAt(variant.strengths, `${goal}.strengths`),
        weaknesses: stringsAt(variant.weaknesses, `${goal}.weaknesses`),
        playstyleCombatSequence: stringsAt(variant.playstyleCombatSequence, `${goal}.playstyleCombatSequence`),
        powerBreakpoints: parsePowerBreakpoints(variant.powerBreakpoints, `${goal}.powerBreakpoints`),
        arcanaLoadout: {
            cards: recommendationsAt(arcana.cards, `${goal}.arcanaLoadout.cards`),
            graspCost: arcana.graspCost,
            constraint: stringAt(arcana.constraint, `${goal}.arcanaLoadout.constraint`),
        },
        keepsakeRoute: parseKeepsakes(variant.keepsakeRoute, `${goal}.keepsakeRoute`),
        familiarHex: recommendationsAt(variant.familiarHex, `${goal}.familiarHex`),
        boonPriorities: parseBoonLanes(variant.boonPriorities, `${goal}.boonPriorities`),
        boonRankings: recommendationsAt(variant.boonRankings, `${goal}.boonRankings`),
        duoLegendaryTargets: parseTargets(variant.duoLegendaryTargets, `${goal}.duoLegendaryTargets`),
        hammerRankings: recommendationsAt(variant.hammerRankings, `${goal}.hammerRankings`),
        buildInteractions: parseInteractions(variant.buildInteractions, `${goal}.buildInteractions`),
        bossRouteConsiderations: stringsAt(variant.bossRouteConsiderations, `${goal}.bossRouteConsiderations`),
        contextRatings: parseContextRatings(variant.contextRatings, `${goal}.contextRatings`),
    };
}

export function parseBuildVariants(value: JsonValue | undefined): BuildVariants {
    const variants = objectAt(value, 'root');
    const keys = Object.keys(variants).sort();
    const expectedKeys = [...BUILD_GOALS].sort();
    if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) {
        invalid('root', 'exactly the strongest and safest modes');
    }
    return {
        strongest: parseVariant(variants.strongest, 'strongest'),
        safest: parseVariant(variants.safest, 'safest'),
    };
}
