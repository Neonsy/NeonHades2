import type {
  JsonObject,
  JsonValue,
  RuntimeBoonSample,
} from "../boons/runtime-schema.js";
import { validateRuntimeTraitSample } from "../boons/runtime-schema.js";

export interface RuntimeCost {
  readonly resourceId: string;
  readonly amount: number;
}

export interface RuntimeEvidence {
  readonly localizationPath: string;
  readonly runtimePaths: readonly string[];
}

export interface RuntimeWeapon {
  readonly id: string;
  readonly displayName: string;
  readonly description: string;
  readonly unlockCosts: readonly RuntimeCost[];
  readonly unlockRequirements: JsonValue;
  readonly linkedWeaponIds: readonly string[];
  readonly linkedIdsWithoutWeaponData: readonly string[];
  readonly weaponDataIds: readonly string[];
  readonly weaponData: JsonObject;
  readonly attackPatternObservationRequired: true;
  readonly evidence: RuntimeEvidence;
}

export interface RuntimeAspectRank {
  readonly rank: number;
  readonly rarity: string;
  readonly shopItemId: string | null;
  readonly costs: readonly RuntimeCost[];
  readonly requirements: JsonValue;
  readonly runtimePath: string;
}

export interface RuntimeAspect {
  readonly id: string;
  readonly weaponId: string;
  readonly displayName: string;
  readonly description: string;
  readonly baseAspect: boolean;
  readonly ranks: readonly RuntimeAspectRank[];
  readonly mechanics: JsonObject;
  readonly samples: readonly RuntimeBoonSample[];
  readonly evidence: RuntimeEvidence;
}

export interface RuntimeHammerCompatibility {
  readonly allowedAspectIds: readonly string[];
  readonly excludedAspectIds: readonly string[];
  readonly requiredAspectIds: readonly string[];
  readonly incompatibleHammerIds: readonly string[];
}

export interface RuntimeHammer {
  readonly id: string;
  readonly weaponId: string;
  readonly displayName: string;
  readonly description: string;
  readonly requirements: JsonValue;
  readonly compatibility: RuntimeHammerCompatibility;
  readonly mechanics: JsonObject;
  readonly samples: readonly RuntimeBoonSample[];
  readonly evidence: RuntimeEvidence;
}

export interface RuntimeWeaponReport {
  readonly schema: "neodes2-weapon-runtime-1";
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
  readonly weapons: readonly RuntimeWeapon[];
  readonly aspects: readonly RuntimeAspect[];
  readonly hammers: readonly RuntimeHammer[];
}

function asRecord(value: unknown, label: string): Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Readonly<Record<string, unknown>>;
}

function asArray(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }
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
  if (typeof value !== "boolean") {
    throw new Error(`${label} must be a boolean.`);
  }
  return value;
}

function asLiteral<const Value extends string>(
  value: unknown,
  label: string,
  allowed: readonly Value[],
): Value {
  if (typeof value !== "string" || !allowed.includes(value as Value)) {
    throw new Error(`${label} must be ${allowed.join(" or ")}.`);
  }
  return value as Value;
}

function asJsonValue(value: unknown, label: string): JsonValue {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`${label} contains a non-finite number.`);
    }
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
  const strings = asArray(value, label).map((entry, index) =>
    asString(entry, `${label}[${index}]`),
  );
  if (new Set(strings).size !== strings.length) {
    throw new Error(`${label} must not contain duplicates.`);
  }
  if (strings.some((entry, index) => entry !== strings.toSorted()[index])) {
    throw new Error(`${label} must be sorted.`);
  }
  return strings;
}

function validateCosts(value: unknown, label: string): readonly RuntimeCost[] {
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
  const resourceIds = costs.map((cost) => cost.resourceId);
  if (new Set(resourceIds).size !== resourceIds.length) {
    throw new Error(`${label} must not repeat a resource.`);
  }
  if (resourceIds.some((id, index) => id !== resourceIds.toSorted()[index])) {
    throw new Error(`${label} must be sorted by resourceId.`);
  }
  return costs;
}

function validateEvidence(value: unknown, label: string): RuntimeEvidence {
  const evidence = asRecord(value, label);
  return {
    localizationPath: asString(evidence.localizationPath, `${label}.localizationPath`),
    runtimePaths: sortedUniqueStrings(evidence.runtimePaths, `${label}.runtimePaths`),
  };
}

function validateSamples(value: unknown, label: string): readonly RuntimeBoonSample[] {
  const samples = asArray(value, label).map((entry, index) =>
    validateRuntimeTraitSample(entry, `${label}[${index}]`),
  );
  const keys = samples.map(
    (sample) => `${sample.rarity}\u0000${sample.endpoint}\u0000${sample.level}`,
  );
  if (new Set(keys).size !== keys.length) {
    throw new Error(`${label} must not repeat a rarity, endpoint, and level.`);
  }
  return samples;
}

function validateWeapon(value: unknown, label: string): RuntimeWeapon {
  const weapon = asRecord(value, label);
  const id = asString(weapon.id, `${label}.id`);
  const linkedWeaponIds = sortedUniqueStrings(
    weapon.linkedWeaponIds,
    `${label}.linkedWeaponIds`,
  );
  const linkedIdsWithoutWeaponData = sortedUniqueStrings(
    weapon.linkedIdsWithoutWeaponData,
    `${label}.linkedIdsWithoutWeaponData`,
  );
  const weaponDataIds = sortedUniqueStrings(weapon.weaponDataIds, `${label}.weaponDataIds`);
  const weaponData = asJsonObject(weapon.weaponData, `${label}.weaponData`);
  const dataKeys = Object.keys(weaponData).toSorted();
  if (dataKeys.length !== weaponDataIds.length || dataKeys.some((key, index) => key !== weaponDataIds[index])) {
    throw new Error(`${label}.weaponData keys must match weaponDataIds.`);
  }
  if (weapon.attackPatternObservationRequired !== true) {
    throw new Error(`${label}.attackPatternObservationRequired must be true.`);
  }
  const linkedIdSet = new Set(linkedWeaponIds);
  const dataIdSet = new Set(weaponDataIds);
  const missingDataIdSet = new Set(linkedIdsWithoutWeaponData);
  if (!dataIdSet.has(id)) {
    throw new Error(`${label}.weaponDataIds must include the primary weapon id.`);
  }
  for (const dataId of weaponDataIds) {
    if (dataId !== id && !linkedIdSet.has(dataId)) {
      throw new Error(`${label}.weaponDataIds contains unlinked id ${dataId}.`);
    }
  }
  for (const missingId of linkedIdsWithoutWeaponData) {
    if (!linkedIdSet.has(missingId) || dataIdSet.has(missingId)) {
      throw new Error(`${label}.linkedIdsWithoutWeaponData contains invalid id ${missingId}.`);
    }
  }
  for (const linkedId of linkedWeaponIds) {
    if (!dataIdSet.has(linkedId) && !missingDataIdSet.has(linkedId)) {
      throw new Error(`${label}.linked weapon ${linkedId} has no data or explicit missing-data record.`);
    }
  }
  const evidence = validateEvidence(weapon.evidence, `${label}.evidence`);
  if (!evidence.runtimePaths.includes(`WeaponSets.HeroWeaponSets.${id}`)) {
    throw new Error(`${label}.evidence is missing the HeroWeaponSets path.`);
  }
  for (const dataId of weaponDataIds) {
    if (!evidence.runtimePaths.includes(`WeaponData.${dataId}`)) {
      throw new Error(`${label}.evidence is missing WeaponData.${dataId}.`);
    }
  }
  return {
    id,
    displayName: asString(weapon.displayName, `${label}.displayName`),
    description: asString(weapon.description, `${label}.description`),
    unlockCosts: validateCosts(weapon.unlockCosts, `${label}.unlockCosts`),
    unlockRequirements: asJsonValue(weapon.unlockRequirements, `${label}.unlockRequirements`),
    linkedWeaponIds,
    linkedIdsWithoutWeaponData,
    weaponDataIds,
    weaponData,
    attackPatternObservationRequired: true,
    evidence,
  };
}

function validateRank(value: unknown, label: string): RuntimeAspectRank {
  const rank = asRecord(value, label);
  const shopItemId = rank.shopItemId;
  if (shopItemId !== null && (typeof shopItemId !== "string" || shopItemId.trim() === "")) {
    throw new Error(`${label}.shopItemId must be null or a nonempty string.`);
  }
  return {
    rank: asInteger(rank.rank, `${label}.rank`, 1),
    rarity: asString(rank.rarity, `${label}.rarity`),
    shopItemId,
    costs: validateCosts(rank.costs, `${label}.costs`),
    requirements: asJsonValue(rank.requirements, `${label}.requirements`),
    runtimePath: asString(rank.runtimePath, `${label}.runtimePath`),
  };
}

function validateAspect(value: unknown, label: string): RuntimeAspect {
  const aspect = asRecord(value, label);
  const baseAspect = asBoolean(aspect.baseAspect, `${label}.baseAspect`);
  const ranks = asArray(aspect.ranks, `${label}.ranks`).map((rank, index) =>
    validateRank(rank, `${label}.ranks[${index}]`),
  );
  if (ranks.length !== 5 || ranks.some((rank, index) => rank.rank !== index + 1)) {
    throw new Error(`${label}.ranks must contain contiguous ranks 1 through 5.`);
  }
  const expectedRarities = ["Common", "Rare", "Epic", "Heroic", "Legendary"];
  if (ranks.some((rank, index) => rank.rarity !== expectedRarities[index])) {
    throw new Error(`${label}.ranks must map ranks 1 through 5 to the weapon rarity order.`);
  }
  if ((ranks[0]?.shopItemId === null) !== baseAspect) {
    throw new Error(`${label}.rank 1 shop item must identify whether this is the base aspect.`);
  }
  if (ranks.slice(1).some((rank) => rank.shopItemId === null)) {
    throw new Error(`${label}.ranks 2 through 5 must reference rank shop items.`);
  }
  return {
    id: asString(aspect.id, `${label}.id`),
    weaponId: asString(aspect.weaponId, `${label}.weaponId`),
    displayName: asString(aspect.displayName, `${label}.displayName`),
    description: asString(aspect.description, `${label}.description`),
    baseAspect,
    ranks,
    mechanics: asJsonObject(aspect.mechanics, `${label}.mechanics`),
    samples: validateSamples(aspect.samples, `${label}.samples`),
    evidence: validateEvidence(aspect.evidence, `${label}.evidence`),
  };
}

function validateCompatibility(
  value: unknown,
  label: string,
): RuntimeHammerCompatibility {
  const compatibility = asRecord(value, label);
  return {
    allowedAspectIds: sortedUniqueStrings(
      compatibility.allowedAspectIds,
      `${label}.allowedAspectIds`,
    ),
    excludedAspectIds: sortedUniqueStrings(
      compatibility.excludedAspectIds,
      `${label}.excludedAspectIds`,
    ),
    requiredAspectIds: sortedUniqueStrings(
      compatibility.requiredAspectIds,
      `${label}.requiredAspectIds`,
    ),
    incompatibleHammerIds: sortedUniqueStrings(
      compatibility.incompatibleHammerIds,
      `${label}.incompatibleHammerIds`,
    ),
  };
}

function validateHammer(value: unknown, label: string): RuntimeHammer {
  const hammer = asRecord(value, label);
  return {
    id: asString(hammer.id, `${label}.id`),
    weaponId: asString(hammer.weaponId, `${label}.weaponId`),
    displayName: asString(hammer.displayName, `${label}.displayName`),
    description: asString(hammer.description, `${label}.description`),
    requirements: asJsonValue(hammer.requirements, `${label}.requirements`),
    compatibility: validateCompatibility(hammer.compatibility, `${label}.compatibility`),
    mechanics: asJsonObject(hammer.mechanics, `${label}.mechanics`),
    samples: validateSamples(hammer.samples, `${label}.samples`),
    evidence: validateEvidence(hammer.evidence, `${label}.evidence`),
  };
}

function validateSortedRecordIds(
  records: readonly { readonly id: string }[],
  label: string,
): void {
  const ids = records.map((record) => record.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error(`${label} must not repeat an id.`);
  }
  if (ids.some((id, index) => id !== ids.toSorted()[index])) {
    throw new Error(`${label} must be sorted by id.`);
  }
}

function validateCrossReferences(report: RuntimeWeaponReport): void {
  const weaponIds = new Set(report.weapons.map((weapon) => weapon.id));
  const aspectsByWeapon = new Map<string, RuntimeAspect[]>();
  const aspectIds = new Set(report.aspects.map((aspect) => aspect.id));
  for (const aspect of report.aspects) {
    if (!weaponIds.has(aspect.weaponId)) {
      throw new Error(`Aspect ${aspect.id} references missing weapon ${aspect.weaponId}.`);
    }
    const group = aspectsByWeapon.get(aspect.weaponId) ?? [];
    group.push(aspect);
    aspectsByWeapon.set(aspect.weaponId, group);
  }
  for (const weapon of report.weapons) {
    const aspects = aspectsByWeapon.get(weapon.id) ?? [];
    if (aspects.length === 0) {
      throw new Error(`Weapon ${weapon.id} has no aspects.`);
    }
    if (aspects.filter((aspect) => aspect.baseAspect).length !== 1) {
      throw new Error(`Weapon ${weapon.id} must have exactly one base aspect.`);
    }
  }

  const hammerIds = new Set(report.hammers.map((hammer) => hammer.id));
  const hammerWeapons = new Set<string>();
  for (const hammer of report.hammers) {
    if (!weaponIds.has(hammer.weaponId)) {
      throw new Error(`Hammer ${hammer.id} references missing weapon ${hammer.weaponId}.`);
    }
    hammerWeapons.add(hammer.weaponId);
    const weaponAspectIds = new Set(
      (aspectsByWeapon.get(hammer.weaponId) ?? []).map((aspect) => aspect.id),
    );
    const compatibilitySets = [
      hammer.compatibility.allowedAspectIds,
      hammer.compatibility.excludedAspectIds,
      hammer.compatibility.requiredAspectIds,
    ];
    for (const ids of compatibilitySets) {
      for (const id of ids) {
        if (!aspectIds.has(id) || !weaponAspectIds.has(id)) {
          throw new Error(`Hammer ${hammer.id} has an invalid aspect reference ${id}.`);
        }
      }
    }
    const allowed = new Set(hammer.compatibility.allowedAspectIds);
    for (const id of hammer.compatibility.excludedAspectIds) {
      if (allowed.has(id)) {
        throw new Error(`Hammer ${hammer.id} both allows and excludes aspect ${id}.`);
      }
    }
    for (const id of hammer.compatibility.requiredAspectIds) {
      if (!allowed.has(id)) {
        throw new Error(`Hammer ${hammer.id} requires an aspect it does not allow: ${id}.`);
      }
    }
    for (const id of hammer.compatibility.incompatibleHammerIds) {
      if (!hammerIds.has(id) || id === hammer.id) {
        throw new Error(`Hammer ${hammer.id} has an invalid Hammer conflict ${id}.`);
      }
    }
  }
  for (const weapon of report.weapons) {
    if (!hammerWeapons.has(weapon.id)) {
      throw new Error(`Weapon ${weapon.id} has no Hammer upgrades.`);
    }
  }
}

export function validateRuntimeWeaponReport(value: unknown): RuntimeWeaponReport {
  const report = asRecord(value, "runtime weapon report");
  const game = asRecord(report.game, "runtime weapon report.game");
  const weapons = asArray(report.weapons, "runtime weapon report.weapons").map(
    (weapon, index) => validateWeapon(weapon, `runtime weapon report.weapons[${index}]`),
  );
  const aspects = asArray(report.aspects, "runtime weapon report.aspects").map(
    (aspect, index) => validateAspect(aspect, `runtime weapon report.aspects[${index}]`),
  );
  const hammers = asArray(report.hammers, "runtime weapon report.hammers").map(
    (hammer, index) => validateHammer(hammer, `runtime weapon report.hammers[${index}]`),
  );
  validateSortedRecordIds(weapons, "runtime weapon report.weapons");
  validateSortedRecordIds(aspects, "runtime weapon report.aspects");
  validateSortedRecordIds(hammers, "runtime weapon report.hammers");

  const validated: RuntimeWeaponReport = {
    schema: asLiteral(report.schema, "runtime weapon report.schema", [
      "neodes2-weapon-runtime-1",
    ] as const),
    exporterVersion: asString(report.exporterVersion, "runtime weapon report.exporterVersion"),
    generatedAtUnixSeconds: asInteger(
      report.generatedAtUnixSeconds,
      "runtime weapon report.generatedAtUnixSeconds",
    ),
    language: asLiteral(report.language, "runtime weapon report.language", ["en"] as const),
    game: {
      steamBuildId: asString(game.steamBuildId, "runtime weapon report.game.steamBuildId"),
      executableVersion: asString(
        game.executableVersion,
        "runtime weapon report.game.executableVersion",
      ),
      packageVersion: asString(game.packageVersion, "runtime weapon report.game.packageVersion"),
      acquisitionId: asString(game.acquisitionId, "runtime weapon report.game.acquisitionId"),
      sourceManifestSha256: asString(
        game.sourceManifestSha256,
        "runtime weapon report.game.sourceManifestSha256",
      ),
    },
    sourceTables: sortedUniqueStrings(
      report.sourceTables,
      "runtime weapon report.sourceTables",
    ),
    localizationFiles: sortedUniqueStrings(
      report.localizationFiles,
      "runtime weapon report.localizationFiles",
    ),
    weapons,
    aspects,
    hammers,
  };
  validateCrossReferences(validated);
  return validated;
}
