import { basename, isAbsolute, join, resolve } from "node:path";
import { mkdir, mkdtemp, rename, writeFile } from "node:fs/promises";

import { jsonBytes, readStableRegularFile, sha256 } from "../boons/runtime-acquisition.js";
import { acquisitionContract, validateContract } from "../contract/index.js";
import { readCombinedDataset } from "../dataset/index.js";
import { assertLocalOutputPath } from "../snapshot/index.js";
import { createPublicationAllowlist } from "./policy.js";
import type { DataReadyBuildOptions, DataReadyBuildResult, DataReadyCheck, DataReadyReport } from "./types.js";

interface VerificationSummary {
  readonly acquisitionId: string;
  readonly manifestSha256: string;
  readonly reportSha256: string;
  readonly sourceDatasetAcquisitionId: string;
  readonly sourceDatasetSha256: string;
  readonly sourceDatasetManifestSha256: string;
  readonly contractSha256: string;
  readonly calculatedValueCount: number;
  readonly calculationIssueCount: number;
  readonly namedRequirementCount: number;
  readonly requirementIssueCount: number;
  readonly completedManualCheckCount: number;
  readonly requiredManualCheckCount: number;
  readonly pendingManualCheckCount: number;
  readonly spoilerReviewTaskCount: number;
  readonly spoilerReviewComplete: boolean;
  readonly complete: boolean;
}

function record(value: unknown, label: string): Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Readonly<Record<string, unknown>>;
}

function array(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  return value;
}

function string(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${label} must be a nonempty string.`);
  return value;
}

function count(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a nonnegative integer.`);
  return value;
}

function canonicalJson(content: Buffer, label: string): unknown {
  const value: unknown = JSON.parse(content.toString("utf8"));
  if (!content.equals(jsonBytes(value))) throw new Error(`${label} is not deterministic JSON.`);
  return value;
}

async function readVerification(directory: string): Promise<VerificationSummary> {
  if (!isAbsolute(directory)) throw new Error("Verification artifact path must be absolute.");
  const root = resolve(directory);
  const [manifestFile, completionFile, reportFile, graphFile, calculationsFile, observationPlanFile] = await Promise.all([
    readStableRegularFile(join(root, "manifest.json")),
    readStableRegularFile(join(root, "complete.json")),
    readStableRegularFile(join(root, "report.json")),
    readStableRegularFile(join(root, "requirement-graph.json")),
    readStableRegularFile(join(root, "calculations.json")),
    readStableRegularFile(join(root, "observation-plan.json")),
  ]);
  const manifest = record(canonicalJson(manifestFile.content, "Verification manifest"), "Verification manifest");
  const completion = record(canonicalJson(completionFile.content, "Verification completion marker"), "Verification completion marker");
  const report = record(canonicalJson(reportFile.content, "Verification report"), "Verification report");
  canonicalJson(graphFile.content, "Requirement graph");
  canonicalJson(calculationsFile.content, "Calculation report");
  canonicalJson(observationPlanFile.content, "Observation plan");
  if (manifest.schema !== "neodes2-verification-manifest-2") throw new Error("Unsupported verification manifest schema.");
  if (completion.schema !== "neodes2-verification-completion-2") throw new Error("Unsupported verification completion schema.");
  if (report.schema !== "neodes2-verification-report-2") throw new Error("Unsupported verification report schema.");
  for (const [field, actual] of [
    ["reportSha256", reportFile.sha256],
    ["requirementGraphSha256", graphFile.sha256],
    ["calculationsSha256", calculationsFile.sha256],
    ["observationPlanSha256", observationPlanFile.sha256],
  ] as const) {
    if (manifest[field] !== actual || completion[field] !== actual) throw new Error(`Verification ${field} does not match its file.`);
  }
  const acquisitionId = string(manifest.acquisitionId, "Verification acquisitionId");
  const manifestSha256 = manifestFile.sha256;
  if (completion.acquisitionId !== acquisitionId || completion.manifestSha256 !== manifestSha256) {
    throw new Error("Verification completion marker does not match its manifest.");
  }
  const identity = Object.fromEntries(Object.entries(manifest).filter(([field]) => field !== "acquisitionId"));
  if (acquisitionId !== `sha256:${sha256(JSON.stringify(identity))}`) throw new Error("Verification acquisition identity is invalid.");
  const requirementGraph = record(report.requirementGraph, "Verification report requirementGraph");
  const calculations = record(report.calculations, "Verification report calculations");
  const manualEvidence = record(report.manualEvidence, "Verification report manualEvidence");
  const manualTasks = array(report.manualTasks, "Verification report manualTasks").map((task, index) =>
    record(task, `Verification report manualTasks[${index}]`));
  const spoilerTasks = manualTasks.filter((task) => array(task.requiredChecks, "Manual task requiredChecks").includes("spoiler-review"));
  const complete = manifest.automatedComplete === true && manifest.manualComplete === true && manifest.phaseComplete === true &&
    completion.automatedComplete === true && completion.manualComplete === true && completion.phaseComplete === true &&
    report.automatedComplete === true && report.manualComplete === true && report.phaseComplete === true;
  return {
    acquisitionId,
    manifestSha256,
    reportSha256: reportFile.sha256,
    sourceDatasetAcquisitionId: string(manifest.sourceDatasetAcquisitionId, "Verification source dataset acquisitionId"),
    sourceDatasetSha256: string(manifest.sourceDatasetSha256, "Verification source dataset SHA-256"),
    sourceDatasetManifestSha256: string(manifest.sourceDatasetManifestSha256, "Verification source dataset manifest SHA-256"),
    contractSha256: string(manifest.contractSha256, "Verification contract SHA-256"),
    calculatedValueCount: count(calculations.valueCount, "Calculated value count"),
    calculationIssueCount: count(calculations.issueCount, "Calculation issue count"),
    namedRequirementCount: count(requirementGraph.nodeCount, "Named requirement count"),
    requirementIssueCount: count(requirementGraph.issueCount, "Requirement issue count"),
    completedManualCheckCount: count(manualEvidence.completedCheckCount, "Completed manual check count"),
    requiredManualCheckCount: count(manualEvidence.requiredCheckCount, "Required manual check count"),
    pendingManualCheckCount: count(manualEvidence.pendingCheckCount, "Pending manual check count"),
    spoilerReviewTaskCount: spoilerTasks.length,
    spoilerReviewComplete: spoilerTasks.length > 0 && spoilerTasks.every((task) => task.status === "complete"),
    complete,
  };
}

function check(id: string, passed: boolean, detail: string): DataReadyCheck {
  return { id, passed, detail };
}

async function writeFinalFile(directory: string, name: string, content: Buffer): Promise<void> {
  const temporary = join(directory, `${name}.tmp`);
  await writeFile(temporary, content, { flag: "wx" });
  await rename(temporary, join(directory, name));
}

export async function createDataReadyArtifact(options: DataReadyBuildOptions): Promise<DataReadyBuildResult> {
  if (!isAbsolute(options.datasetDirectory) || !isAbsolute(options.reproducedDatasetDirectory)) {
    throw new Error("Dataset paths must be absolute.");
  }
  assertLocalOutputPath(options.outputRoot);
  const [dataset, reproduced, verification] = await Promise.all([
    readCombinedDataset(options.datasetDirectory),
    readCombinedDataset(options.reproducedDatasetDirectory),
    readVerification(options.verificationDirectory),
  ]);
  const contract = validateContract(acquisitionContract.requirements, acquisitionContract.domains);
  const allowlist = createPublicationAllowlist();
  const contractSha256 = sha256(jsonBytes(acquisitionContract));
  const factualFields = acquisitionContract.domains.flatMap((domain) => domain.records.flatMap((record) =>
    record.fields.filter((field) => field.claimKind !== "editorial")));
  const sourceBound = factualFields.every((field) =>
    field.sourceClasses.length > 0 && field.sourcePatterns.length > 0 && field.validations.includes("build-versioned")) &&
    [
      dataset.dataset.source.acquisitionId,
      dataset.dataset.source.steamBuildId,
      dataset.dataset.source.executableVersion,
      dataset.dataset.source.packageVersion,
    ].every((value) => value.trim() !== "");
  const datasetMatchesVerification = verification.sourceDatasetAcquisitionId === dataset.acquisitionId &&
    verification.sourceDatasetSha256 === dataset.datasetSha256 &&
    verification.sourceDatasetManifestSha256 === dataset.manifestSha256 &&
    verification.contractSha256 === contractSha256;
  const reproductionMatches = reproduced.acquisitionId === dataset.acquisitionId &&
    reproduced.datasetSha256 === dataset.datasetSha256 && reproduced.manifestSha256 === dataset.manifestSha256;
  const validationCodes = new Set(dataset.validation.issues.map((issue) => issue.code));
  const recordCount = Object.values(dataset.validation.domainRecordCounts).reduce((total, value) => total + value, 0);
  const checks = [
    check("contract-coverage", contract.errors.length === 0 && contract.report.coverage.size === acquisitionContract.requirements.length,
      `${contract.report.requirementCount} product requirements have contract coverage.`),
    check("launch-blocking-coverage", contract.report.launchBlockingRequirementCount === acquisitionContract.requirements.filter((item) => item.launchBlocking).length,
      `${contract.report.launchBlockingRequirementCount} launch-blocking requirements have launch-required coverage.`),
    check("source-and-build", sourceBound,
      `${factualFields.length} factual or derived fields identify source rules and build-versioned validation.`),
    check("stable-identifiers", !validationCodes.has("duplicate-id") && !validationCodes.has("invalid-range"),
      "The normalized dataset has no duplicate or empty stable identifiers."),
    check("relationships", !validationCodes.has("reference") && !validationCodes.has("cost-reference"),
      "The normalized dataset has no unresolved references."),
    check("english-display-names", !validationCodes.has("missing-name"),
      "Every required English display name resolves."),
    check("known-values", !validationCodes.has("unknown-enum"),
      "The normalized dataset has no unexplained enum value."),
    check("runtime-source-agreement", verification.complete && verification.calculationIssueCount === 0 && verification.requirementIssueCount === 0,
      "Phase 5 reports no unresolved calculation or requirement issue."),
    check("manual-verification", verification.complete && verification.pendingManualCheckCount === 0,
      `${verification.completedManualCheckCount}/${verification.requiredManualCheckCount} manual checks are complete.`),
    check("spoiler-review", verification.spoilerReviewComplete,
      `${verification.spoilerReviewTaskCount} spoiler-review tasks are complete.`),
    check("dataset-reproduction", reproductionMatches,
      "A fresh build from the five finalized domain acquisitions has the same acquisition, dataset, and manifest hashes."),
    check("publication-allowlist", allowlist.excludedFields.length > 0 && allowlist.forbiddenPayloadCategories.length === 4,
      `${allowlist.allowedFields.length} public fields are allowed; ${allowlist.excludedFields.length} internal fields and four payload categories are excluded.`),
    check("dataset-validation", dataset.validation.complete && dataset.validation.issues.length === 0 && datasetMatchesVerification,
      `${recordCount} normalized records pass validation and match the Phase 5 artifact.`),
  ];
  const report: DataReadyReport = {
    schema: "neodes2-data-ready-report-1",
    sourceDatasetAcquisitionId: dataset.acquisitionId,
    sourceVerificationAcquisitionId: verification.acquisitionId,
    source: {
      acquisitionId: dataset.dataset.source.acquisitionId,
      steamBuildId: dataset.dataset.source.steamBuildId,
      executableVersion: dataset.dataset.source.executableVersion,
      packageVersion: dataset.dataset.source.packageVersion,
    },
    contract: {
      productRequirementCount: contract.report.requirementCount,
      launchBlockingRequirementCount: contract.report.launchBlockingRequirementCount,
      domainCount: contract.report.domainCount,
      recordCount: contract.report.recordCount,
      fieldCount: contract.report.fieldCount,
      factualFieldCount: factualFields.length,
      errorCount: contract.errors.length,
    },
    dataset: { sha256: dataset.datasetSha256, recordCount, validationIssueCount: dataset.validation.issues.length },
    verification: {
      calculatedValueCount: verification.calculatedValueCount,
      calculationIssueCount: verification.calculationIssueCount,
      namedRequirementCount: verification.namedRequirementCount,
      requirementIssueCount: verification.requirementIssueCount,
      completedManualCheckCount: verification.completedManualCheckCount,
      requiredManualCheckCount: verification.requiredManualCheckCount,
      pendingManualCheckCount: verification.pendingManualCheckCount,
      spoilerReviewTaskCount: verification.spoilerReviewTaskCount,
    },
    reproduction: { acquisitionId: reproduced.acquisitionId, datasetSha256: reproduced.datasetSha256, matches: reproductionMatches },
    publication: {
      allowedFieldCount: allowlist.allowedFields.length,
      excludedFieldCount: allowlist.excludedFields.length,
      forbiddenPayloadCategoryCount: allowlist.forbiddenPayloadCategories.length,
    },
    checks,
    complete: checks.every((item) => item.passed),
  };
  if (!report.complete) {
    const failures = checks.filter((item) => !item.passed).map((item) => item.id).join(", ");
    throw new Error(`Data-ready gate failed: ${failures}.`);
  }
  const reportContent = jsonBytes(report);
  const allowlistContent = jsonBytes(allowlist);
  const identity = {
    schema: "neodes2-data-ready-manifest-1" as const,
    sourceDatasetAcquisitionId: dataset.acquisitionId,
    sourceDatasetSha256: dataset.datasetSha256,
    sourceDatasetManifestSha256: dataset.manifestSha256,
    sourceVerificationAcquisitionId: verification.acquisitionId,
    sourceVerificationManifestSha256: verification.manifestSha256,
    sourceVerificationReportSha256: verification.reportSha256,
    contractSha256,
    reportSha256: sha256(reportContent),
    publicationAllowlistSha256: sha256(allowlistContent),
    complete: true,
  };
  const acquisitionId = `sha256:${sha256(JSON.stringify(identity))}`;
  const outputRoot = resolve(options.outputRoot);
  await mkdir(outputRoot, { recursive: true });
  const timestamp = (options.now ?? (() => new Date()))().toISOString().replace(/[-:.]/gu, "");
  const incompletePrefix = join(outputRoot, `${timestamp}-incomplete-`);
  let currentDirectory = await mkdtemp(incompletePrefix);
  try {
    await writeFinalFile(currentDirectory, "report.json", reportContent);
    await writeFinalFile(currentDirectory, "publication-allowlist.json", allowlistContent);
    const manifestContent = jsonBytes({ ...identity, acquisitionId });
    await writeFinalFile(currentDirectory, "manifest.json", manifestContent);
    const suffix = basename(currentDirectory).slice(basename(incompletePrefix).length);
    const finalDirectory = join(outputRoot, `${timestamp}-${acquisitionId.slice(7, 19)}-${suffix}`);
    await rename(currentDirectory, finalDirectory);
    currentDirectory = finalDirectory;
    const [writtenReport, writtenAllowlist, writtenManifest] = await Promise.all([
      readStableRegularFile(join(finalDirectory, "report.json")),
      readStableRegularFile(join(finalDirectory, "publication-allowlist.json")),
      readStableRegularFile(join(finalDirectory, "manifest.json")),
    ]);
    if (writtenReport.sha256 !== identity.reportSha256 || writtenAllowlist.sha256 !== identity.publicationAllowlistSha256) {
      throw new Error("Written data-ready artifact hash changed.");
    }
    if (writtenManifest.sha256 !== sha256(manifestContent)) throw new Error("Written data-ready manifest hash changed.");
    await writeFinalFile(finalDirectory, "complete.json", jsonBytes({
      schema: "neodes2-data-ready-completion-1",
      acquisitionId,
      manifestSha256: writtenManifest.sha256,
      reportSha256: writtenReport.sha256,
      publicationAllowlistSha256: writtenAllowlist.sha256,
      complete: true,
    }));
    return { acquisitionId, directory: finalDirectory, report, allowlist };
  } catch (error) {
    throw new Error(`Unable to finalize data-ready artifact in ${currentDirectory}.`, { cause: error });
  }
}
