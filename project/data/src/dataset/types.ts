import type { NormalizedArcanaDataset } from "../arcana/index.js";
import type { NormalizedBoonDataset } from "../boons/index.js";
import type { NormalizedGuideDataset } from "../guide/index.js";
import type { NormalizedLoadoutDataset } from "../loadouts/index.js";
import type { NormalizedWeaponDataset } from "../weapons/index.js";

export type DatasetDomainName = "arcana" | "boons" | "guide" | "loadouts" | "weapons";

export interface DatasetSource {
  readonly acquisitionId: string;
  readonly sourceManifestSha256: string;
  readonly exporterVersion: string;
  readonly steamBuildId: string;
  readonly executableVersion: string;
  readonly packageVersion: string;
}

export interface NormalizedDomains {
  readonly arcana: NormalizedArcanaDataset;
  readonly boons: NormalizedBoonDataset;
  readonly guide: NormalizedGuideDataset;
  readonly loadouts: NormalizedLoadoutDataset;
  readonly weapons: NormalizedWeaponDataset;
}

export interface DomainProvenance {
  readonly acquisitionId: string;
  readonly manifestSha256: string;
  readonly normalizedDatasetSha256: string;
  readonly runtimeReportSha256: string;
  readonly coverageReportSha256: string;
  readonly coverageMarkdownSha256: string;
}

export interface DatasetValidationIssue {
  readonly code:
    | "cost-reference"
    | "duplicate-id"
    | "empty-collection"
    | "invalid-cost"
    | "invalid-range"
    | "missing-name"
    | "presentation-data"
    | "reference"
    | "unknown-enum";
  readonly domain: DatasetDomainName;
  readonly path: string;
  readonly detail: string;
}

export interface DatasetValidationReport {
  readonly schema: "neodes2-dataset-validation-1";
  readonly sourceAcquisitionId: string;
  readonly domainRecordCounts: Readonly<Record<DatasetDomainName, number>>;
  readonly issues: readonly DatasetValidationIssue[];
  readonly complete: boolean;
}

export interface CombinedDataset {
  readonly schema: "neodes2-dataset-1";
  readonly source: DatasetSource;
  readonly domainAcquisitionIds: Readonly<Record<DatasetDomainName, string>>;
  readonly domains: NormalizedDomains;
}

export interface DatasetBuildOptions {
  readonly acquisitions: Readonly<Record<DatasetDomainName, string>>;
  readonly outputRoot: string;
  readonly now?: () => Date;
}

export interface DatasetBuildResult {
  readonly acquisitionId: string;
  readonly datasetSha256: string;
  readonly directory: string;
  readonly validation: DatasetValidationReport;
}

export interface VerifiedCombinedDataset {
  readonly acquisitionId: string;
  readonly datasetSha256: string;
  readonly manifestSha256: string;
  readonly dataset: CombinedDataset;
  readonly validation: DatasetValidationReport;
}
