import { basename, isAbsolute, join, resolve } from "node:path";
import { mkdir, mkdtemp, rename, writeFile } from "node:fs/promises";

import { jsonBytes, readStableRegularFile, sha256 } from "../boons/runtime-acquisition.js";
import { readCombinedDataset } from "../dataset/index.js";
import { assertLocalOutputPath } from "../snapshot/index.js";
import { assertTraceMatchesDataset, parseObservationTrace, summarizeObservationTrace, type ObservationEvidenceReport } from "./trace.js";

export interface ObservationArtifactOptions {
  readonly datasetDirectory: string;
  readonly tracePath: string;
  readonly outputRoot: string;
  readonly now?: () => Date;
}

export interface ObservationArtifactResult {
  readonly acquisitionId: string;
  readonly directory: string;
  readonly traceSha256: string;
  readonly report: ObservationEvidenceReport;
}

async function writeFinalFile(directory: string, name: string, content: Buffer): Promise<void> {
  const temporaryPath = join(directory, `${name}.tmp`);
  await writeFile(temporaryPath, content, { flag: "wx" });
  await rename(temporaryPath, join(directory, name));
}

export async function createObservationArtifact(options: ObservationArtifactOptions): Promise<ObservationArtifactResult> {
  if (!isAbsolute(options.datasetDirectory)) throw new Error("Combined dataset path must be absolute.");
  if (!isAbsolute(options.tracePath)) throw new Error("Observation trace path must be absolute.");
  assertLocalOutputPath(options.outputRoot);
  const [dataset, traceFile] = await Promise.all([
    readCombinedDataset(resolve(options.datasetDirectory)),
    readStableRegularFile(resolve(options.tracePath)),
  ]);
  const trace = parseObservationTrace(traceFile.content);
  assertTraceMatchesDataset(trace, dataset);
  const report = summarizeObservationTrace(trace, dataset.dataset);
  const reportContent = jsonBytes(report);
  const identity = {
    schema: "neodes2-observation-manifest-1" as const,
    observerVersion: trace.identity.observerVersion,
    sourceDatasetAcquisitionId: dataset.acquisitionId,
    sourceDatasetSha256: dataset.datasetSha256,
    sourceDatasetManifestSha256: dataset.manifestSha256,
    traceSha256: traceFile.sha256,
    reportSha256: sha256(reportContent),
    eventCount: trace.events.length,
  };
  const acquisitionId = `sha256:${sha256(JSON.stringify(identity))}`;
  const outputRoot = resolve(options.outputRoot);
  await mkdir(outputRoot, { recursive: true });
  const timestamp = (options.now ?? (() => new Date()))().toISOString().replace(/[-:.]/gu, "");
  const incompletePrefix = join(outputRoot, `${timestamp}-incomplete-`);
  let currentDirectory = await mkdtemp(incompletePrefix);
  try {
    await writeFinalFile(currentDirectory, "trace.ndjson", traceFile.content);
    await writeFinalFile(currentDirectory, "report.json", reportContent);
    const manifestContent = jsonBytes({ ...identity, acquisitionId });
    await writeFinalFile(currentDirectory, "manifest.json", manifestContent);
    const suffix = basename(currentDirectory).slice(basename(incompletePrefix).length);
    const finalDirectory = join(outputRoot, `${timestamp}-${acquisitionId.slice(7, 19)}-${suffix}`);
    await rename(currentDirectory, finalDirectory);
    currentDirectory = finalDirectory;
    const [writtenTrace, writtenReport, writtenManifest] = await Promise.all([
      readStableRegularFile(join(finalDirectory, "trace.ndjson")),
      readStableRegularFile(join(finalDirectory, "report.json")),
      readStableRegularFile(join(finalDirectory, "manifest.json")),
    ]);
    if (writtenTrace.sha256 !== traceFile.sha256) throw new Error("Written observation trace hash changed.");
    if (writtenReport.sha256 !== identity.reportSha256) throw new Error("Written observation report hash changed.");
    await writeFinalFile(finalDirectory, "complete.json", jsonBytes({
      schema: "neodes2-observation-completion-1",
      acquisitionId,
      manifestSha256: writtenManifest.sha256,
      traceSha256: writtenTrace.sha256,
      reportSha256: writtenReport.sha256,
    }));
    return { acquisitionId, directory: finalDirectory, traceSha256: traceFile.sha256, report };
  } catch (error) {
    throw new Error(`Unable to finalize observation artifact in ${currentDirectory}.`, { cause: error });
  }
}
