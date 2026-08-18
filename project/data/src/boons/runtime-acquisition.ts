import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import { assertLocalOutputPath } from "../snapshot/index.js";
import { normalizeRuntimeBoons, renderBoonCoverageReport } from "./normalize.js";
import { validateRuntimeBoonReport } from "./runtime-schema.js";

export interface RuntimeAcquisitionOptions {
  readonly reportPath: string;
  readonly sourceAcquisitionDirectory: string;
  readonly outputRoot: string;
  readonly now?: () => Date;
}

export interface RuntimeAcquisitionResult {
  readonly acquisitionId: string;
  readonly directory: string;
  readonly reportSha256: string;
  readonly boonCount: number;
  readonly coverageComplete: boolean;
}

export interface VerifiedSourceManifest {
  readonly acquisitionId: string;
  readonly manifestSha256: string;
  readonly steamBuildId: string;
  readonly executableVersion: string;
  readonly packageVersion: string;
}

export interface StableFile {
  readonly content: Buffer;
  readonly sha256: string;
}

export function sha256(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

export function jsonBytes(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function asRecord(value: unknown, label: string): Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Readonly<Record<string, unknown>>;
}

function requiredString(
  record: Readonly<Record<string, unknown>>,
  field: string,
  label: string,
): string {
  const value = record[field];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label}.${field} must be a nonempty string.`);
  }
  return value;
}

export async function readStableRegularFile(path: string): Promise<StableFile> {
  const entry = await lstat(path);
  if (!entry.isFile() || entry.isSymbolicLink()) {
    throw new Error(`Runtime acquisition input is not a regular file: ${path}`);
  }
  const before = await stat(path, { bigint: true });
  const content = await readFile(path);
  const after = await stat(path, { bigint: true });
  if (before.size !== after.size || before.mtimeNs !== after.mtimeNs) {
    throw new Error(`Runtime acquisition input changed while it was read: ${path}`);
  }
  return { content, sha256: sha256(content) };
}

export async function verifySourceAcquisition(
  directory: string,
): Promise<VerifiedSourceManifest> {
  const manifestFile = await readStableRegularFile(join(directory, "manifest.json"));
  const completionFile = await readStableRegularFile(join(directory, "complete.json"));
  const manifest = asRecord(JSON.parse(manifestFile.content.toString("utf8")), "source manifest");
  const completion = asRecord(
    JSON.parse(completionFile.content.toString("utf8")),
    "source completion marker",
  );

  if (manifest.schema !== "neodes2-source-manifest-1") {
    throw new Error("Unsupported source manifest schema.");
  }
  if (completion.schema !== "neodes2-source-snapshot-completion-1") {
    throw new Error("Unsupported source completion marker schema.");
  }
  const acquisitionId = requiredString(manifest, "acquisitionId", "source manifest");
  if (requiredString(completion, "acquisitionId", "source completion marker") !== acquisitionId) {
    throw new Error("Source manifest and completion marker acquisition IDs differ.");
  }
  if (
    requiredString(completion, "manifestSha256", "source completion marker") !==
    manifestFile.sha256
  ) {
    throw new Error("Source manifest hash does not match its completion marker.");
  }

  if (!Array.isArray(manifest.sources)) {
    throw new Error("Source manifest.sources must be an array.");
  }
  const sourcesRoot = resolve(directory, "sources");
  for (const [index, entry] of manifest.sources.entries()) {
    const source = asRecord(entry, `source manifest.sources[${index}]`);
    const relativePath = requiredString(
      source,
      "relativePath",
      `source manifest.sources[${index}]`,
    );
    if (isAbsolute(relativePath) || relativePath.split(/[\\/]/u).includes("..")) {
      throw new Error(`Source manifest contains an unsafe relative path: ${relativePath}`);
    }
    const sourcePath = resolve(sourcesRoot, ...relativePath.split("/"));
    const pathFromRoot = relative(sourcesRoot, sourcePath);
    if (pathFromRoot === ".." || pathFromRoot.startsWith(`..${sep}`) || isAbsolute(pathFromRoot)) {
      throw new Error(`Source manifest path escapes its acquisition: ${relativePath}`);
    }
    const sourceFile = await readStableRegularFile(sourcePath);
    const expectedSize = source.size;
    if (typeof expectedSize !== "number" || !Number.isSafeInteger(expectedSize) || expectedSize < 0) {
      throw new Error(`Source manifest size is invalid for ${relativePath}.`);
    }
    if (sourceFile.content.length !== expectedSize || sourceFile.sha256 !== source.sha256) {
      throw new Error(`Source file no longer matches its manifest: ${relativePath}`);
    }
  }

  const game = asRecord(manifest.game, "source manifest.game");
  return {
    acquisitionId,
    manifestSha256: manifestFile.sha256,
    steamBuildId: requiredString(game, "steamBuildId", "source manifest.game"),
    executableVersion: requiredString(game, "executableVersion", "source manifest.game"),
    packageVersion: requiredString(game, "packageVersion", "source manifest.game"),
  };
}

async function verifyRuntimeCompletion(
  reportPath: string,
  reportSha256: string,
  exporterVersion: string,
): Promise<void> {
  if (basename(reportPath) !== "runtime-report.json") {
    throw new Error("Finalized runtime report must be named runtime-report.json.");
  }
  const runDirectory = dirname(reportPath);
  const manifestFile = await readStableRegularFile(join(runDirectory, "manifest.json"));
  const completionFile = await readStableRegularFile(join(runDirectory, "complete.json"));
  const manifest = asRecord(
    JSON.parse(manifestFile.content.toString("utf8")),
    "runtime manifest",
  );
  const completion = asRecord(
    JSON.parse(completionFile.content.toString("utf8")),
    "runtime completion marker",
  );
  if (manifest.schema !== "neodes2-boon-runtime-manifest-1") {
    throw new Error("Unsupported runtime manifest schema.");
  }
  if (completion.schema !== "neodes2-boon-runtime-completion-1") {
    throw new Error("Unsupported runtime completion marker schema.");
  }
  if (manifest.reportFile !== "runtime-report.json") {
    throw new Error("Runtime manifest points to an unexpected report file.");
  }
  if (requiredString(manifest, "exporterVersion", "runtime manifest") !== exporterVersion) {
    throw new Error("Runtime report and manifest exporter versions differ.");
  }
  if (
    requiredString(manifest, "reportSha256", "runtime manifest") !== reportSha256 ||
    requiredString(completion, "reportSha256", "runtime completion marker") !== reportSha256
  ) {
    throw new Error("Runtime report hash does not match its finalization metadata.");
  }
}

export function assertRuntimeGameMatchesSource(
  runtime: ReturnType<typeof validateRuntimeBoonReport>["game"],
  source: VerifiedSourceManifest,
): void {
  const comparisons = [
    ["acquisition ID", runtime.acquisitionId, source.acquisitionId],
    ["source manifest hash", runtime.sourceManifestSha256, source.manifestSha256],
    ["Steam build", runtime.steamBuildId, source.steamBuildId],
    ["executable version", runtime.executableVersion, source.executableVersion],
    ["package version", runtime.packageVersion, source.packageVersion],
  ] as const;
  for (const [label, runtimeValue, sourceValue] of comparisons) {
    if (runtimeValue !== sourceValue) {
      throw new Error(
        `Runtime ${label} ${runtimeValue} does not match source acquisition ${sourceValue}.`,
      );
    }
  }
}

export function formatTimestamp(date: Date): string {
  return date.toISOString().replace(/[-:.]/gu, "");
}

export async function writeFailure(directory: string, error: unknown): Promise<void> {
  const failure = {
    schema: "neodes2-runtime-acquisition-failure-1",
    message: error instanceof Error ? error.message : "Unknown runtime acquisition failure.",
  };
  try {
    await writeFile(join(directory, "failure.json"), jsonBytes(failure), { flag: "wx" });
  } catch {
    // The original failure remains authoritative when the local report cannot be written.
  }
}

export async function createRuntimeBoonAcquisition(
  options: RuntimeAcquisitionOptions,
): Promise<RuntimeAcquisitionResult> {
  assertLocalOutputPath(options.outputRoot);
  const reportPath = resolve(options.reportPath);
  const reportFile = await readStableRegularFile(reportPath);
  const report: unknown = JSON.parse(reportFile.content.toString("utf8"));
  const runtime = validateRuntimeBoonReport(report);
  await verifyRuntimeCompletion(reportPath, reportFile.sha256, runtime.exporterVersion);
  const source = await verifySourceAcquisition(resolve(options.sourceAcquisitionDirectory));
  assertRuntimeGameMatchesSource(runtime.game, source);
  const normalized = normalizeRuntimeBoons(runtime);
  const datasetContent = jsonBytes(normalized.dataset);
  const coverageContent = jsonBytes(normalized.coverage);
  const coverageMarkdownContent = Buffer.from(
    renderBoonCoverageReport(normalized.coverage),
    "utf8",
  );

  const outputRoot = resolve(options.outputRoot);
  await mkdir(outputRoot, { recursive: true });
  const timestamp = formatTimestamp((options.now ?? (() => new Date()))());
  const incompletePrefix = join(outputRoot, `${timestamp}-incomplete-`);
  let currentRunDirectory = await mkdtemp(incompletePrefix);

  try {
    const identity = {
      schema: "neodes2-boon-acquisition-manifest-2" as const,
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
        gods: normalized.coverage.godCount,
        boons: normalized.coverage.boonCount,
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
      ["boons.json", datasetContent],
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
      schema: "neodes2-boon-acquisition-completion-2",
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
      boonCount: normalized.coverage.boonCount,
      coverageComplete: normalized.coverage.complete,
    };
  } catch (error) {
    await writeFailure(currentRunDirectory, error);
    throw error;
  }
}
