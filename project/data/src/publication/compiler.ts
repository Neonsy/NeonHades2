import type { JsonObject, JsonValue } from "../boons/index.js";
import { jsonBytes, sha256 } from "../boons/runtime-acquisition.js";
import type { SpoilerLevel } from "../contract/index.js";
import type { PublicationAllowlist, PublicationField } from "../data-ready/index.js";
import type { CombinedDataset } from "../dataset/index.js";
import type { EditorialDataset, EditorialReference } from "../editorial/index.js";
import type {
  PublicationCompileResult,
  PublicationCondition,
  PublicationDataset,
  PublicationPage,
  PublicationRecord,
  PublicationRecordField,
  PublicationRelationship,
  PublicationReport,
  PublicationSearchEntry,
  PublicationSourceIdentity,
} from "./types.js";

interface Subject {
  readonly recordType: string;
  readonly id: string;
  readonly officialName: string;
  readonly values: Readonly<Record<string, unknown>>;
}

const spoilerOrder: Readonly<Record<SpoilerLevel, number>> = {
  none: 0,
  progression: 1,
  story: 2,
  ending: 3,
};

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function key(recordType: string, id: string): string {
  return `${recordType}:${id}`;
}

function reference(recordType: string, id: string): EditorialReference {
  return { recordType, id };
}

function object(value: unknown): Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : {};
}

function array(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function string(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() !== "" ? value : fallback;
}

function forbiddenValue(value: unknown): boolean {
  return typeof value === "string" && (/^[A-Za-z0-9_]+Data\.[A-Za-z0-9_.:-]+$/u.test(value) || /^[A-Za-z]:\\|^(?:\/|\\\\)/u.test(value));
}

function humanizeIdentifier(value: string): string {
  return value.replace(/:[A-Z]$/u, "").replace(/_/gu, " ").replace(/([a-z0-9])([A-Z])/gu, "$1 $2").trim();
}

function publicText(value: string): string {
  return value
    .replace(/\{#[^}]+\}/gu, "")
    .replace(/\{!Icons\.([^}]+)\}/gu, (_match, label: string) => ` [${humanizeIdentifier(label)}]`)
    .replace(/\{\$Keywords\.([^}]+)\}/gu, (_match, label: string) => humanizeIdentifier(label))
    .replace(/\{\$TooltipData\.StatDisplay(\d+)\}/gu, "[value $1]")
    .replace(/\{\$TooltipData\.ExtractData\.([^}]+)\}/gu, (_match, label: string) => `[${humanizeIdentifier(label)}]`)
    .replace(/\{\$[A-Za-z0-9_]+Data\.[^}]+\}/gu, "[value]")
    .replace(/\{![^}]+\}/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

function sanitizedJson(value: unknown): JsonValue | undefined {
  if (forbiddenValue(value)) return undefined;
  if (typeof value === "string") return publicText(value);
  if (value === null || typeof value === "boolean" ||
    typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(sanitizedJson).filter((entry): entry is JsonValue => entry !== undefined);
  if (typeof value !== "object") return undefined;
  const output: Record<string, JsonValue> = {};
  for (const [entryKey, entry] of Object.entries(value).sort(([left], [right]) => compareStrings(left, right))) {
    if (entry !== undefined &&
      !/^(?:evidence|runtimePath|runtimePaths|localizationPath|sourceText|reportSources|path)$/iu.test(entryKey) &&
      !/(?:Icon|Animation|Granny|Vfx|Sfx|Sound|Cue|Voice|TextLine|Portrait|Texture|Model|Image|Video|Audio)/iu.test(entryKey)) {
      if (Array.isArray(entry) && entry.some(forbiddenValue)) continue;
      const sanitized = sanitizedJson(entry);
      if (sanitized !== undefined) output[entryKey] = sanitized;
    }
  }
  return output;
}

function json(value: unknown): JsonValue {
  return sanitizedJson(value) ?? null;
}

function hasContent(value: JsonValue): boolean {
  if (value === null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function pick(value: unknown, keys: readonly string[]): JsonObject {
  const input = object(value);
  return Object.fromEntries(keys.filter((entry) => input[entry] !== undefined).map((entry) => [entry, json(input[entry])])) as JsonObject;
}

function costs(value: unknown): JsonValue {
  return array(value).map((entry) => {
    const input = object(entry);
    const resourceId = string(input.resourceId, "");
    return json({
      ...Object.fromEntries(Object.entries(input).filter(([field]) => field !== "resourceId" && field !== "evidence")),
      ...(resourceId === "" ? {} : { resource: reference("mechanics/resource", resourceId) }),
    });
  });
}

function publicLocator(value: string, dataset: CombinedDataset): JsonValue {
  const separator = value.indexOf(".");
  const source = separator < 0 ? "record" : value.slice(0, separator);
  const id = separator < 0 ? value : value.slice(separator + 1);
  const targets: readonly [string, readonly { readonly id: string }[], string][] = [
    ["QuestData", dataset.domains.guide.prophecies, "world-progression/prophecy"],
    ["EncounterData", dataset.domains.guide.encounters, "world-progression/encounter"],
    ["EnemyData", dataset.domains.guide.enemies, "world-progression/enemy"],
    ["TraitData", dataset.domains.boons.boons, "mechanics/boon"],
  ];
  const target = targets.find(([prefix, records]) => prefix === source && records.some((record) => record.id === id));
  if (target !== undefined) return json(reference(target[2], id));
  const kind = ({ ConsumableData: "drop", RoomData: "room", WeaponData: "weapon-state" } as Readonly<Record<string, string>>)[source]
    ?? source.replace(/Data$/u, "").replace(/([a-z])([A-Z])/gu, "$1-$2").toLocaleLowerCase("en-US");
  return { kind, id };
}

function sourceSubjects(dataset: CombinedDataset, editorial: EditorialDataset): readonly Subject[] {
  const subjects: Subject[] = [];
  const add = (recordType: string, id: string, officialName: string, values: Readonly<Record<string, unknown>>): void => {
    subjects.push({ recordType, id, officialName: publicText(officialName) || id, values });
  };
  for (const card of dataset.domains.arcana.cards) {
    add("mechanics/arcana-card", card.id, card.name, {
      name: card.name,
      description: card.description,
      "grasp-cost": card.graspCost,
      "rank-costs-effects": { ranks: card.ranks, rankEffects: card.rankEffects, unlockCosts: costs(card.unlockCosts) },
      "unlock-requirements": { unlock: card.unlock, autoActivationRequirements: card.autoActivationRequirements },
    });
  }
  add("mechanics/grasp-progression", "Grasp", "Grasp", {
    "name-description": pick(dataset.domains.arcana.grasp, ["name", "displayName", "description"]),
    "starting-capacity": pick(dataset.domains.arcana.grasp, ["startingCapacity", "initialValue"]),
    "upgrade-series": pick(dataset.domains.arcana.grasp, ["levels", "ranks", "upgrades"]),
  });
  for (const god of dataset.domains.boons.gods) {
    add("mechanics/god", god.id, god.name, { name: god.name, boons: god.boonIds.map((id) => reference("mechanics/boon", id)) });
  }
  const boonAffinity = new Map<string, { aspect: EditorialReference; rating: string }[]>();
  for (const guide of editorial.aspectGuides) {
    for (const ranking of guide.boonRankings.filter((entry) => entry.rating === "S" || entry.rating === "A")) {
      const entries = boonAffinity.get(ranking.reference.id) ?? [];
      entries.push({ aspect: guide.aspectReference, rating: ranking.rating });
      boonAffinity.set(ranking.reference.id, entries);
    }
  }
  for (const boon of dataset.domains.boons.boons) {
    add("mechanics/boon", boon.id, boon.name, {
      name: boon.name,
      god: boon.godIds.map((id) => reference("mechanics/god", id)),
      kind: boon.kind,
      effects: boon.effects,
      "rarity-scaling": boon.rarityBehavior,
      elements: boon.elements,
      "level-scaling": boon.levelScaling,
      prerequisites: boon.prerequisites,
      "weapon-affinity": (boonAffinity.get(boon.id) ?? []).sort((left, right) => compareStrings(left.aspect.id, right.aspect.id)),
    });
  }
  for (const weapon of dataset.domains.weapons.weapons) {
    add("mechanics/weapon", weapon.id, weapon.name, {});
  }
  for (const aspect of dataset.domains.weapons.aspects) {
    add("mechanics/weapon-aspect", aspect.id, aspect.name, {
      name: aspect.name,
      description: aspect.description,
      weapon: reference("mechanics/weapon", aspect.weaponId),
      "rank-costs": aspect.ranks.map((rank) => ({ ...rank, costs: costs(rank.costs) })),
      "rank-effects": aspect.rankEffects,
      "unlock-requirements": pick(aspect.mechanics, ["GameStateRequirements", "UnlockGameStateRequirements", "Requirements"]),
      "attack-pattern": pick(aspect.mechanics, [
        "AddOutgoingCritModifiers", "AddOutgoingDamageModifiers", "AddOutgoingLifestealModifiers", "CastFlatFuseModifier",
        "Charge", "DaggerAdditionalTargetData", "ExpandedProperties", "LinkedSpell", "ManaCostModifiers", "ManaSpendCostModifiers",
        "NumHits", "PerfectCritChance", "PreEquipWeapons", "PropertyChanges", "RequiredWeapon", "ScaledStageEffects",
        "SkipAutoLobMagnetism", "SprintStrikeDamageMultiplier", "UnlimitedAmmo", "WeaponDataOverride", "WeaponSpeedMultiplier",
      ]),
    });
  }
  for (const hammer of dataset.domains.weapons.hammers) {
    add("mechanics/hammer-upgrade", hammer.id, hammer.name, {
      name: hammer.name,
      description: hammer.description,
      effects: hammer.effects,
      compatibility: {
        weapon: reference("mechanics/weapon", hammer.weaponId),
        allowedAspects: hammer.compatibility.allowedAspectIds.map((id) => reference("mechanics/weapon-aspect", id)),
        excludedAspects: hammer.compatibility.excludedAspectIds.map((id) => reference("mechanics/weapon-aspect", id)),
        requiredAspects: hammer.compatibility.requiredAspectIds.map((id) => reference("mechanics/weapon-aspect", id)),
        incompatibleHammers: hammer.compatibility.incompatibleHammerIds.map((id) => reference("mechanics/hammer-upgrade", id)),
      },
    });
  }
  const keepsakeEditorial = new Map(editorial.keepsakePriorities.map((entry) => [entry.id, entry]));
  for (const keepsake of dataset.domains.loadouts.keepsakes) {
    const guidance = keepsakeEditorial.get(keepsake.id);
    add("mechanics/keepsake", keepsake.id, keepsake.displayName, {
      name: keepsake.displayName,
      acquisition: { relationship: keepsake.relationshipId === null ? null : reference("world-progression/relationship", keepsake.relationshipId), requirements: keepsake.acquisitionRequirements },
      "rank-effects": { naturalRanks: keepsake.naturalRanks, rankEffects: keepsake.rankEffects, chamberThresholds: keepsake.chamberThresholds },
      "leveling-priority": guidance === undefined ? null : {
        priority: guidance.priority,
        lifecycle: guidance.lifecycle,
        recommendation: guidance.recommendation,
        reason: guidance.reason,
        limitation: guidance.limitation,
        switchWhenInactive: guidance.switchWhenInactive,
        fallback: guidance.fallback,
      },
    });
  }
  for (const familiar of dataset.domains.loadouts.familiars) {
    add("mechanics/familiar", familiar.id, familiar.displayName, {
      name: familiar.displayName,
      "unlock-requirements": familiar.unlockRequirements,
      "abilities-upgrades": { description: familiar.description, mechanics: familiar.mechanics, upgrades: familiar.upgrades },
    });
  }
  for (const hex of dataset.domains.loadouts.hexes) {
    add("mechanics/hex", hex.id, hex.displayName, {
      name: hex.displayName,
      "base-effect": { description: hex.description, effects: hex.baseEffects, availabilityRequirements: hex.availabilityRequirements },
      "path-upgrades": hex.talents,
    });
  }
  for (const incantation of dataset.domains.loadouts.incantations) {
    add("mechanics/incantation", incantation.id, incantation.displayName, {
      name: incantation.displayName,
      "unlock-requirements": incantation.unlockRequirements,
      costs: costs(incantation.costs),
      effects: { description: incantation.description, effects: incantation.effects, automaticUnlock: incantation.automaticUnlock },
    });
  }
  for (const status of dataset.domains.guide.statusElements) {
    const name = status.displayName ?? status.id;
    const behavior = { description: status.description, mechanics: pick(status.data, ["Duration", "Multiplier", "Name", "Stacks", "Threshold"]) };
    add("mechanics/status-element", status.id, name, { name, behavior });
    add("mechanics/combat-mechanic", status.id, name, { name, behavior });
  }
  const resourceEditorial = new Map(editorial.resourceAdvice.map((entry) => [entry.id, entry]));
  for (const resource of dataset.domains.guide.resources) {
    const guidance = resourceEditorial.get(resource.id);
    add("mechanics/resource", resource.id, resource.displayName ?? resource.id, {
      name: resource.displayName ?? resource.id,
      "acquisition-locations": resource.acquisitionReferences.map((entry) => publicLocator(entry, dataset)),
      uses: [
        ...resource.useReferences.map((entry) => publicLocator(entry, dataset)),
        ...(guidance?.recommendedUseReferences ?? []),
      ],
      "reservation-advice": guidance === undefined ? null : {
        policy: guidance.policy,
        priority: guidance.priority,
        earliestRecommendedStage: guidance.earliestRecommendedStage,
        recommendedUses: guidance.recommendedUseReferences,
        recommendation: guidance.recommendation,
        reason: guidance.reason,
        limitation: guidance.limitation,
        fallback: guidance.fallback,
      },
    });
  }
  for (const region of dataset.domains.guide.regions) {
    const encounterIds = dataset.domains.guide.encounters.filter((entry) => entry.regionIds.includes(region.id)).map((entry) => entry.id);
    add("world-progression/region", region.id, region.displayName, {
      name: region.displayName,
      route: region.routeId === null ? null : { id: region.routeId, order: region.routeOrder },
      encounters: encounterIds.map((id) => reference("world-progression/encounter", id)),
      "unlock-requirements": null,
    });
  }
  for (const encounter of dataset.domains.guide.encounters) {
    add("world-progression/encounter", encounter.id, encounter.displayName ?? encounter.id, {
      name: encounter.displayName ?? encounter.id,
      region: encounter.regionIds.map((id) => reference("world-progression/region", id)),
      enemies: encounter.enemyIds.map((id) => reference("world-progression/enemy", id)),
      rewards: encounter.rewardIds,
      classification: encounter.classification,
    });
  }
  for (const enemy of dataset.domains.guide.enemies) {
    add("world-progression/enemy", enemy.id, enemy.displayName ?? enemy.id, {
      name: enemy.displayName ?? enemy.id,
      stats: pick(enemy.data, ["Health", "HealthBufferedGripBonus", "HealthBufferedRegenAmount", "MaxHitShields", "MoneyDropOnDeath", "Speed"]),
      "attacks-behavior": pick(enemy.data, ["ActivateDuration", "AggroIfLastAlive", "AggroReactionTimeMax", "AggroReactionTimeMin", "AIAggroRange", "AIOptions", "CanBeFrozen", "CollisionReactions", "DamageType", "DefaultAIData", "PostAttackDuration", "PreAttackDuration", "SpellSummonDataOverrides", "WeaponOptions"]),
      classification: { classifications: enemy.classifications, regions: enemy.regionIds.map((id) => reference("world-progression/region", id)) },
    });
  }
  for (const oath of dataset.domains.guide.oathConditions) {
    add("world-progression/oath-condition", oath.id, oath.displayName ?? oath.id, {
      name: oath.displayName ?? oath.id,
      "rank-effects": pick(oath.data, ["ChangeValue", "ChangeValueNegativePercentDelta", "ChangeValuePercent", "ChangeValuePercentDelta", "DisplayValue", "Ranks", "SimpleExtractValues"]),
      "unlock-requirements": pick(oath.data, ["GameStateRequirements", "UnlockGameStateRequirements"]),
    });
  }
  for (const bounty of dataset.domains.guide.bounties) {
    add("world-progression/testament-bounty", bounty.id, bounty.displayName ?? bounty.id, {
      "target-route": pick(bounty.data, ["Encounters", "Biome", "Route"]),
      requirements: pick(bounty.data, ["CompleteGameStateRequirements", "UnlockGameStateRequirements"]),
      rewards: pick(bounty.data, ["LootOptions", "RewardResourceAmount", "RewardResourceName"]),
    });
  }
  for (const relationship of dataset.domains.guide.relationships) {
    add("world-progression/relationship", relationship.id, relationship.displayName ?? relationship.id, {
      character: relationship.displayName ?? relationship.id,
      "gift-track": relationship.data,
      rewards: pick(relationship.data, ["Maximum", "MaxedRequirement", "Locked"]),
    });
  }
  for (const prophecy of dataset.domains.guide.prophecies) {
    add("world-progression/prophecy", prophecy.id, prophecy.displayName ?? prophecy.id, {
      name: prophecy.displayName ?? prophecy.id,
      "unlock-requirements": pick(prophecy.data, ["UnlockGameStateRequirements"]),
      objectives: pick(prophecy.data, ["CompleteGameStateRequirements", "NumChambersRequired", "SetupEvents"]),
      rewards: pick(prophecy.data, ["RewardResourceAmount", "RewardResourceName"]),
    });
  }
  for (const milestone of dataset.domains.guide.narrative) {
    add("world-progression/narrative-milestone", milestone.id, milestone.displayName ?? milestone.id, {
      kind: milestone.classification ?? "narrative",
      requirements: pick(milestone.data, ["CompleteGameStateRequirements", "GameStateRequirements", "UnlockGameStateRequirements"]),
    });
  }
  for (const achievement of dataset.domains.guide.achievements) {
    add("world-progression/achievement", achievement.id, achievement.displayName, {
      "name-description": { name: achievement.displayName, description: achievement.description, hidden: achievement.hidden },
      trigger: pick(achievement.data, ["CompleteGameStateRequirements"]),
    });
  }
  const officialNameFor = (item: EditorialReference): string =>
    subjects.find((subject) => subject.recordType === item.recordType && subject.id === item.id)?.officialName ?? item.id;
  for (const stage of editorial.progressionStages) {
    add(stage.recordType, stage.id, stage.title, {
      milestone: { order: stage.order, title: stage.title, endpoint: stage.endpoint, spoilerLevel: stage.spoilerLevel, recommendation: stage.recommendation, reason: stage.reason, limitation: stage.limitation, fallback: stage.fallback },
      "reader-knowledge": stage.readerKnowledge,
      "next-objective": stage.recommendation,
      "action-sequence": stage.actionSequence,
      "purchase-upgrade-priorities": stage.purchaseUpgradePriorities,
      "resource-policy": stage.resourcePolicy,
      loadout: stage.loadoutReferences,
      "ordered-priority-references": stage.priorityReferences,
      "boon-encounter-priorities": stage.boonEncounterPriorities,
      "parallel-objectives": stage.parallelObjectiveReferences,
      "route-late-game": stage.routeLateGame,
      "completion-checklist": { steps: stage.completionChecklist, references: stage.completionReferences },
    });
  }
  for (const guide of editorial.weaponGuides) {
    add(guide.recordType, guide.id, officialNameFor(guide.weaponReference), {
      "subject-aspects": { weapon: guide.weaponReference, aspects: guide.aspectReferences },
      "boon-rankings": guide.boonRankings,
      "context-ratings-guidance": { overallRating: guide.overallRating, overallReason: guide.overallReason, contextRatings: guide.contextRatings, recommendation: guide.recommendation, reason: guide.reason, limitation: guide.limitation, fallback: guide.fallback },
    });
  }
  for (const guide of editorial.aspectGuides) {
    add(guide.recordType, guide.id, officialNameFor(guide.aspectReference), {
      "rank-evaluations": { aspect: guide.aspectReference, overallRating: guide.overallRating, overallReason: guide.overallReason, ranks: guide.rankEvaluations },
      "strengths-weaknesses": { strengths: guide.strengths, weaknesses: guide.weaknesses, beginnerDifficulty: guide.beginnerDifficulty },
      "playstyle-combat-sequence": guide.playstyleCombatSequence,
      "arcana-loadout": { cards: guide.arcanaLoadout, graspCost: guide.arcanaGraspCost, constraint: guide.arcanaConstraint },
      "keepsake-route": guide.keepsakeRoute,
      "familiar-hex": guide.familiarHex,
      "boon-priorities": guide.boonPriorities,
      "boon-rankings": guide.boonRankings,
      "duo-legendary-targets": guide.duoLegendaryTargets,
      "hammer-rankings": guide.hammerRankings,
      "build-interactions": guide.buildInteractions,
      "reward-priorities": guide.rewardPriorities,
      "reward-decision-rules": guide.rewardDecisionRules,
      "fallbacks-conflicts": { conflicts: guide.conflicts, upgradeConflicts: guide.upgradeConflicts, fallback: guide.fallback },
      "boss-route-considerations": guide.bossRouteConsiderations,
      "context-ratings": guide.contextRatings,
    });
  }
  for (const rating of editorial.boonRatings) {
    add(rating.recordType, rating.id, officialNameFor(rating.subjectReference), {
      "subject-context": { subject: rating.subjectReference, context: rating.context, dimension: rating.evaluationDimension },
      rating: rating.rating,
      "reason-prerequisites-limitation": { recommendation: rating.recommendation, reason: rating.reason, prerequisites: rating.prerequisiteReferences, limitation: rating.limitation, fallback: rating.fallback },
    });
  }
  for (const rating of [...editorial.arcanaRatings, ...editorial.familiarRatings, ...editorial.hexRatings]) {
    add(rating.recordType, rating.id, officialNameFor(rating.subjectReference), {
      "subject-context": { subject: rating.subjectReference, context: rating.context, dimension: rating.evaluationDimension },
      [rating.recordType === "editorial/arcana-rating" ? "rating-guidance" : "rating-choice-guidance"]: {
        rating: rating.rating,
        recommendation: rating.recommendation,
        reason: rating.reason,
        limitation: rating.limitation,
        fallback: rating.fallback,
        recommendedByAspectCount: rating.recommendedByAspectCount,
        aspectCount: rating.aspectCount,
      },
    });
  }
  for (const page of editorial.pageDefinitions) {
    add("editorial/page-definition", page.id, page.title, {
      "title-kind-sources": { title: page.title, kind: page.pageKind, sourceRecordTypes: page.sourceRecordTypes },
      "aliases-spoiler-level": { aliases: page.aliases, spoilerLevel: page.spoilerLevel },
    });
  }
  return subjects;
}

function allowedByRecordType(allowlist: PublicationAllowlist): ReadonlyMap<string, ReadonlyMap<string, PublicationField>> {
  const output = new Map<string, Map<string, PublicationField>>();
  for (const field of allowlist.allowedFields) {
    const separator = field.id.lastIndexOf("/");
    const recordType = field.id.slice(0, separator);
    const fieldId = field.id.slice(separator + 1);
    const fields = output.get(recordType) ?? new Map<string, PublicationField>();
    fields.set(fieldId, field);
    output.set(recordType, fields);
  }
  return output;
}

function highestSpoiler(fields: ReadonlyMap<string, PublicationField> | undefined): SpoilerLevel {
  return [...(fields?.values() ?? [])].reduce<SpoilerLevel>((highest, field) =>
    spoilerOrder[field.spoilerLevel] > spoilerOrder[highest] ? field.spoilerLevel : highest, "none");
}

function makeRecord(subject: Subject, allowed: ReadonlyMap<string, PublicationField> | undefined): PublicationRecord {
  const fields: PublicationRecordField[] = [];
  for (const [fieldId, value] of Object.entries(subject.values)) {
    const policy = allowed?.get(fieldId);
    if (policy !== undefined) fields.push({ ...policy, value: json(value) });
  }
  return {
    key: key(subject.recordType, subject.id),
    recordType: subject.recordType,
    id: subject.id,
    fields: fields.sort((left, right) => compareStrings(left.id, right.id)),
  };
}

function normalizeSearchTerm(value: string): string {
  return value.trim().toLocaleLowerCase("en-US").replace(/\s+/gu, " ");
}

function explicitReference(value: unknown): EditorialReference | null {
  const input = object(value);
  return typeof input.recordType === "string" && typeof input.id === "string"
    ? { recordType: input.recordType, id: input.id }
    : null;
}

function referencesIn(
  value: unknown,
  candidates: ReadonlyMap<string, readonly PublicationRecord[]>,
  inferStringIds: boolean,
): readonly EditorialReference[] {
  const output = new Map<string, EditorialReference>();
  const visit = (entry: unknown): void => {
    const explicit = explicitReference(entry);
    if (explicit !== null) {
      output.set(key(explicit.recordType, explicit.id), explicit);
      return;
    }
    if (typeof entry === "string" && inferStringIds) {
      const matches = (candidates.get(entry) ?? []).filter((record) => !record.recordType.startsWith("editorial/") && record.recordType !== "foundation/record-metadata");
      if (matches.length === 1) output.set(matches[0]!.key, reference(matches[0]!.recordType, matches[0]!.id));
      return;
    }
    if (Array.isArray(entry)) {
      entry.forEach(visit);
      return;
    }
    if (typeof entry === "object" && entry !== null) Object.values(entry).forEach(visit);
  };
  visit(value);
  return [...output.values()].sort((left, right) => compareStrings(key(left.recordType, left.id), key(right.recordType, right.id)));
}

function relationshipIndexes(
  records: readonly PublicationRecord[],
): { readonly relationships: PublicationDataset["relationships"]; readonly conditions: readonly PublicationCondition[]; readonly unresolved: readonly string[] } {
  const recordKeys = new Set(records.map((record) => record.key));
  const candidates = new Map<string, PublicationRecord[]>();
  for (const record of records) {
    const values = candidates.get(record.id) ?? [];
    values.push(record);
    candidates.set(record.id, values);
  }
  const edges = new Map<string, { sourceKey: string; targetKey: string; fields: Set<string> }>();
  const conditions = new Map<string, { expression: JsonValue; dependentRecordKeys: Set<string>; fields: Set<string> }>();
  const unresolved = new Set<string>();
  const addEdge = (sourceKey: string, targetKey: string, fieldId: string): void => {
    const edgeKey = `${sourceKey}\u0000${targetKey}`;
    const edge = edges.get(edgeKey) ?? { sourceKey, targetKey, fields: new Set<string>() };
    edge.fields.add(fieldId);
    edges.set(edgeKey, edge);
  };
  for (const record of records) {
    if (record.recordType === "foundation/record-metadata") continue;
    for (const field of record.fields) {
      const inferStringIds = !/(?:^|[-/])(?:name|character|description|reason|recommendation|limitation|fallback|aliases|title)(?:-|$)/u.test(field.id);
      for (const target of referencesIn(field.value, candidates, inferStringIds)) {
        const targetKey = key(target.recordType, target.id);
        if (!recordKeys.has(targetKey)) unresolved.add(`${record.key}/${field.id}->${targetKey}`);
        else if (targetKey !== record.key) addEdge(record.key, targetKey, field.id);
      }
      if (/(?:^|-)requirements$|prerequisites$/u.test(field.id) && hasContent(field.value)) {
        const expression = json(field.value);
        const conditionKey = `condition:sha256:${sha256(jsonBytes(expression))}`;
        const condition = conditions.get(conditionKey) ?? { expression, dependentRecordKeys: new Set<string>(), fields: new Set<string>() };
        condition.dependentRecordKeys.add(record.key);
        condition.fields.add(field.id);
        conditions.set(conditionKey, condition);
        addEdge(record.key, conditionKey, field.id);
      }
    }
  }
  const forward: PublicationRelationship[] = [...edges.values()].map((edge) => ({
    sourceKey: edge.sourceKey,
    targetKey: edge.targetKey,
    fields: [...edge.fields].sort(compareStrings),
  })).sort((left, right) => compareStrings(left.sourceKey, right.sourceKey) || compareStrings(left.targetKey, right.targetKey));
  const reverse = forward.map((edge) => ({ sourceKey: edge.targetKey, targetKey: edge.sourceKey, fields: edge.fields }))
    .sort((left, right) => compareStrings(left.sourceKey, right.sourceKey) || compareStrings(left.targetKey, right.targetKey));
  return {
    relationships: { forward, reverse },
    conditions: [...conditions.entries()].map(([conditionKey, condition]) => ({
      key: conditionKey,
      expression: condition.expression,
      dependentRecordKeys: [...condition.dependentRecordKeys].sort(compareStrings),
      fields: [...condition.fields].sort(compareStrings),
    })).sort((left, right) => compareStrings(left.key, right.key)),
    unresolved: [...unresolved].sort(compareStrings),
  };
}

export function createPublicationReport(dataset: PublicationDataset, allowlist: PublicationAllowlist): PublicationReport {
  const allowed = new Set(allowlist.allowedFields.map((field) => field.id));
  const recordKeys = dataset.records.map((record) => record.key);
  const recordKeySet = new Set(recordKeys);
  const duplicateRecordKeys = [...new Set(recordKeys.filter((recordKey, index) => recordKeys.indexOf(recordKey) !== index))].sort(compareStrings);
  const expectedFields = new Map<string, string[]>();
  for (const field of allowlist.allowedFields) {
    const recordType = field.id.slice(0, field.id.lastIndexOf("/"));
    const fields = expectedFields.get(recordType) ?? [];
    fields.push(field.id);
    expectedFields.set(recordType, fields);
  }
  const missingAllowedFieldIds = dataset.records.flatMap((record) => {
    const actual = new Set(record.fields.map((field) => field.id));
    return (expectedFields.get(record.recordType) ?? []).filter((fieldId) => !actual.has(fieldId)).map((fieldId) => `${record.key}/${fieldId}`);
  }).sort(compareStrings);
  const forbiddenFieldIds = [...new Set(dataset.records.flatMap((record) => record.fields
    .filter((field) => !allowed.has(field.id) || !field.id.startsWith(`${record.recordType}/`))
    .map((field) => `${record.key}/${field.id}`)))].sort(compareStrings);
  const forbiddenPayloadPaths: string[] = [];
  const forbiddenKey = /^(?:evidence|runtimePath|runtimePaths|localizationPath|saveData|binary|sourceText)$|(?:Icon|Animation|Granny|Vfx|Sfx|Sound|Cue|Voice|TextLine|Portrait|Texture|Model|Image|Video|Audio)/iu;
  const scan = (value: unknown, path: string): void => {
    if (forbiddenValue(value) || typeof value === "string" && /\{(?:#|!|\$[A-Za-z0-9_]+Data\.)/u.test(value)) {
      forbiddenPayloadPaths.push(path);
    } else if (Array.isArray(value)) value.forEach((entry, index) => scan(entry, `${path}[${index}]`));
    else if (typeof value === "object" && value !== null) {
      for (const [entryKey, entry] of Object.entries(value)) {
        const entryPath = `${path}.${entryKey}`;
        if (forbiddenKey.test(entryKey)) forbiddenPayloadPaths.push(entryPath);
        scan(entry, entryPath);
      }
    }
  };
  scan({ records: dataset.records, pages: dataset.pages, search: dataset.search, relationships: dataset.relationships, conditions: dataset.conditions }, "publication");
  const forwardKeys = new Set(dataset.relationships.forward.map((edge) => `${edge.sourceKey}\u0000${edge.targetKey}\u0000${edge.fields.join("\u0000")}`));
  const reverseKeys = new Set(dataset.relationships.reverse.map((edge) => `${edge.targetKey}\u0000${edge.sourceKey}\u0000${edge.fields.join("\u0000")}`));
  const incompleteReverseRelationships = [
    ...[...forwardKeys].filter((edge) => !reverseKeys.has(edge)).map((edge) => `missing:${edge}`),
    ...[...reverseKeys].filter((edge) => !forwardKeys.has(edge)).map((edge) => `extra:${edge}`),
  ].sort(compareStrings);
  const pagesWithoutRecords = dataset.pages.filter((page) => page.recordKeys.length === 0).map((page) => page.id).sort(compareStrings);
  const searchable = new Set(dataset.search.map((entry) => entry.recordKey));
  const recordsWithoutSearchTerms = dataset.records
    .filter((record) => record.recordType !== "foundation/record-metadata" && !searchable.has(record.key))
    .map((record) => record.key)
    .sort(compareStrings);
  const relationshipTargets = new Set([...recordKeys, ...dataset.conditions.map((condition) => condition.key)]);
  const unresolvedReferences = [
    ...dataset.relationships.forward
      .filter((edge) => !recordKeySet.has(edge.sourceKey) || !relationshipTargets.has(edge.targetKey))
      .map((edge) => `relationship:${edge.sourceKey}->${edge.targetKey}`),
    ...dataset.conditions.flatMap((condition) => condition.dependentRecordKeys
      .filter((recordKey) => !recordKeySet.has(recordKey))
      .map((recordKey) => `condition:${condition.key}->${recordKey}`)),
    ...dataset.pages.flatMap((page) => page.recordKeys
      .filter((recordKey) => !recordKeySet.has(recordKey))
      .map((recordKey) => `page:${page.id}->${recordKey}`)),
    ...dataset.search
      .filter((entry) => !recordKeySet.has(entry.recordKey))
      .map((entry) => `search:${entry.normalizedTerm}->${entry.recordKey}`),
  ].sort(compareStrings);
  const report: PublicationReport = {
    schema: "neodes2-publication-report-1",
    counts: {
      records: dataset.records.length,
      pages: dataset.pages.length,
      searchEntries: dataset.search.length,
      forwardRelationships: dataset.relationships.forward.length,
      reverseRelationships: dataset.relationships.reverse.length,
      conditions: dataset.conditions.length,
    },
    duplicateRecordKeys,
    missingAllowedFieldIds,
    forbiddenFieldIds,
    forbiddenPayloadPaths: [...new Set(forbiddenPayloadPaths)].sort(compareStrings),
    unresolvedReferences,
    incompleteReverseRelationships,
    pagesWithoutRecords,
    recordsWithoutSearchTerms,
    complete: false,
  };
  return { ...report, complete: [
    report.duplicateRecordKeys,
    report.missingAllowedFieldIds,
    report.forbiddenFieldIds,
    report.forbiddenPayloadPaths,
    report.unresolvedReferences,
    report.incompleteReverseRelationships,
    report.pagesWithoutRecords,
    report.recordsWithoutSearchTerms,
  ].every((issues) => issues.length === 0) };
}

export function compilePublicationDataset(
  combined: CombinedDataset,
  editorial: EditorialDataset,
  allowlist: PublicationAllowlist,
  identity: PublicationSourceIdentity,
): PublicationCompileResult {
  if (editorial.source.datasetAcquisitionId !== identity.datasetAcquisitionId || editorial.source.datasetSha256 !== identity.datasetSha256 ||
    editorial.source.dataReadyAcquisitionId !== identity.dataReadyAcquisitionId) {
    throw new Error("Publication inputs do not share one certified dataset and data-ready identity.");
  }
  const allowed = allowedByRecordType(allowlist);
  const baseSubjects = sourceSubjects(combined, editorial);
  const aliases = new Map(editorial.searchAliases.map((entry) => [key(entry.subjectReference.recordType, entry.subjectReference.id), entry.aliases]));
  const baseRecords = baseSubjects.map((subject) => makeRecord(subject, allowed.get(subject.recordType)));
  const metadataSubjects = baseSubjects.map((subject): Subject => ({
    recordType: "foundation/record-metadata",
    id: key(subject.recordType, subject.id),
    officialName: subject.officialName,
    values: {
      "official-name": subject.officialName,
      "search-aliases": aliases.get(key(subject.recordType, subject.id)) ?? [],
      "spoiler-level": highestSpoiler(allowed.get(subject.recordType)),
    },
  }));
  const records = [...baseRecords, ...metadataSubjects.map((subject) => makeRecord(subject, allowed.get(subject.recordType)))]
    .sort((left, right) => compareStrings(left.key, right.key));
  const pageRecords = new Map(editorial.pageDefinitions.map((page) => [page.id, page]));
  const pages: PublicationPage[] = editorial.pageDefinitions.map((page) => ({
    id: page.id,
    pageKind: page.pageKind,
    title: page.title,
    aliases: [...page.aliases].sort(compareStrings),
    spoilerLevel: page.spoilerLevel,
    recordKeys: records.filter((record) => page.sourceRecordTypes.includes(record.recordType)).map((record) => record.key).sort(compareStrings),
  })).sort((left, right) => compareStrings(left.id, right.id));
  const search: PublicationSearchEntry[] = [];
  for (const subject of baseSubjects) {
    const subjectKey = key(subject.recordType, subject.id);
    const terms = new Set([subject.officialName, ...(aliases.get(subjectKey) ?? [])]);
    if (subject.recordType === "editorial/page-definition") {
      const page = pageRecords.get(subject.id);
      page?.aliases.forEach((alias) => terms.add(alias));
    }
    for (const term of terms) {
      const normalizedTerm = normalizeSearchTerm(term);
      if (normalizedTerm !== "") search.push({ term, normalizedTerm, recordKey: subjectKey });
    }
  }
  const sortedSearch = search
    .filter((entry, index, values) => values.findIndex((candidate) => candidate.recordKey === entry.recordKey && candidate.normalizedTerm === entry.normalizedTerm) === index)
    .sort((left, right) => compareStrings(left.normalizedTerm, right.normalizedTerm) || compareStrings(left.recordKey, right.recordKey));
  const indexed = relationshipIndexes(records);
  const dataset: PublicationDataset = {
    schema: "neodes2-publication-1",
    source: {
      ...identity,
      steamBuildId: combined.source.steamBuildId,
      executableVersion: combined.source.executableVersion,
      packageVersion: combined.source.packageVersion,
    },
    records,
    pages,
    search: sortedSearch,
    relationships: indexed.relationships,
    conditions: indexed.conditions,
  };
  const report = createPublicationReport(dataset, allowlist);
  return {
    dataset,
    report: indexed.unresolved.length === 0 ? report : {
      ...report,
      unresolvedReferences: [...new Set([...report.unresolvedReferences, ...indexed.unresolved])].sort(compareStrings),
      complete: false,
    },
  };
}
