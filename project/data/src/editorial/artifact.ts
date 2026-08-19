import { basename, isAbsolute, join, resolve } from "node:path";
import { mkdir, mkdtemp, rename, writeFile } from "node:fs/promises";

import { jsonBytes, readStableRegularFile, sha256 } from "../boons/runtime-acquisition.js";
import { readCombinedDataset } from "../dataset/index.js";
import { assertLocalOutputPath } from "../snapshot/index.js";
import { aspectProfiles, familiarProfiles, hexProfiles, pageDefinitions, progressionStages } from "./content.js";
import { compileEditorialDataset } from "./compiler.js";
import type { EditorialBuildOptions, EditorialBuildResult } from "./types.js";

interface DataReadyIdentity {
  readonly acquisitionId: string;
  readonly sourceDatasetAcquisitionId: string;
  readonly sourceDatasetSha256: string;
  readonly sourceDatasetManifestSha256: string;
  readonly sourceVerificationAcquisitionId: string;
  readonly reportSha256: string;
  readonly publicationAllowlistSha256: string;
}

function record(value: unknown, label: string): Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Readonly<Record<string, unknown>>;
}

function string(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${label} must be a nonempty string.`);
  return value;
}

function canonicalJson(content: Buffer, label: string): Readonly<Record<string, unknown>> {
  const value: unknown = JSON.parse(content.toString("utf8"));
  if (!content.equals(jsonBytes(value))) throw new Error(`${label} is not deterministic JSON.`);
  return record(value, label);
}

async function readDataReady(directory: string): Promise<DataReadyIdentity> {
  if (!isAbsolute(directory)) throw new Error("Data-ready artifact path must be absolute.");
  const root = resolve(directory);
  const [manifestFile, completionFile, reportFile, allowlistFile] = await Promise.all([
    readStableRegularFile(join(root, "manifest.json")),
    readStableRegularFile(join(root, "complete.json")),
    readStableRegularFile(join(root, "report.json")),
    readStableRegularFile(join(root, "publication-allowlist.json")),
  ]);
  const manifest = canonicalJson(manifestFile.content, "Data-ready manifest");
  const completion = canonicalJson(completionFile.content, "Data-ready completion marker");
  const report = canonicalJson(reportFile.content, "Data-ready report");
  const allowlist = canonicalJson(allowlistFile.content, "Publication allowlist");
  if (manifest.schema !== "neodes2-data-ready-manifest-1" || completion.schema !== "neodes2-data-ready-completion-1") {
    throw new Error("Unsupported data-ready artifact schema.");
  }
  if (report.schema !== "neodes2-data-ready-report-1" || report.complete !== true || manifest.complete !== true || completion.complete !== true) {
    throw new Error("Data-ready artifact is incomplete.");
  }
  if (allowlist.schema !== "neodes2-publication-allowlist-1") throw new Error("Unsupported publication allowlist schema.");
  if (manifest.reportSha256 !== reportFile.sha256 || completion.reportSha256 !== reportFile.sha256 ||
    manifest.publicationAllowlistSha256 !== allowlistFile.sha256 || completion.publicationAllowlistSha256 !== allowlistFile.sha256) {
    throw new Error("Data-ready payload hash does not match its manifest.");
  }
  const acquisitionId = string(manifest.acquisitionId, "Data-ready acquisitionId");
  if (completion.acquisitionId !== acquisitionId || completion.manifestSha256 !== manifestFile.sha256) {
    throw new Error("Data-ready completion marker does not match its manifest.");
  }
  const identity = Object.fromEntries(Object.entries(manifest).filter(([field]) => field !== "acquisitionId"));
  if (acquisitionId !== `sha256:${sha256(JSON.stringify(identity))}`) throw new Error("Data-ready acquisition identity is invalid.");
  if (report.sourceDatasetAcquisitionId !== manifest.sourceDatasetAcquisitionId ||
    report.sourceVerificationAcquisitionId !== manifest.sourceVerificationAcquisitionId) {
    throw new Error("Data-ready report source identity does not match its manifest.");
  }
  return {
    acquisitionId,
    sourceDatasetAcquisitionId: string(manifest.sourceDatasetAcquisitionId, "Data-ready source dataset acquisitionId"),
    sourceDatasetSha256: string(manifest.sourceDatasetSha256, "Data-ready source dataset SHA-256"),
    sourceDatasetManifestSha256: string(manifest.sourceDatasetManifestSha256, "Data-ready source dataset manifest SHA-256"),
    sourceVerificationAcquisitionId: string(manifest.sourceVerificationAcquisitionId, "Data-ready verification acquisitionId"),
    reportSha256: reportFile.sha256,
    publicationAllowlistSha256: allowlistFile.sha256,
  };
}

async function writeFinalFile(directory: string, name: string, content: Buffer): Promise<void> {
  const temporary = join(directory, `${name}.tmp`);
  await writeFile(temporary, content, { flag: "wx" });
  await rename(temporary, join(directory, name));
}

export async function createEditorialArtifact(options: EditorialBuildOptions): Promise<EditorialBuildResult> {
  if (!isAbsolute(options.datasetDirectory) || !isAbsolute(options.dataReadyDirectory)) {
    throw new Error("Dataset and data-ready paths must be absolute.");
  }
  assertLocalOutputPath(options.outputRoot);
  const [combined, dataReady] = await Promise.all([
    readCombinedDataset(options.datasetDirectory),
    readDataReady(options.dataReadyDirectory),
  ]);
  if (dataReady.sourceDatasetAcquisitionId !== combined.acquisitionId ||
    dataReady.sourceDatasetSha256 !== combined.datasetSha256 ||
    dataReady.sourceDatasetManifestSha256 !== combined.manifestSha256) {
    throw new Error("Data-ready artifact does not certify the selected normalized dataset.");
  }
  const compiled = compileEditorialDataset(combined.dataset, {
    datasetAcquisitionId: combined.acquisitionId,
    datasetSha256: combined.datasetSha256,
    dataReadyAcquisitionId: dataReady.acquisitionId,
    verificationAcquisitionId: dataReady.sourceVerificationAcquisitionId,
  });
  if (!compiled.report.complete) {
    const issueGroups: readonly (readonly [string, readonly string[]])[] = [
      ["missing references", compiled.report.missingReferences],
      ["missing aliases", compiled.report.missingAliases],
      ["orphan records", compiled.report.orphanRecordIds],
      ["uncovered pages", compiled.report.requiredPagesWithoutEditorialCoverage],
      ["duplicate records", compiled.report.duplicateRecordIds],
      ["invalid editorial records", compiled.report.invalidEditorialRecords],
    ];
    const failures = issueGroups.filter(([, values]) => values.length > 0)
      .map(([label, values]) => `${label}: ${values.join(", ")}`);
    throw new Error(`Editorial content is incomplete. ${failures.join("; ")}`);
  }
  const editorialContent = jsonBytes(compiled.dataset);
  const reportContent = jsonBytes(compiled.report);
  const contentSourceSha256 = sha256(jsonBytes({ progressionStages, aspectProfiles, familiarProfiles, hexProfiles, pageDefinitions }));
  const identity = {
    schema: "neodes2-editorial-manifest-1" as const,
    sourceDatasetAcquisitionId: combined.acquisitionId,
    sourceDatasetSha256: combined.datasetSha256,
    sourceDatasetManifestSha256: combined.manifestSha256,
    sourceDataReadyAcquisitionId: dataReady.acquisitionId,
    sourceDataReadyReportSha256: dataReady.reportSha256,
    sourcePublicationAllowlistSha256: dataReady.publicationAllowlistSha256,
    contentSourceSha256,
    editorialSha256: sha256(editorialContent),
    reportSha256: sha256(reportContent),
    complete: true,
  };
  const acquisitionId = `sha256:${sha256(JSON.stringify(identity))}`;
  const outputRoot = resolve(options.outputRoot);
  await mkdir(outputRoot, { recursive: true });
  const timestamp = (options.now ?? (() => new Date()))().toISOString().replace(/[-:.]/gu, "");
  const incompletePrefix = join(outputRoot, `${timestamp}-incomplete-`);
  let currentDirectory = await mkdtemp(incompletePrefix);
  try {
    await writeFinalFile(currentDirectory, "editorial.json", editorialContent);
    await writeFinalFile(currentDirectory, "content-report.json", reportContent);
    const manifestContent = jsonBytes({ ...identity, acquisitionId });
    await writeFinalFile(currentDirectory, "manifest.json", manifestContent);
    const suffix = basename(currentDirectory).slice(basename(incompletePrefix).length);
    const finalDirectory = join(outputRoot, `${timestamp}-${acquisitionId.slice(7, 19)}-${suffix}`);
    await rename(currentDirectory, finalDirectory);
    currentDirectory = finalDirectory;
    const [writtenEditorial, writtenReport, writtenManifest] = await Promise.all([
      readStableRegularFile(join(finalDirectory, "editorial.json")),
      readStableRegularFile(join(finalDirectory, "content-report.json")),
      readStableRegularFile(join(finalDirectory, "manifest.json")),
    ]);
    if (writtenEditorial.sha256 !== identity.editorialSha256 || writtenReport.sha256 !== identity.reportSha256) {
      throw new Error("Written editorial artifact hash changed.");
    }
    await writeFinalFile(finalDirectory, "complete.json", jsonBytes({
      schema: "neodes2-editorial-completion-1",
      acquisitionId,
      manifestSha256: writtenManifest.sha256,
      editorialSha256: writtenEditorial.sha256,
      reportSha256: writtenReport.sha256,
      complete: true,
    }));
    return {
      acquisitionId,
      directory: finalDirectory,
      editorialSha256: writtenEditorial.sha256,
      reportSha256: writtenReport.sha256,
      dataset: compiled.dataset,
      report: compiled.report,
    };
  } catch (error) {
    throw new Error(`Unable to finalize editorial artifact in ${currentDirectory}.`, { cause: error });
  }
}
