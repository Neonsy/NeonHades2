import type {
  JsonObject,
  JsonValue,
  RuntimeBoonSample,
  RuntimeSampleValue,
} from "../boons/index.js";
import type { CombinedDataset } from "../dataset/index.js";
import { evaluateFormula, type FormulaValue } from "./expression.js";
import type { CalculationRules } from "./source-rules.js";

export interface CalculationVerificationIssue {
  readonly code:
    | "boundary-evaluation"
    | "context-input-mismatch"
    | "expression-mismatch"
    | "failed-sample"
    | "invalid-instruction"
    | "missing-instruction"
    | "resolution-mismatch";
  readonly path: string;
  readonly detail: string;
}

export interface CalculationVerificationReport {
  readonly schema: "neodes2-calculation-verification-1";
  readonly sourceDatasetAcquisitionId: string;
  readonly sampleGroupCount: number;
  readonly sampleCount: number;
  readonly valueCount: number;
  readonly resolvedValueCount: number;
  readonly contextualValueCount: number;
  readonly boundaryCaseCount: number;
  readonly issues: readonly CalculationVerificationIssue[];
  readonly complete: boolean;
}

interface SampleGroup {
  readonly path: string;
  readonly mechanics: JsonObject;
  readonly samples: readonly RuntimeBoonSample[];
}

interface ResolutionModel {
  readonly kind: "contextual" | "resolved";
  readonly expression: string;
  readonly inputIds: ReadonlySet<string>;
  readonly value?: JsonValue;
  readonly terminalString: boolean;
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function objectValue(value: JsonValue | undefined, label: string): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as JsonObject;
}

function stringValue(value: JsonValue | undefined, label: string): string {
  if (typeof value !== "string" || value === "") throw new Error(`${label} must be a nonempty string.`);
  return value;
}

function numberValue(value: JsonValue | undefined, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must be a finite number.`);
  return value;
}

function gameRound(value: number, precision: number): number {
  const scale = 10 ** precision;
  return Math.floor(value * scale + 0.5) / scale;
}

function groups(dataset: CombinedDataset): readonly SampleGroup[] {
  const output: SampleGroup[] = [];
  dataset.domains.boons.boons.forEach((record, index) => output.push({
    path: `domains.boons.boons[${index}]`, mechanics: record.effects, samples: record.levelScaling,
  }));
  dataset.domains.weapons.aspects.forEach((record, index) => output.push({
    path: `domains.weapons.aspects[${index}]`, mechanics: record.mechanics, samples: record.rankEffects,
  }));
  dataset.domains.weapons.hammers.forEach((record, index) => output.push({
    path: `domains.weapons.hammers[${index}]`, mechanics: record.mechanics, samples: record.effects,
  }));
  dataset.domains.arcana.cards.forEach((record, index) => output.push({
    path: `domains.arcana.cards[${index}]`, mechanics: record.mechanics, samples: record.rankEffects,
  }));
  dataset.domains.loadouts.keepsakes.forEach((record, index) => output.push({
    path: `domains.loadouts.keepsakes[${index}]`, mechanics: record.mechanics, samples: record.rankEffects,
  }));
  dataset.domains.loadouts.familiars.forEach((familiar, familiarIndex) => {
    familiar.upgrades.forEach((record, index) => output.push({
      path: `domains.loadouts.familiars[${familiarIndex}].upgrades[${index}]`,
      mechanics: record.mechanics,
      samples: record.rankEffects,
    }));
  });
  dataset.domains.loadouts.hexes.forEach((hex, hexIndex) => {
    output.push({ path: `domains.loadouts.hexes[${hexIndex}]`, mechanics: hex.mechanics, samples: hex.baseEffects });
    hex.talents.forEach((record, index) => output.push({
      path: `domains.loadouts.hexes[${hexIndex}].talents[${index}]`,
      mechanics: record.mechanics,
      samples: record.effects,
    }));
  });
  return output;
}

function instructions(mechanics: JsonObject, label: string): ReadonlyMap<string, JsonObject> {
  const raw = mechanics.ExtractValues;
  if (raw === undefined) return new Map();
  if (typeof raw === "object" && raw !== null && !Array.isArray(raw) && Object.keys(raw).length === 0) {
    return new Map();
  }
  if (!Array.isArray(raw)) throw new Error(`${label}.ExtractValues must be an array.`);
  const output = new Map<string, JsonObject>();
  raw.forEach((value, index) => {
    const instruction = objectValue(value, `${label}.ExtractValues[${index}]`);
    output.set(stringValue(instruction.ExtractAs, `${label}.ExtractValues[${index}].ExtractAs`), instruction);
  });
  return output;
}

function staticNumber(value: RuntimeSampleValue, id: string): number {
  const input = value.staticInputs.find((candidate) => candidate.id === id);
  if (input === undefined) throw new Error(`Static input ${id} is missing.`);
  return numberValue(input.value, `Static input ${id}`);
}

function sourceModel(value: RuntimeSampleValue): ResolutionModel {
  if (value.source.kind === "context-value") {
    return {
      kind: "contextual", expression: value.source.inputId,
      inputIds: new Set([value.source.inputId]), terminalString: false,
    };
  }
  if (value.source.kind === "processed-trait-variants") {
    if (value.source.variants.length < 2) throw new Error("Processed trait variants must contain at least two choices.");
    return {
      kind: "contextual", expression: "value",
      inputIds: new Set([value.source.selectorInputId]), terminalString: false,
    };
  }
  return {
    kind: "resolved", expression: "value", inputIds: new Set(),
    value: value.source.value, terminalString: false,
  };
}

function contextual(model: ResolutionModel, expression: string, ...inputIds: readonly string[]): ResolutionModel {
  return {
    kind: "contextual",
    expression,
    inputIds: new Set([...model.inputIds, ...inputIds]),
    ...(model.value === undefined ? {} : { value: model.value }),
    terminalString: model.terminalString,
  };
}

function resolvedNumber(model: ResolutionModel, transform: (value: number) => number, expression: string): ResolutionModel {
  if (model.kind === "contextual") return { ...model, expression };
  return { ...model, expression, value: transform(numberValue(model.value, "Resolved sample value")) };
}

function calculateBaseResolution(
  instruction: JsonObject,
  extractAs: string,
  value: RuntimeSampleValue,
  rules: CalculationRules,
): ResolutionModel {
  let model = sourceModel(value);
  const automatic = (instruction.External === true || instruction.CheckAutomaticPropertyChanges === true)
    ? rules.automaticProperties[extractAs]
    : undefined;
  if (automatic !== undefined) {
    const input = automatic.inputId;
    if (automatic.operation === "add") model = contextual(model, `(${model.expression} + ${input})`, input);
    else if (automatic.operation === "multiply") model = contextual(model, `(${model.expression} * ${input})`, input);
    else model = contextual(model, `(${input} ~= 1 and ${input} or ${model.expression})`, input);
  }
  const format = instruction.Format;
  if (format !== undefined && typeof format !== "string") throw new Error("Format must be a string.");
  if (format === undefined || format === "TotalTargets") {
    if (
      format === "TotalTargets" && instruction.External === true &&
      instruction.BaseType === "ProjectileBase" && instruction.BaseProperty === "NumJumps"
    ) {
      model = resolvedNumber(model, (current) => current + 1, `(${model.expression} + 1)`);
    }
  } else if (format === "MultiplyByBase") {
    const base = staticNumber(value, "baseValue");
    model = resolvedNumber(model, (current) => current * base, `(${model.expression} * baseValue)`);
  } else if (format === "AddToBase") {
    const base = staticNumber(value, "baseValue");
    model = resolvedNumber(model, (current) => current + base, `(${model.expression} + baseValue)`);
  } else if (format === "AdjustedBaseManaSpendCost") {
    const base = staticNumber(value, "baseManaSpendCost");
    model = resolvedNumber(model, (current) => current + base, `(${model.expression} + baseManaSpendCost)`);
  } else if (format === "MultiplyByBaseOverTime") {
    const base = staticNumber(value, "baseValue");
    const fuse = staticNumber(value, "baseFuseValue");
    model = resolvedNumber(model, (current) => current * base / fuse, `((${model.expression} * baseValue) / baseFuseValue)`);
  } else if (format === "PercentOfBase") {
    const base = staticNumber(value, "baseValue");
    model = resolvedNumber(model, (current) => current / base * 100, `((${model.expression} / baseValue) * 100)`);
  } else if (format === "Percent") {
    model = resolvedNumber(model, (current) => current * 100, `(${model.expression} * 100)`);
  } else if (format === "FlatPercent") {
    model = resolvedNumber(model, (current) => Math.abs(current * 100), `abs(${model.expression} * 100)`);
  } else if (format === "PercentDelta") {
    model = resolvedNumber(model, (current) => (current - 1) * 100, `((${model.expression} - 1) * 100)`);
  } else if (format === "FlatPercentDelta") {
    model = resolvedNumber(model, (current) => Math.abs((current - 1) * 100), `abs((${model.expression} - 1) * 100)`);
  } else if (format === "NegativePercentDelta") {
    model = resolvedNumber(model, (current) => (1 - current) * 100, `((1 - ${model.expression}) * 100)`);
  } else if (format === "PercentReciprocalDelta") {
    model = resolvedNumber(model, (current) => (1 / current) * 100 - 100, `((1 / ${model.expression}) * 100 - 100)`);
  } else if (format === "TimesOneHundredPercent") {
    model = resolvedNumber(model, (current) => current * 10_000, `(${model.expression} * 10000)`);
  } else if (format === "LuckModifiedPercent") {
    model = contextual(model, `min((${model.expression} * LuckMultiplier) * 100, 100)`, "LuckMultiplier");
  } else if (format === "SpeedModifiedDuration") {
    model = contextual(model, `(${model.expression} * OlympianRechargeMultiplier)`, "OlympianRechargeMultiplier");
  } else if (format === "FlatHeal") {
    model = contextual(model, `(${model.expression} * HealingMultiplier)`, "HealingMultiplier");
  } else if (format === "PercentHeal") {
    model = contextual(model, `(${model.expression} * HealingMultiplier * 100)`, "HealingMultiplier");
  } else if (format === "UniqueGodPercentDelta") {
    model = contextual(model, `((${model.expression} - 1) * UniqueGodCount * 100)`, "UniqueGodCount");
  } else if (format === "ManaSpendCost") {
    model = { ...model, expression: "value" };
  } else if (format === "DamageOverTime" || format === "DamageOverTotalDuration") {
    const fuse = typeof instruction.BaseValue === "number" ? instruction.BaseValue : staticNumber(value, "baseFuseValue");
    const fuseExpression = typeof instruction.BaseValue === "number" ? String(fuse) : "baseFuseValue";
    const duration = format === "DamageOverTotalDuration" && instruction.DurationSource !== undefined
      ? staticNumber(value, "totalDuration")
      : 1;
    const durationExpression = format === "DamageOverTotalDuration" && instruction.DurationSource !== undefined
      ? "totalDuration"
      : "1";
    model = resolvedNumber(model, (current) => current / fuse * duration, `((${model.expression} / ${fuseExpression}) * ${durationExpression})`);
  } else if (format === "SlottedBoon") {
    model = { ...model, terminalString: true };
  } else if (format === "Rarity") {
    if (model.kind === "contextual") throw new Error("Contextual rarity values are unsupported.");
    const rarity = numberValue(model.value, "Rarity value");
    const key = rules.rarityOrder[rarity - 1];
    if (key === undefined) throw new Error(`Rarity index ${rarity} is outside RarityUpgradeOrder.`);
    model = { ...model, expression: "rarityKeyword(value)", value: `{$Keywords.${key}}`, terminalString: true };
  } else if (format === "CardRarity") {
    if (model.kind === "contextual") throw new Error("Contextual card rarity values are unsupported.");
    model = { ...model, expression: "cardRarity(value)", value: `MetaRank${String(model.value)}`, terminalString: true };
  } else if (format === "MultipliedMoney") {
    model = contextual(model, `(${model.expression} * MoneyMultiplier)`, "MoneyMultiplier");
  } else if (format === "RemainingBiomes") {
    model = contextual(model, `min((4 - EnteredBiomes), ${model.expression})`, "EnteredBiomes");
  } else if (format === "TotalDamageTaken") {
    model = contextual(model, "TotalDamageTaken", "TotalDamageTaken");
  } else if (format === "TotalHeroTraitValuePercent") {
    model = contextual(model, `(${model.expression} * 100)`);
  } else {
    throw new Error(`Unsupported sample format ${format}.`);
  }
  for (const [field, inputId] of [
    ["MultiplyByMissingHealth", "MissingHealth"],
    ["MultiplyByOlympianBoonCount", "OlympianBoonCount"],
    ["MultiplyByMissingLastStands", "MissingLastStands"],
    ["MultiplyBySpentLastStands", "LastStandsUsed"],
  ] as const) {
    if (instruction[field] === true) model = contextual(model, `(${model.expression} * ${inputId})`, inputId);
  }
  if (instruction.AbsoluteValue !== undefined) {
    model = resolvedNumber(model, Math.abs, `abs(${model.expression})`);
  }
  if (instruction.MaximumValue !== undefined) {
    const maximum = numberValue(instruction.MaximumValue, "MaximumValue");
    model = resolvedNumber(model, (current) => Math.min(current, maximum), `min(${model.expression}, ${String(maximum)})`);
  }
  const precision = instruction.DecimalPlaces ?? 0;
  if (typeof precision !== "number" || !Number.isSafeInteger(precision) || precision < 0) {
    throw new Error("DecimalPlaces must be a nonnegative integer.");
  }
  if (!model.terminalString) {
    const expression = `round(${model.expression}, ${precision})`;
    model = model.kind === "contextual"
      ? { ...model, expression }
      : { ...model, expression, value: gameRound(numberValue(model.value, "Resolved sample value"), precision) };
  }
  return model;
}

function combine(left: ResolutionModel, right: ResolutionModel, operator: "-" | "*"): ResolutionModel {
  if (left.kind === "resolved" && right.kind === "resolved") {
    const leftValue = numberValue(left.value, "Cross-value left operand");
    const rightValue = numberValue(right.value, "Cross-value right operand");
    return { ...left, value: operator === "-" ? leftValue - rightValue : leftValue * rightValue };
  }
  const leftExpression = left.kind === "resolved" ? String(left.value) : left.expression;
  const rightExpression = right.kind === "resolved" ? String(right.value) : right.expression;
  return {
    kind: "contextual",
    expression: `(${leftExpression} ${operator} ${rightExpression})`,
    inputIds: new Set([...left.inputIds, ...right.inputIds]),
    terminalString: false,
  };
}

function expectedResolutions(
  values: readonly RuntimeSampleValue[],
  instructionMap: ReadonlyMap<string, JsonObject>,
  rules: CalculationRules,
): (id: string) => ResolutionModel {
  const valuesById = new Map(values.map((value) => [value.id, value]));
  const results = new Map<string, ResolutionModel>();
  const resolving = new Set<string>();
  const resolve = (id: string): ResolutionModel => {
    const existing = results.get(id);
    if (existing !== undefined) return existing;
    if (resolving.has(id)) throw new Error(`ExtractValues contains a cross-value cycle at ${id}.`);
    const value = valuesById.get(id);
    const instruction = instructionMap.get(id);
    if (value === undefined) throw new Error(`Sample value ${id} is missing.`);
    if (instruction === undefined) throw new Error(`ExtractValues instruction ${id} is missing.`);
    resolving.add(id);
    let model = calculateBaseResolution(instruction, id, value, rules);
    if (typeof instruction.Subtractor === "string") model = combine(model, resolve(instruction.Subtractor), "-");
    if (typeof instruction.Multiplier === "string") model = combine(model, resolve(instruction.Multiplier), "*");
    if (instruction.Negative === true) {
      model = model.kind === "resolved"
        ? { ...model, value: -numberValue(model.value, "Negative sample value") }
        : { ...model, expression: `-(${model.expression})` };
    }
    resolving.delete(id);
    results.set(id, model);
    return model;
  };
  return resolve;
}

function boundaryValues(inputId: string, value: RuntimeSampleValue): readonly FormulaValue[] {
  if (value.source.kind === "processed-trait-variants" && inputId === value.source.selectorInputId) {
    return value.source.variants.map((variant) => variant.selectorValue);
  }
  if (inputId.startsWith("Slotted")) return ["SyntheticBoon"];
  if (inputId === "ClearCastDamageMultiplierOverride") return [1, 1.5];
  if (inputId === "MissingHealth") return [0, 1, 100];
  if (inputId === "TotalDamageTaken") return [0, 1, 1_000];
  if (inputId.startsWith("HeroTraitValue:")) return [0, 0.5, 1];
  if (/Count|Biomes|LastStands/u.test(inputId)) return [0, 1, 4];
  if (/Multiplier/u.test(inputId)) return [0, 1, 2];
  return [0, 1, 2];
}

function boundaryContexts(value: RuntimeSampleValue, inputIds: readonly string[]): readonly Readonly<Record<string, FormulaValue>>[] {
  let contexts: Readonly<Record<string, FormulaValue>>[] = [{}];
  for (const inputId of inputIds) {
    contexts = contexts.flatMap((context) => boundaryValues(inputId, value).map((entry) => ({ ...context, [inputId]: entry })));
    if (contexts.length > 64) contexts = contexts.slice(0, 64);
  }
  return contexts;
}

function formulaContext(value: RuntimeSampleValue, context: Readonly<Record<string, FormulaValue>>): Readonly<Record<string, FormulaValue>> {
  const output: Record<string, FormulaValue> = { ...context };
  if (value.source.kind === "processed-trait-variants") {
    const selector = context[value.source.selectorInputId];
    const variant = value.source.variants.find((candidate) => candidate.selectorValue === selector);
    if (variant === undefined) throw new Error(`No source value exists for selector ${String(selector)}.`);
    if (typeof variant.value !== "number" && typeof variant.value !== "string" && typeof variant.value !== "boolean") {
      throw new Error("Variant source value is not a formula primitive.");
    }
    output.value = variant.value;
  } else if (value.source.kind !== "context-value") {
    if (typeof value.source.value !== "number" && typeof value.source.value !== "string" && typeof value.source.value !== "boolean") {
      throw new Error("Sample source value is not a formula primitive.");
    }
    output.value = value.source.value;
  }
  for (const input of value.staticInputs) {
    if (typeof input.value !== "number" && typeof input.value !== "string" && typeof input.value !== "boolean") {
      throw new Error(`Static input ${input.id} is not a formula primitive.`);
    }
    output[input.id] = input.value;
  }
  return output;
}

function sameValue(left: JsonValue | FormulaValue | undefined, right: JsonValue | FormulaValue | undefined): boolean {
  return typeof left === "number" && typeof right === "number"
    ? Math.abs(left - right) <= 1e-9
    : JSON.stringify(left) === JSON.stringify(right);
}

export function verifyCalculations(dataset: CombinedDataset, rules: CalculationRules): CalculationVerificationReport {
  const issues: CalculationVerificationIssue[] = [];
  const sampleGroups = groups(dataset);
  let sampleCount = 0;
  let valueCount = 0;
  let resolvedValueCount = 0;
  let contextualValueCount = 0;
  let boundaryCaseCount = 0;
  for (const group of sampleGroups) {
    let instructionMap: ReadonlyMap<string, JsonObject>;
    try {
      instructionMap = instructions(group.mechanics, `${group.path}.mechanics`);
    } catch (error) {
      issues.push({ code: "invalid-instruction", path: `${group.path}.mechanics.ExtractValues`, detail: error instanceof Error ? error.message : "Invalid ExtractValues instructions." });
      continue;
    }
    group.samples.forEach((sample, sampleIndex) => {
      sampleCount += 1;
      const samplePath = `${group.path}.samples[${sampleIndex}]`;
      if (sample.result.status === "error") {
        issues.push({ code: "failed-sample", path: samplePath, detail: sample.result.message });
        return;
      }
      const resolve = expectedResolutions(sample.result.values, instructionMap, rules);
      sample.result.values.forEach((value, valueIndex) => {
        valueCount += 1;
        const path = `${samplePath}.values[${valueIndex}]`;
        if (!instructionMap.has(value.id)) {
          issues.push({ code: "missing-instruction", path, detail: `No final ExtractValues instruction exists for ${value.id}.` });
          return;
        }
        let expected: ResolutionModel;
        try {
          expected = resolve(value.id);
        } catch (error) {
          issues.push({ code: "invalid-instruction", path, detail: error instanceof Error ? error.message : "Calculation failed." });
          return;
        }
        if (value.resolution.kind === "resolved") {
          resolvedValueCount += 1;
          if (expected.kind !== "resolved" || !sameValue(expected.value, value.resolution.value)) {
            issues.push({
              code: "resolution-mismatch", path,
              detail: `Expected ${JSON.stringify(expected.value)}, found ${JSON.stringify(value.resolution.value)}.`,
            });
          }
          return;
        }
        contextualValueCount += 1;
        const resolution = value.resolution;
        if (expected.kind !== "contextual" || expected.expression !== resolution.expression) {
          issues.push({
            code: "expression-mismatch", path,
            detail: `Expected ${expected.expression}, found ${resolution.expression}.`,
          });
        }
        const expectedInputs = [...expected.inputIds].sort(compareStrings);
        if (
          expectedInputs.length !== resolution.inputIds.length ||
          expectedInputs.some((input, index) => input !== resolution.inputIds[index])
        ) {
          issues.push({
            code: "context-input-mismatch", path,
            detail: `Expected inputs ${expectedInputs.join(", ")}, found ${resolution.inputIds.join(", ")}.`,
          });
        }
        let boundaryFailed = false;
        for (const context of boundaryContexts(value, expectedInputs)) {
          try {
            const completeContext = formulaContext(value, context);
            const expectedValue = evaluateFormula(expected.expression, completeContext);
            const actualValue = evaluateFormula(resolution.expression, completeContext);
            if (!sameValue(expectedValue, actualValue)) {
              throw new Error(`Expected ${JSON.stringify(expectedValue)}, found ${JSON.stringify(actualValue)}.`);
            }
            boundaryCaseCount += 1;
          } catch (error) {
            if (!boundaryFailed) {
              issues.push({
                code: "boundary-evaluation", path,
                detail: error instanceof Error ? error.message : "Boundary evaluation failed.",
              });
              boundaryFailed = true;
            }
          }
        }
      });
    });
  }
  issues.sort((left, right) => compareStrings(left.path, right.path) || compareStrings(left.code, right.code));
  return {
    schema: "neodes2-calculation-verification-1",
    sourceDatasetAcquisitionId: dataset.source.acquisitionId,
    sampleGroupCount: sampleGroups.length,
    sampleCount,
    valueCount,
    resolvedValueCount,
    contextualValueCount,
    boundaryCaseCount,
    issues,
    complete: issues.length === 0,
  };
}
