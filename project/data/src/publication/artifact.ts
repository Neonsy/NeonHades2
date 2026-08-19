import { mkdir, mkdtemp, rename, writeFile } from "node:fs/promises";
import { basename, isAbsolute, join, resolve } from "node:path";

import { jsonBytes, readStableRegularFile, sha256 } from "../boons/runtime-acquisition.js";
import type { PublicationAllowlist } from "../data-ready/index.js";
import { readCombinedDataset } from "../dataset/index.js";
import type { EditorialDataset } from "../editorial/index.js";
import { assertLocalOutputPath } from "../snapshot/index.js";
import { compilePublicationDataset } from "./compiler.js";
import type { PublicationBuildOptions, PublicationBuildResult } from "./types.js";

interface DataReadyInput {
  readonly acquisitionId: string;
  readonly manifestSha256: string;
  readonly sourceDatasetAcquisitionId: string;
  readonly sourceDatasetSha256: string;
  readonly sourceDatasetManifestSha256: string;
  readonly allowlistSha256: string;
  readonly allowlist: PublicationAllowlist;
}

interface EditorialInput {
  readonly acquisitionId: string;
  readonly manifestSha256: string;
  readonly editorialSha256: string;
  readonly sourceDatasetAcquisitionId: string;
  readonly sourceDatasetSha256: string;
  readonly sourceDataReadyAcquisitionId: string;
  readonly dataset: EditorialDataset;
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

function assertIdentity(manifest: Readonly<Record<string, unknown>>, acquisitionId: string, label: string): void {
  const identity = Object.fromEntries(Object.entries(manifest).filter(([field]) => field !== "acquisitionId"));
  if (acquisitionId !== `sha256:${sha256(JSON.stringify(identity))}`) throw new Error(`${label} acquisition identity is invalid.`);
}

async function readDataReady(directory: string): Promise<DataReadyInput> {
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
  const allowlistValue = canonicalJson(allowlistFile.content, "Publication allowlist");
  if (manifest.schema !== "neodes2-data-ready-manifest-1" || completion.schema !== "neodes2-data-ready-completion-1" ||
    report.schema !== "neodes2-data-ready-report-1" || allowlistValue.schema !== "neodes2-publication-allowlist-1") {
    throw new Error("Unsupported data-ready artifact schema.");
  }
  if (manifest.complete !== true || completion.complete !== true || report.complete !== true) throw new Error("Data-ready artifact is incomplete.");
  if (manifest.reportSha256 !== reportFile.sha256 || completion.reportSha256 !== reportFile.sha256 ||
    manifest.publicationAllowlistSha256 !== allowlistFile.sha256 || completion.publicationAllowlistSha256 !== allowlistFile.sha256) {
    throw new Error("Data-ready payload hash does not match its manifest.");
  }
  const acquisitionId = string(manifest.acquisitionId, "Data-ready acquisitionId");
  if (completion.acquisitionId !== acquisitionId || completion.manifestSha256 !== manifestFile.sha256) {
    throw new Error("Data-ready completion marker does not match its manifest.");
  }
  assertIdentity(manifest, acquisitionId, "Data-ready");
  return {
    acquisitionId,
    manifestSha256: manifestFile.sha256,
    sourceDatasetAcquisitionId: string(manifest.sourceDatasetAcquisitionId, "Data-ready source dataset acquisitionId"),
    sourceDatasetSha256: string(manifest.sourceDatasetSha256, "Data-ready source dataset SHA-256"),
    sourceDatasetManifestSha256: string(manifest.sourceDatasetManifestSha256, "Data-ready source dataset manifest SHA-256"),
    allowlistSha256: allowlistFile.sha256,
    allowlist: allowlistValue as unknown as PublicationAllowlist,
  };
}

async function readEditorial(directory: string): Promise<EditorialInput> {
  if (!isAbsolute(directory)) throw new Error("Editorial artifact path must be absolute.");
  const root = resolve(directory);
  const [manifestFile, completionFile, editorialFile, reportFile] = await Promise.all([
    readStableRegularFile(join(root, "manifest.json")),
    readStableRegularFile(join(root, "complete.json")),
    readStableRegularFile(join(root, "editorial.json")),
    readStableRegularFile(join(root, "content-report.json")),
  ]);
  const manifest = canonicalJson(manifestFile.content, "Editorial manifest");
  const completion = canonicalJson(completionFile.content, "Editorial completion marker");
  const editorialValue = canonicalJson(editorialFile.content, "Editorial dataset");
  const report = canonicalJson(reportFile.content, "Editorial content report");
  if (manifest.schema !== "neodes2-editorial-manifest-1" || completion.schema !== "neodes2-editorial-completion-1" ||
    editorialValue.schema !== "neodes2-editorial-1" || report.schema !== "neodes2-content-report-1") {
    throw new Error("Unsupported editorial artifact schema.");
  }
  if (manifest.complete !== true || completion.complete !== true || report.complete !== true) throw new Error("Editorial artifact is incomplete.");
  if (manifest.editorialSha256 !== editorialFile.sha256 || completion.editorialSha256 !== editorialFile.sha256 ||
    manifest.reportSha256 !== reportFile.sha256 || completion.reportSha256 !== reportFile.sha256) {
    throw new Error("Editorial payload hash does not match its manifest.");
  }
  const acquisitionId = string(manifest.acquisitionId, "Editorial acquisitionId");
  if (completion.acquisitionId !== acquisitionId || completion.manifestSha256 !== manifestFile.sha256) {
    throw new Error("Editorial completion marker does not match its manifest.");
  }
  assertIdentity(manifest, acquisitionId, "Editorial");
  return {
    acquisitionId,
    manifestSha256: manifestFile.sha256,
    editorialSha256: editorialFile.sha256,
    sourceDatasetAcquisitionId: string(manifest.sourceDatasetAcquisitionId, "Editorial source dataset acquisitionId"),
    sourceDatasetSha256: string(manifest.sourceDatasetSha256, "Editorial source dataset SHA-256"),
    sourceDataReadyAcquisitionId: string(manifest.sourceDataReadyAcquisitionId, "Editorial source data-ready acquisitionId"),
    dataset: editorialValue as unknown as EditorialDataset,
  };
}

async function writeFinalFile(directory: string, name: string, content: Buffer): Promise<void> {
  const temporary = join(directory, `${name}.tmp`);
  await writeFile(temporary, content, { flag: "wx" });
  await rename(temporary, join(directory, name));
}

export async function createPublicationArtifact(options: PublicationBuildOptions): Promise<PublicationBuildResult> {
  if (!isAbsolute(options.datasetDirectory) || !isAbsolute(options.dataReadyDirectory) || !isAbsolute(options.editorialDirectory)) {
    throw new Error("Dataset, data-ready, and editorial paths must be absolute.");
  }
  assertLocalOutputPath(options.outputRoot);
  const [combined, dataReady, editorial] = await Promise.all([
    readCombinedDataset(options.datasetDirectory),
    readDataReady(options.dataReadyDirectory),
    readEditorial(options.editorialDirectory),
  ]);
  if (dataReady.sourceDatasetAcquisitionId !== combined.acquisitionId || dataReady.sourceDatasetSha256 !== combined.datasetSha256 ||
    dataReady.sourceDatasetManifestSha256 !== combined.manifestSha256) {
    throw new Error("Data-ready artifact does not certify the selected normalized dataset.");
  }
  if (editorial.sourceDatasetAcquisitionId !== combined.acquisitionId || editorial.sourceDatasetSha256 !== combined.datasetSha256 ||
    editorial.sourceDataReadyAcquisitionId !== dataReady.acquisitionId) {
    throw new Error("Editorial artifact does not match the selected dataset and data-ready artifact.");
  }
  const compiled = compilePublicationDataset(combined.dataset, editorial.dataset, dataReady.allowlist, {
    datasetAcquisitionId: combined.acquisitionId,
    datasetSha256: combined.datasetSha256,
    dataReadyAcquisitionId: dataReady.acquisitionId,
    editorialAcquisitionId: editorial.acquisitionId,
  });
  if (!compiled.report.complete) {
    const failures = Object.entries(compiled.report)
      .filter(([, value]) => Array.isArray(value) && value.length > 0)
      .map(([name, value]) => `${name}: ${(value as readonly string[]).join(", ")}`);
    throw new Error(`Publication dataset is incomplete. ${failures.join("; ")}`);
  }
  const publicationContent = jsonBytes(compiled.dataset);
  const reportContent = jsonBytes(compiled.report);
  const identity = {
    schema: "neodes2-publication-manifest-1" as const,
    sourceDatasetAcquisitionId: combined.acquisitionId,
    sourceDatasetSha256: combined.datasetSha256,
    sourceDatasetManifestSha256: combined.manifestSha256,
    sourceDataReadyAcquisitionId: dataReady.acquisitionId,
    sourceDataReadyManifestSha256: dataReady.manifestSha256,
    sourcePublicationAllowlistSha256: dataReady.allowlistSha256,
    sourceEditorialAcquisitionId: editorial.acquisitionId,
    sourceEditorialManifestSha256: editorial.manifestSha256,
    sourceEditorialSha256: editorial.editorialSha256,
    publicationSha256: sha256(publicationContent),
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
    await writeFinalFile(currentDirectory, "publication.json", publicationContent);
    await writeFinalFile(currentDirectory, "publication-report.json", reportContent);
    const manifestContent = jsonBytes({ ...identity, acquisitionId });
    await writeFinalFile(currentDirectory, "manifest.json", manifestContent);
    const suffix = basename(currentDirectory).slice(basename(incompletePrefix).length);
    const finalDirectory = join(outputRoot, `${timestamp}-${acquisitionId.slice(7, 19)}-${suffix}`);
    await rename(currentDirectory, finalDirectory);
    currentDirectory = finalDirectory;
    const [writtenPublication, writtenReport, writtenManifest] = await Promise.all([
      readStableRegularFile(join(finalDirectory, "publication.json")),
      readStableRegularFile(join(finalDirectory, "publication-report.json")),
      readStableRegularFile(join(finalDirectory, "manifest.json")),
    ]);
    if (writtenPublication.sha256 !== identity.publicationSha256 || writtenReport.sha256 !== identity.reportSha256) {
      throw new Error("Written publication artifact hash changed.");
    }
    await writeFinalFile(finalDirectory, "complete.json", jsonBytes({
      schema: "neodes2-publication-completion-1",
      acquisitionId,
      manifestSha256: writtenManifest.sha256,
      publicationSha256: writtenPublication.sha256,
      reportSha256: writtenReport.sha256,
      complete: true,
    }));
    return {
      acquisitionId,
      directory: finalDirectory,
      publicationSha256: writtenPublication.sha256,
      reportSha256: writtenReport.sha256,
      ...compiled,
    };
  } catch (error) {
    throw new Error(`Unable to finalize publication artifact in ${currentDirectory}.`, { cause: error });
  }
}
