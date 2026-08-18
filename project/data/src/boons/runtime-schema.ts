export type JsonPrimitive = boolean | number | string | null;

export type JsonValue = JsonPrimitive | JsonObject | readonly JsonValue[];

export interface JsonObject {
  readonly [key: string]: JsonValue;
}

export type BoonKind = "duo" | "infusion" | "legendary" | "normal";

export type RuntimeStaticBaseType =
  | "EffectData"
  | "EffectLuaData"
  | "Projectile"
  | "ProjectileBase"
  | "Weapon";

export interface RuntimeStaticBaseValue {
  readonly baseType: RuntimeStaticBaseType;
  readonly baseName: string;
  readonly baseProperty: string;
  readonly runtimePath: string;
  readonly value: JsonValue;
}

export interface RuntimeSampleProcessedSource {
  readonly kind: "processed-trait";
  readonly key: string;
  readonly runtimePath: string;
  readonly value: JsonValue;
}

export interface RuntimeSampleProcessedVariantSource {
  readonly kind: "processed-trait-variants";
  readonly key: string;
  readonly selectorInputId: string;
  readonly variants: readonly {
    readonly selectorValue: string;
    readonly runtimePaths: readonly string[];
    readonly value: JsonValue;
  }[];
}

export interface RuntimeSampleStaticSource extends RuntimeStaticBaseValue {
  readonly kind: "static-base-data";
}

export type RuntimeSampleValueSource =
  | RuntimeSampleProcessedSource
  | RuntimeSampleProcessedVariantSource
  | RuntimeSampleStaticSource;

export interface RuntimeSampleStaticInput extends RuntimeStaticBaseValue {
  readonly id: string;
}

export interface RuntimeSampleResolvedValue {
  readonly kind: "resolved";
  readonly value: JsonValue;
}

export interface RuntimeSampleContextualValue {
  readonly kind: "contextual";
  readonly expression: string;
  readonly inputIds: readonly string[];
}

export interface RuntimeSampleValue {
  readonly id: string;
  readonly source: RuntimeSampleValueSource;
  readonly staticInputs: readonly RuntimeSampleStaticInput[];
  readonly resolution: RuntimeSampleResolvedValue | RuntimeSampleContextualValue;
}

export interface RuntimeBoonSampleResultOk {
  readonly status: "ok";
  readonly values: readonly RuntimeSampleValue[];
}

export interface RuntimeBoonSampleResultError {
  readonly status: "error";
  readonly message: string;
}

export interface RuntimeBoonSample {
  readonly rarity: string;
  readonly endpoint: "fixed" | "maximum" | "minimum";
  readonly level: number;
  readonly context: {
    readonly mode: "player-independent";
    readonly elementCounts: readonly {
      readonly element: string;
      readonly count: number;
    }[];
  };
  readonly result: RuntimeBoonSampleResultOk | RuntimeBoonSampleResultError;
}

export interface RuntimeLootSource {
  readonly id: string;
  readonly displayName: string;
  readonly speakerName: string;
  readonly boonIds: readonly string[];
  readonly runtimePath: string;
  readonly localizationPath: string;
}

export interface RuntimeBoon {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly ownerIds: readonly string[];
  readonly kind: BoonKind;
  readonly elements: readonly string[];
  readonly inheritedFrom: readonly string[];
  readonly hasPrerequisites: boolean;
  readonly prerequisites: JsonObject;
  readonly rarityLevels: JsonObject;
  readonly mechanics: JsonObject;
  readonly samples: readonly RuntimeBoonSample[];
  readonly evidence: {
    readonly runtimePaths: readonly string[];
    readonly localizationPath: string;
  };
}

export interface RuntimeBoonReport {
  readonly schema: "neodes2-boon-runtime-2";
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
  readonly lootSources: readonly RuntimeLootSource[];
  readonly boons: readonly RuntimeBoon[];
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

function asString(value: unknown, label: string, allowEmpty = false): string {
  if (typeof value !== "string" || (!allowEmpty && value.trim() === "")) {
    throw new Error(`${label} must be ${allowEmpty ? "a string" : "a nonempty string"}.`);
  }
  return value;
}

function asInteger(value: unknown, label: string, minimum: number): number {
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
    throw new Error(`${label} must be one of: ${allowed.join(", ")}.`);
  }
  return value as Value;
}

function asStringArray(value: unknown, label: string): readonly string[] {
  const values = asArray(value, label).map((entry, index) =>
    asString(entry, `${label}[${index}]`),
  );
  const sorted = [...values].sort();
  if (new Set(values).size !== values.length) {
    throw new Error(`${label} must not contain duplicates.`);
  }
  if (values.some((entry, index) => entry !== sorted[index])) {
    throw new Error(`${label} must be sorted.`);
  }
  return values;
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
  const source = asRecord(value, label);
  const result: Record<string, JsonValue> = {};
  for (const [key, entry] of Object.entries(source)) {
    result[key] = asJsonValue(entry, `${label}.${key}`);
  }
  return result;
}

function asJsonObject(value: unknown, label: string): JsonObject {
  return asJsonValue(asRecord(value, label), label) as JsonObject;
}

const staticBaseTypes = [
  "EffectData",
  "EffectLuaData",
  "Projectile",
  "ProjectileBase",
  "Weapon",
] as const;

function validateStaticBaseValue(
  value: unknown,
  label: string,
): RuntimeStaticBaseValue {
  const base = asRecord(value, label);
  return {
    baseType: asLiteral(base.baseType, `${label}.baseType`, staticBaseTypes),
    baseName: asString(base.baseName, `${label}.baseName`),
    baseProperty: asString(base.baseProperty, `${label}.baseProperty`),
    runtimePath: asString(base.runtimePath, `${label}.runtimePath`),
    value: asJsonValue(base.value, `${label}.value`),
  };
}

function validateSampleSource(value: unknown, label: string): RuntimeSampleValueSource {
  const source = asRecord(value, label);
  const kind = asLiteral(source.kind, `${label}.kind`, [
    "processed-trait",
    "processed-trait-variants",
    "static-base-data",
  ] as const);
  if (kind === "processed-trait") {
    return {
      kind,
      key: asString(source.key, `${label}.key`),
      runtimePath: asString(source.runtimePath, `${label}.runtimePath`),
      value: asJsonValue(source.value, `${label}.value`),
    };
  }
  if (kind === "processed-trait-variants") {
    const variants = asArray(source.variants, `${label}.variants`).map((entry, index) => {
      const variant = asRecord(entry, `${label}.variants[${index}]`);
      const runtimePaths = asStringArray(
        variant.runtimePaths,
        `${label}.variants[${index}].runtimePaths`,
      );
      if (runtimePaths.length === 0) {
        throw new Error(`${label}.variants[${index}].runtimePaths must not be empty.`);
      }
      return {
        selectorValue: asString(
          variant.selectorValue,
          `${label}.variants[${index}].selectorValue`,
        ),
        runtimePaths,
        value: asJsonValue(variant.value, `${label}.variants[${index}].value`),
      };
    });
    if (variants.length < 2) {
      throw new Error(`${label}.variants must contain at least two choices.`);
    }
    const selectorValues = variants.map((variant) => variant.selectorValue);
    if (new Set(selectorValues).size !== selectorValues.length) {
      throw new Error(`${label}.variants must not repeat a selector value.`);
    }
    if (
      selectorValues.some(
        (selectorValue, index) => selectorValue !== selectorValues.toSorted()[index],
      )
    ) {
      throw new Error(`${label}.variants must be sorted by selector value.`);
    }
    return {
      kind,
      key: asString(source.key, `${label}.key`),
      selectorInputId: asString(source.selectorInputId, `${label}.selectorInputId`),
      variants,
    };
  }
  return { kind, ...validateStaticBaseValue(source, label) };
}

function validateSampleValue(value: unknown, label: string): RuntimeSampleValue {
  const sampleValue = asRecord(value, label);
  const staticInputs = asArray(sampleValue.staticInputs, `${label}.staticInputs`).map(
    (entry, index): RuntimeSampleStaticInput => {
      const input = asRecord(entry, `${label}.staticInputs[${index}]`);
      return {
        id: asString(input.id, `${label}.staticInputs[${index}].id`),
        ...validateStaticBaseValue(input, `${label}.staticInputs[${index}]`),
      };
    },
  );
  const staticInputIds = staticInputs.map((input) => input.id);
  if (new Set(staticInputIds).size !== staticInputIds.length) {
    throw new Error(`${label}.staticInputs must not repeat an id.`);
  }
  if (staticInputIds.some((id, index) => id !== staticInputIds.toSorted()[index])) {
    throw new Error(`${label}.staticInputs must be sorted by id.`);
  }

  const resolutionRecord = asRecord(sampleValue.resolution, `${label}.resolution`);
  const resolutionKind = asLiteral(resolutionRecord.kind, `${label}.resolution.kind`, [
    "contextual",
    "resolved",
  ] as const);
  const resolution =
    resolutionKind === "resolved"
      ? {
          kind: resolutionKind,
          value: asJsonValue(resolutionRecord.value, `${label}.resolution.value`),
        }
      : {
          kind: resolutionKind,
          expression: asString(
            resolutionRecord.expression,
            `${label}.resolution.expression`,
          ),
          inputIds: asStringArray(
            resolutionRecord.inputIds,
            `${label}.resolution.inputIds`,
          ),
        };
  if (resolution.kind === "contextual" && resolution.inputIds.length === 0) {
    throw new Error(`${label}.resolution.inputIds must name at least one context input.`);
  }

  const source = validateSampleSource(sampleValue.source, `${label}.source`);
  if (
    source.kind === "processed-trait-variants" &&
    (resolution.kind !== "contextual" ||
      !resolution.inputIds.includes(source.selectorInputId))
  ) {
    throw new Error(
      `${label}.resolution must include the processed variant selector input.`,
    );
  }

  return {
    id: asString(sampleValue.id, `${label}.id`),
    source,
    staticInputs,
    resolution,
  };
}

function validateSample(value: unknown, label: string): RuntimeBoonSample {
  const sample = asRecord(value, label);
  const context = asRecord(sample.context, `${label}.context`);
  const elementCounts = asArray(
    context.elementCounts,
    `${label}.context.elementCounts`,
  ).map((entry, index) => {
    const count = asRecord(entry, `${label}.context.elementCounts[${index}]`);
    return {
      element: asString(count.element, `${label}.context.elementCounts[${index}].element`),
      count: asInteger(count.count, `${label}.context.elementCounts[${index}].count`, 1),
    };
  });
  const elements = elementCounts.map((entry) => entry.element);
  if (new Set(elements).size !== elements.length) {
    throw new Error(`${label}.context.elementCounts must not repeat an element.`);
  }
  if (elements.some((element, index) => element !== elements.toSorted()[index])) {
    throw new Error(`${label}.context.elementCounts must be sorted by element.`);
  }

  const resultRecord = asRecord(sample.result, `${label}.result`);
  const status = asLiteral(resultRecord.status, `${label}.result.status`, [
    "error",
    "ok",
  ] as const);
  const result =
    status === "ok"
      ? {
          status,
          values: asArray(resultRecord.values, `${label}.result.values`).map(
            (entry, index) => validateSampleValue(entry, `${label}.result.values[${index}]`),
          ),
        }
      : {
          status,
          message: asString(resultRecord.message, `${label}.result.message`),
        };
  if (result.status === "ok") {
    const valueIds = result.values.map((entry) => entry.id);
    if (new Set(valueIds).size !== valueIds.length) {
      throw new Error(`${label}.result.values must not repeat an id.`);
    }
    if (valueIds.some((id, index) => id !== valueIds.toSorted()[index])) {
      throw new Error(`${label}.result.values must be sorted by id.`);
    }
  }

  return {
    rarity: asString(sample.rarity, `${label}.rarity`),
    endpoint: asLiteral(sample.endpoint, `${label}.endpoint`, [
      "fixed",
      "maximum",
      "minimum",
    ] as const),
    level: asInteger(sample.level, `${label}.level`, 1),
    context: {
      mode: asLiteral(context.mode, `${label}.context.mode`, [
        "player-independent",
      ] as const),
      elementCounts,
    },
    result,
  };
}

function validateLootSource(value: unknown, label: string): RuntimeLootSource {
  const loot = asRecord(value, label);
  return {
    id: asString(loot.id, `${label}.id`),
    displayName: asString(loot.displayName, `${label}.displayName`),
    speakerName: asString(loot.speakerName, `${label}.speakerName`),
    boonIds: asStringArray(loot.boonIds, `${label}.boonIds`),
    runtimePath: asString(loot.runtimePath, `${label}.runtimePath`),
    localizationPath: asString(loot.localizationPath, `${label}.localizationPath`),
  };
}

function validateBoon(value: unknown, label: string): RuntimeBoon {
  const boon = asRecord(value, label);
  const evidence = asRecord(boon.evidence, `${label}.evidence`);
  const samples = asArray(boon.samples, `${label}.samples`).map((sample, index) =>
    validateSample(sample, `${label}.samples[${index}]`),
  );
  const sampleKeys = samples.map(
    (sample) => `${sample.rarity}\u0000${sample.endpoint}\u0000${sample.level}`,
  );
  if (new Set(sampleKeys).size !== sampleKeys.length) {
    throw new Error(`${label}.samples must not repeat a rarity, endpoint, and level.`);
  }

  return {
    id: asString(boon.id, `${label}.id`),
    name: asString(boon.name, `${label}.name`),
    description: asString(boon.description, `${label}.description`, true),
    ownerIds: asStringArray(boon.ownerIds, `${label}.ownerIds`),
    kind: asLiteral(boon.kind, `${label}.kind`, [
      "duo",
      "infusion",
      "legendary",
      "normal",
    ] as const),
    elements: asStringArray(boon.elements, `${label}.elements`),
    inheritedFrom: asStringArray(boon.inheritedFrom, `${label}.inheritedFrom`),
    hasPrerequisites: asBoolean(boon.hasPrerequisites, `${label}.hasPrerequisites`),
    prerequisites: asJsonObject(boon.prerequisites, `${label}.prerequisites`),
    rarityLevels: asJsonObject(boon.rarityLevels, `${label}.rarityLevels`),
    mechanics: asJsonObject(boon.mechanics, `${label}.mechanics`),
    samples,
    evidence: {
      runtimePaths: asStringArray(evidence.runtimePaths, `${label}.evidence.runtimePaths`),
      localizationPath: asString(
        evidence.localizationPath,
        `${label}.evidence.localizationPath`,
      ),
    },
  };
}

function validateCrossReferences(report: RuntimeBoonReport): void {
  const lootIds = new Set<string>();
  const boonIds = new Set<string>();

  for (const loot of report.lootSources) {
    if (lootIds.has(loot.id)) {
      throw new Error(`Duplicate loot source id: ${loot.id}`);
    }
    lootIds.add(loot.id);
  }
  for (const boon of report.boons) {
    if (boonIds.has(boon.id)) {
      throw new Error(`Duplicate boon id: ${boon.id}`);
    }
    boonIds.add(boon.id);
    if (boon.ownerIds.length === 0) {
      throw new Error(`${boon.id} must have at least one owner.`);
    }
    for (const ownerId of boon.ownerIds) {
      if (!lootIds.has(ownerId)) {
        throw new Error(`${boon.id} references unknown loot source ${ownerId}.`);
      }
    }
    if ((boon.kind === "duo" || boon.kind === "legendary") && !boon.hasPrerequisites) {
      throw new Error(`${boon.id} is ${boon.kind} but has no prerequisite data.`);
    }
  }

  for (const loot of report.lootSources) {
    for (const boonId of loot.boonIds) {
      const boon = report.boons.find((candidate) => candidate.id === boonId);
      if (boon === undefined) {
        throw new Error(`${loot.id} references unknown boon ${boonId}.`);
      }
      if (!boon.ownerIds.includes(loot.id)) {
        throw new Error(`${loot.id} and ${boonId} disagree about ownership.`);
      }
    }
  }
}

export function validateRuntimeBoonReport(value: unknown): RuntimeBoonReport {
  const report = asRecord(value, "runtime report");
  const game = asRecord(report.game, "runtime report.game");
  const result: RuntimeBoonReport = {
    schema: asLiteral(report.schema, "runtime report.schema", [
      "neodes2-boon-runtime-2",
    ] as const),
    exporterVersion: asString(report.exporterVersion, "runtime report.exporterVersion"),
    generatedAtUnixSeconds: asInteger(
      report.generatedAtUnixSeconds,
      "runtime report.generatedAtUnixSeconds",
      0,
    ),
    language: asLiteral(report.language, "runtime report.language", ["en"] as const),
    game: {
      steamBuildId: asString(game.steamBuildId, "runtime report.game.steamBuildId"),
      executableVersion: asString(
        game.executableVersion,
        "runtime report.game.executableVersion",
      ),
      packageVersion: asString(game.packageVersion, "runtime report.game.packageVersion"),
      acquisitionId: asString(game.acquisitionId, "runtime report.game.acquisitionId"),
      sourceManifestSha256: asString(
        game.sourceManifestSha256,
        "runtime report.game.sourceManifestSha256",
      ),
    },
    sourceTables: asStringArray(report.sourceTables, "runtime report.sourceTables"),
    localizationFiles: asStringArray(
      report.localizationFiles,
      "runtime report.localizationFiles",
    ),
    lootSources: asArray(report.lootSources, "runtime report.lootSources").map(
      (loot, index) => validateLootSource(loot, `runtime report.lootSources[${index}]`),
    ),
    boons: asArray(report.boons, "runtime report.boons").map((boon, index) =>
      validateBoon(boon, `runtime report.boons[${index}]`),
    ),
  };

  const sortedLootIds = result.lootSources.map((loot) => loot.id).toSorted();
  if (result.lootSources.some((loot, index) => loot.id !== sortedLootIds[index])) {
    throw new Error("runtime report.lootSources must be sorted by id.");
  }
  const sortedBoonIds = result.boons.map((boon) => boon.id).toSorted();
  if (result.boons.some((boon, index) => boon.id !== sortedBoonIds[index])) {
    throw new Error("runtime report.boons must be sorted by id.");
  }

  validateCrossReferences(result);
  return result;
}
