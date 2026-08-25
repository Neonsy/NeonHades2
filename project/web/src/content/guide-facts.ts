import { getField, getRecord, type JsonValue, type PublicationRecord } from '../lib/publication';

type JsonObject = Record<string, JsonValue>;

function requireRecord(recordType: string, id: string): PublicationRecord {
    const key = `${recordType}:${id}`;
    const record = getRecord(key);
    if (!record) throw new Error(`Guide fact source is missing: ${key}`);
    return record;
}

function requireObject(value: JsonValue | undefined, source: string): JsonObject {
    if (value === null || value === undefined || Array.isArray(value) || typeof value !== 'object') {
        throw new Error(`Guide fact source must be an object: ${source}`);
    }
    return value;
}

function requireString(value: JsonValue | undefined, source: string): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new Error(`Guide fact source must be a non-empty string: ${source}`);
    }
    return value;
}

function requireStringArray(value: JsonValue | undefined, source: string): string[] {
    if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== 'string')) {
        throw new Error(`Guide fact source must be a non-empty string array: ${source}`);
    }
    return value as string[];
}

function requireRules(recordType: string, id: string, fieldId: string): string[] {
    const record = requireRecord(recordType, id);
    const field = requireObject(getField(record, fieldId), `${record.key}/${fieldId}`);
    return requireStringArray(field.rules, `${record.key}/${fieldId}/rules`);
}

function requireGodAvailability(id: string): string {
    const record = requireRecord('mechanics/god', id);
    const availability = requireObject(
        getField(record, 'mechanics/god/availability'),
        `${record.key}/mechanics/god/availability`
    );
    return requireStringArray(availability.rules, `${record.key}/mechanics/god/availability/rules`).join(' ');
}

function requireRarifyUses(record: PublicationRecord): number {
    const effects = requireObject(
        getField(record, 'mechanics/keepsake/rank-effects'),
        `${record.key}/mechanics/keepsake/rank-effects`
    );
    if (!Array.isArray(effects.rankEffects) || effects.rankEffects.length === 0) {
        throw new Error(`Guide fact source has no keepsake rank effects: ${record.key}`);
    }

    const uses = new Set<number>();
    for (const effectValue of effects.rankEffects) {
        const effect = requireObject(effectValue, `${record.key}/mechanics/keepsake/rank-effects/rankEffects`);
        const result = requireObject(effect.result, `${record.key}/mechanics/keepsake/rank-effects/result`);
        if (!Array.isArray(result.values)) continue;
        for (const sampleValue of result.values) {
            const sample = requireObject(sampleValue, `${record.key}/mechanics/keepsake/rank-effects/result/values`);
            if (sample.id !== 'Uses') continue;
            const resolution = requireObject(
                sample.resolution,
                `${record.key}/mechanics/keepsake/rank-effects/result/values/Uses/resolution`
            );
            if (typeof resolution.value === 'number' && Number.isInteger(resolution.value)) {
                uses.add(resolution.value);
            }
        }
    }

    if (uses.size !== 1) {
        throw new Error(`Guide fact source must resolve one consistent Rarify use count: ${record.key}`);
    }
    return [...uses][0] as number;
}

const harmonicPhoton = requireRecord('mechanics/keepsake', 'ForceApolloBoonKeepsake');
const harmonicPhotonPriority = requireObject(
    getField(harmonicPhoton, 'mechanics/keepsake/leveling-priority'),
    `${harmonicPhoton.key}/mechanics/keepsake/leveling-priority`
);
const harmonicPhotonSwitch = requireString(
    harmonicPhotonPriority.switchWhenInactive,
    `${harmonicPhoton.key}/mechanics/keepsake/leveling-priority/switchWhenInactive`
);
const harmonicPhotonRarifyUses = requireRarifyUses(harmonicPhoton);
const switchMentionsRarify = /Rarify/iu.test(harmonicPhotonSwitch);

if (
    !/god offer is consumed/iu.test(harmonicPhotonSwitch) ||
    (harmonicPhotonRarifyUses > 0 && !switchMentionsRarify) ||
    (harmonicPhotonRarifyUses === 0 && switchMentionsRarify)
) {
    throw new Error('Harmonic Photon guide policy does not match its acquired forced-offer and Rarify-use data.');
}

const argentSkullRules = requireRules('mechanics/weapon', 'WeaponLob', 'mechanics/weapon/unlock-requirements');
const blackCoatRules = requireRules('mechanics/weapon', 'WeaponSuit', 'mechanics/weapon/unlock-requirements');

function requireCurrentNightRule(rules: readonly string[], source: string): string {
    const rule = rules.find((candidate) => /current night/iu.test(candidate));
    if (!rule) throw new Error(`Guide fact source has no current-night reveal rule: ${source}`);
    return rule;
}

export const guideFacts = {
    harmonicPhoton: {
        switchCondition: harmonicPhotonSwitch,
        shortSwitch:
            harmonicPhotonRarifyUses === 0
                ? 'Use Harmonic Photon until its Apollo offer is consumed.'
                : `Use Harmonic Photon until its Apollo offer and ${harmonicPhotonRarifyUses === 1 ? 'Rarify charge are' : `${harmonicPhotonRarifyUses} Rarify charges are`} spent.`,
    },
    hephaestus: {
        availability: requireGodAvailability('HephaestusUpgrade'),
    },
    argentSkull: {
        unlockRequirements: argentSkullRules.join(' '),
        currentNightRule: requireCurrentNightRule(argentSkullRules, 'mechanics/weapon:WeaponLob'),
    },
    blackCoat: {
        unlockRequirements: blackCoatRules.join(' '),
        currentNightRule: requireCurrentNightRule(blackCoatRules, 'mechanics/weapon:WeaponSuit'),
    },
    stormStop: {
        unlockRequirements: requireRules(
            'mechanics/incantation',
            'WorldUpgradeStormStop',
            'mechanics/incantation/unlock-requirements'
        ).join(' '),
    },
    incantations: {
        revealPolicy: requireRules(
            'mechanics/incantation',
            'WorldUpgradeQuestLog',
            'mechanics/incantation/availability'
        ).join(' '),
    },
} as const;
