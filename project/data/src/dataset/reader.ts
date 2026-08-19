import { isAbsolute, join, resolve } from "node:path";

import { jsonBytes, readStableRegularFile, sha256 } from "../boons/runtime-acquisition.js";
import type { CombinedDataset, DatasetValidationReport, VerifiedCombinedDataset } from "./types.js";
import { validateNormalizedDomains } from "./validation.js";

function record(value: unknown, label: string): Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Readonly<Record<string, unknown>>;
}

function canonicalJson(content: Buffer, label: string): unknown {
  const value: unknown = JSON.parse(content.toString("utf8"));
  if (!content.equals(jsonBytes(value))) {
    throw new Error(`${label} is not in the supported deterministic JSON representation.`);
  }
  return value;
}

function sameJson(left: unknown, right: unknown): boolean {
  return jsonBytes(left).equals(jsonBytes(right));
}

export async function readCombinedDataset(directory: string): Promise<VerifiedCombinedDataset> {
  if (!isAbsolute(directory)) throw new Error("Combined dataset path must be absolute.");
  const root = resolve(directory);
  const [manifestFile, completionFile, datasetFile, validationFile] = await Promise.all([
    readStableRegularFile(join(root, "manifest.json")),
    readStableRegularFile(join(root, "complete.json")),
    readStableRegularFile(join(root, "dataset.json")),
    readStableRegularFile(join(root, "validation.json")),
  ]);
  const manifest = record(canonicalJson(manifestFile.content, "Combined dataset manifest"), "Combined dataset manifest");
  const completion = record(canonicalJson(completionFile.content, "Combined dataset completion marker"), "Combined dataset completion marker");
  const datasetRecord = record(canonicalJson(datasetFile.content, "Combined dataset"), "Combined dataset");
  const validationRecord = record(canonicalJson(validationFile.content, "Combined dataset validation"), "Combined dataset validation");
  if (manifest.schema !== "neodes2-dataset-manifest-1") throw new Error("Unsupported combined dataset manifest schema.");
  if (completion.schema !== "neodes2-dataset-completion-1") throw new Error("Unsupported combined dataset completion schema.");
  if (datasetRecord.schema !== "neodes2-dataset-1") throw new Error("Unsupported combined dataset schema.");
  if (validationRecord.schema !== "neodes2-dataset-validation-1") throw new Error("Unsupported combined dataset validation schema.");
  const datasetSha256 = sha256(datasetFile.content);
  const validationSha256 = sha256(validationFile.content);
  const manifestSha256 = sha256(manifestFile.content);
  for (const [field, expected] of [
    ["datasetSha256", datasetSha256],
    ["validationSha256", validationSha256],
  ] as const) {
    if (manifest[field] !== expected || completion[field] !== expected) {
      throw new Error(`Combined dataset ${field} does not match its file.`);
    }
  }
  const acquisitionId = manifest.acquisitionId;
  if (typeof acquisitionId !== "string" || acquisitionId.trim() === "") {
    throw new Error("Combined dataset manifest acquisitionId must be a nonempty string.");
  }
  if (completion.acquisitionId !== acquisitionId || completion.manifestSha256 !== manifestSha256) {
    throw new Error("Combined dataset completion marker does not match its manifest.");
  }
  const identity = Object.fromEntries(Object.entries(manifest).filter(([field]) => field !== "acquisitionId"));
  if (acquisitionId !== `sha256:${sha256(JSON.stringify(identity))}`) {
    throw new Error("Combined dataset acquisition identifier does not match its manifest identity.");
  }
  if (manifest.validationComplete !== true || validationRecord.complete !== true) {
    throw new Error("Combined dataset validation is incomplete.");
  }
  const issues = validationRecord.issues;
  if (!Array.isArray(issues) || issues.length !== 0) {
    throw new Error("Combined dataset validation contains issues.");
  }
  const dataset = datasetRecord as unknown as CombinedDataset;
  const validation = validationRecord as unknown as DatasetValidationReport;
  if (!sameJson(manifest.source, dataset.source)) {
    throw new Error("Combined dataset source differs from its manifest.");
  }
  const manifestDomains = record(manifest.domains, "Combined dataset manifest domains");
  for (const [domain, domainAcquisitionId] of Object.entries(dataset.domainAcquisitionIds)) {
    const provenance = record(manifestDomains[domain], `Combined dataset manifest domains.${domain}`);
    if (provenance.acquisitionId !== domainAcquisitionId) {
      throw new Error(`Combined dataset ${domain} acquisition differs from its manifest.`);
    }
  }
  const recalculated = validateNormalizedDomains(dataset.domains);
  if (!recalculated.complete || !sameJson(recalculated, validation)) {
    throw new Error("Combined dataset validation cannot be reproduced from its normalized domains.");
  }
  if (validation.sourceAcquisitionId !== dataset.source.acquisitionId) {
    throw new Error("Combined dataset validation source differs from its dataset source.");
  }
  return { acquisitionId, datasetSha256, manifestSha256, dataset, validation };
}
