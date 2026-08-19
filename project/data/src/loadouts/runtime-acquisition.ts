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
import { normalizeRuntimeLoadouts, renderLoadoutCoverageReport } from "./normalize.js";
import { validateRuntimeLoadoutReport } from "./runtime-schema.js";
import { auditLoadoutSources } from "./source-audit.js";

export interface LoadoutRuntimeAcquisitionOptions {
  readonly reportPath: string;
  readonly sourceAcquisitionDirectory: string;
  readonly outputRoot: string;
  readonly now?: () => Date;
}

export interface LoadoutRuntimeAcquisitionResult {
  readonly acquisitionId: string;
  readonly directory: string;
  readonly reportSha256: string;
  readonly keepsakeCount: number;
  readonly familiarCount: number;
  readonly hexCount: number;
  readonly incantationCount: number;
  readonly coverageComplete: boolean;
}

async function verifyRuntimeCompletion(
  reportPath: string,
  reportSha256: string,
  exporterVersion: string,
): Promise<void> {
  if (basename(reportPath) !== "runtime-report.json") {
    throw new Error("Finalized loadout-system runtime report must be named runtime-report.json.");
  }
  const runDirectory = dirname(reportPath);
  const [manifestFile, completionFile] = await Promise.all([
    readStableRegularFile(join(runDirectory, "manifest.json")),
    readStableRegularFile(join(runDirectory, "complete.json")),
  ]);
  const manifest: unknown = JSON.parse(manifestFile.content.toString("utf8"));
  const completion: unknown = JSON.parse(completionFile.content.toString("utf8"));
  if (typeof manifest !== "object" || manifest === null || Array.isArray(manifest)) {
    throw new Error("Loadout-system runtime manifest must be an object.");
  }
  if (typeof completion !== "object" || completion === null || Array.isArray(completion)) {
    throw new Error("Loadout-system runtime completion marker must be an object.");
  }
  const manifestRecord = manifest as Readonly<Record<string, unknown>>;
  const completionRecord = completion as Readonly<Record<string, unknown>>;
  if (manifestRecord.schema !== "neodes2-loadout-runtime-manifest-1") {
    throw new Error("Unsupported loadout-system runtime manifest schema.");
  }
  if (completionRecord.schema !== "neodes2-loadout-runtime-completion-1") {
    throw new Error("Unsupported loadout-system runtime completion marker schema.");
  }
  if (manifestRecord.reportFile !== "runtime-report.json") {
    throw new Error("Loadout-system runtime manifest points to an unexpected report file.");
  }
  if (manifestRecord.exporterVersion !== exporterVersion) {
    throw new Error("Loadout-system runtime report and manifest exporter versions differ.");
  }
  if (manifestRecord.reportSha256 !== reportSha256 || completionRecord.reportSha256 !== reportSha256) {
    throw new Error("Loadout-system runtime report hash does not match its finalization metadata.");
  }
}

function assertSameIds(runtimeValues: readonly string[], sourceValues: readonly string[], label: string): void {
  const runtime = runtimeValues.toSorted();
  const source = sourceValues.toSorted();
  if (runtime.length !== source.length || runtime.some((value, index) => value !== source[index])) {
    throw new Error(`Runtime ${label} do not exactly match the completed static source audit.`);
  }
}

export async function createRuntimeLoadoutAcquisition(
  options: LoadoutRuntimeAcquisitionOptions,
): Promise<LoadoutRuntimeAcquisitionResult> {
  assertLocalOutputPath(options.outputRoot);
  const reportPath = resolve(options.reportPath);
  const reportEntry = await lstat(reportPath);
  if (!reportEntry.isFile() || reportEntry.isSymbolicLink()) {
    throw new Error(`Loadout-system runtime input is not a regular file: ${reportPath}`);
  }
  const reportFile = await readStableRegularFile(reportPath);
  const runtime = validateRuntimeLoadoutReport(JSON.parse(reportFile.content.toString("utf8")) as unknown);
  await verifyRuntimeCompletion(reportPath, reportFile.sha256, runtime.exporterVersion);
  const sourceDirectory = resolve(options.sourceAcquisitionDirectory);
  const source = await verifySourceAcquisition(sourceDirectory);
  assertRuntimeGameMatchesSource(runtime.game, source);
  const sourceAudit = await auditLoadoutSources(sourceDirectory);
  if (!sourceAudit.complete) {
    throw new Error("Static loadout-system source audit is incomplete for this source acquisition.");
  }
  assertSameIds(runtime.keepsakes.map((record) => record.id), sourceAudit.keepsakeIds, "keepsake IDs");
  assertSameIds(runtime.familiars.map((record) => record.id), sourceAudit.familiarIds, "Familiar IDs");
  assertSameIds(
    runtime.familiars.flatMap((familiar) => familiar.upgrades.map((upgrade) => upgrade.id)),
    sourceAudit.familiarUpgradeGroupIds,
    "Familiar upgrade track IDs",
  );
  assertSameIds(runtime.hexes.map((record) => record.id), sourceAudit.hexes.map((record) => record.id), "Hex IDs");
  for (const sourceHex of sourceAudit.hexes) {
    const runtimeHex = runtime.hexes.find((hex) => hex.id === sourceHex.id);
    if (runtimeHex?.traitId !== sourceHex.traitId) {
      throw new Error(`Runtime Hex ${sourceHex.id} has a trait identifier that disagrees with source.`);
    }
    assertSameIds(runtimeHex.talents.map((talent) => talent.id), sourceHex.talentIds, `${sourceHex.id} talent IDs`);
  }
  assertSameIds(runtime.incantations.map((record) => record.id), sourceAudit.incantationIds, "incantation IDs");
  assertSameIds(runtime.automaticWorldUpgradeIds, sourceAudit.automaticWorldUpgradeIds, "automatic incantation IDs");

  const normalized = normalizeRuntimeLoadouts(runtime);
  const datasetContent = jsonBytes(normalized.dataset);
  const coverageContent = jsonBytes(normalized.coverage);
  const coverageMarkdownContent = Buffer.from(renderLoadoutCoverageReport(normalized.coverage), "utf8");
  const outputRoot = resolve(options.outputRoot);
  await mkdir(outputRoot, { recursive: true });
  const timestamp = formatTimestamp((options.now ?? (() => new Date()))());
  const incompletePrefix = join(outputRoot, `${timestamp}-incomplete-`);
  let currentRunDirectory = await mkdtemp(incompletePrefix);
  try {
    const identity = {
      schema: "neodes2-loadout-acquisition-manifest-1" as const,
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
        keepsakes: normalized.coverage.keepsakeCount,
        familiars: normalized.coverage.familiarCount,
        familiarUpgradeTracks: normalized.coverage.familiarUpgradeTrackCount,
        familiarUpgradeRanks: normalized.coverage.familiarUpgradeRankCount,
        hexes: normalized.coverage.hexCount,
        hexTalents: normalized.coverage.hexTalentCount,
        incantations: normalized.coverage.incantationCount,
        automaticIncantations: normalized.coverage.automaticIncantationCount,
        failedSamples: normalized.coverage.failedSampleCount,
        coverageIssues: normalized.coverage.issues.length,
      },
      coverageComplete: normalized.coverage.complete,
    };
    const acquisitionId = `sha256:${sha256(JSON.stringify(identity))}`;
    const manifest = { ...identity, acquisitionId };
    const files = [
      ["runtime-report.json", reportFile.content],
      ["loadouts.json", datasetContent],
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
      schema: "neodes2-loadout-acquisition-completion-1",
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
      keepsakeCount: normalized.coverage.keepsakeCount,
      familiarCount: normalized.coverage.familiarCount,
      hexCount: normalized.coverage.hexCount,
      incantationCount: normalized.coverage.incantationCount,
      coverageComplete: normalized.coverage.complete,
    };
  } catch (error) {
    await writeFailure(currentRunDirectory, error);
    throw error;
  }
}
