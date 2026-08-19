import { lstat, mkdir, mkdtemp, readFile, rename, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

import {
  assertRuntimeGameMatchesSource,
  formatTimestamp,
  jsonBytes,
  readStableRegularFile,
  sha256,
  verifySourceAcquisition,
  writeFailure,
} from "../boons/runtime-acquisition.js";
import { assertLocalOutputPath } from "../snapshot/index.js";
import { normalizeRuntimeGuide, renderGuideCoverage } from "./normalize.js";
import { validateRuntimeGuideReport } from "./runtime-schema.js";
import { auditGuideSources } from "./source-audit.js";

export interface GuideRuntimeAcquisitionOptions {
  readonly reportPath: string;
  readonly sourceAcquisitionDirectory: string;
  readonly achievementSchemaPath: string;
  readonly outputRoot: string;
  readonly now?: () => Date;
}

export interface GuideRuntimeAcquisitionResult {
  readonly acquisitionId: string;
  readonly directory: string;
  readonly reportSha256: string;
  readonly coverageComplete: boolean;
  readonly counts: Readonly<Record<string, number>>;
}

async function verifyRuntimeCompletion(
  reportPath: string,
  reportSha256: string,
  exporterVersion: string,
): Promise<void> {
  if (basename(reportPath) !== "runtime-report.json") {
    throw new Error("Finalized guide runtime report must be named runtime-report.json.");
  }
  const runDirectory = dirname(reportPath);
  const [manifestFile, completionFile] = await Promise.all([
    readStableRegularFile(join(runDirectory, "manifest.json")),
    readStableRegularFile(join(runDirectory, "complete.json")),
  ]);
  const manifest = JSON.parse(manifestFile.content.toString("utf8")) as Readonly<Record<string, unknown>>;
  const completion = JSON.parse(completionFile.content.toString("utf8")) as Readonly<Record<string, unknown>>;
  if (manifest.schema !== "neodes2-guide-runtime-manifest-1") {
    throw new Error("Unsupported guide runtime manifest schema.");
  }
  if (completion.schema !== "neodes2-guide-runtime-completion-1") {
    throw new Error("Unsupported guide runtime completion marker schema.");
  }
  if (manifest.reportFile !== "runtime-report.json" || manifest.exporterVersion !== exporterVersion) {
    throw new Error("Guide runtime finalization metadata does not match the report.");
  }
  if (manifest.reportSha256 !== reportSha256 || completion.reportSha256 !== reportSha256) {
    throw new Error("Guide runtime report hash does not match its finalization metadata.");
  }
}

export async function createRuntimeGuideAcquisition(
  options: GuideRuntimeAcquisitionOptions,
): Promise<GuideRuntimeAcquisitionResult> {
  assertLocalOutputPath(options.outputRoot);
  const reportPath = resolve(options.reportPath);
  const reportEntry = await lstat(reportPath);
  if (!reportEntry.isFile() || reportEntry.isSymbolicLink()) {
    throw new Error(`Guide runtime input is not a regular file: ${reportPath}`);
  }
  const [reportFile, achievementSchemaFile] = await Promise.all([
    readStableRegularFile(reportPath),
    readStableRegularFile(resolve(options.achievementSchemaPath)),
  ]);
  const runtime = validateRuntimeGuideReport(JSON.parse(reportFile.content.toString("utf8")) as unknown);
  await verifyRuntimeCompletion(reportPath, reportFile.sha256, runtime.exporterVersion);
  const sourceDirectory = resolve(options.sourceAcquisitionDirectory);
  const source = await verifySourceAcquisition(sourceDirectory);
  assertRuntimeGameMatchesSource(runtime.game, source);
  const sourceAudit = await auditGuideSources(sourceDirectory, options.achievementSchemaPath);
  if (!sourceAudit.complete) throw new Error("Static guide source audit is incomplete.");
  const normalized = normalizeRuntimeGuide(runtime, sourceAudit);
  const datasetContent = jsonBytes(normalized.dataset);
  const coverageContent = jsonBytes(normalized.coverage);
  const coverageMarkdownContent = Buffer.from(renderGuideCoverage(normalized.coverage), "utf8");
  const outputRoot = resolve(options.outputRoot);
  await mkdir(outputRoot, { recursive: true });
  const timestamp = formatTimestamp((options.now ?? (() => new Date()))());
  const incompletePrefix = join(outputRoot, `${timestamp}-incomplete-`);
  let currentRunDirectory = await mkdtemp(incompletePrefix);
  try {
    const identity = {
      schema: "neodes2-guide-acquisition-manifest-1" as const,
      sourceAcquisitionId: source.acquisitionId,
      sourceManifestSha256: source.manifestSha256,
      runtimeReportSha256: reportFile.sha256,
      steamAchievementSchemaSha256: achievementSchemaFile.sha256,
      normalizedDatasetSha256: sha256(datasetContent),
      coverageReportSha256: sha256(coverageContent),
      coverageMarkdownSha256: sha256(coverageMarkdownContent),
      exporterVersion: runtime.exporterVersion,
      game: runtime.game,
      counts: normalized.coverage.counts,
      omissionCount: normalized.coverage.omissionCount,
      coverageComplete: normalized.coverage.complete,
    };
    const acquisitionId = `sha256:${sha256(JSON.stringify(identity))}`;
    const files = [
      ["runtime-report.json", reportFile.content],
      ["guide.json", datasetContent],
      ["coverage.json", coverageContent],
      ["coverage.md", coverageMarkdownContent],
      ["manifest.json", jsonBytes({ ...identity, acquisitionId })],
    ] as const;
    for (const [name, content] of files) {
      const temporaryPath = join(currentRunDirectory, `${name}.tmp`);
      await writeFile(temporaryPath, content, { flag: "wx" });
      await rename(temporaryPath, join(currentRunDirectory, name));
    }
    const suffix = basename(currentRunDirectory).slice(basename(incompletePrefix).length);
    const finalDirectory = join(
      outputRoot,
      `${timestamp}-${acquisitionId.slice("sha256:".length, "sha256:".length + 12)}-${suffix}`,
    );
    await rename(currentRunDirectory, finalDirectory);
    currentRunDirectory = finalDirectory;
    const manifestSha256 = sha256(await readFile(join(finalDirectory, "manifest.json")));
    const temporaryCompletion = join(finalDirectory, "complete.json.tmp");
    await writeFile(
      temporaryCompletion,
      jsonBytes({
        schema: "neodes2-guide-acquisition-completion-1",
        acquisitionId,
        manifestSha256,
      }),
      { flag: "wx" },
    );
    await rename(temporaryCompletion, join(finalDirectory, "complete.json"));
    return {
      acquisitionId,
      directory: finalDirectory,
      reportSha256: reportFile.sha256,
      coverageComplete: normalized.coverage.complete,
      counts: normalized.coverage.counts,
    };
  } catch (error) {
    await writeFailure(currentRunDirectory, error);
    throw error;
  }
}
