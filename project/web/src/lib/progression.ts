import type { JsonValue, PublicationField } from './publication';

export type ProgressionReference = {
    id: string;
    recordType: string;
};

export type ProgressionCost = {
    amount: number;
    resource: ProgressionReference;
};

export type ProgressionMetric = {
    name: string;
    note?: string;
    value: string;
};

export type ProgressionRow = {
    costs: ProgressionCost[];
    effects: ProgressionMetric[];
    label: string;
    note?: string;
};

export type ProgressionTable = {
    kind: 'rows';
    rows: ProgressionRow[];
};

export type ProgressionMatrixRow = {
    label: string;
    values: Record<string, ProgressionMetric[]>;
};

export type ProgressionMatrix = {
    columns: string[];
    kind: 'matrix';
    rows: ProgressionMatrixRow[];
};

export type AnyProgressionTable = ProgressionTable | ProgressionMatrix;

function isObject(value: JsonValue | undefined): value is Record<string, JsonValue> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isReference(value: JsonValue | undefined): value is ProgressionReference & Record<string, JsonValue> {
    return isObject(value) && typeof value.id === 'string' && typeof value.recordType === 'string';
}

function costs(value: JsonValue | undefined): ProgressionCost[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
        if (!isObject(item) || typeof item.amount !== 'number' || !isReference(item.resource)) return [];
        return [{ amount: item.amount, resource: { id: item.resource.id, recordType: item.resource.recordType } }];
    });
}

function metricLabel(id: string): string {
    const labels: Record<string, string> = {
        EchoDuration: 'Blitz duration',
        EchoThreshold: 'Damage needed to trigger Blitz',
        TooltipDamage: 'Damage',
        TooltipDuration: 'Duration',
        TooltipSpeed: 'Speed boost',
        TooltipChance: 'Chance',
        TooltipHealth: 'Life',
        TooltipMana: 'Magick',
        TooltipRange: 'Range',
    };
    if (labels[id]) return labels[id];
    return id
        .replace(/^Tooltip/u, '')
        .replace(/([a-z])([A-Z])/gu, '$1 $2')
        .replaceAll('_', ' ')
        .trim();
}

function reportedSourceLabel(entry: Record<string, JsonValue>): string | undefined {
    if (!isObject(entry.source) || typeof entry.source.key !== 'string') return undefined;
    const labels: Record<string, string> = {
        ReportedAoEIncrease: 'Area increase',
        ReportedCount: 'Count',
        ReportedDamage: 'Damage',
        ReportedDuration: 'Duration',
        ReportedHits: 'Hits',
        PostBossCardRarity: 'Arcana rank',
    };
    return labels[entry.source.key];
}

function hasStaticDamageBase(entry: Record<string, JsonValue>): boolean {
    return (
        Array.isArray(entry.staticInputs) &&
        entry.staticInputs.some(
            (input) => isObject(input) && input.baseProperty === 'Damage' && typeof input.value === 'number'
        )
    );
}

function progressionMetricName(entry: Record<string, JsonValue>): string {
    if (
        entry.id === 'Damage' &&
        Array.isArray(entry.staticInputs) &&
        entry.staticInputs.some((input) => isObject(input) && input.baseName === 'ZeusEchoStrike')
    ) {
        return 'Blitz damage';
    }
    return reportedSourceLabel(entry) ?? metricLabel(String(entry.id));
}

function formatValue(value: string | number): string {
    if (typeof value === 'string') {
        const metaRank = /^MetaRank(\d+)$/u.exec(value);
        if (metaRank) {
            const rank = Number(metaRank[1]);
            const romanRanks = ['I', 'II', 'III', 'IV', 'V'];
            return `Rank ${romanRanks[rank - 1] ?? String(rank)}`;
        }
    }
    return typeof value === 'number' ? new Intl.NumberFormat('en', { maximumFractionDigits: 3 }).format(value) : value;
}

function isPercentageMetric(entry: Record<string, JsonValue>): boolean {
    if (!isObject(entry.source) || typeof entry.source.key !== 'string') return false;
    if (hasStaticDamageBase(entry)) return false;
    return new Set([
        'CastChargeSpeedMultiplier',
        'DamageTakenMultiplier',
        'ReportedChance',
        'ReportedChange',
        'ReportedDamageBonus',
        'ReportedDamageMultiplier',
        'ReportedMultiplier',
        'ReportedSpeed',
        'ReportedSpeedIncrease',
        'ReportedWeaponMultiplier',
    ]).has(entry.source.key);
}

function contextualMetricValue(entry: Record<string, JsonValue>): string | undefined {
    if (!isObject(entry.resolution) || entry.resolution.kind !== 'contextual' || !isObject(entry.source))
        return undefined;
    if (entry.id === 'CurrentHeroDamage' && entry.source.kind === 'context-value') {
        return 'Depends on damage taken';
    }

    if (entry.source.kind === 'processed-trait-variants' && Array.isArray(entry.source.variants)) {
        const values = entry.source.variants.flatMap((variant) =>
            isObject(variant) && typeof variant.value === 'number' ? [variant.value] : []
        );
        if (values.length === 0) return undefined;
        const expression = typeof entry.resolution.expression === 'string' ? entry.resolution.expression : '';
        if (expression === 'round(((value - 1) * 100), 0)') {
            const range = values.map((item) => Math.round((item - 1) * 100));
            const minimum = Math.min(...range);
            const maximum = Math.max(...range);
            return minimum === maximum ? `${minimum}% by weapon` : `${minimum}% to ${maximum}% by weapon`;
        }
        const minimum = Math.min(...values);
        const maximum = Math.max(...values);
        return minimum === maximum
            ? `${formatValue(minimum)} by weapon`
            : `${formatValue(minimum)} to ${formatValue(maximum)} by weapon`;
    }

    const sourceValue = entry.source.value;
    if (typeof sourceValue !== 'number' && typeof sourceValue !== 'string') return undefined;
    if (typeof sourceValue === 'string') return `${sourceValue} base`;
    const expression = typeof entry.resolution.expression === 'string' ? entry.resolution.expression : '';
    const inputIds = Array.isArray(entry.resolution.inputIds)
        ? entry.resolution.inputIds.filter((input): input is string => typeof input === 'string')
        : [];
    const percentageExpression = /(?:\*\s*100|100\s*\*)/u.test(expression);
    if (expression.includes('(value - 1)') && percentageExpression) {
        const modifier = inputIds[0] === 'UniqueGodCount' ? 'Olympian' : 'modifier';
        return `${formatValue((sourceValue - 1) * 100)}% per ${modifier}`;
    }
    if (percentageExpression && Math.abs(sourceValue) <= 1) {
        return `${formatValue(sourceValue * 100)}% before ${inputIds.includes('LuckMultiplier') ? 'Luck' : 'other modifiers'}`;
    }
    return `${formatValue(sourceValue)} base`;
}

function metrics(value: JsonValue | undefined): ProgressionMetric[] {
    if (!isObject(value) || !isObject(value.result) || !Array.isArray(value.result.values)) return [];
    return value.result.values.flatMap((entry) => {
        if (!isObject(entry) || typeof entry.id !== 'string' || !isObject(entry.resolution)) return [];
        const resolved = entry.resolution.kind === 'resolved' ? entry.resolution.value : undefined;
        const contextual = contextualMetricValue(entry);
        const hasResolvedValue = typeof resolved === 'number' || typeof resolved === 'string';
        const name = progressionMetricName(entry);
        if (hasResolvedValue) {
            const renderedValue = formatValue(resolved);
            return [
                {
                    name,
                    value:
                        typeof resolved === 'number' && isPercentageMetric(entry) ? `${renderedValue}%` : renderedValue,
                },
            ];
        }
        return contextual === undefined ? [] : [{ name, value: contextual }];
    });
}

function effectRows(value: JsonValue | undefined): Map<string, ProgressionMetric[]> {
    const rows = new Map<string, ProgressionMetric[]>();
    if (!Array.isArray(value)) return rows;
    for (const entry of value) {
        if (!isObject(entry) || typeof entry.rarity !== 'string') continue;
        const values = metrics(entry);
        if (values.length > 0) rows.set(entry.rarity, values);
    }
    return rows;
}

function collapseMatchingEndpointMetrics(items: ProgressionMetric[]): ProgressionMetric[] {
    const collapsed = new Map<string, ProgressionMetric>();
    for (const item of items) {
        const key = `${item.name}\u0000${item.value}`;
        const existing = collapsed.get(key);
        if (existing) {
            existing.note = undefined;
        } else {
            collapsed.set(key, { ...item });
        }
    }
    return [...collapsed.values()];
}

function rankRows(value: JsonValue, effectValue?: JsonValue): ProgressionTable | undefined {
    if (!Array.isArray(value)) return undefined;
    const effects = effectRows(effectValue);
    const rows = value.flatMap((entry) => {
        if (!isObject(entry) || typeof entry.rank !== 'number') return [];
        const rarity = typeof entry.rarity === 'string' ? entry.rarity : undefined;
        return [
            {
                costs: costs(entry.costs),
                effects: rarity ? (effects.get(rarity) ?? []) : [],
                label: `Rank ${entry.rank}`,
                note: rarity,
            },
        ];
    });
    return rows.length > 0 ? { kind: 'rows', rows } : undefined;
}

function rankCostsAndEffects(value: JsonValue): ProgressionTable | undefined {
    if (!isObject(value) || !Array.isArray(value.ranks)) return undefined;
    const effects = effectRows(value.rankEffects);
    const rows: ProgressionRow[] = [];
    const unlockCosts = costs(value.unlockCosts);
    if (unlockCosts.length > 0) rows.push({ costs: unlockCosts, effects: [], label: 'Unlock' });
    for (const entry of value.ranks) {
        if (!isObject(entry) || typeof entry.rank !== 'number') continue;
        const rarity = typeof entry.rarity === 'string' ? entry.rarity : undefined;
        rows.push({
            costs: costs(entry.upgradeFromPreviousCosts),
            effects: rarity ? (effects.get(rarity) ?? []) : [],
            label: `Rank ${entry.rank}`,
            note: rarity,
        });
    }
    return rows.length > 0 ? { kind: 'rows', rows } : undefined;
}

function keepsakeRanks(value: JsonValue): ProgressionTable | undefined {
    if (!isObject(value) || !Array.isArray(value.rankEffects)) return undefined;
    const thresholds = Array.isArray(value.chamberThresholds)
        ? value.chamberThresholds.filter((threshold): threshold is number => typeof threshold === 'number')
        : [];
    const rarityOrder = new Map([
        ['Common', 0],
        ['Rare', 1],
        ['Epic', 2],
    ]);
    const orderedEffects = value.rankEffects
        .filter((entry): entry is Record<string, JsonValue> => isObject(entry) && typeof entry.rarity === 'string')
        .sort((a, b) => (rarityOrder.get(String(a.rarity)) ?? 99) - (rarityOrder.get(String(b.rarity)) ?? 99));
    const rows = orderedEffects.flatMap((entry, index) => {
        if (!isObject(entry) || typeof entry.rarity !== 'string') return [];
        const chamberThreshold = index > 0 ? thresholds[index - 1] : undefined;
        return [
            {
                costs: [],
                effects: metrics(entry),
                label: `Rank ${index + 1}`,
                note: [entry.rarity, chamberThreshold ? `after ${chamberThreshold} chambers` : '']
                    .filter(Boolean)
                    .join(', '),
            },
        ];
    });
    return rows.length > 0 ? { kind: 'rows', rows } : undefined;
}

function boonLevels(value: JsonValue): ProgressionMatrix | undefined {
    if (!Array.isArray(value)) return undefined;
    const grouped = new Map<number, Map<string, ProgressionMetric[]>>();
    for (const entry of value) {
        if (!isObject(entry) || typeof entry.level !== 'number' || typeof entry.rarity !== 'string') continue;
        const endpoint = typeof entry.endpoint === 'string' && entry.endpoint !== 'fixed' ? entry.endpoint : undefined;
        const byRarity = grouped.get(entry.level) ?? new Map<string, ProgressionMetric[]>();
        const values = byRarity.get(entry.rarity) ?? [];
        values.push(...metrics(entry).map((metric) => ({ ...metric, note: endpoint })));
        byRarity.set(entry.rarity, values);
        grouped.set(entry.level, byRarity);
    }
    const rarityOrder = ['Common', 'Rare', 'Epic', 'Heroic', 'Legendary', 'Duo'];
    const columns = [...new Set([...grouped.values()].flatMap((row) => [...row.keys()]))].sort(
        (a, b) => rarityOrder.indexOf(a) - rarityOrder.indexOf(b)
    );
    const rows = [...grouped.entries()]
        .sort(([a], [b]) => a - b)
        .map(([level, values]) => ({
            label: `Level ${level}`,
            values: Object.fromEntries(
                [...values].map(([rarity, items]) => [rarity, collapseMatchingEndpointMetrics(items)])
            ),
        }));
    return rows.length > 0 && columns.length > 0 ? { columns, kind: 'matrix', rows } : undefined;
}

function graspStart(value: JsonValue): ProgressionTable | undefined {
    if (!isObject(value) || typeof value.startingCapacity !== 'number') return undefined;
    return {
        kind: 'rows',
        rows: [
            {
                costs: [],
                effects: [{ name: 'Capacity', value: formatValue(value.startingCapacity) }],
                label: 'Starting capacity',
            },
        ],
    };
}

function graspUpgrades(value: JsonValue): ProgressionTable | undefined {
    if (!Array.isArray(value)) return undefined;
    const rows = value.flatMap((entry) => {
        if (!isObject(entry) || typeof entry.level !== 'number' || typeof entry.cumulativeCapacity !== 'number')
            return [];
        const increase =
            typeof entry.capacityIncrease === 'number' ? `+${formatValue(entry.capacityIncrease)}` : undefined;
        return [
            {
                costs: costs(entry.costs),
                effects: [
                    { name: 'Capacity', value: formatValue(entry.cumulativeCapacity) },
                    ...(increase ? [{ name: 'Increase', value: increase }] : []),
                ],
                label: `Level ${entry.level}`,
            },
        ];
    });
    return rows.length > 0 ? { kind: 'rows', rows } : undefined;
}

export function progressionTable(
    fieldId: string,
    value: JsonValue,
    effectValue?: JsonValue
): AnyProgressionTable | undefined {
    const suffix = fieldId.split('/').at(-1);
    switch (suffix) {
        case 'rank-costs-effects':
            return rankCostsAndEffects(value);
        case 'rank-effects':
            return keepsakeRanks(value);
        case 'rank-costs':
            return rankRows(value, effectValue);
        case 'level-scaling':
            return boonLevels(value);
        case 'starting-capacity':
            return graspStart(value);
        case 'upgrade-series':
            return graspUpgrades(value);
        default:
            return undefined;
    }
}

function readerStrings(value: JsonValue, key = ''): string[] {
    const allowed = new Set(['description', 'displayName', 'name', 'rarity', 'endpoint']);
    if (typeof value === 'string') {
        if (!allowed.has(key) || /^MetaRank\d+$/u.test(value)) return [];
        return [value];
    }
    if (Array.isArray(value)) return value.flatMap((item) => readerStrings(item, key));
    if (!isObject(value)) return [];
    return Object.entries(value).flatMap(([childKey, child]) => readerStrings(child, childKey));
}

export function publicProgressionSearchTerms(
    recordType: string,
    fields: readonly PublicationField[],
    resourceLabel: (reference: ProgressionReference) => string | undefined = () => undefined
): string[] {
    const suffixes = new Set(fields.map((field) => field.id.split('/').at(-1)));
    const terms = new Set<string>();
    const add = (...values: string[]) => values.forEach((value) => value && terms.add(value));
    if (suffixes.has('rank-costs-effects')) add('Arcana ranks', 'Arcana upgrade costs', 'Arcana rank effects');
    if (suffixes.has('rank-effects') && recordType === 'mechanics/keepsake') {
        add('Keepsake ranks', 'Keepsake upgrade effects');
    }
    if (suffixes.has('rank-costs') && recordType === 'mechanics/weapon-aspect') {
        add('Aspect ranks', 'Aspect upgrade costs', 'Rank V');
    }
    if (suffixes.has('level-scaling')) add('Pom scaling', 'Boon levels', 'Boon rarity');
    if (suffixes.has('rarity-scaling')) add('Boon rarity', 'Rarity multipliers');
    if (suffixes.has('starting-capacity') || suffixes.has('upgrade-series')) add('Grasp capacity', 'Grasp upgrades');
    if (suffixes.has('abilities-upgrades')) add('Familiar bonds', 'Familiar upgrades');
    if (suffixes.has('level-costs') && recordType === 'mechanics/gathering-tool')
        add('Tool upgrades', 'Gathering tool upgrades');
    if (suffixes.has('path-upgrades')) add('Hex Path upgrades', 'Path of Stars upgrades');
    if (recordType === 'world-progression/oath-condition') add('Oath ranks', 'Fear ranks');
    if (recordType === 'mechanics/incantation') add('Incantation costs', 'Cauldron upgrades');
    const rankEffects = fields.find((field) => field.id.endsWith('/rank-effects'))?.value;
    const searchableProgressionFields = new Set([
        'abilities-upgrades',
        'level-costs',
        'level-scaling',
        'path-upgrades',
        'rank-costs',
        'rank-costs-effects',
        'rank-effects',
        'rarity-scaling',
        'starting-capacity',
        'upgrade-series',
    ]);
    for (const field of fields) {
        const suffix = field.id.split('/').at(-1) ?? '';
        const isIncantationField =
            recordType === 'mechanics/incantation' && (suffix === 'costs' || suffix === 'effects');
        if (!searchableProgressionFields.has(suffix) && !isIncantationField) continue;
        for (const text of readerStrings(field.value)) add(text);
        const table = progressionTable(field.id, field.value, rankEffects);
        if (!table) continue;
        if (table.kind === 'matrix') {
            for (const row of table.rows) {
                add(row.label);
                for (const [rarity, effects] of Object.entries(row.values)) {
                    add(rarity);
                    for (const effect of effects) {
                        add(
                            effect.name,
                            effect.value,
                            `${effect.name} ${effect.value}`,
                            `${effect.value} ${effect.name}`
                        );
                    }
                }
            }
        } else {
            for (const row of table.rows) {
                add(row.label, row.note ?? '');
                for (const effect of row.effects) {
                    add(effect.name, effect.value, `${effect.name} ${effect.value}`, `${effect.value} ${effect.name}`);
                }
                for (const cost of row.costs) {
                    const resource = resourceLabel(cost.resource);
                    add(String(cost.amount), resource ?? '', resource ? `${cost.amount} ${resource}` : '');
                }
            }
        }
    }
    return [...terms];
}
