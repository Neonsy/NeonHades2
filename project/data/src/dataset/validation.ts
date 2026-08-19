import type { JsonValue } from "../boons/index.js";
import type { RuntimeLoadoutCost } from "../loadouts/index.js";
import type { RuntimeCost } from "../weapons/index.js";
import type {
  DatasetDomainName,
  DatasetValidationIssue,
  DatasetValidationReport,
  NormalizedDomains,
} from "./types.js";

type Cost = RuntimeCost | RuntimeLoadoutCost;

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function issue(
  issues: DatasetValidationIssue[],
  code: DatasetValidationIssue["code"],
  domain: DatasetDomainName,
  path: string,
  detail: string,
): void {
  issues.push({ code, domain, path, detail });
}

function ids<T extends { readonly id: string }>(records: readonly T[]): ReadonlySet<string> {
  return new Set(records.map((record) => record.id));
}

function validateUniqueIds(
  domain: DatasetDomainName,
  path: string,
  records: readonly { readonly id: string }[],
  issues: DatasetValidationIssue[],
): void {
  const seen = new Set<string>();
  for (const [index, record] of records.entries()) {
    if (record.id.trim() === "") {
      issue(issues, "invalid-range", domain, `${path}[${index}].id`, "Identifier is empty.");
    } else if (seen.has(record.id)) {
      issue(issues, "duplicate-id", domain, `${path}[${index}].id`, `Identifier ${record.id} is repeated.`);
    }
    seen.add(record.id);
  }
}

function requireNonempty(
  domain: DatasetDomainName,
  path: string,
  values: readonly unknown[],
  issues: DatasetValidationIssue[],
): void {
  if (values.length === 0) {
    issue(issues, "empty-collection", domain, path, "Required collection is empty.");
  }
}

function requireNames(
  domain: DatasetDomainName,
  path: string,
  records: readonly {
    readonly id: string;
    readonly name?: string | null;
    readonly displayName?: string | null;
  }[],
  field: "displayName" | "name",
  issues: DatasetValidationIssue[],
): void {
  for (const record of records) {
    if ((record[field] ?? "").trim() === "") {
      issue(issues, "missing-name", domain, `${path}.${record.id}`, "Official English name is missing.");
    }
  }
}

function validateReferences(
  domain: DatasetDomainName,
  path: string,
  values: readonly string[],
  available: ReadonlySet<string>,
  issues: DatasetValidationIssue[],
): void {
  for (const value of values) {
    if (!available.has(value)) {
      issue(issues, "reference", domain, path, `Referenced identifier ${value} is absent.`);
    }
  }
}

function validateEnum(
  domain: DatasetDomainName,
  path: string,
  value: string | null | undefined,
  allowed: ReadonlySet<string>,
  issues: DatasetValidationIssue[],
): void {
  if (value !== null && value !== undefined && !allowed.has(value)) {
    issue(issues, "unknown-enum", domain, path, `Unknown value ${value}.`);
  }
}

function validateCosts(
  domain: DatasetDomainName,
  path: string,
  costs: readonly Cost[],
  resourceIds: ReadonlySet<string>,
  issues: DatasetValidationIssue[],
): void {
  for (const [index, cost] of costs.entries()) {
    if (!Number.isSafeInteger(cost.amount) || cost.amount < 0 || cost.resourceId.trim() === "") {
      issue(issues, "invalid-cost", domain, `${path}[${index}]`, "Cost requires a resource identifier and a nonnegative integer amount.");
      continue;
    }
    if (!resourceIds.has(cost.resourceId)) {
      issue(issues, "cost-reference", domain, `${path}[${index}]`, `Cost resource ${cost.resourceId} is absent from guide resources.`);
    }
  }
}

function validateConsecutiveRanks(
  domain: DatasetDomainName,
  path: string,
  ranks: readonly { readonly rank: number }[],
  issues: DatasetValidationIssue[],
): void {
  for (const [index, rank] of ranks.entries()) {
    if (rank.rank !== index + 1) {
      issue(issues, "invalid-range", domain, `${path}[${index}].rank`, `Expected consecutive rank ${index + 1}, found ${rank.rank}.`);
    }
  }
}

function validateBoons(domains: NormalizedDomains, issues: DatasetValidationIssue[]): void {
  const { boons } = domains;
  requireNonempty("boons", "gods", boons.gods, issues);
  requireNonempty("boons", "boons", boons.boons, issues);
  validateUniqueIds("boons", "gods", boons.gods, issues);
  validateUniqueIds("boons", "boons", boons.boons, issues);
  requireNames("boons", "gods", boons.gods, "name", issues);
  requireNames("boons", "boons", boons.boons, "name", issues);
  const godIds = ids(boons.gods);
  const boonIds = ids(boons.boons);
  const allowedKinds = new Set(["duo", "infusion", "legendary", "normal"]);
  for (const god of boons.gods) {
    validateReferences("boons", `gods.${god.id}.boonIds`, god.boonIds, boonIds, issues);
  }
  for (const boon of boons.boons) {
    validateReferences("boons", `boons.${boon.id}.godIds`, boon.godIds, godIds, issues);
    if (!allowedKinds.has(boon.kind)) {
      issue(issues, "unknown-enum", "boons", `boons.${boon.id}.kind`, `Unknown boon kind ${boon.kind}.`);
    }
  }
}

function validateWeapons(
  domains: NormalizedDomains,
  resourceIds: ReadonlySet<string>,
  issues: DatasetValidationIssue[],
): void {
  const { weapons } = domains;
  for (const [path, records] of [
    ["weapons", weapons.weapons],
    ["aspects", weapons.aspects],
    ["hammers", weapons.hammers],
  ] as const) {
    requireNonempty("weapons", path, records, issues);
    validateUniqueIds("weapons", path, records, issues);
    requireNames("weapons", path, records, "name", issues);
  }
  const weaponIds = ids(weapons.weapons);
  const aspectIds = ids(weapons.aspects);
  const hammerIds = ids(weapons.hammers);
  for (const weapon of weapons.weapons) {
    validateCosts("weapons", `weapons.${weapon.id}.unlockCosts`, weapon.unlockCosts, resourceIds, issues);
  }
  for (const aspect of weapons.aspects) {
    validateReferences("weapons", `aspects.${aspect.id}.weaponId`, [aspect.weaponId], weaponIds, issues);
    validateConsecutiveRanks("weapons", `aspects.${aspect.id}.ranks`, aspect.ranks, issues);
    for (const rank of aspect.ranks) {
      validateCosts("weapons", `aspects.${aspect.id}.ranks.${rank.rank}.costs`, rank.costs, resourceIds, issues);
    }
  }
  for (const hammer of weapons.hammers) {
    validateReferences("weapons", `hammers.${hammer.id}.weaponId`, [hammer.weaponId], weaponIds, issues);
    for (const [field, values] of [
      ["allowedAspectIds", hammer.compatibility.allowedAspectIds],
      ["excludedAspectIds", hammer.compatibility.excludedAspectIds],
      ["requiredAspectIds", hammer.compatibility.requiredAspectIds],
    ] as const) {
      validateReferences("weapons", `hammers.${hammer.id}.${field}`, values, aspectIds, issues);
    }
    validateReferences("weapons", `hammers.${hammer.id}.incompatibleHammerIds`, hammer.compatibility.incompatibleHammerIds, hammerIds, issues);
  }
}

function validateArcana(
  domains: NormalizedDomains,
  resourceIds: ReadonlySet<string>,
  issues: DatasetValidationIssue[],
): void {
  const { arcana } = domains;
  requireNonempty("arcana", "cards", arcana.cards, issues);
  requireNonempty("arcana", "layout", arcana.layout, issues);
  requireNonempty("arcana", "grasp.levels", arcana.grasp.levels, issues);
  validateUniqueIds("arcana", "cards", arcana.cards, issues);
  requireNames("arcana", "cards", arcana.cards, "name", issues);
  if (arcana.grasp.displayName.trim() === "") {
    issue(issues, "missing-name", "arcana", "grasp.displayName", "Official English Grasp name is missing.");
  }
  const cardIds = ids(arcana.cards);
  if (arcana.unlockModel.kind !== "orthogonal-adjacency" || arcana.unlockModel.layoutMutableAfterUnlock !== true) {
    issue(issues, "unknown-enum", "arcana", "unlockModel", "Unknown Arcana unlock model.");
  }
  validateReferences("arcana", "unlockModel.startingCardId", [arcana.unlockModel.startingCardId], cardIds, issues);
  const allowedTypes = new Set<string | null>([null, "Death", "Life", "Soul", "Time"]);
  for (const entry of arcana.layout) {
    validateReferences("arcana", `layout.${entry.row}.${entry.column}`, [entry.cardId], cardIds, issues);
    if (!Number.isSafeInteger(entry.row) || entry.row < 1 || !Number.isSafeInteger(entry.column) || entry.column < 1) {
      issue(issues, "invalid-range", "arcana", `layout.${entry.cardId}`, "Layout row and column must be positive integers.");
    }
  }
  for (const card of arcana.cards) {
    if (!allowedTypes.has(card.type)) {
      issue(issues, "unknown-enum", "arcana", `cards.${card.id}.type`, `Unknown Arcana type ${String(card.type)}.`);
    }
    if (!Number.isSafeInteger(card.graspCost) || card.graspCost < 0) {
      issue(issues, "invalid-range", "arcana", `cards.${card.id}.graspCost`, "Grasp cost must be a nonnegative integer.");
    }
    validateReferences("arcana", `cards.${card.id}.relatedCardIds`, card.relatedCardIds, cardIds, issues);
    validateReferences("arcana", `cards.${card.id}.unlock.adjacentCardIds`, card.unlock.adjacentCardIds, cardIds, issues);
    validateCosts("arcana", `cards.${card.id}.unlockCosts`, card.unlockCosts, resourceIds, issues);
    validateConsecutiveRanks("arcana", `cards.${card.id}.ranks`, card.ranks, issues);
    for (const rank of card.ranks) {
      validateCosts("arcana", `cards.${card.id}.ranks.${rank.rank}.upgradeFromPreviousCosts`, rank.upgradeFromPreviousCosts, resourceIds, issues);
    }
  }
  let previousCapacity = arcana.grasp.startingCapacity;
  for (const [index, level] of arcana.grasp.levels.entries()) {
    if (level.level !== index + 1 || level.capacityIncrease < 0 || level.cumulativeCapacity < previousCapacity) {
      issue(issues, "invalid-range", "arcana", `grasp.levels[${index}]`, "Grasp levels must be consecutive with nondecreasing capacity.");
    }
    previousCapacity = level.cumulativeCapacity;
    validateCosts("arcana", `grasp.levels.${level.level}.costs`, level.costs, resourceIds, issues);
  }
}

function validateLoadouts(
  domains: NormalizedDomains,
  resourceIds: ReadonlySet<string>,
  issues: DatasetValidationIssue[],
): void {
  const { loadouts, guide } = domains;
  for (const [path, records] of [
    ["keepsakes", loadouts.keepsakes],
    ["familiars", loadouts.familiars],
    ["hexes", loadouts.hexes],
    ["incantations", loadouts.incantations],
  ] as const) {
    requireNonempty("loadouts", path, records, issues);
    validateUniqueIds("loadouts", path, records, issues);
    requireNames("loadouts", path, records, "displayName", issues);
  }
  const relationshipIds = ids(guide.relationships);
  for (const keepsake of loadouts.keepsakes) {
    validateReferences("loadouts", `keepsakes.${keepsake.id}.relationshipId`, [keepsake.relationshipId], relationshipIds, issues);
    if (keepsake.chamberThresholds.some((value, index, values) => value <= 0 || (index > 0 && value <= values[index - 1]!))) {
      issue(issues, "invalid-range", "loadouts", `keepsakes.${keepsake.id}.chamberThresholds`, "Chamber thresholds must be positive and strictly increasing.");
    }
    if (
      keepsake.naturalRanks.length !== 3 ||
      keepsake.naturalRanks[0] !== "Common" ||
      keepsake.naturalRanks[1] !== "Rare" ||
      keepsake.naturalRanks[2] !== "Epic" ||
      (keepsake.temporaryBonusRank !== null && keepsake.temporaryBonusRank !== "Heroic")
    ) {
      issue(issues, "unknown-enum", "loadouts", `keepsakes.${keepsake.id}.ranks`, "Unknown keepsake rank sequence.");
    }
  }
  const talentCategories = new Set(["Legendary", "Repeatable", "Unique"]);
  for (const familiar of loadouts.familiars) {
    validateUniqueIds("loadouts", `familiars.${familiar.id}.upgrades`, familiar.upgrades, issues);
    requireNames("loadouts", `familiars.${familiar.id}.upgrades`, familiar.upgrades, "displayName", issues);
    for (const upgrade of familiar.upgrades) {
      validateConsecutiveRanks("loadouts", `familiars.${familiar.id}.upgrades.${upgrade.id}.ranks`, upgrade.ranks, issues);
      for (const rank of upgrade.ranks) {
        validateCosts("loadouts", `familiars.${familiar.id}.upgrades.${upgrade.id}.ranks.${rank.rank}.costs`, rank.costs, resourceIds, issues);
      }
    }
  }
  for (const hex of loadouts.hexes) {
    validateUniqueIds("loadouts", `hexes.${hex.id}.talents`, hex.talents, issues);
    requireNames("loadouts", `hexes.${hex.id}.talents`, hex.talents, "displayName", issues);
    for (const talent of hex.talents) {
      if (!talentCategories.has(talent.category)) {
        issue(issues, "unknown-enum", "loadouts", `hexes.${hex.id}.talents.${talent.id}.category`, `Unknown talent category ${talent.category}.`);
      }
    }
  }
  for (const incantation of loadouts.incantations) {
    validateCosts("loadouts", `incantations.${incantation.id}.costs`, incantation.costs, resourceIds, issues);
  }
}

function inspectPresentationData(
  value: JsonValue,
  path: string,
  issues: DatasetValidationIssue[],
): void {
  if (value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => inspectPresentationData(entry, `${path}[${index}]`, issues));
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (key === "Cue" || key.includes("VoiceLines")) {
      issue(issues, "presentation-data", "guide", `${path}.${key}`, "Excluded dialogue presentation data is present.");
    } else if (key === "Text" && typeof entry === "string" && !/^[A-Za-z_][A-Za-z0-9_.:-]*$/u.test(entry)) {
      issue(issues, "presentation-data", "guide", `${path}.Text`, "Excluded prose text is present in generic record data.");
    }
    if (entry !== undefined) inspectPresentationData(entry, `${path}.${key}`, issues);
  }
}

function validateGuide(domains: NormalizedDomains, issues: DatasetValidationIssue[]): void {
  const { guide } = domains;
  const collections = [
    ["routes", guide.routes], ["regions", guide.regions], ["rooms", guide.rooms],
    ["encounters", guide.encounters], ["enemies", guide.enemies], ["rewards", guide.rewards],
    ["consumables", guide.consumables], ["resources", guide.resources], ["statusElements", guide.statusElements],
    ["oathConditions", guide.oathConditions], ["bounties", guide.bounties], ["relationships", guide.relationships],
    ["prophecies", guide.prophecies], ["narrative", guide.narrative], ["outros", guide.outros],
    ["achievements", guide.achievements], ["namedRequirements", guide.namedRequirements],
    ["runClearMessages", guide.runClearMessages],
  ] as const;
  for (const [path, records] of collections) {
    requireNonempty("guide", path, records, issues);
    validateUniqueIds("guide", path, records, issues);
  }
  for (const [path, records] of [
    ["regions", guide.regions], ["resources", guide.resources], ["statusElements", guide.statusElements],
    ["oathConditions", guide.oathConditions], ["relationships", guide.relationships],
    ["prophecies", guide.prophecies], ["achievements", guide.achievements],
  ] as const) {
    requireNames("guide", path, records, "displayName", issues);
  }
  const regionIds = ids(guide.regions);
  const roomIds = ids(guide.rooms);
  const encounterIds = ids(guide.encounters);
  const enemyIds = ids(guide.enemies);
  const rewardIds = new Set([...guide.rewards, ...guide.consumables, ...guide.resources].map((record) => record.id));
  for (const route of guide.routes) validateReferences("guide", `routes.${route.id}.regionIds`, route.regionIds, regionIds, issues);
  for (const region of guide.regions) {
    if (region.routeId !== null) {
      validateReferences("guide", `regions.${region.id}.routeId`, [region.routeId], ids(guide.routes), issues);
    }
    validateReferences("guide", `regions.${region.id}.roomIds`, region.roomIds, roomIds, issues);
  }
  for (const room of guide.rooms) {
    validateReferences("guide", `rooms.${room.id}.regionId`, [room.regionId], regionIds, issues);
    validateReferences("guide", `rooms.${room.id}.encounterIds`, room.encounterIds, encounterIds, issues);
    validateReferences("guide", `rooms.${room.id}.rewardIds`, room.rewardIds, rewardIds, issues);
  }
  for (const encounter of guide.encounters) {
    validateReferences("guide", `encounters.${encounter.id}.regionIds`, encounter.regionIds, regionIds, issues);
    validateReferences("guide", `encounters.${encounter.id}.enemyIds`, encounter.enemyIds, enemyIds, issues);
    validateReferences("guide", `encounters.${encounter.id}.rewardIds`, encounter.rewardIds, rewardIds, issues);
    validateEnum(
      "guide",
      `encounters.${encounter.id}.classification`,
      encounter.classification,
      new Set(["arachnecombat", "default", "devotion", "elitechallenge", "guardian", "miniboss", "noncombat", "perfectclear", "timechallenge"]),
      issues,
    );
  }
  for (const [path, records, allowed] of [
    ["statusElements", guide.statusElements, new Set(["effect", "element-or-infusion"])],
    ["bounties", guide.bounties, new Set(["bounty", "package"])],
    ["narrative", guide.narrative, new Set(["story"])],
    ["outros", guide.outros, new Set(["postgame", "route-clear", "story-reset"])],
  ] as const) {
    for (const record of records) {
      validateEnum("guide", `${path}.${record.id}.classification`, record.classification, allowed, issues);
    }
  }
  validateReferences("guide", "bountyOrder", guide.bountyOrder, ids(guide.bounties), issues);
  const outroIds = ids(guide.outros);
  for (const [index, priority] of guide.outroPriorities.entries()) {
    validateReferences("guide", `outroPriorities[${index}]`, typeof priority === "string" ? [priority] : priority, outroIds, issues);
  }
  for (const [path, records] of collections) {
    for (const record of records) {
      if ("data" in record) inspectPresentationData(record.data, `${path}.${record.id}.data`, issues);
    }
  }
}

export function validateNormalizedDomains(domains: NormalizedDomains): DatasetValidationReport {
  const issues: DatasetValidationIssue[] = [];
  const sourceAcquisitionId = domains.boons.source.acquisitionId;
  const resourceIds = new Set(
    [...domains.guide.rewards, ...domains.guide.consumables, ...domains.guide.resources].map((record) => record.id),
  );
  validateBoons(domains, issues);
  validateWeapons(domains, resourceIds, issues);
  validateArcana(domains, resourceIds, issues);
  validateLoadouts(domains, resourceIds, issues);
  validateGuide(domains, issues);
  issues.sort(
    (left, right) =>
      compareStrings(left.domain, right.domain) ||
      compareStrings(left.path, right.path) ||
      compareStrings(left.code, right.code) ||
      compareStrings(left.detail, right.detail),
  );
  const domainRecordCounts = {
    arcana: domains.arcana.cards.length + domains.arcana.grasp.levels.length,
    boons: domains.boons.gods.length + domains.boons.boons.length,
    guide: [
      domains.guide.routes, domains.guide.regions, domains.guide.rooms, domains.guide.encounters,
      domains.guide.enemies, domains.guide.rewards, domains.guide.consumables, domains.guide.resources,
      domains.guide.statusElements, domains.guide.oathConditions, domains.guide.bounties,
      domains.guide.relationships, domains.guide.prophecies, domains.guide.narrative, domains.guide.outros,
      domains.guide.achievements, domains.guide.namedRequirements, domains.guide.runClearMessages,
    ].reduce((count, records) => count + records.length, 0),
    loadouts:
      domains.loadouts.keepsakes.length + domains.loadouts.familiars.length +
      domains.loadouts.familiars.reduce((count, record) => count + record.upgrades.length, 0) +
      domains.loadouts.hexes.length +
      domains.loadouts.hexes.reduce((count, record) => count + record.talents.length, 0) +
      domains.loadouts.incantations.length,
    weapons: domains.weapons.weapons.length + domains.weapons.aspects.length + domains.weapons.hammers.length,
  } as const;
  return {
    schema: "neodes2-dataset-validation-1",
    sourceAcquisitionId,
    domainRecordCounts,
    issues,
    complete: issues.length === 0,
  };
}
