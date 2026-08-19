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
import { normalizeRuntimeArcana, renderArcanaCoverageReport } from "./normalize.js";
import { validateRuntimeArcanaReport } from "./runtime-schema.js";
import { auditArcanaSources } from "./source-audit.js";

export interface ArcanaRuntimeAcquisitionOptions {
  readonly reportPath: string;
  readonly sourceAcquisitionDirectory: string;
  readonly outputRoot: string;
  readonly now?: () => Date;
}

export interface ArcanaRuntimeAcquisitionResult {
  readonly acquisitionId: string;
  readonly directory: string;
  readonly reportSha256: string;
  readonly cardCount: number;
  readonly rankCount: number;
  readonly graspLevelCount: number;
  readonly maximumGrasp: number;
  readonly coverageComplete: boolean;
}

async function verifyRuntimeCompletion(
  reportPath: string,
  reportSha256: string,
  exporterVersion: string,
): Promise<void> {
  if (basename(reportPath) !== "runtime-report.json") {
    throw new Error("Finalized Arcana runtime report must be named runtime-report.json.");
  }
  const runDirectory = dirname(reportPath);
  const [manifestFile, completionFile] = await Promise.all([
    readStableRegularFile(join(runDirectory, "manifest.json")),
    readStableRegularFile(join(runDirectory, "complete.json")),
  ]);
  const manifest: unknown = JSON.parse(manifestFile.content.toString("utf8"));
  const completion: unknown = JSON.parse(completionFile.content.toString("utf8"));
  if (typeof manifest !== "object" || manifest === null || Array.isArray(manifest)) {
    throw new Error("Arcana runtime manifest must be an object.");
  }
  if (typeof completion !== "object" || completion === null || Array.isArray(completion)) {
    throw new Error("Arcana runtime completion marker must be an object.");
  }
  const manifestRecord = manifest as Readonly<Record<string, unknown>>;
  const completionRecord = completion as Readonly<Record<string, unknown>>;
  if (manifestRecord.schema !== "neodes2-arcana-runtime-manifest-1") {
    throw new Error("Unsupported Arcana runtime manifest schema.");
  }
  if (completionRecord.schema !== "neodes2-arcana-runtime-completion-1") {
    throw new Error("Unsupported Arcana runtime completion marker schema.");
  }
  if (manifestRecord.reportFile !== "runtime-report.json") {
    throw new Error("Arcana runtime manifest points to an unexpected report file.");
  }
  if (manifestRecord.exporterVersion !== exporterVersion) {
    throw new Error("Arcana runtime report and manifest exporter versions differ.");
  }
  if (
    manifestRecord.reportSha256 !== reportSha256 ||
    completionRecord.reportSha256 !== reportSha256
  ) {
    throw new Error("Arcana runtime report hash does not match its finalization metadata.");
  }
}

function assertSameStrings(
  runtimeValues: readonly string[],
  sourceValues: readonly string[],
  label: string,
): void {
  if (
    runtimeValues.length !== sourceValues.length ||
    runtimeValues.some((value, index) => value !== sourceValues[index])
  ) {
    throw new Error(`Runtime ${label} do not exactly match the completed static source audit.`);
  }
}

export async function createRuntimeArcanaAcquisition(
  options: ArcanaRuntimeAcquisitionOptions,
): Promise<ArcanaRuntimeAcquisitionResult> {
  assertLocalOutputPath(options.outputRoot);
  const reportPath = resolve(options.reportPath);
  const reportEntry = await lstat(reportPath);
  if (!reportEntry.isFile() || reportEntry.isSymbolicLink()) {
    throw new Error(`Arcana runtime input is not a regular file: ${reportPath}`);
  }
  const reportFile = await readStableRegularFile(reportPath);
  const runtime = validateRuntimeArcanaReport(
    JSON.parse(reportFile.content.toString("utf8")) as unknown,
  );
  await verifyRuntimeCompletion(reportPath, reportFile.sha256, runtime.exporterVersion);
  const sourceDirectory = resolve(options.sourceAcquisitionDirectory);
  const source = await verifySourceAcquisition(sourceDirectory);
  assertRuntimeGameMatchesSource(runtime.game, source);
  const sourceAudit = await auditArcanaSources(sourceDirectory);
  if (!sourceAudit.complete) {
    throw new Error("Static Arcana source audit is incomplete for this source acquisition.");
  }
  assertSameStrings(
    runtime.cards.map((card) => card.id),
    sourceAudit.cards.map((card) => card.id),
    "Arcana Card IDs",
  );
  assertSameStrings(
    runtime.layout.map((entry) => entry.cardId),
    sourceAudit.layoutCardIds,
    "Arcana default layout",
  );
  if (
    runtime.grasp.startingCapacity !== sourceAudit.startingGrasp ||
    runtime.grasp.levels.length !== sourceAudit.graspLevelCount ||
    runtime.grasp.levels.at(-1)?.cumulativeCapacity !== sourceAudit.maximumGrasp
  ) {
    throw new Error("Runtime Grasp progression does not match the completed static source audit.");
  }

  const normalized = normalizeRuntimeArcana(runtime);
  const datasetContent = jsonBytes(normalized.dataset);
  const coverageContent = jsonBytes(normalized.coverage);
  const coverageMarkdownContent = Buffer.from(
    renderArcanaCoverageReport(normalized.coverage),
    "utf8",
  );
  const outputRoot = resolve(options.outputRoot);
  await mkdir(outputRoot, { recursive: true });
  const timestamp = formatTimestamp((options.now ?? (() => new Date()))());
  const incompletePrefix = join(outputRoot, `${timestamp}-incomplete-`);
  let currentRunDirectory = await mkdtemp(incompletePrefix);

  try {
    const identity = {
      schema: "neodes2-arcana-acquisition-manifest-1" as const,
      sourceAcquisitionId: source.acquisitionId,
      sourceManifestSha256: source.manifestSha256,
      runtimeReportSha256: reportFile.sha256,
      normalizedDatasetSha256: sha256(datasetContent),
      coverageReportSha256: sha256(coverageContent),
      coverageMarkdownSha256: sha256(coverageMarkdownContent),
      exporterVersion: runtime.exporterVersion,
      game: {
        steamBuildId: runtime.game.steamBuildId,
        executableVersion: runtime.game.executableVersion,
        packageVersion: runtime.game.packageVersion,
      },
      counts: {
        cards: normalized.coverage.cardCount,
        ranks: normalized.coverage.rankCount,
        automaticCards: normalized.coverage.automaticCardCount,
        graspLevels: normalized.coverage.graspLevelCount,
        maximumGrasp: normalized.coverage.maximumGrasp,
        failedSamples: normalized.coverage.failedSampleCount,
        resolvedValues: normalized.coverage.resolvedValueCount,
        contextualValues: normalized.coverage.contextualValueCount,
        coverageIssues: normalized.coverage.issues.length,
      },
      coverageComplete: normalized.coverage.complete,
    };
    const acquisitionId = `sha256:${sha256(JSON.stringify(identity))}`;
    const manifest = { ...identity, acquisitionId };
    const files = [
      ["runtime-report.json", reportFile.content],
      ["arcana.json", datasetContent],
      ["coverage.json", coverageContent],
      ["coverage.md", coverageMarkdownContent],
      ["manifest.json", jsonBytes(manifest)],
    ] as const;
    for (const [name, content] of files) {
      const temporaryPath = join(currentRunDirectory, `${name}.tmp`);
      await writeFile(temporaryPath, content, { flag: "wx" });
      await rename(temporaryPath, join(currentRunDirectory, name));
    }

    const randomSuffix = basename(currentRunDirectory).slice(basename(incompletePrefix).length);
    const finalDirectory = join(
      outputRoot,
      `${timestamp}-${acquisitionId.slice("sha256:".length, "sha256:".length + 12)}-${randomSuffix}`,
    );
    await rename(currentRunDirectory, finalDirectory);
    currentRunDirectory = finalDirectory;
    const manifestSha256 = sha256(await readFile(join(finalDirectory, "manifest.json")));
    const completion = {
      schema: "neodes2-arcana-acquisition-completion-1",
      acquisitionId,
      manifestSha256,
    };
    const temporaryCompletionPath = join(finalDirectory, "complete.json.tmp");
    await writeFile(temporaryCompletionPath, jsonBytes(completion), { flag: "wx" });
    await rename(temporaryCompletionPath, join(finalDirectory, "complete.json"));

    return {
      acquisitionId,
      directory: finalDirectory,
      reportSha256: reportFile.sha256,
      cardCount: normalized.coverage.cardCount,
      rankCount: normalized.coverage.rankCount,
      graspLevelCount: normalized.coverage.graspLevelCount,
      maximumGrasp: normalized.coverage.maximumGrasp,
      coverageComplete: normalized.coverage.complete,
    };
  } catch (error) {
    await writeFailure(currentRunDirectory, error);
    throw error;
  }
}
