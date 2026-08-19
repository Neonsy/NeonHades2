import { basename, isAbsolute, join, resolve } from "node:path";
import { mkdir, mkdtemp, rename, writeFile } from "node:fs/promises";

import { jsonBytes, readStableRegularFile, sha256 } from "../boons/runtime-acquisition.js";
import { acquisitionContract } from "../contract/index.js";
import { readCombinedDataset } from "../dataset/index.js";
import { assertLocalOutputPath, readSourceSnapshotFile } from "../snapshot/index.js";
import { verifyDataset, type AutomatedVerificationReport } from "./report.js";
import { parseCalculationRules } from "./source-rules.js";

const ruleSources = ["Content/Scripts/UIData.lua", "Content/Scripts/TraitData.lua"] as const;

export interface VerificationBuildOptions {
  readonly datasetDirectory: string;
  readonly sourceDirectory: string;
  readonly outputRoot: string;
  readonly now?: () => Date;
}

export interface VerificationBuildResult {
  readonly acquisitionId: string;
  readonly directory: string;
  readonly report: AutomatedVerificationReport;
}

interface VerificationSummaryReport {
  readonly schema: "neodes2-verification-report-1";
  readonly sourceDatasetAcquisitionId: string;
  readonly requirementGraph: {
    readonly schema: string;
    readonly nodeCount: number;
    readonly referenceCount: number;
    readonly issueCount: number;
    readonly complete: boolean;
  };
  readonly calculations: {
    readonly schema: string;
    readonly sampleGroupCount: number;
    readonly sampleCount: number;
    readonly valueCount: number;
    readonly resolvedValueCount: number;
    readonly contextualValueCount: number;
    readonly boundaryCaseCount: number;
    readonly issueCount: number;
    readonly complete: boolean;
  };
  readonly manualTasks: AutomatedVerificationReport["manualTasks"];
  readonly automatedComplete: boolean;
  readonly manualComplete: false;
  readonly phaseComplete: false;
}

async function writeFinalFile(directory: string, name: string, content: Buffer): Promise<void> {
  const temporary = join(directory, `${name}.tmp`);
  await writeFile(temporary, content, { flag: "wx" });
  await rename(temporary, join(directory, name));
}

export async function createVerificationArtifact(options: VerificationBuildOptions): Promise<VerificationBuildResult> {
  if (!isAbsolute(options.datasetDirectory)) throw new Error("Combined dataset path must be absolute.");
  if (!isAbsolute(options.sourceDirectory)) throw new Error("Source acquisition path must be absolute.");
  assertLocalOutputPath(options.outputRoot);
  const [verifiedDataset, uiData, traitData] = await Promise.all([
    readCombinedDataset(options.datasetDirectory),
    readSourceSnapshotFile(options.sourceDirectory, ruleSources[0]),
    readSourceSnapshotFile(options.sourceDirectory, ruleSources[1]),
  ]);
  const sourceIdentity = uiData.acquisitionId;
  if (traitData.acquisitionId !== sourceIdentity || verifiedDataset.dataset.source.acquisitionId !== sourceIdentity) {
    throw new Error("Verification inputs do not share one source acquisition.");
  }
  if (
    traitData.manifestSha256 !== uiData.manifestSha256 ||
    verifiedDataset.dataset.source.sourceManifestSha256 !== uiData.manifestSha256
  ) {
    throw new Error("Verification inputs do not share one source manifest.");
  }
  const rules = parseCalculationRules(uiData.content.toString("utf8"), traitData.content.toString("utf8"));
  const report = verifyDataset(verifiedDataset.dataset, rules);
  if (!report.automatedComplete) {
    const issues = report.requirementGraph.issues.length + report.calculations.issues.length;
    throw new Error(`Automated verification failed with ${issues} issue(s).`);
  }
  const requirementGraphContent = jsonBytes(report.requirementGraph);
  const calculationsContent = jsonBytes(report.calculations);
  const summary: VerificationSummaryReport = {
    schema: "neodes2-verification-report-1",
    sourceDatasetAcquisitionId: report.sourceDatasetAcquisitionId,
    requirementGraph: {
      schema: report.requirementGraph.schema,
      nodeCount: report.requirementGraph.nodes.length,
      referenceCount: report.requirementGraph.references.length,
      issueCount: report.requirementGraph.issues.length,
      complete: report.requirementGraph.complete,
    },
    calculations: {
      schema: report.calculations.schema,
      sampleGroupCount: report.calculations.sampleGroupCount,
      sampleCount: report.calculations.sampleCount,
      valueCount: report.calculations.valueCount,
      resolvedValueCount: report.calculations.resolvedValueCount,
      contextualValueCount: report.calculations.contextualValueCount,
      boundaryCaseCount: report.calculations.boundaryCaseCount,
      issueCount: report.calculations.issues.length,
      complete: report.calculations.complete,
    },
    manualTasks: report.manualTasks,
    automatedComplete: report.automatedComplete,
    manualComplete: report.manualComplete,
    phaseComplete: report.phaseComplete,
  };
  const reportContent = jsonBytes(summary);
  const identity = {
    schema: "neodes2-verification-manifest-1" as const,
    sourceAcquisitionId: sourceIdentity,
    sourceManifestSha256: uiData.manifestSha256,
    sourceDatasetAcquisitionId: verifiedDataset.acquisitionId,
    sourceDatasetSha256: verifiedDataset.datasetSha256,
    sourceDatasetManifestSha256: verifiedDataset.manifestSha256,
    contractSha256: sha256(jsonBytes(acquisitionContract)),
    ruleSources: ruleSources.map((path, index) => ({
      path,
      sha256: index === 0 ? uiData.evidence.sha256 : traitData.evidence.sha256,
    })),
    reportSha256: sha256(reportContent),
    requirementGraphSha256: sha256(requirementGraphContent),
    calculationsSha256: sha256(calculationsContent),
    automatedComplete: true,
    manualTaskCount: report.manualTasks.length,
    phaseComplete: false,
  };
  const acquisitionId = `sha256:${sha256(JSON.stringify(identity))}`;
  const outputRoot = resolve(options.outputRoot);
  await mkdir(outputRoot, { recursive: true });
  const timestamp = (options.now ?? (() => new Date()))().toISOString().replace(/[-:.]/gu, "");
  const incompletePrefix = join(outputRoot, `${timestamp}-incomplete-`);
  let currentDirectory = await mkdtemp(incompletePrefix);
  try {
    await writeFinalFile(currentDirectory, "report.json", reportContent);
    await writeFinalFile(currentDirectory, "requirement-graph.json", requirementGraphContent);
    await writeFinalFile(currentDirectory, "calculations.json", calculationsContent);
    const manifestContent = jsonBytes({ ...identity, acquisitionId });
    await writeFinalFile(currentDirectory, "manifest.json", manifestContent);
    const suffix = basename(currentDirectory).slice(basename(incompletePrefix).length);
    const finalDirectory = join(outputRoot, `${timestamp}-${acquisitionId.slice(7, 19)}-${suffix}`);
    await rename(currentDirectory, finalDirectory);
    currentDirectory = finalDirectory;
    const [writtenReport, writtenGraph, writtenCalculations, writtenManifest] = await Promise.all([
      readStableRegularFile(join(finalDirectory, "report.json")),
      readStableRegularFile(join(finalDirectory, "requirement-graph.json")),
      readStableRegularFile(join(finalDirectory, "calculations.json")),
      readStableRegularFile(join(finalDirectory, "manifest.json")),
    ]);
    if (writtenReport.sha256 !== identity.reportSha256) throw new Error("Written verification report hash changed.");
    if (writtenGraph.sha256 !== identity.requirementGraphSha256) throw new Error("Written requirement graph hash changed.");
    if (writtenCalculations.sha256 !== identity.calculationsSha256) {
      throw new Error("Written calculation verification hash changed.");
    }
    if (writtenManifest.sha256 !== sha256(manifestContent)) throw new Error("Written verification manifest hash changed.");
    await writeFinalFile(finalDirectory, "complete.json", jsonBytes({
      schema: "neodes2-verification-completion-1",
      acquisitionId,
      manifestSha256: writtenManifest.sha256,
      reportSha256: identity.reportSha256,
      requirementGraphSha256: identity.requirementGraphSha256,
      calculationsSha256: identity.calculationsSha256,
      automatedComplete: true,
      phaseComplete: false,
    }));
    return { acquisitionId, directory: finalDirectory, report };
  } catch (error) {
    throw new Error(`Unable to finalize verification artifact in ${currentDirectory}.`, { cause: error });
  }
}
