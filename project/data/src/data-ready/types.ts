import type { PublicationStatus, SpoilerLevel } from "../contract/index.js";

export interface PublicationField {
  readonly id: string;
  readonly publication: Exclude<PublicationStatus, "internal-evidence">;
  readonly spoilerLevel: SpoilerLevel;
}

export interface ExcludedPublicationField {
  readonly id: string;
  readonly reason: "internal-evidence";
}

export interface PublicationAllowlist {
  readonly schema: "neodes2-publication-allowlist-1";
  readonly structuralKeys: readonly ["recordType", "id"];
  readonly allowedFields: readonly PublicationField[];
  readonly excludedFields: readonly ExcludedPublicationField[];
  readonly forbiddenPayloadCategories: readonly [
    "raw-source-text",
    "raw-runtime-structures",
    "private-save-state",
    "binary-assets",
  ];
}

export interface DataReadyCheck {
  readonly id: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface DataReadyReport {
  readonly schema: "neodes2-data-ready-report-1";
  readonly sourceDatasetAcquisitionId: string;
  readonly sourceVerificationAcquisitionId: string;
  readonly source: {
    readonly acquisitionId: string;
    readonly steamBuildId: string;
    readonly executableVersion: string;
    readonly packageVersion: string;
  };
  readonly contract: {
    readonly productRequirementCount: number;
    readonly launchBlockingRequirementCount: number;
    readonly domainCount: number;
    readonly recordCount: number;
    readonly fieldCount: number;
    readonly factualFieldCount: number;
    readonly errorCount: number;
  };
  readonly dataset: {
    readonly sha256: string;
    readonly recordCount: number;
    readonly validationIssueCount: number;
  };
  readonly verification: {
    readonly calculatedValueCount: number;
    readonly calculationIssueCount: number;
    readonly namedRequirementCount: number;
    readonly requirementIssueCount: number;
    readonly completedManualCheckCount: number;
    readonly requiredManualCheckCount: number;
    readonly pendingManualCheckCount: number;
    readonly spoilerReviewTaskCount: number;
  };
  readonly reproduction: {
    readonly acquisitionId: string;
    readonly datasetSha256: string;
    readonly matches: boolean;
  };
  readonly publication: {
    readonly allowedFieldCount: number;
    readonly excludedFieldCount: number;
    readonly forbiddenPayloadCategoryCount: number;
  };
  readonly checks: readonly DataReadyCheck[];
  readonly complete: boolean;
}

export interface DataReadyBuildOptions {
  readonly datasetDirectory: string;
  readonly reproducedDatasetDirectory: string;
  readonly verificationDirectory: string;
  readonly outputRoot: string;
  readonly now?: () => Date;
}

export interface DataReadyBuildResult {
  readonly acquisitionId: string;
  readonly directory: string;
  readonly report: DataReadyReport;
  readonly allowlist: PublicationAllowlist;
}
