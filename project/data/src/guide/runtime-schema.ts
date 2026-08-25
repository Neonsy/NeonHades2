import type { JsonObject, JsonValue, RuntimeBoonSample } from "../boons/runtime-schema.js";
import { validateRuntimeTraitSample } from "../boons/runtime-schema.js";

export interface RuntimeGuideGame {
  readonly steamBuildId: string;
  readonly executableVersion: string;
  readonly packageVersion: string;
  readonly acquisitionId: string;
  readonly sourceManifestSha256: string;
}

export interface RuntimeGuideEvidence {
  readonly runtimePath: string;
  readonly localizationPath: string | null;
}

export interface RuntimeGuideRecord {
  readonly id: string;
  readonly displayName: string | null;
  readonly description: string | null;
  readonly localizedFields?: Readonly<Record<string, string>>;
  readonly data: JsonValue;
  readonly omissions: readonly string[];
  readonly evidence: RuntimeGuideEvidence;
  readonly classification?: string | null;
  readonly order?: number;
}

export interface RuntimeRoute {
  readonly id: string;
  readonly regionIds: readonly string[];
}

export interface RuntimeRegion {
  readonly id: string;
  readonly displayName: string;
  readonly routeId: string | null;
  readonly routeOrder: number | null;
  readonly roomIds: readonly string[];
  readonly evidence: RuntimeGuideEvidence;
}

export interface RuntimeRoom extends RuntimeGuideRecord {
  readonly regionId: string;
  readonly encounterIds: readonly string[];
  readonly rewardIds: readonly string[];
}

export interface RuntimeEncounter extends RuntimeGuideRecord {
  readonly classification: string;
  readonly regionIds: readonly string[];
  readonly enemyIds: readonly string[];
  readonly rewardIds: readonly string[];
}

export interface RuntimeEnemy extends RuntimeGuideRecord {
  readonly classifications: readonly string[];
  readonly regionIds: readonly string[];
}

export type RuntimeOutroPriority = string | readonly string[];

export interface RuntimeGuideReport {
  readonly schema: "neodes2-guide-runtime-1";
  readonly exporterVersion: string;
  readonly generatedAtUnixSeconds: number;
  readonly language: "en";
  readonly game: RuntimeGuideGame;
  readonly routes: readonly RuntimeRoute[];
  readonly regions: readonly RuntimeRegion[];
  readonly rooms: readonly RuntimeRoom[];
  readonly encounters: readonly RuntimeEncounter[];
  readonly enemies: readonly RuntimeEnemy[];
  readonly rewards: readonly RuntimeGuideRecord[];
  readonly consumables: readonly RuntimeGuideRecord[];
  readonly resources: readonly RuntimeGuideRecord[];
  readonly statusEffects: readonly RuntimeGuideRecord[];
  readonly elementalTraits: readonly RuntimeGuideRecord[];
  readonly encounterAidTraits: readonly RuntimeGuideRecord[];
  readonly oathConditions: readonly RuntimeGuideRecord[];
  readonly bounties: readonly RuntimeGuideRecord[];
  readonly bountyOrder: readonly string[];
  readonly relationships: readonly RuntimeGuideRecord[];
  readonly prophecies: readonly RuntimeGuideRecord[];
  readonly narrative: readonly RuntimeGuideRecord[];
  readonly outros: readonly RuntimeGuideRecord[];
  readonly outroPriorities: readonly RuntimeOutroPriority[];
  readonly achievements: readonly RuntimeGuideRecord[];
  readonly namedRequirements: readonly RuntimeGuideRecord[];
  readonly runClearMessages: readonly RuntimeGuideRecord[];
  readonly sourceTables: readonly string[];
}

function record(value: unknown, path: string): Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${path} must be an object.`);
  }
  return value as Readonly<Record<string, unknown>>;
}

function stringValue(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${path} must be a nonempty string.`);
  return value;
}

function nullableString(value: unknown, path: string): string | null {
  if (value === null || value === "") return null;
  return stringValue(value, path);
}

function stringRecord(value: unknown, path: string): Readonly<Record<string, string>> {
  const input = record(value, path);
  return Object.fromEntries(Object.entries(input).map(([key, entry]) => [key, stringValue(entry, `${path}.${key}`)]));
}

function numberValue(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${path} must be a finite number.`);
  return value;
}

function strings(value: unknown, path: string): readonly string[] {
  if (!Array.isArray(value)) throw new Error(`${path} must be an array.`);
  return value.map((entry, index) => stringValue(entry, `${path}[${index}]`));
}

function sortedUniqueStrings(value: unknown, path: string): readonly string[] {
  const output = strings(value, path);
  const sorted = [...new Set(output)].sort();
  if (output.length !== sorted.length || output.some((entry, index) => entry !== sorted[index])) {
    throw new Error(`${path} must contain unique values in sorted order.`);
  }
  return output;
}

function jsonValue(value: unknown, path: string): JsonValue {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return value;
  }
  if (Array.isArray(value)) return value.map((entry, index) => jsonValue(entry, `${path}[${index}]`));
  const input = record(value, path);
  return Object.fromEntries(
    Object.entries(input).map(([key, entry]) => [key, jsonValue(entry, `${path}.${key}`)]),
  ) as JsonObject;
}

function assertNoPresentationData(value: JsonValue, path: string): void {
  if (value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoPresentationData(entry, `${path}[${index}]`));
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (key.includes("VoiceLines") || key === "Cue") {
      throw new Error(`${path}.${key} contains excluded presentation data.`);
    }
    if (
      key === "Text" &&
      typeof entry === "string" &&
      !/^[A-Za-z_][A-Za-z0-9_.:-]*$/u.test(entry)
    ) {
      throw new Error(`${path}.Text contains excluded prose.`);
    }
    if (entry !== undefined) assertNoPresentationData(entry, `${path}.${key}`);
  }
}

function uniqueIds(values: readonly { readonly id: string }[], path: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value.id)) throw new Error(`${path} repeats identifier ${value.id}.`);
    seen.add(value.id);
  }
}

function guideRecord(value: unknown, path: string): RuntimeGuideRecord {
  const input = record(value, path);
  const data = jsonValue(input.data, `${path}.data`);
  assertNoPresentationData(data, `${path}.data`);
  const evidence = record(input.evidence, `${path}.evidence`);
  const classification =
    input.classification === undefined ? undefined : nullableString(input.classification, `${path}.classification`);
  const order = input.order === undefined ? undefined : numberValue(input.order, `${path}.order`);
  const localizedFields = input.localizedFields === undefined
    ? undefined
    : stringRecord(input.localizedFields, `${path}.localizedFields`);
  return {
    id: stringValue(input.id, `${path}.id`),
    displayName: nullableString(input.displayName, `${path}.displayName`),
    description: nullableString(input.description, `${path}.description`),
    ...(localizedFields === undefined ? {} : { localizedFields }),
    data,
    omissions: strings(input.omissions, `${path}.omissions`),
    evidence: {
      runtimePath: stringValue(evidence.runtimePath, `${path}.evidence.runtimePath`),
      localizationPath: nullableString(evidence.localizationPath, `${path}.evidence.localizationPath`),
    },
    ...(classification === undefined ? {} : { classification }),
    ...(order === undefined ? {} : { order }),
  };
}

function guideRecords(value: unknown, path: string): readonly RuntimeGuideRecord[] {
  if (!Array.isArray(value)) throw new Error(`${path} must be an array.`);
  const output = value.map((entry, index) => guideRecord(entry, `${path}[${index}]`));
  uniqueIds(output, path);
  return output;
}

function encounterAidTraitRecords(value: unknown, path: string): readonly RuntimeGuideRecord[] {
  const output = guideRecords(value, path);
  return output.map((entry, index) => {
    const entryPath = `${path}[${index}]`;
    const data = record(entry.data, `${entryPath}.data`);
    stringValue(data.providerId, `${entryPath}.data.providerId`);
    record(data.trait, `${entryPath}.data.trait`);
    if (!Array.isArray(data.samples) || data.samples.length === 0) {
      throw new Error(`${entryPath}.data.samples must be a nonempty array.`);
    }
    const samples: readonly RuntimeBoonSample[] = data.samples.map((sample, sampleIndex) =>
      validateRuntimeTraitSample(sample, `${entryPath}.data.samples[${sampleIndex}]`));
    const sampleKeys = samples.map(
      (sample) => `${sample.rarity}\u0000${sample.endpoint}\u0000${sample.level}`,
    );
    if (new Set(sampleKeys).size !== sampleKeys.length) {
      throw new Error(`${entryPath}.data.samples must not repeat a rarity, endpoint, and level.`);
    }
    return entry;
  });
}

function specializedRecords<T extends RuntimeGuideRecord>(
  value: unknown,
  path: string,
  convert: (base: RuntimeGuideRecord, input: Readonly<Record<string, unknown>>, entryPath: string) => T,
): readonly T[] {
  if (!Array.isArray(value)) throw new Error(`${path} must be an array.`);
  const output = value.map((entry, index) => {
    const entryPath = `${path}[${index}]`;
    return convert(guideRecord(entry, entryPath), record(entry, entryPath), entryPath);
  });
  uniqueIds(output, path);
  return output;
}

function validateOutroPriorities(
  value: unknown,
  outros: readonly RuntimeGuideRecord[],
): readonly RuntimeOutroPriority[] {
  if (!Array.isArray(value)) throw new Error("report.outroPriorities must be an array.");
  const seen = new Set<string>();
  const available = new Set(outros.map((outro) => outro.id));
  const output = value.map((entry, index): RuntimeOutroPriority => {
    const ids = typeof entry === "string"
      ? [stringValue(entry, `report.outroPriorities[${index}]`)]
      : strings(entry, `report.outroPriorities[${index}]`);
    if (ids.length === 0) throw new Error(`report.outroPriorities[${index}] must not be empty.`);
    for (const id of ids) {
      if (seen.has(id)) throw new Error(`report.outroPriorities repeats ${id}.`);
      if (!available.has(id)) throw new Error(`report.outroPriorities references missing outro ${id}.`);
      seen.add(id);
    }
    return typeof entry === "string" ? ids[0] as string : ids;
  });
  if (seen.size !== available.size) {
    throw new Error("report.outroPriorities must cover every exported outro.");
  }
  return output;
}

export function validateRuntimeGuideReport(value: unknown): RuntimeGuideReport {
  const input = record(value, "report");
  if (input.schema !== "neodes2-guide-runtime-1") throw new Error("Unsupported guide runtime report schema.");
  if (input.language !== "en") throw new Error("Guide runtime report must use English localization.");
  const game = record(input.game, "report.game");
  const routes = (() => {
    if (!Array.isArray(input.routes)) throw new Error("report.routes must be an array.");
    const output = input.routes.map((entry, index) => {
      const route = record(entry, `report.routes[${index}]`);
      return {
        id: stringValue(route.id, `report.routes[${index}].id`),
        regionIds: strings(route.regionIds, `report.routes[${index}].regionIds`),
      };
    });
    uniqueIds(output, "report.routes");
    return output;
  })();
  const regions = (() => {
    if (!Array.isArray(input.regions)) throw new Error("report.regions must be an array.");
    const output = input.regions.map((entry, index) => {
      const path = `report.regions[${index}]`;
      const region = record(entry, path);
      const evidence = record(region.evidence, `${path}.evidence`);
      return {
        id: stringValue(region.id, `${path}.id`),
        displayName: stringValue(region.displayName, `${path}.displayName`),
        routeId: nullableString(region.routeId, `${path}.routeId`),
        routeOrder: region.routeOrder === null ? null : numberValue(region.routeOrder, `${path}.routeOrder`),
        roomIds: strings(region.roomIds, `${path}.roomIds`),
        evidence: {
          runtimePath: stringValue(evidence.runtimePath, `${path}.evidence.runtimePath`),
          localizationPath: nullableString(evidence.localizationPath, `${path}.evidence.localizationPath`),
        },
      };
    });
    uniqueIds(output, "report.regions");
    return output;
  })();
  const rooms = specializedRecords(input.rooms, "report.rooms", (base, entry, path) => ({
    ...base,
    regionId: stringValue(entry.regionId, `${path}.regionId`),
    encounterIds: strings(entry.encounterIds, `${path}.encounterIds`),
    rewardIds: strings(entry.rewardIds, `${path}.rewardIds`),
  }));
  const encounters = specializedRecords(input.encounters, "report.encounters", (base, entry, path) => ({
    ...base,
    classification: stringValue(entry.classification, `${path}.classification`),
    regionIds: strings(entry.regionIds, `${path}.regionIds`),
    enemyIds: strings(entry.enemyIds, `${path}.enemyIds`),
    rewardIds: strings(entry.rewardIds, `${path}.rewardIds`),
  }));
  const enemies = specializedRecords(input.enemies, "report.enemies", (base, entry, path) => ({
    ...base,
    classifications: strings(entry.classifications, `${path}.classifications`),
    regionIds: strings(entry.regionIds, `${path}.regionIds`),
  }));
  const outros = guideRecords(input.outros, "report.outros");
  return {
    schema: "neodes2-guide-runtime-1",
    exporterVersion: stringValue(input.exporterVersion, "report.exporterVersion"),
    generatedAtUnixSeconds: numberValue(input.generatedAtUnixSeconds, "report.generatedAtUnixSeconds"),
    language: "en",
    game: {
      steamBuildId: stringValue(game.steamBuildId, "report.game.steamBuildId"),
      executableVersion: stringValue(game.executableVersion, "report.game.executableVersion"),
      packageVersion: stringValue(game.packageVersion, "report.game.packageVersion"),
      acquisitionId: stringValue(game.acquisitionId, "report.game.acquisitionId"),
      sourceManifestSha256: stringValue(game.sourceManifestSha256, "report.game.sourceManifestSha256"),
    },
    routes,
    regions,
    rooms,
    encounters,
    enemies,
    rewards: guideRecords(input.rewards, "report.rewards"),
    consumables: guideRecords(input.consumables, "report.consumables"),
    resources: guideRecords(input.resources, "report.resources"),
    statusEffects: guideRecords(input.statusEffects, "report.statusEffects"),
    elementalTraits: guideRecords(input.elementalTraits, "report.elementalTraits"),
    encounterAidTraits: input.encounterAidTraits === undefined
      ? []
      : encounterAidTraitRecords(input.encounterAidTraits, "report.encounterAidTraits"),
    oathConditions: guideRecords(input.oathConditions, "report.oathConditions"),
    bounties: guideRecords(input.bounties, "report.bounties"),
    bountyOrder: strings(input.bountyOrder, "report.bountyOrder"),
    relationships: guideRecords(input.relationships, "report.relationships"),
    prophecies: guideRecords(input.prophecies, "report.prophecies"),
    narrative: guideRecords(input.narrative, "report.narrative"),
    outros,
    outroPriorities: validateOutroPriorities(input.outroPriorities, outros),
    achievements: guideRecords(input.achievements, "report.achievements"),
    namedRequirements: guideRecords(input.namedRequirements, "report.namedRequirements"),
    runClearMessages: guideRecords(input.runClearMessages, "report.runClearMessages"),
    sourceTables: sortedUniqueStrings(input.sourceTables, "report.sourceTables"),
  };
}
