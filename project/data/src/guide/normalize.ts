import type { JsonObject, JsonValue } from "../boons/runtime-schema.js";
import type { GuideSourceAudit } from "./source-audit.js";
import type {
  RuntimeEncounter,
  RuntimeEnemy,
  RuntimeGuideRecord,
  RuntimeGuideReport,
  RuntimeOutroPriority,
  RuntimeRegion,
  RuntimeRoom,
  RuntimeRoute,
} from "./runtime-schema.js";

export interface NormalizedResource extends RuntimeGuideRecord {
  readonly acquisitionReferences: readonly string[];
  readonly useReferences: readonly string[];
}

export interface NormalizedAchievement extends RuntimeGuideRecord {
  readonly displayName: string;
  readonly description: string;
  readonly hidden: boolean;
}

export interface NormalizedGuideDataset {
  readonly schema: "neodes2-guide-data-1";
  readonly source: {
    readonly acquisitionId: string;
    readonly exporterVersion: string;
    readonly steamBuildId: string;
    readonly executableVersion: string;
    readonly packageVersion: string;
  };
  readonly routes: readonly RuntimeRoute[];
  readonly regions: readonly RuntimeRegion[];
  readonly rooms: readonly RuntimeRoom[];
  readonly encounters: readonly RuntimeEncounter[];
  readonly enemies: readonly RuntimeEnemy[];
  readonly rewards: readonly RuntimeGuideRecord[];
  readonly consumables: readonly RuntimeGuideRecord[];
  readonly resources: readonly NormalizedResource[];
  readonly statusElements: readonly RuntimeGuideRecord[];
  readonly oathConditions: readonly RuntimeGuideRecord[];
  readonly bounties: readonly RuntimeGuideRecord[];
  readonly bountyOrder: readonly string[];
  readonly relationships: readonly RuntimeGuideRecord[];
  readonly prophecies: readonly RuntimeGuideRecord[];
  readonly narrative: readonly RuntimeGuideRecord[];
  readonly outros: readonly RuntimeGuideRecord[];
  readonly outroPriorities: readonly RuntimeOutroPriority[];
  readonly achievements: readonly NormalizedAchievement[];
  readonly namedRequirements: readonly RuntimeGuideRecord[];
  readonly runClearMessages: readonly RuntimeGuideRecord[];
}

export interface GuideCoverageIssue {
  readonly code:
    | "cross-reference"
    | "empty-domain"
    | "missing-official-text"
    | "source-disagreement";
  readonly domain: string;
  readonly recordId: string;
  readonly detail: string;
}

export interface GuideCoverageReport {
  readonly schema: "neodes2-guide-coverage-1";
  readonly acquisitionId: string;
  readonly counts: Readonly<Record<string, number>>;
  readonly omissionCount: number;
  readonly issues: readonly GuideCoverageIssue[];
  readonly complete: boolean;
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalize(value: JsonValue): JsonValue {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const objectValue = value as JsonObject;
  const output: Record<string, JsonValue> = {};
  for (const key of Object.keys(objectValue).sort(compareStrings)) {
    const entry = objectValue[key];
    if (entry !== undefined) output[key] = canonicalize(entry);
  }
  return output;
}

function canonicalRecord<T extends RuntimeGuideRecord>(record: T): T {
  return {
    ...record,
    data: canonicalize(record.data),
    omissions: [...record.omissions].sort(compareStrings),
  };
}

function ids(records: readonly { readonly id: string }[]): ReadonlySet<string> {
  return new Set(records.map((record) => record.id));
}

function sameValues(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function flattenedOutroPriorities(values: readonly RuntimeOutroPriority[]): readonly string[] {
  return values.flatMap((value) => typeof value === "string" ? [value] : value);
}

function containsReference(value: JsonValue, target: string): boolean {
  if (value === target) return true;
  if (value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((entry) => containsReference(entry, target));
  return Object.entries(value).some(
    ([key, entry]) => key === target || (entry !== undefined && containsReference(entry, target)),
  );
}

function referencesTo(
  resourceId: string,
  groups: readonly (readonly RuntimeGuideRecord[])[],
): readonly string[] {
  const output = new Set<string>();
  for (const group of groups) {
    for (const record of group) {
      if (containsReference(record.data, resourceId)) output.add(record.evidence.runtimePath);
    }
  }
  return [...output].sort(compareStrings);
}

function addEmptyIssue(
  domain: string,
  records: readonly unknown[],
  issues: GuideCoverageIssue[],
): void {
  if (records.length === 0) {
    issues.push({ code: "empty-domain", domain, recordId: domain, detail: "No records were exported." });
  }
}

function requireText(
  domain: string,
  records: readonly RuntimeGuideRecord[],
  issues: GuideCoverageIssue[],
): void {
  for (const record of records) {
    if (record.displayName === null) {
      issues.push({
        code: "missing-official-text",
        domain,
        recordId: record.id,
        detail: "Official English display name is missing.",
      });
    }
  }
}

function addMissingReferences(
  domain: string,
  recordId: string,
  values: readonly string[],
  available: ReadonlySet<string>,
  issues: GuideCoverageIssue[],
): void {
  for (const value of values) {
    if (!available.has(value)) {
      issues.push({
        code: "cross-reference",
        domain,
        recordId,
        detail: `Referenced identifier ${value} is absent from the normalized dataset.`,
      });
    }
  }
}

export function normalizeRuntimeGuide(
  report: RuntimeGuideReport,
  sourceAudit: GuideSourceAudit,
): { readonly dataset: NormalizedGuideDataset; readonly coverage: GuideCoverageReport } {
  const issues: GuideCoverageIssue[] = [];
  const regionIds = ids(report.regions);
  const roomIds = ids(report.rooms);
  const encounterIds = ids(report.encounters);
  const enemyIds = ids(report.enemies);
  const rewardIds = new Set([
    ...report.rewards.map((record) => record.id),
    ...report.consumables.map((record) => record.id),
    ...report.resources.map((record) => record.id),
  ]);
  for (const route of report.routes) addMissingReferences("routes", route.id, route.regionIds, regionIds, issues);
  for (const region of report.regions) addMissingReferences("regions", region.id, region.roomIds, roomIds, issues);
  for (const room of report.rooms) {
    addMissingReferences("rooms", room.id, [room.regionId], regionIds, issues);
    addMissingReferences("rooms", room.id, room.encounterIds, encounterIds, issues);
    addMissingReferences("rooms", room.id, room.rewardIds, rewardIds, issues);
  }
  for (const encounter of report.encounters) {
    addMissingReferences("encounters", encounter.id, encounter.regionIds, regionIds, issues);
    addMissingReferences("encounters", encounter.id, encounter.enemyIds, enemyIds, issues);
    addMissingReferences("encounters", encounter.id, encounter.rewardIds, rewardIds, issues);
  }
  const runtimeUnderworld = report.routes.find((route) => route.id === "underworld")?.regionIds ?? [];
  const runtimeSurface = report.routes.find((route) => route.id === "surface")?.regionIds ?? [];
  for (const [label, runtime, source] of [
    ["underworld", runtimeUnderworld, sourceAudit.routeRegions.underworld],
    ["surface", runtimeSurface, sourceAudit.routeRegions.surface],
  ] as const) {
    if (!sameValues(runtime, source)) {
      issues.push({
        code: "source-disagreement",
        domain: "routes",
        recordId: label,
        detail: "Runtime route order differs from the static RoomSets audit.",
      });
    }
  }
  if (!sameValues(report.oathConditions.map((record) => record.id), sourceAudit.shrineOrder)) {
    issues.push({
      code: "source-disagreement",
      domain: "oathConditions",
      recordId: "ShrineUpgradeOrder",
      detail: "Runtime Oath condition order differs from the static source audit.",
    });
  }
  if (!sameValues(report.bountyOrder, sourceAudit.bountyOrder)) {
    issues.push({
      code: "source-disagreement",
      domain: "bounties",
      recordId: "BountyOrder",
      detail: "Runtime Testament order differs from the static source audit.",
    });
  }
  if (!sameValues(report.prophecies.map((record) => record.id), sourceAudit.questOrder)) {
    issues.push({
      code: "source-disagreement",
      domain: "prophecies",
      recordId: "QuestOrderData",
      detail: "Runtime prophecy order differs from the static source audit.",
    });
  }
  if (!sameValues(report.outros.map((record) => record.id), sourceAudit.outroIds)) {
    issues.push({
      code: "source-disagreement",
      domain: "outros",
      recordId: "GameOutroData",
      detail: "Runtime outro identifiers differ from the static HeroData audit.",
    });
  }
  if (!sameValues(flattenedOutroPriorities(report.outroPriorities), sourceAudit.outroOrder)) {
    issues.push({
      code: "source-disagreement",
      domain: "outros",
      recordId: "GameOutroPriorities",
      detail: "Runtime outro priority order differs from the static HeroData audit.",
    });
  }
  addMissingReferences("bounties", "BountyOrder", report.bountyOrder, ids(report.bounties), issues);

  const steamAchievements = new Map(sourceAudit.achievements.map((achievement) => [achievement.id, achievement]));
  const runtimeAchievementIds = report.achievements.map((record) => record.id).sort(compareStrings);
  const steamAchievementIds = [...steamAchievements.keys()].sort(compareStrings);
  if (!sameValues(runtimeAchievementIds, steamAchievementIds)) {
    issues.push({
      code: "source-disagreement",
      domain: "achievements",
      recordId: "Steam",
      detail: "Runtime achievement identifiers differ from the local Steam schema.",
    });
  }
  const achievements = report.achievements.flatMap((achievement): readonly NormalizedAchievement[] => {
    const official = steamAchievements.get(achievement.id);
    if (official === undefined) return [];
    return [{
      ...canonicalRecord(achievement),
      displayName: official.name,
      description: official.description,
      hidden: official.hidden,
    }];
  });

  const resources = report.resources
    .filter((resource) => resource.displayName !== null)
    .map((resource): NormalizedResource => ({
      ...canonicalRecord(resource),
      acquisitionReferences: referencesTo(resource.id, [
        report.rewards,
        report.consumables,
        report.rooms,
        report.encounters,
      ]),
      useReferences: referencesTo(resource.id, [
        report.oathConditions,
        report.bounties,
        report.relationships,
        report.prophecies,
      ]),
    }));
  const statusElements = [...report.statusEffects, ...report.elementalTraits]
    .filter((record) => record.displayName !== null)
    .map(canonicalRecord);

  const requiredDomains = {
    routes: report.routes,
    regions: report.regions,
    rooms: report.rooms,
    encounters: report.encounters,
    enemies: report.enemies,
    rewards: report.rewards,
    resources,
    statusElements,
    oathConditions: report.oathConditions,
    bounties: report.bounties,
    relationships: report.relationships,
    prophecies: report.prophecies,
    narrative: report.narrative,
    outros: report.outros,
    achievements,
    namedRequirements: report.namedRequirements,
  };
  for (const [domain, records] of Object.entries(requiredDomains)) addEmptyIssue(domain, records, issues);
  requireText("resources", resources, issues);
  requireText("statusElements", statusElements, issues);
  requireText("oathConditions", report.oathConditions, issues);
  requireText("relationships", report.relationships, issues);
  requireText("prophecies", report.prophecies, issues);
  const allRecords = [
    ...report.rooms,
    ...report.encounters,
    ...report.enemies,
    ...report.rewards,
    ...report.consumables,
    ...report.resources,
    ...report.statusEffects,
    ...report.elementalTraits,
    ...report.oathConditions,
    ...report.bounties,
    ...report.relationships,
    ...report.prophecies,
    ...report.narrative,
    ...report.outros,
    ...report.achievements,
    ...report.namedRequirements,
    ...report.runClearMessages,
  ];
  issues.sort(
    (left, right) =>
      compareStrings(left.domain, right.domain) ||
      compareStrings(left.recordId, right.recordId) ||
      compareStrings(left.code, right.code),
  );
  const counts = Object.fromEntries(
    Object.entries(requiredDomains).map(([domain, records]) => [domain, records.length]),
  );
  const dataset: NormalizedGuideDataset = {
    schema: "neodes2-guide-data-1",
    source: {
      acquisitionId: report.game.acquisitionId,
      exporterVersion: report.exporterVersion,
      steamBuildId: report.game.steamBuildId,
      executableVersion: report.game.executableVersion,
      packageVersion: report.game.packageVersion,
    },
    routes: report.routes,
    regions: report.regions,
    rooms: report.rooms.map(canonicalRecord),
    encounters: report.encounters.map(canonicalRecord),
    enemies: report.enemies.map(canonicalRecord),
    rewards: report.rewards.map(canonicalRecord),
    consumables: report.consumables.map(canonicalRecord),
    resources,
    statusElements,
    oathConditions: report.oathConditions.map(canonicalRecord),
    bounties: report.bounties.map(canonicalRecord),
    bountyOrder: report.bountyOrder,
    relationships: report.relationships.map(canonicalRecord),
    prophecies: report.prophecies.map(canonicalRecord),
    narrative: report.narrative.map(canonicalRecord),
    outros: report.outros.map(canonicalRecord),
    outroPriorities: report.outroPriorities,
    achievements,
    namedRequirements: report.namedRequirements.map(canonicalRecord),
    runClearMessages: report.runClearMessages.map(canonicalRecord),
  };
  return {
    dataset,
    coverage: {
      schema: "neodes2-guide-coverage-1",
      acquisitionId: report.game.acquisitionId,
      counts,
      omissionCount: allRecords.reduce((count, record) => count + record.omissions.length, 0),
      issues,
      complete: issues.length === 0,
    },
  };
}

export function renderGuideCoverage(coverage: GuideCoverageReport): string {
  const lines = [
    "# Guide data coverage",
    "",
    `- Acquisition: \`${coverage.acquisitionId}\``,
    `- Complete: ${coverage.complete}`,
    `- Filtered runtime omissions: ${coverage.omissionCount}`,
    `- Issues: ${coverage.issues.length}`,
    "",
    "## Counts",
    "",
    ...Object.entries(coverage.counts).map(([domain, count]) => `- ${domain}: ${count}`),
  ];
  if (coverage.issues.length > 0) {
    lines.push("", "## Issues", "");
    for (const issue of coverage.issues) {
      lines.push(`- ${issue.domain}/${issue.recordId} [${issue.code}]: ${issue.detail}`);
    }
  }
  return `${lines.join("\n")}\n`;
}
