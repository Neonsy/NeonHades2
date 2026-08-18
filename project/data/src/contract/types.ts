export type RequirementSection =
  | "foundation"
  | "guided-progression"
  | "reference"
  | "weapon-pages"
  | "ratings";

export type ClaimKind = "fact" | "derived" | "editorial";

export type SourceClass =
  | "runtime-table"
  | "lua-source"
  | "gameplay-sjson"
  | "localization-sjson"
  | "in-game-observation"
  | "official-platform"
  | "normalized-facts"
  | "editorial-analysis";

export type Cardinality =
  | "exactly-one"
  | "zero-or-one"
  | "zero-or-more"
  | "one-or-more";

export type NormalizationRule =
  | "stable-id"
  | "localized-text"
  | "scalar"
  | "ordered-values"
  | "reference"
  | "references"
  | "requirement-expression"
  | "rank-series"
  | "numeric-scaling"
  | "derived-classification"
  | "authored-text"
  | "authored-rating"
  | "evidence-reference";

export type ValidationRule =
  | "required"
  | "unique"
  | "localized"
  | "reference-exists"
  | "references-exist"
  | "nonnegative"
  | "rank-series-contiguous"
  | "requirement-resolves"
  | "runtime-source-agree"
  | "deterministic-derivation"
  | "observation-required"
  | "editorial-context-complete"
  | "spoiler-reviewed"
  | "build-versioned";

export type PublicationStatus =
  | "public-fact"
  | "public-editorial"
  | "internal-evidence";

export type SpoilerLevel = "none" | "progression" | "story" | "ending";

export type CompletionRequirement =
  | "launch-required"
  | "conditional"
  | "internal-only";

export interface ProductRequirement {
  readonly id: string;
  readonly section: RequirementSection;
  readonly description: string;
  readonly launchBlocking: boolean;
}

export interface FieldContract {
  readonly id: string;
  readonly description: string;
  readonly claimKind: ClaimKind;
  readonly cardinality: Cardinality;
  readonly sourceClasses: readonly SourceClass[];
  readonly sourcePatterns: readonly string[];
  readonly normalization: NormalizationRule;
  readonly validations: readonly ValidationRule[];
  readonly publication: PublicationStatus;
  readonly spoilerLevel: SpoilerLevel;
  readonly completion: CompletionRequirement;
  readonly requirementIds: readonly string[];
}

export interface RecordContract {
  readonly id: string;
  readonly description: string;
  readonly stableId: string;
  readonly sourcePatterns: readonly string[];
  readonly fields: readonly FieldContract[];
}

export interface DomainContract {
  readonly id: string;
  readonly description: string;
  readonly records: readonly RecordContract[];
}

export interface CoverageLocation {
  readonly domainId: string;
  readonly recordId: string;
  readonly fieldId: string;
}

export interface ContractReport {
  readonly requirementCount: number;
  readonly domainCount: number;
  readonly recordCount: number;
  readonly fieldCount: number;
  readonly launchBlockingRequirementCount: number;
  readonly coverage: ReadonlyMap<string, readonly CoverageLocation[]>;
}

export interface ContractValidationResult {
  readonly errors: readonly string[];
  readonly report: ContractReport;
}

export interface AcquisitionContract {
  readonly schema: "neodes2-acquisition-contract-1";
  readonly project: "NeonHades2";
  readonly game: {
    readonly steamAppId: "1145350";
    readonly language: "en";
  };
  readonly requirements: readonly ProductRequirement[];
  readonly domains: readonly DomainContract[];
}
