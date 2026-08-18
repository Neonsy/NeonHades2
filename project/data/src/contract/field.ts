import type {
  Cardinality,
  CompletionRequirement,
  FieldContract,
  NormalizationRule,
  PublicationStatus,
  SourceClass,
  SpoilerLevel,
  ValidationRule,
} from "./types.js";

interface FactFieldInput {
  readonly id: string;
  readonly description: string;
  readonly sourceClasses: readonly SourceClass[];
  readonly sourcePatterns: readonly string[];
  readonly normalization: NormalizationRule;
  readonly requirementIds: readonly string[];
  readonly cardinality?: Cardinality;
  readonly validations?: readonly ValidationRule[];
  readonly publication?: PublicationStatus;
  readonly spoilerLevel?: SpoilerLevel;
  readonly completion?: CompletionRequirement;
}

interface AuthoredFieldInput {
  readonly id: string;
  readonly description: string;
  readonly requirementIds: readonly string[];
  readonly normalization?: NormalizationRule;
  readonly cardinality?: Cardinality;
  readonly sourceClasses?: readonly SourceClass[];
  readonly sourcePatterns?: readonly string[];
  readonly validations?: readonly ValidationRule[];
  readonly spoilerLevel?: SpoilerLevel;
  readonly completion?: CompletionRequirement;
}

function uniqueRules(rules: readonly ValidationRule[]): readonly ValidationRule[] {
  return [...new Set(rules)];
}

function spoilerRules(spoilerLevel: SpoilerLevel | undefined): readonly ValidationRule[] {
  return spoilerLevel === undefined || spoilerLevel === "none" ? [] : ["spoiler-reviewed"];
}

export function fact(input: FactFieldInput): FieldContract {
  return {
    id: input.id,
    description: input.description,
    claimKind: "fact",
    cardinality: input.cardinality ?? "exactly-one",
    sourceClasses: input.sourceClasses,
    sourcePatterns: input.sourcePatterns,
    normalization: input.normalization,
    validations: uniqueRules([
      ...(input.validations ?? []),
      ...spoilerRules(input.spoilerLevel),
      "build-versioned",
    ]),
    publication: input.publication ?? "public-fact",
    spoilerLevel: input.spoilerLevel ?? "none",
    completion: input.completion ?? "launch-required",
    requirementIds: input.requirementIds,
  };
}

export function derived(input: AuthoredFieldInput): FieldContract {
  return {
    id: input.id,
    description: input.description,
    claimKind: "derived",
    cardinality: input.cardinality ?? "exactly-one",
    sourceClasses: input.sourceClasses ?? ["normalized-facts"],
    sourcePatterns: input.sourcePatterns ?? ["Normalized factual records"],
    normalization: input.normalization ?? "derived-classification",
    validations: uniqueRules([
      ...(input.validations ?? []),
      ...spoilerRules(input.spoilerLevel),
      "deterministic-derivation",
      "build-versioned",
    ]),
    publication: "public-fact",
    spoilerLevel: input.spoilerLevel ?? "none",
    completion: input.completion ?? "launch-required",
    requirementIds: input.requirementIds,
  };
}

export function editorial(input: AuthoredFieldInput): FieldContract {
  return {
    id: input.id,
    description: input.description,
    claimKind: "editorial",
    cardinality: input.cardinality ?? "exactly-one",
    sourceClasses: input.sourceClasses ?? ["editorial-analysis"],
    sourcePatterns: input.sourcePatterns ?? ["Committed NeonHades2 editorial records"],
    normalization: input.normalization ?? "authored-text",
    validations: uniqueRules([
      ...(input.validations ?? []),
      ...spoilerRules(input.spoilerLevel),
      "editorial-context-complete",
      "build-versioned",
    ]),
    publication: "public-editorial",
    spoilerLevel: input.spoilerLevel ?? "none",
    completion: input.completion ?? "launch-required",
    requirementIds: input.requirementIds,
  };
}
