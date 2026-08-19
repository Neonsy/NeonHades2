import type { JsonValue } from "../boons/index.js";
import type { PublicationField } from "../data-ready/index.js";
import type { PageDefinition } from "../editorial/index.js";

export interface PublicationRecordField extends PublicationField {
  readonly value: JsonValue;
}

export interface PublicationRecord {
  readonly key: string;
  readonly recordType: string;
  readonly id: string;
  readonly fields: readonly PublicationRecordField[];
}

export interface PublicationPage {
  readonly id: string;
  readonly pageKind: PageDefinition["pageKind"];
  readonly title: string;
  readonly aliases: readonly string[];
  readonly spoilerLevel: PageDefinition["spoilerLevel"];
  readonly recordKeys: readonly string[];
}

export interface PublicationSearchEntry {
  readonly term: string;
  readonly normalizedTerm: string;
  readonly recordKey: string;
}

export interface PublicationRelationship {
  readonly sourceKey: string;
  readonly targetKey: string;
  readonly fields: readonly string[];
}

export interface PublicationRelationshipIndex {
  readonly forward: readonly PublicationRelationship[];
  readonly reverse: readonly PublicationRelationship[];
}

export interface PublicationCondition {
  readonly key: string;
  readonly expression: JsonValue;
  readonly dependentRecordKeys: readonly string[];
  readonly fields: readonly string[];
}

export interface PublicationDataset {
  readonly schema: "neodes2-publication-1";
  readonly source: {
    readonly datasetAcquisitionId: string;
    readonly datasetSha256: string;
    readonly dataReadyAcquisitionId: string;
    readonly editorialAcquisitionId: string;
    readonly steamBuildId: string;
    readonly executableVersion: string;
    readonly packageVersion: string;
  };
  readonly records: readonly PublicationRecord[];
  readonly pages: readonly PublicationPage[];
  readonly search: readonly PublicationSearchEntry[];
  readonly relationships: PublicationRelationshipIndex;
  readonly conditions: readonly PublicationCondition[];
}

export interface PublicationReport {
  readonly schema: "neodes2-publication-report-1";
  readonly counts: {
    readonly records: number;
    readonly pages: number;
    readonly searchEntries: number;
    readonly forwardRelationships: number;
    readonly reverseRelationships: number;
    readonly conditions: number;
  };
  readonly duplicateRecordKeys: readonly string[];
  readonly missingAllowedFieldIds: readonly string[];
  readonly forbiddenFieldIds: readonly string[];
  readonly forbiddenPayloadPaths: readonly string[];
  readonly unresolvedReferences: readonly string[];
  readonly incompleteReverseRelationships: readonly string[];
  readonly pagesWithoutRecords: readonly string[];
  readonly recordsWithoutSearchTerms: readonly string[];
  readonly complete: boolean;
}

export interface PublicationCompileResult {
  readonly dataset: PublicationDataset;
  readonly report: PublicationReport;
}

export interface PublicationBuildOptions {
  readonly datasetDirectory: string;
  readonly dataReadyDirectory: string;
  readonly editorialDirectory: string;
  readonly outputRoot: string;
  readonly now?: () => Date;
}

export interface PublicationBuildResult extends PublicationCompileResult {
  readonly acquisitionId: string;
  readonly directory: string;
  readonly publicationSha256: string;
  readonly reportSha256: string;
}

export interface PublicationSourceIdentity {
  readonly datasetAcquisitionId: string;
  readonly datasetSha256: string;
  readonly dataReadyAcquisitionId: string;
  readonly editorialAcquisitionId: string;
}
