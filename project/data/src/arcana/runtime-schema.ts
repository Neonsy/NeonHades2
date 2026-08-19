import type { JsonObject, JsonValue, RuntimeBoonSample } from "../boons/runtime-schema.js";
import { validateRuntimeTraitSample } from "../boons/runtime-schema.js";

export interface RuntimeArcanaCost {
  readonly resourceId: string;
  readonly amount: number;
}

export interface RuntimeArcanaEvidence {
  readonly localizationPath: string;
  readonly runtimePaths: readonly string[];
}

export interface RuntimeArcanaLayoutEntry {
  readonly row: number;
  readonly column: number;
  readonly cardId: string;
}

export interface RuntimeArcanaRank {
  readonly rank: number;
  readonly rarity: string;
  readonly upgradeFromPreviousCosts: readonly RuntimeArcanaCost[];
  readonly runtimePath: string;
}

export interface RuntimeArcanaCard {
  readonly id: string;
  readonly row: number;
  readonly column: number;
  readonly displayName: string;
  readonly description: string;
  readonly traitId: string;
  readonly type: string | null;
  readonly graspCost: number;
  readonly unlockCosts: readonly RuntimeArcanaCost[];
  readonly ranks: readonly RuntimeArcanaRank[];
  readonly autoActivationRequirements: JsonObject;
  readonly autoActivationText: string | null;
  readonly relatedCardIds: readonly string[];
  readonly unlock: {
    readonly initiallyRevealable: boolean;
    readonly adjacentCardIds: readonly string[];
  };
  readonly mechanics: JsonObject;
  readonly rankEffects: readonly RuntimeBoonSample[];
  readonly evidence: RuntimeArcanaEvidence;
}

export interface RuntimeGraspLevel {
  readonly level: number;
  readonly capacityIncrease: number;
  readonly cumulativeCapacity: number;
  readonly costs: readonly RuntimeArcanaCost[];
}

export interface RuntimeArcanaReport {
  readonly schema: "neodes2-arcana-runtime-1";
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
  readonly unlockModel: {
    readonly kind: "orthogonal-adjacency";
    readonly startingCardId: string;
    readonly layoutMutableAfterUnlock: true;
  };
  readonly layout: readonly RuntimeArcanaLayoutEntry[];
  readonly grasp: {
    readonly id: string;
    readonly displayName: string;
    readonly description: string;
    readonly startingCapacity: number;
    readonly levels: readonly RuntimeGraspLevel[];
    readonly evidence: RuntimeArcanaEvidence;
  };
  readonly cards: readonly RuntimeArcanaCard[];
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
  const strings = asArray(value, label).map((entry, index) =>
    asString(entry, `${label}[${index}]`),
  );
  if (new Set(strings).size !== strings.length) throw new Error(`${label} has duplicates.`);
  if (strings.some((entry, index) => entry !== strings.toSorted()[index])) {
    throw new Error(`${label} must be sorted.`);
  }
  return strings;
}

function validateCosts(value: unknown, label: string): readonly RuntimeArcanaCost[] {
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
    throw new Error(`${label} must contain unique costs sorted by resourceId.`);
  }
  return costs;
}

function validateEvidence(value: unknown, label: string): RuntimeArcanaEvidence {
  const evidence = asRecord(value, label);
  return {
    localizationPath: asString(evidence.localizationPath, `${label}.localizationPath`),
    runtimePaths: sortedUniqueStrings(evidence.runtimePaths, `${label}.runtimePaths`),
  };
}

function validateLayout(value: unknown): readonly RuntimeArcanaLayoutEntry[] {
  const layout = asArray(value, "runtime Arcana report.layout").map((entry, index) => {
    const record = asRecord(entry, `runtime Arcana report.layout[${index}]`);
    return {
      row: asInteger(record.row, `runtime Arcana report.layout[${index}].row`, 1),
      column: asInteger(record.column, `runtime Arcana report.layout[${index}].column`, 1),
      cardId: asString(record.cardId, `runtime Arcana report.layout[${index}].cardId`),
    };
  });
  if (layout.length !== 25) throw new Error("runtime Arcana report.layout must have 25 cards.");
  const ids = layout.map((entry) => entry.cardId);
  const coordinates = layout.map((entry) => `${entry.row}:${entry.column}`);
  if (new Set(ids).size !== ids.length || new Set(coordinates).size !== coordinates.length) {
    throw new Error("runtime Arcana report.layout must have unique cards and coordinates.");
  }
  for (const [index, entry] of layout.entries()) {
    const expectedRow = Math.floor(index / 5) + 1;
    const expectedColumn = (index % 5) + 1;
    if (entry.row !== expectedRow || entry.column !== expectedColumn) {
      throw new Error("runtime Arcana report.layout must be a row-major 5 by 5 grid.");
    }
  }
  return layout;
}

function validateRanks(value: unknown, label: string): readonly RuntimeArcanaRank[] {
  const ranks = asArray(value, label).map((entry, index) => {
    const rank = asRecord(entry, `${label}[${index}]`);
    return {
      rank: asInteger(rank.rank, `${label}[${index}].rank`, 1),
      rarity: asString(rank.rarity, `${label}[${index}].rarity`),
      upgradeFromPreviousCosts: validateCosts(
        rank.upgradeFromPreviousCosts,
        `${label}[${index}].upgradeFromPreviousCosts`,
      ),
      runtimePath: asString(rank.runtimePath, `${label}[${index}].runtimePath`),
    };
  });
  const rarities = ["Common", "Rare", "Epic"];
  if (
    ranks.length !== 3 ||
    ranks.some((rank, index) => rank.rank !== index + 1 || rank.rarity !== rarities[index])
  ) {
    throw new Error(`${label} must contain Common, Rare, and Epic ranks 1 through 3.`);
  }
  if (ranks[0]?.upgradeFromPreviousCosts.length !== 0) {
    throw new Error(`${label}[0] must not have an upgrade-from-previous cost.`);
  }
  if (ranks.slice(1).some((rank) => rank.upgradeFromPreviousCosts.length === 0)) {
    throw new Error(`${label} ranks 2 and 3 must have upgrade costs.`);
  }
  return ranks;
}

function validateSamples(value: unknown, label: string): readonly RuntimeBoonSample[] {
  const samples = asArray(value, label).map((entry, index) =>
    validateRuntimeTraitSample(entry, `${label}[${index}]`),
  );
  const keys = samples.map(
    (sample) => `${sample.rarity}\u0000${sample.endpoint}\u0000${sample.level}`,
  );
  if (new Set(keys).size !== keys.length) throw new Error(`${label} has duplicate samples.`);
  return samples;
}

function validateCard(value: unknown, label: string): RuntimeArcanaCard {
  const card = asRecord(value, label);
  const type = card.type;
  if (type !== null && (typeof type !== "string" || type.trim() === "")) {
    throw new Error(`${label}.type must be null or a nonempty string.`);
  }
  const autoActivationText = card.autoActivationText;
  if (
    autoActivationText !== null &&
    (typeof autoActivationText !== "string" || autoActivationText.trim() === "")
  ) {
    throw new Error(`${label}.autoActivationText must be null or a nonempty string.`);
  }
  const unlock = asRecord(card.unlock, `${label}.unlock`);
  const autoActivationRequirements = asJsonObject(
    card.autoActivationRequirements,
    `${label}.autoActivationRequirements`,
  );
  const graspCost = asInteger(card.graspCost, `${label}.graspCost`);
  const hasAutomaticActivation = Object.keys(autoActivationRequirements).length > 0;
  if ((autoActivationText !== null) !== hasAutomaticActivation) {
    throw new Error(`${label}.autoActivationText must match automatic activation behavior.`);
  }
  return {
    id: asString(card.id, `${label}.id`),
    row: asInteger(card.row, `${label}.row`, 1),
    column: asInteger(card.column, `${label}.column`, 1),
    displayName: asString(card.displayName, `${label}.displayName`),
    description: asString(card.description, `${label}.description`),
    traitId: asString(card.traitId, `${label}.traitId`),
    type,
    graspCost,
    unlockCosts: validateCosts(card.unlockCosts, `${label}.unlockCosts`),
    ranks: validateRanks(card.ranks, `${label}.ranks`),
    autoActivationRequirements,
    autoActivationText,
    relatedCardIds: sortedUniqueStrings(card.relatedCardIds, `${label}.relatedCardIds`),
    unlock: {
      initiallyRevealable: asBoolean(
        unlock.initiallyRevealable,
        `${label}.unlock.initiallyRevealable`,
      ),
      adjacentCardIds: sortedUniqueStrings(
        unlock.adjacentCardIds,
        `${label}.unlock.adjacentCardIds`,
      ),
    },
    mechanics: asJsonObject(card.mechanics, `${label}.mechanics`),
    rankEffects: validateSamples(card.rankEffects, `${label}.rankEffects`),
    evidence: validateEvidence(card.evidence, `${label}.evidence`),
  };
}

function validateGraspLevel(value: unknown, label: string): RuntimeGraspLevel {
  const level = asRecord(value, label);
  return {
    level: asInteger(level.level, `${label}.level`, 1),
    capacityIncrease: asInteger(level.capacityIncrease, `${label}.capacityIncrease`, 1),
    cumulativeCapacity: asInteger(level.cumulativeCapacity, `${label}.cumulativeCapacity`, 1),
    costs: validateCosts(level.costs, `${label}.costs`),
  };
}

function expectedAdjacentIds(
  layout: readonly RuntimeArcanaLayoutEntry[],
  entry: RuntimeArcanaLayoutEntry,
): readonly string[] {
  return layout
    .filter(
      (candidate) =>
        Math.abs(candidate.row - entry.row) + Math.abs(candidate.column - entry.column) === 1,
    )
    .map((candidate) => candidate.cardId)
    .toSorted();
}

function validateCrossReferences(report: RuntimeArcanaReport): void {
  const layoutById = new Map(report.layout.map((entry) => [entry.cardId, entry]));
  const cardIds = report.cards.map((card) => card.id);
  if (
    report.cards.length !== report.layout.length ||
    new Set(cardIds).size !== cardIds.length ||
    cardIds.some((id, index) => id !== cardIds.toSorted()[index])
  ) {
    throw new Error("runtime Arcana report.cards must be unique and sorted by id.");
  }
  if (cardIds.some((id) => !layoutById.has(id))) {
    throw new Error("runtime Arcana report.cards and layout identifiers must match.");
  }
  if (!layoutById.has(report.unlockModel.startingCardId)) {
    throw new Error("runtime Arcana report starting card is absent from the layout.");
  }
  for (const card of report.cards) {
    const layoutEntry = layoutById.get(card.id);
    if (layoutEntry?.row !== card.row || layoutEntry.column !== card.column) {
      throw new Error(`Arcana Card ${card.id} has coordinates that disagree with the layout.`);
    }
    const expectedAdjacent = expectedAdjacentIds(report.layout, layoutEntry);
    if (
      card.unlock.adjacentCardIds.length !== expectedAdjacent.length ||
      card.unlock.adjacentCardIds.some((id, index) => id !== expectedAdjacent[index])
    ) {
      throw new Error(`Arcana Card ${card.id} has an invalid adjacency list.`);
    }
    const shouldStart = card.id === report.unlockModel.startingCardId;
    if (card.unlock.initiallyRevealable !== shouldStart) {
      throw new Error(`Arcana Card ${card.id} has an invalid initial reveal flag.`);
    }
    for (const relatedId of card.relatedCardIds) {
      if (!layoutById.has(relatedId) || relatedId === card.id) {
        throw new Error(`Arcana Card ${card.id} has invalid related card ${relatedId}.`);
      }
    }
    for (const rank of card.ranks) {
      const successful = card.rankEffects.some(
        (sample) =>
          sample.rarity === rank.rarity && sample.level === 1 && sample.result.status === "ok",
      );
      if (!successful) {
        throw new Error(`Arcana Card ${card.id} has no successful ${rank.rarity} rank sample.`);
      }
    }
  }
}

export function validateRuntimeArcanaReport(value: unknown): RuntimeArcanaReport {
  const report = asRecord(value, "runtime Arcana report");
  const game = asRecord(report.game, "runtime Arcana report.game");
  const unlockModel = asRecord(report.unlockModel, "runtime Arcana report.unlockModel");
  if (unlockModel.kind !== "orthogonal-adjacency") {
    throw new Error("runtime Arcana report.unlockModel.kind is unsupported.");
  }
  if (unlockModel.layoutMutableAfterUnlock !== true) {
    throw new Error("runtime Arcana report must record that the unlocked layout is mutable.");
  }
  const layout = validateLayout(report.layout);
  const grasp = asRecord(report.grasp, "runtime Arcana report.grasp");
  const startingCapacity = asInteger(
    grasp.startingCapacity,
    "runtime Arcana report.grasp.startingCapacity",
    1,
  );
  const levels = asArray(grasp.levels, "runtime Arcana report.grasp.levels").map(
    (entry, index) => validateGraspLevel(entry, `runtime Arcana report.grasp.levels[${index}]`),
  );
  if (levels.length === 0) throw new Error("runtime Arcana report.grasp.levels must not be empty.");
  let capacity = startingCapacity;
  for (const [index, level] of levels.entries()) {
    capacity += level.capacityIncrease;
    if (level.level !== index + 1 || level.cumulativeCapacity !== capacity) {
      throw new Error("runtime Arcana report.grasp.levels must be contiguous and cumulative.");
    }
    if (level.costs.length === 0) {
      throw new Error(`runtime Arcana report.grasp.levels[${index}] must have a cost.`);
    }
  }
  const cards = asArray(report.cards, "runtime Arcana report.cards").map((entry, index) =>
    validateCard(entry, `runtime Arcana report.cards[${index}]`),
  );
  const validated: RuntimeArcanaReport = {
    schema:
      report.schema === "neodes2-arcana-runtime-1"
        ? report.schema
        : (() => {
            throw new Error("runtime Arcana report.schema is unsupported.");
          })(),
    exporterVersion: asString(report.exporterVersion, "runtime Arcana report.exporterVersion"),
    generatedAtUnixSeconds: asInteger(
      report.generatedAtUnixSeconds,
      "runtime Arcana report.generatedAtUnixSeconds",
    ),
    language:
      report.language === "en"
        ? "en"
        : (() => {
            throw new Error("runtime Arcana report.language must be en.");
          })(),
    game: {
      steamBuildId: asString(game.steamBuildId, "runtime Arcana report.game.steamBuildId"),
      executableVersion: asString(
        game.executableVersion,
        "runtime Arcana report.game.executableVersion",
      ),
      packageVersion: asString(game.packageVersion, "runtime Arcana report.game.packageVersion"),
      acquisitionId: asString(game.acquisitionId, "runtime Arcana report.game.acquisitionId"),
      sourceManifestSha256: asString(
        game.sourceManifestSha256,
        "runtime Arcana report.game.sourceManifestSha256",
      ),
    },
    sourceTables: sortedUniqueStrings(report.sourceTables, "runtime Arcana report.sourceTables"),
    localizationFiles: sortedUniqueStrings(
      report.localizationFiles,
      "runtime Arcana report.localizationFiles",
    ),
    unlockModel: {
      kind: "orthogonal-adjacency",
      startingCardId: asString(
        unlockModel.startingCardId,
        "runtime Arcana report.unlockModel.startingCardId",
      ),
      layoutMutableAfterUnlock: true,
    },
    layout,
    grasp: {
      id: asString(grasp.id, "runtime Arcana report.grasp.id"),
      displayName: asString(grasp.displayName, "runtime Arcana report.grasp.displayName"),
      description: asString(grasp.description, "runtime Arcana report.grasp.description"),
      startingCapacity,
      levels,
      evidence: validateEvidence(grasp.evidence, "runtime Arcana report.grasp.evidence"),
    },
    cards,
  };
  validateCrossReferences(validated);
  return validated;
}
