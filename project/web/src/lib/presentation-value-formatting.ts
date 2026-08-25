import { getRecord, getRecordName, isReaderFacingRecord, type JsonValue, type PublicationRecord } from './publication';
import { progressionTable } from './progression';
import { cleanReaderText, readableRules } from './presentation-reader-text';

export type RecordReference = {
    id: string;
    recordType: string;
};

export type RecommendationItem = {
    rating?: string;
    reason?: string;
    limitation?: string;
    role?: string;
    slot?: string;
    reference: RecordReference;
};

export type EffectMetric = {
    name: string;
    values: Array<number | string>;
};

export type RarityScalingRow = {
    rarity: string;
    value: string;
};

export type CostItem = {
    amount: number;
    resource: RecordReference;
};

export type CostGroup = {
    label: string;
    items: CostItem[];
};

export type NamedDescriptionItem = {
    category?: string;
    description: string;
    name: string;
};

export type UpgradeRank = {
    costs: CostItem[];
    description: string;
    rank: number;
};

export type UpgradeGroup = {
    name: string;
    ranks: UpgradeRank[];
};

const PRIVATE_DETAIL_KEYS = new Set([
    'context',
    'GameStateRequirements',
    'InheritFrom',
    'MaxedRequirement',
    'MaxedSticker',
    'mechanics',
    'Name',
    'PathFalse',
    'PathTrue',
    'source',
    'staticInputs',
    'Value',
]);

const FIELD_LABELS: Record<string, string> = {
    activation: 'When it applies',
    'aggression-range': 'Aggression range',
    'abilities-upgrades': 'Abilities and upgrades',
    additionalDamagePerTick: 'Escalation each tick',
    acquisition: 'How to get it',
    'acquisition-locations': 'Where to find it',
    aid: 'Help you can receive',
    appearance: 'Where and when it appears',
    'attack-patterns': 'Attack patterns',
    'attacks-behavior': 'Combat behavior',
    availability: 'When it can appear',
    behavior: 'How it works',
    'boss-route-considerations': 'Boss and route plan',
    'build-affinity': 'Build fit',
    'catch-location': 'Where to catch it',
    'can-be-charmed': 'Can be Charmed',
    'can-be-frozen': 'Can be Frozen',
    'can-be-polymorphed': 'Can be transformed',
    'can-be-raised-from-the-dead': 'Can be raised from the dead',
    classification: 'Encounter role',
    compatibility: 'Weapon compatibility',
    costs: 'What it costs',
    Damage: 'Damage',
    description: 'What it does',
    effects: 'What changes',
    EchoDuration: 'Blitz duration',
    EchoThreshold: 'Damage needed to trigger',
    elements: 'Elements',
    exchange: 'Exchange',
    'forced-boon-choice': 'Opening choice',
    'gathering-effect': 'What the tool gathers',
    'gift-track': 'Relationship progress',
    god: 'Olympian',
    growth: 'Growth cycle',
    'path-upgrades': 'Path of Stars upgrades',
    kind: 'Boon type',
    intervalSeconds: 'Time between ticks',
    'level-costs': 'Upgrade costs',
    'level-scaling': 'Pom scaling',
    'leveling-priority': 'When to equip and replace it',
    'health-buffer': 'Armor or health buffer',
    'name-description': 'What it is',
    'maximum-hit-shields': 'Maximum hit shields',
    'maximum-life': 'Maximum Life',
    objectives: 'How to complete it',
    prerequisites: 'What it needs',
    provider: 'Who offers it',
    'rank-costs': 'Rank costs',
    'rank-costs-effects': 'Ranks and costs',
    'rank-effects': 'Rank effects',
    'rarity-scaling': 'Rarity multipliers',
    region: 'Region',
    requirements: 'Requirements',
    removal: 'How to remove it',
    rewards: 'Reward',
    'room-encounter': 'Opening encounter',
    sale: 'Sale value',
    'seed-output': 'Seed and harvest',
    'starting-capacity': 'Starting Grasp',
    startingSelfDamage: 'First self-damage tick',
    stats: 'Stats',
    trigger: 'How to unlock it',
    'unlock-costs': 'Unlock cost',
    'unlock-requirements': 'When it unlocks',
    'upgrade-series': 'Grasp upgrades',
    uses: 'What it is used for',
    'weapon-affinity': 'Aspect fit',
};

function isPrivateDetailKey(key: string): boolean {
    const normalized = key.replaceAll(/[-_]/g, '').toLowerCase();
    return (
        PRIVATE_DETAIL_KEYS.has(key) ||
        normalized === 'statlines' ||
        normalized === 'staticinputs' ||
        normalized === 'extractvalues' ||
        normalized === 'rankeffects'
    );
}

export function isObject(value: JsonValue | undefined): value is Record<string, JsonValue> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readerFieldLabel(fieldId: string): string {
    const suffix = fieldId.split('/').at(-1) ?? fieldId;
    const label = FIELD_LABELS[suffix];
    if (!label) throw new Error(`Field has no explicit reader-facing label: ${fieldId}`);
    return label;
}

export function namedDescriptionItems(value: JsonValue): NamedDescriptionItem[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
        if (!isObject(item) || typeof item.name !== 'string' || typeof item.description !== 'string') return [];
        return [
            {
                category: typeof item.category === 'string' ? cleanReaderText(item.category) : undefined,
                description: cleanReaderText(item.description),
                name: cleanReaderText(item.name),
            },
        ];
    });
}

export function upgradeGroups(value: JsonValue): UpgradeGroup[] {
    if (!isObject(value) || !Array.isArray(value.upgrades)) return [];
    return value.upgrades.flatMap((upgrade) => {
        if (!isObject(upgrade) || typeof upgrade.name !== 'string' || !Array.isArray(upgrade.ranks)) return [];
        const ranks = upgrade.ranks.flatMap((rank) => {
            if (
                !isObject(rank) ||
                typeof rank.rank !== 'number' ||
                typeof rank.description !== 'string' ||
                !Array.isArray(rank.costs)
            ) {
                return [];
            }
            return [
                {
                    costs: asCostItems(rank.costs),
                    description: cleanReaderText(rank.description),
                    rank: rank.rank,
                },
            ];
        });
        return ranks.length > 0 ? [{ name: cleanReaderText(upgrade.name), ranks }] : [];
    });
}

export function fieldSuffix(fieldId: string): string {
    return fieldId.split('/').at(-1) ?? fieldId;
}

export function visibleRecordFields(record: PublicationRecord, summary = '') {
    const hidden = new Set([
        'classification',
        'encounters',
        'gift-track',
        'kind',
        'name',
        'official-name',
        'reservation-advice',
        'search-aliases',
        'spoiler-level',
    ]);
    const normalizedSummary = normalizeReaderText(summary);
    return record.fields
        .filter((field) => FIELD_LABELS[fieldSuffix(field.id)] !== undefined)
        .filter((field) => !hidden.has(fieldSuffix(field.id)))
        .filter((field) => canPresentValue(field.value, field.id))
        .filter((field) => {
            if (!normalizedSummary) return true;
            const candidate = visibleValueText(field.value);
            if (!candidate) return true;
            const normalizedCandidate = normalizeReaderText(candidate);
            if (normalizedCandidate.length < 20) return true;
            return !(
                normalizedCandidate === normalizedSummary ||
                normalizedCandidate.includes(normalizedSummary) ||
                normalizedSummary.includes(normalizedCandidate)
            );
        });
}

export function isReference(value: JsonValue | undefined): value is RecordReference & Record<string, JsonValue> {
    return isObject(value) && typeof value.id === 'string' && typeof value.recordType === 'string';
}

export function asRecommendations(value: JsonValue): RecommendationItem[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
        if (!isObject(item) || !isReference(item.reference)) return [];
        return [
            {
                rating: typeof item.rating === 'string' ? item.rating : undefined,
                reason: typeof item.reason === 'string' ? item.reason : undefined,
                limitation: typeof item.limitation === 'string' ? item.limitation : undefined,
                role: typeof item.role === 'string' ? item.role : undefined,
                slot: typeof item.slot === 'string' ? item.slot : undefined,
                reference: item.reference,
            },
        ];
    });
}

export function asCostItems(value: JsonValue): CostItem[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
        if (!isObject(item) || typeof item.amount !== 'number' || !isReference(item.resource)) return [];
        return [{ amount: item.amount, resource: item.resource }];
    });
}

export function costGroups(value: JsonValue, fieldId = ''): CostGroup[] {
    const direct = asCostItems(value);
    if (direct.length > 0) {
        return [{ label: fieldId.endsWith('/rewards') ? 'You receive' : 'Cost', items: direct }];
    }
    if (!isObject(value)) return [];

    const groups: CostGroup[] = [];
    if (Array.isArray(value.unlockCosts)) {
        const items = asCostItems(value.unlockCosts);
        if (items.length > 0) groups.push({ label: 'Unlock', items });
    }
    if (Array.isArray(value.ranks)) {
        for (const rank of value.ranks) {
            if (!isObject(rank) || typeof rank.rank !== 'number' || !Array.isArray(rank.upgradeFromPreviousCosts)) {
                continue;
            }
            const items = asCostItems(rank.upgradeFromPreviousCosts);
            if (items.length > 0) groups.push({ label: `Rank ${rank.rank}`, items });
        }
    }
    return groups;
}

export function collectReferences(value: JsonValue, maximum = 24): RecordReference[] {
    const found = new Map<string, RecordReference>();

    function walk(current: JsonValue): void {
        if (found.size >= maximum) return;
        if (Array.isArray(current)) {
            for (const item of current) walk(item);
            return;
        }
        if (!isObject(current)) return;
        if (isReference(current)) {
            const record = getRecord(`${current.recordType}:${current.id}`);
            if (record && isReaderFacingRecord(record)) {
                found.set(`${current.recordType}:${current.id}`, {
                    id: current.id,
                    recordType: current.recordType,
                });
            }
        }
        for (const [key, child] of Object.entries(current)) {
            if (!isPrivateDetailKey(key)) walk(child);
        }
    }

    walk(value);
    return [...found.values()];
}

export function extractEffectMetrics(value: JsonValue): EffectMetric[] {
    const metrics = new Map<string, Set<number | string>>();

    const contextualValue = (current: Record<string, JsonValue>): string | number | undefined => {
        if (!isObject(current.resolution) || current.resolution.kind !== 'contextual' || !isObject(current.source)) {
            return undefined;
        }
        const sourceValue = current.source.value;
        if (typeof sourceValue !== 'number' && typeof sourceValue !== 'string') return undefined;
        if (typeof sourceValue === 'string') return `${sourceValue} base`;

        const expression = typeof current.resolution.expression === 'string' ? current.resolution.expression : '';
        const inputIds = Array.isArray(current.resolution.inputIds)
            ? current.resolution.inputIds.filter((input): input is string => typeof input === 'string')
            : [];
        const percentageExpression = expression.includes('* 100') || expression.includes('*100');

        if (expression.includes('(value - 1)') && percentageExpression) {
            return `${Number(((sourceValue - 1) * 100).toFixed(3))}% per ${modifierLabel(inputIds[0] ?? '')}`;
        }
        if (percentageExpression && Math.abs(sourceValue) <= 1) {
            const percentage = Number((sourceValue * 100).toFixed(3));
            return inputIds.length > 0
                ? `${percentage}% before ${inputIds.map(modifierLabel).join(' and ')}`
                : `${percentage}%`;
        }
        return inputIds.length > 0
            ? `${sourceValue} before ${inputIds.map(modifierLabel).join(' and ')}`
            : `${sourceValue} base`;
    };

    function walk(current: JsonValue): void {
        if (Array.isArray(current)) {
            for (const item of current) walk(item);
            return;
        }
        if (!isObject(current)) return;

        if (
            typeof current.id === 'string' &&
            isObject(current.resolution) &&
            current.resolution.kind === 'resolved' &&
            (typeof current.resolution.value === 'number' || typeof current.resolution.value === 'string')
        ) {
            const values = metrics.get(current.id) ?? new Set<number | string>();
            values.add(current.resolution.value);
            metrics.set(current.id, values);
        }
        const contextual = contextualValue(current);
        if (typeof current.id === 'string' && contextual !== undefined) {
            const values = metrics.get(current.id) ?? new Set<number | string>();
            values.add(contextual);
            metrics.set(current.id, values);
        }

        for (const [key, child] of Object.entries(current)) {
            if (!isPrivateDetailKey(key)) walk(child);
        }
    }

    walk(value);
    return [...metrics.entries()].flatMap(([name, values]) => {
        return [
            {
                name: metricLabel(name),
                values: [...values].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true })),
            },
        ];
    });
}

export function rarityScalingRows(value: JsonValue): RarityScalingRow[] {
    if (!isObject(value)) return [];
    const order = ['Common', 'Rare', 'Epic', 'Heroic', 'Legendary', 'Duo'];
    return Object.entries(value)
        .flatMap(([rarity, scaling]) => {
            if (!isObject(scaling)) return [];
            const multiplier = typeof scaling.Multiplier === 'number' ? scaling.Multiplier : undefined;
            const minimum = typeof scaling.MinMultiplier === 'number' ? scaling.MinMultiplier : undefined;
            const maximum = typeof scaling.MaxMultiplier === 'number' ? scaling.MaxMultiplier : undefined;
            if (multiplier !== undefined) return [{ rarity, value: `×${formatMetricNumber(multiplier)}` }];
            if (minimum !== undefined && maximum !== undefined) {
                return [
                    {
                        rarity,
                        value:
                            minimum === maximum
                                ? `×${formatMetricNumber(minimum)}`
                                : `×${formatMetricNumber(minimum)} to ×${formatMetricNumber(maximum)}`,
                    },
                ];
            }
            return [];
        })
        .sort((a, b) => order.indexOf(a.rarity) - order.indexOf(b.rarity));
}

function formatMetricNumber(value: number): string {
    return new Intl.NumberFormat('en', { maximumFractionDigits: 3 }).format(value);
}

function modifierLabel(value: string): string {
    const labels: Record<string, string> = {
        ExpectedMaxHealth: 'expected maximum Life',
        HealingMultiplier: 'healing modifiers',
        LuckMultiplier: 'Luck',
        MaxHealthMultiplier: 'maximum Life modifiers',
        MissingHealth: 'missing Life',
        OlympianBoonCount: 'Olympian Boon',
        OlympianRechargeMultiplier: 'recharge modifiers',
        UniqueGodCount: 'Olympian',
    };
    return labels[value] ?? metricLabel(value).toLocaleLowerCase();
}

function metricLabel(value: string): string {
    if (FIELD_LABELS[value]) return FIELD_LABELS[value];
    const normalized = value
        .replace(/^Tooltip/u, '')
        .replace(/^Reported/u, '')
        .replace(/^Unmodified/u, '')
        .replace(/AOE/gu, 'Area ')
        .replace(/AoE/gu, 'Area ')
        .replace(/Mana/gu, 'Magick')
        .replace(/Heal/gu, 'Healing')
        .replace(/([a-z0-9])([A-Z])/gu, '$1 $2')
        .replace(/\s+/gu, ' ')
        .trim();
    return normalized.charAt(0).toLocaleUpperCase() + normalized.slice(1);
}

export function plainList(value: JsonValue): Array<number | string> {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is number | string => typeof item === 'string' || typeof item === 'number');
}

export function objectSummary(value: JsonValue): Array<{ label: string; value: string }> {
    if (!isObject(value)) return [];
    const entries: Array<{ label: string; value: string }> = [];

    function walk(current: Record<string, JsonValue>, path: string[], depth: number): void {
        if (entries.length >= 16 || depth > 3) return;
        for (const [key, child] of Object.entries(current)) {
            if (isPrivateDetailKey(key)) continue;
            const nextPath = [...path, key];
            const summary = summarizeValue(child);
            const label = FIELD_LABELS[key];
            if (summary && label) {
                entries.push({ label, value: summary });
            } else if (isObject(child) && !isReference(child)) {
                walk(child, nextPath, depth + 1);
            }
            if (entries.length >= 16) return;
        }
    }

    walk(value, [], 0);
    return entries;
}

export function summarizeValue(value: JsonValue): string {
    if (value === null) return '';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'number') return new Intl.NumberFormat('en').format(value);
    if (typeof value === 'string') return cleanReaderText(value);
    if (isReference(value)) {
        const record = getRecord(`${value.recordType}:${value.id}`);
        return record && isReaderFacingRecord(record) ? getRecordName(record) : '';
    }
    if (Array.isArray(value)) {
        const summaries = value.map(summarizeValue).filter(Boolean);
        return summaries.slice(0, 8).join(' · ');
    }

    if (typeof value.description === 'string') return cleanReaderText(value.description);
    if (typeof value.title === 'string') return cleanReaderText(value.title);
    return '';
}

function normalizeReaderText(value: string): string {
    return value
        .replaceAll(/[^a-z0-9]+/giu, ' ')
        .trim()
        .toLocaleLowerCase();
}

function visibleValueText(value: JsonValue): string {
    if (typeof value === 'string') return cleanReaderText(value);
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) {
        return value.flatMap((item) => (typeof item === 'string' ? [cleanReaderText(item)] : [])).join(' ');
    }
    if (!isObject(value)) return '';
    if (typeof value.description === 'string') return cleanReaderText(value.description);
    const rules = readableRules(value);
    return rules.join(' ');
}

export function canPresentValue(value: JsonValue, fieldId = ''): boolean {
    const normalizedFieldId = fieldId.replaceAll(/[-_]/g, '').toLowerCase();
    if (normalizedFieldId.includes('statlines')) return false;
    const isEffectField = normalizedFieldId.includes('effect') || normalizedFieldId.includes('scaling');
    return (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        isReference(value) ||
        asRecommendations(value).length > 0 ||
        readableRules(value).length > 0 ||
        progressionTable(fieldId, value) !== undefined ||
        (fieldId.endsWith('/rarity-scaling') && rarityScalingRows(value).length > 0) ||
        (isEffectField && extractEffectMetrics(value).length > 0) ||
        plainList(value).length > 0 ||
        collectReferences(value).length > 0 ||
        objectSummary(value).length > 0 ||
        summarizeValue(value).length > 0
    );
}

export function ratingOrder(rating: string): number {
    return ['S', 'A', 'B', 'C', 'D'].indexOf(rating.toUpperCase());
}
