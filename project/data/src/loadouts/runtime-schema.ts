import type { JsonObject, JsonValue, RuntimeBoonSample } from "../boons/runtime-schema.js";
import { validateRuntimeTraitSample } from "../boons/runtime-schema.js";

export interface RuntimeLoadoutCost {
  readonly resourceId: string;
  readonly amount: number;
}

export interface RuntimeLoadoutEvidence {
  readonly localizationPath: string;
  readonly runtimePaths: readonly string[];
}

export interface RuntimeKeepsake {
  readonly id: string;
  readonly displayName: string;
  readonly description: string;
  readonly relationshipId: string;
  readonly relationshipName: string;
  readonly acquisitionRequirements: JsonValue;
  readonly chamberThresholds: readonly number[];
  readonly naturalRanks: readonly ["Common", "Rare", "Epic"];
  readonly temporaryBonusRank: "Heroic" | null;
  readonly mechanics: JsonObject;
  readonly rankEffects: readonly RuntimeBoonSample[];
  readonly evidence: RuntimeLoadoutEvidence;
}

export interface RuntimeFamiliarUpgradeRank {
  readonly rank: number;
  readonly itemId: string;
  readonly costs: readonly RuntimeLoadoutCost[];
  readonly requirements: JsonValue;
  readonly runtimePath: string;
}

export interface RuntimeFamiliarUpgrade {
  readonly id: string;
  readonly displayName: string;
  readonly description: string;
  readonly traitId: string;
  readonly ranks: readonly RuntimeFamiliarUpgradeRank[];
  readonly mechanics: JsonObject;
  readonly rankEffects: readonly RuntimeBoonSample[];
  readonly evidence: RuntimeLoadoutEvidence;
}

export interface RuntimeFamiliar {
  readonly id: string;
  readonly displayName: string;
  readonly description: string;
  readonly unlockRequirements: JsonValue;
  readonly mechanics: JsonObject;
  readonly upgrades: readonly RuntimeFamiliarUpgrade[];
  readonly evidence: RuntimeLoadoutEvidence;
}

export interface RuntimeHexTalent {
  readonly id: string;
  readonly category: "Legendary" | "Repeatable" | "Unique";
  readonly displayName: string;
  readonly description: string;
  readonly mechanics: JsonObject;
  readonly effects: readonly RuntimeBoonSample[];
  readonly evidence: RuntimeLoadoutEvidence;
}

export interface RuntimeHex {
  readonly id: string;
  readonly traitId: string;
  readonly displayName: string;
  readonly description: string;
  readonly availabilityRequirements: JsonValue;
  readonly spellData: JsonObject;
  readonly mechanics: JsonObject;
  readonly baseEffects: readonly RuntimeBoonSample[];
  readonly talents: readonly RuntimeHexTalent[];
  readonly evidence: RuntimeLoadoutEvidence;
}

export interface RuntimeIncantation {
  readonly id: string;
  readonly displayName: string;
  readonly description: string;
  readonly automaticUnlock: boolean;
  readonly costs: readonly RuntimeLoadoutCost[];
  readonly unlockRequirements: JsonValue;
  readonly effects: JsonObject;
  readonly evidence: RuntimeLoadoutEvidence;
}

export interface RuntimeLoadoutReport {
  readonly schema: "neodes2-loadout-runtime-1";
  readonly exporterVersion: string;
  readonly generatedAtUnixSeconds: number;
  readonly language: "en";
  readonly game: {
    readonly steamBuildId: string;
    readonly executableVersion: string;
    readonly packageVersion: string;
    readonly acquisitionId: string;
    readonly sourceManifestSha256: string;
  };
  readonly sourceTables: readonly string[];
  readonly localizationFiles: readonly string[];
  readonly keepsakes: readonly RuntimeKeepsake[];
  readonly familiars: readonly RuntimeFamiliar[];
  readonly hexes: readonly RuntimeHex[];
  readonly incantations: readonly RuntimeIncantation[];
  readonly automaticWorldUpgradeIds: readonly string[];
  readonly spellTalentConfiguration: JsonObject;
}

function asRecord(value: unknown, label: string): Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Readonly<Record<string, unknown>>;
}

function asArray(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  return value;
}

function asString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a nonempty string.`);
  }
  return value;
}

function asInteger(value: unknown, label: string, minimum = 0): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${label} must be an integer greater than or equal to ${minimum}.`);
  }
  return value;
}

function asBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${label} must be a boolean.`);
  return value;
}

function asJsonValue(value: unknown, label: string): JsonValue {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`${label} contains a non-finite number.`);
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry, index) => asJsonValue(entry, `${label}[${index}]`));
  }
  const record = asRecord(value, label);
  return Object.fromEntries(
    Object.entries(record).map(([key, entry]) => [key, asJsonValue(entry, `${label}.${key}`)]),
  );
}

function asJsonObject(value: unknown, label: string): JsonObject {
  return asJsonValue(asRecord(value, label), label) as JsonObject;
}

function sortedUniqueStrings(value: unknown, label: string): readonly string[] {
  const values = asArray(value, label).map((entry, index) =>
    asString(entry, `${label}[${index}]`),
  );
  if (new Set(values).size !== values.length) throw new Error(`${label} has duplicates.`);
  if (values.some((entry, index) => entry !== values.toSorted()[index])) {
    throw new Error(`${label} must be sorted.`);
  }
  return values;
}

function validateEvidence(value: unknown, label: string): RuntimeLoadoutEvidence {
  const evidence = asRecord(value, label);
  const runtimePaths = sortedUniqueStrings(evidence.runtimePaths, `${label}.runtimePaths`);
  if (runtimePaths.length === 0) throw new Error(`${label}.runtimePaths must not be empty.`);
  return {
    localizationPath: asString(evidence.localizationPath, `${label}.localizationPath`),
    runtimePaths,
  };
}

function validateCosts(value: unknown, label: string): readonly RuntimeLoadoutCost[] {
  const costs = asArray(value, label).map((entry, index) => {
    const cost = asRecord(entry, `${label}[${index}]`);
    const amount = cost.amount;
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) {
      throw new Error(`${label}[${index}].amount must be a nonnegative finite number.`);
    }
    return {
      resourceId: asString(cost.resourceId, `${label}[${index}].resourceId`),
      amount,
    };
  });
  const ids = costs.map((cost) => cost.resourceId);
  if (new Set(ids).size !== ids.length || ids.some((id, index) => id !== ids.toSorted()[index])) {
    throw new Error(`${label} must have unique costs sorted by resourceId.`);
  }
  return costs;
}

function validateSamples(value: unknown, label: string): readonly RuntimeBoonSample[] {
  return asArray(value, label).map((entry, index) =>
    validateRuntimeTraitSample(entry, `${label}[${index}]`),
  );
}

function validateKeepsake(value: unknown, label: string): RuntimeKeepsake {
  const record = asRecord(value, label);
  const thresholds = asArray(record.chamberThresholds, `${label}.chamberThresholds`).map(
    (entry, index) => asInteger(entry, `${label}.chamberThresholds[${index}]`, 1),
  );
  if (thresholds.length !== 2 || thresholds[0] === undefined || thresholds[1] === undefined || thresholds[0] >= thresholds[1]) {
    throw new Error(`${label}.chamberThresholds must contain two increasing values.`);
  }
  const naturalRanks = asArray(record.naturalRanks, `${label}.naturalRanks`).map((entry, index) =>
    asString(entry, `${label}.naturalRanks[${index}]`),
  );
  if (naturalRanks.join("\u0000") !== "Common\u0000Rare\u0000Epic") {
    throw new Error(`${label}.naturalRanks must be Common, Rare, and Epic.`);
  }
  if (record.temporaryBonusRank !== null && record.temporaryBonusRank !== "Heroic") {
    throw new Error(`${label}.temporaryBonusRank must be Heroic or null.`);
  }
  return {
    id: asString(record.id, `${label}.id`),
    displayName: asString(record.displayName, `${label}.displayName`),
    description: asString(record.description, `${label}.description`),
    relationshipId: asString(record.relationshipId, `${label}.relationshipId`),
    relationshipName: asString(record.relationshipName, `${label}.relationshipName`),
    acquisitionRequirements: asJsonValue(record.acquisitionRequirements, `${label}.acquisitionRequirements`),
    chamberThresholds: thresholds,
    naturalRanks: ["Common", "Rare", "Epic"],
    temporaryBonusRank: record.temporaryBonusRank,
    mechanics: asJsonObject(record.mechanics, `${label}.mechanics`),
    rankEffects: validateSamples(record.rankEffects, `${label}.rankEffects`),
    evidence: validateEvidence(record.evidence, `${label}.evidence`),
  };
}

function validateFamiliarUpgrade(value: unknown, label: string): RuntimeFamiliarUpgrade {
  const record = asRecord(value, label);
  const ranks = asArray(record.ranks, `${label}.ranks`).map((entry, index) => {
    const rank = asRecord(entry, `${label}.ranks[${index}]`);
    const costs = validateCosts(rank.costs, `${label}.ranks[${index}].costs`);
    if (costs.length !== 1 || costs[0]?.resourceId !== "FamiliarPoints" || costs[0].amount !== 1) {
      throw new Error(`${label}.ranks[${index}] must cost one FamiliarPoints resource.`);
    }
    return {
      rank: asInteger(rank.rank, `${label}.ranks[${index}].rank`, 1),
      itemId: asString(rank.itemId, `${label}.ranks[${index}].itemId`),
      costs,
      requirements: asJsonValue(rank.requirements, `${label}.ranks[${index}].requirements`),
      runtimePath: asString(rank.runtimePath, `${label}.ranks[${index}].runtimePath`),
    };
  });
  if (ranks.length !== 3 || ranks.some((rank, index) => rank.rank !== index + 1)) {
    throw new Error(`${label}.ranks must contain ranks 1 through 3.`);
  }
  return {
    id: asString(record.id, `${label}.id`),
    displayName: asString(record.displayName, `${label}.displayName`),
    description: asString(record.description, `${label}.description`),
    traitId: asString(record.traitId, `${label}.traitId`),
    ranks,
    mechanics: asJsonObject(record.mechanics, `${label}.mechanics`),
    rankEffects: validateSamples(record.rankEffects, `${label}.rankEffects`),
    evidence: validateEvidence(record.evidence, `${label}.evidence`),
  };
}

function validateFamiliar(value: unknown, label: string): RuntimeFamiliar {
  const record = asRecord(value, label);
  const upgrades = asArray(record.upgrades, `${label}.upgrades`).map((entry, index) =>
    validateFamiliarUpgrade(entry, `${label}.upgrades[${index}]`),
  );
  if (upgrades.length !== 3) throw new Error(`${label}.upgrades must contain three tracks.`);
  return {
    id: asString(record.id, `${label}.id`),
    displayName: asString(record.displayName, `${label}.displayName`),
    description: asString(record.description, `${label}.description`),
    unlockRequirements: asJsonValue(record.unlockRequirements, `${label}.unlockRequirements`),
    mechanics: asJsonObject(record.mechanics, `${label}.mechanics`),
    upgrades,
    evidence: validateEvidence(record.evidence, `${label}.evidence`),
  };
}

function validateHexTalent(value: unknown, label: string): RuntimeHexTalent {
  const record = asRecord(value, label);
  if (record.category !== "Legendary" && record.category !== "Repeatable" && record.category !== "Unique") {
    throw new Error(`${label}.category is unsupported.`);
  }
  return {
    id: asString(record.id, `${label}.id`),
    category: record.category,
    displayName: asString(record.displayName, `${label}.displayName`),
    description: asString(record.description, `${label}.description`),
    mechanics: asJsonObject(record.mechanics, `${label}.mechanics`),
    effects: validateSamples(record.effects, `${label}.effects`),
    evidence: validateEvidence(record.evidence, `${label}.evidence`),
  };
}

function validateHex(value: unknown, label: string): RuntimeHex {
  const record = asRecord(value, label);
  const talents = asArray(record.talents, `${label}.talents`).map((entry, index) =>
    validateHexTalent(entry, `${label}.talents[${index}]`),
  );
  const talentIds = talents.map((talent) => talent.id);
  if (talents.length === 0 || new Set(talentIds).size !== talentIds.length || talentIds.some((id, index) => id !== talentIds.toSorted()[index])) {
    throw new Error(`${label}.talents must be nonempty, unique, and sorted by id.`);
  }
  return {
    id: asString(record.id, `${label}.id`),
    traitId: asString(record.traitId, `${label}.traitId`),
    displayName: asString(record.displayName, `${label}.displayName`),
    description: asString(record.description, `${label}.description`),
    availabilityRequirements: asJsonValue(record.availabilityRequirements, `${label}.availabilityRequirements`),
    spellData: asJsonObject(record.spellData, `${label}.spellData`),
    mechanics: asJsonObject(record.mechanics, `${label}.mechanics`),
    baseEffects: validateSamples(record.baseEffects, `${label}.baseEffects`),
    talents,
    evidence: validateEvidence(record.evidence, `${label}.evidence`),
  };
}

function validateIncantation(value: unknown, label: string): RuntimeIncantation {
  const record = asRecord(value, label);
  return {
    id: asString(record.id, `${label}.id`),
    displayName: asString(record.displayName, `${label}.displayName`),
    description: asString(record.description, `${label}.description`),
    automaticUnlock: asBoolean(record.automaticUnlock, `${label}.automaticUnlock`),
    costs: validateCosts(record.costs, `${label}.costs`),
    unlockRequirements: asJsonValue(record.unlockRequirements, `${label}.unlockRequirements`),
    effects: asJsonObject(record.effects, `${label}.effects`),
    evidence: validateEvidence(record.evidence, `${label}.evidence`),
  };
}

function validateSortedUniqueIds<T extends { readonly id: string }>(records: readonly T[], label: string): void {
  const ids = records.map((record) => record.id);
  if (new Set(ids).size !== ids.length || ids.some((id, index) => id !== ids.toSorted()[index])) {
    throw new Error(`${label} must have unique records sorted by id.`);
  }
}

export function validateRuntimeLoadoutReport(value: unknown): RuntimeLoadoutReport {
  const report = asRecord(value, "runtime loadout report");
  const game = asRecord(report.game, "runtime loadout report.game");
  const keepsakes = asArray(report.keepsakes, "runtime loadout report.keepsakes").map((entry, index) =>
    validateKeepsake(entry, `runtime loadout report.keepsakes[${index}]`),
  );
  const familiars = asArray(report.familiars, "runtime loadout report.familiars").map((entry, index) =>
    validateFamiliar(entry, `runtime loadout report.familiars[${index}]`),
  );
  const hexes = asArray(report.hexes, "runtime loadout report.hexes").map((entry, index) =>
    validateHex(entry, `runtime loadout report.hexes[${index}]`),
  );
  const incantations = asArray(report.incantations, "runtime loadout report.incantations").map((entry, index) =>
    validateIncantation(entry, `runtime loadout report.incantations[${index}]`),
  );
  validateSortedUniqueIds(keepsakes, "runtime loadout report.keepsakes");
  validateSortedUniqueIds(hexes, "runtime loadout report.hexes");
  validateSortedUniqueIds(incantations, "runtime loadout report.incantations");
  if (keepsakes.length !== 33) throw new Error("runtime loadout report must contain 33 keepsakes.");
  if (familiars.length !== 5 || new Set(familiars.map((familiar) => familiar.id)).size !== 5) {
    throw new Error("runtime loadout report must contain five unique Familiars.");
  }
  if (hexes.length !== 9) throw new Error("runtime loadout report must contain nine Hexes.");
  const automaticWorldUpgradeIds = sortedUniqueStrings(
    report.automaticWorldUpgradeIds,
    "runtime loadout report.automaticWorldUpgradeIds",
  );
  const incantationsById = new Map(incantations.map((incantation) => [incantation.id, incantation]));
  for (const id of automaticWorldUpgradeIds) {
    const incantation = incantationsById.get(id);
    if (incantation === undefined || !incantation.automaticUnlock) {
      throw new Error(`Automatic world upgrade ${id} is missing or not marked automatic.`);
    }
  }
  for (const incantation of incantations) {
    if (incantation.automaticUnlock !== automaticWorldUpgradeIds.includes(incantation.id)) {
      throw new Error(`Incantation ${incantation.id} disagrees with the automatic unlock list.`);
    }
  }
  return {
    schema:
      report.schema === "neodes2-loadout-runtime-1"
        ? report.schema
        : (() => { throw new Error("runtime loadout report.schema is unsupported."); })(),
    exporterVersion: asString(report.exporterVersion, "runtime loadout report.exporterVersion"),
    generatedAtUnixSeconds: asInteger(report.generatedAtUnixSeconds, "runtime loadout report.generatedAtUnixSeconds"),
    language:
      report.language === "en"
        ? report.language
        : (() => { throw new Error("runtime loadout report.language must be en."); })(),
    game: {
      steamBuildId: asString(game.steamBuildId, "runtime loadout report.game.steamBuildId"),
      executableVersion: asString(game.executableVersion, "runtime loadout report.game.executableVersion"),
      packageVersion: asString(game.packageVersion, "runtime loadout report.game.packageVersion"),
      acquisitionId: asString(game.acquisitionId, "runtime loadout report.game.acquisitionId"),
      sourceManifestSha256: asString(game.sourceManifestSha256, "runtime loadout report.game.sourceManifestSha256"),
    },
    sourceTables: sortedUniqueStrings(report.sourceTables, "runtime loadout report.sourceTables"),
    localizationFiles: sortedUniqueStrings(report.localizationFiles, "runtime loadout report.localizationFiles"),
    keepsakes,
    familiars,
    hexes,
    incantations,
    automaticWorldUpgradeIds,
    spellTalentConfiguration: asJsonObject(report.spellTalentConfiguration, "runtime loadout report.spellTalentConfiguration"),
  };
}
