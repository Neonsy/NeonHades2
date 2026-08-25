import { basename, join, resolve } from "node:path";
import { mkdir, mkdtemp, rename, writeFile } from "node:fs/promises";

import { jsonBytes, readStableRegularFile, sha256 } from "../boons/runtime-acquisition.js";
import { assertLocalOutputPath } from "../snapshot/index.js";

interface RuntimeEvidenceFile {
  readonly tableName: string;
  readonly file: string;
  readonly sha256: string;
}

interface RuntimeEvidenceManifest {
  readonly schema: "neodes2-runtime-evidence-manifest-2";
  readonly exporterVersion: string;
  readonly game: {
    readonly steamBuildId: string;
    readonly executableVersion: string;
    readonly packageVersion: string;
    readonly acquisitionId: string;
    readonly sourceManifestSha256: string;
  };
  readonly files: readonly RuntimeEvidenceFile[];
  readonly totalNodeCount: number;
  readonly deniedPlayerStateTables: readonly string[];
  readonly excludedRuntimeNamespaces: readonly string[];
}

export interface EvidenceArchiveOptions {
  readonly sourceAcquisition: string;
  readonly runtimeEvidence: string;
  readonly outputRoot: string;
  readonly now?: () => Date;
}

export interface EvidenceArchiveResult {
  readonly acquisitionId: string;
  readonly directory: string;
  readonly tableCount: number;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: Readonly<Record<string, unknown>>, key: string, label: string): string {
  const candidate = value[key];
  if (typeof candidate !== "string" || candidate === "") throw new Error(`${label}.${key} is missing.`);
  return candidate;
}

function positiveInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) throw new Error(`${label} must be a positive integer.`);
  return value;
}

function parseRuntimeManifest(value: unknown): RuntimeEvidenceManifest {
  if (!isRecord(value) || value.schema !== "neodes2-runtime-evidence-manifest-2") {
    throw new Error("Unknown runtime evidence manifest schema.");
  }
  if (!isRecord(value.game) || !Array.isArray(value.files) || !Array.isArray(value.deniedPlayerStateTables)) {
    throw new Error("Runtime evidence manifest is incomplete.");
  }
  const files = value.files.map((candidate, index) => {
    if (!isRecord(candidate)) throw new Error(`Runtime evidence file ${index} is invalid.`);
    const file = requiredString(candidate, "file", `Runtime evidence file ${index}`);
    if (!/^table-[0-9]{5}\.json$/u.test(file)) throw new Error(`Unsafe runtime evidence filename: ${file}`);
    return {
      tableName: requiredString(candidate, "tableName", `Runtime evidence file ${index}`),
      file,
      sha256: requiredString(candidate, "sha256", `Runtime evidence file ${index}`),
    };
  });
  if (files.length === 0) throw new Error("Runtime evidence manifest contains no processed tables.");
  if (new Set(files.map((entry) => entry.tableName)).size !== files.length || new Set(files.map((entry) => entry.file)).size !== files.length) {
    throw new Error("Runtime evidence manifest contains duplicate tables or files.");
  }
  const denied = value.deniedPlayerStateTables;
  if (!denied.every((entry) => typeof entry === "string") || !denied.includes("GameState")) {
    throw new Error("Runtime evidence manifest does not prove the player-state denial boundary.");
  }
  const excluded = value.excludedRuntimeNamespaces;
  if (!Array.isArray(excluded) || !excluded.every((entry) => typeof entry === "string")) {
    throw new Error("Runtime evidence manifest does not list excluded runtime namespaces.");
  }
  for (const required of ["_G", "package", "rom"]) {
    if (!excluded.includes(required)) throw new Error(`Runtime evidence manifest does not exclude ${required}.`);
  }
  return {
    schema: value.schema,
    exporterVersion: requiredString(value, "exporterVersion", "Runtime evidence manifest"),
    game: {
      steamBuildId: requiredString(value.game, "steamBuildId", "Runtime evidence game"),
      executableVersion: requiredString(value.game, "executableVersion", "Runtime evidence game"),
      packageVersion: requiredString(value.game, "packageVersion", "Runtime evidence game"),
      acquisitionId: requiredString(value.game, "acquisitionId", "Runtime evidence game"),
      sourceManifestSha256: requiredString(value.game, "sourceManifestSha256", "Runtime evidence game"),
    },
    files,
    totalNodeCount: positiveInteger(value.totalNodeCount, "Runtime evidence totalNodeCount"),
    deniedPlayerStateTables: denied as readonly string[],
    excludedRuntimeNamespaces: excluded as readonly string[],
  };
}

function validateProcessedTable(
  value: unknown,
  expectedTableName: string,
  nodeIds: Set<number>,
  references: Set<number>,
): void {
  if (!isRecord(value) || value.schema !== "neodes2-processed-table-evidence-2") {
    throw new Error(`Unknown processed-table evidence schema for ${expectedTableName}.`);
  }
  if (value.tableName !== expectedTableName || !isRecord(value.root) || !Array.isArray(value.nodes)) {
    throw new Error(`Processed-table evidence is incomplete for ${expectedTableName}.`);
  }
  references.add(positiveInteger(value.root.ref, `${expectedTableName} root ref`));
  for (const [index, candidate] of value.nodes.entries()) {
    if (!isRecord(candidate) || !Array.isArray(candidate.entries)) {
      throw new Error(`${expectedTableName} node ${index} is invalid.`);
    }
    const id = positiveInteger(candidate.id, `${expectedTableName} node ${index} id`);
    if (nodeIds.has(id)) throw new Error(`Duplicate shared evidence node id: ${id}.`);
    nodeIds.add(id);
    for (const [entryIndex, entry] of candidate.entries.entries()) {
      if (!isRecord(entry) || !("value" in entry)) throw new Error(`${expectedTableName} node ${id} entry ${entryIndex} is invalid.`);
      if (isRecord(entry.value) && "ref" in entry.value) {
        references.add(positiveInteger(entry.value.ref, `${expectedTableName} node ${id} entry ${entryIndex} ref`));
      }
    }
  }
}

async function writeFinalFile(directory: string, name: string, content: Buffer): Promise<void> {
  const temporary = join(directory, `${name}.tmp`);
  await writeFile(temporary, content, { flag: "wx" });
  await rename(temporary, join(directory, name));
}

function timestamp(date: Date): string {
  return date.toISOString().replace(/[-:.]/gu, "");
}

export async function createEvidenceArchive(options: EvidenceArchiveOptions): Promise<EvidenceArchiveResult> {
  assertLocalOutputPath(options.outputRoot);
  const sourceRoot = resolve(options.sourceAcquisition);
  const runtimeRoot = resolve(options.runtimeEvidence);
  const [sourceManifestFile, sourceCompletionFile, runtimeManifestFile, runtimeCompletionFile] = await Promise.all([
    readStableRegularFile(join(sourceRoot, "manifest.json")),
    readStableRegularFile(join(sourceRoot, "complete.json")),
    readStableRegularFile(join(runtimeRoot, "manifest.json")),
    readStableRegularFile(join(runtimeRoot, "complete.json")),
  ]);
  const sourceManifest: unknown = JSON.parse(sourceManifestFile.content.toString("utf8"));
  const sourceCompletion: unknown = JSON.parse(sourceCompletionFile.content.toString("utf8"));
  const runtimeManifest = parseRuntimeManifest(JSON.parse(runtimeManifestFile.content.toString("utf8")));
  const runtimeCompletion: unknown = JSON.parse(runtimeCompletionFile.content.toString("utf8"));
  if (!isRecord(sourceManifest) || !isRecord(sourceManifest.game) || !isRecord(sourceCompletion)) {
    throw new Error("Source acquisition metadata is invalid.");
  }
  const sourceAcquisitionId = requiredString(sourceManifest, "acquisitionId", "Source manifest");
  if (sourceCompletion.manifestSha256 !== sourceManifestFile.sha256) throw new Error("Source completion hash mismatch.");
  if (!isRecord(runtimeCompletion) || runtimeCompletion.manifestSha256 !== runtimeManifestFile.sha256) {
    throw new Error("Runtime evidence completion hash mismatch.");
  }
  if (runtimeCompletion.schema !== "neodes2-runtime-evidence-completion-2") {
    throw new Error("Unknown runtime evidence completion schema.");
  }
  const comparisons = [
    [runtimeManifest.game.acquisitionId, sourceAcquisitionId, "acquisition"],
    [runtimeManifest.game.sourceManifestSha256, sourceManifestFile.sha256, "source manifest"],
    [runtimeManifest.game.steamBuildId, requiredString(sourceManifest.game, "steamBuildId", "Source game"), "Steam build"],
    [runtimeManifest.game.executableVersion, requiredString(sourceManifest.game, "executableVersion", "Source game"), "executable version"],
    [runtimeManifest.game.packageVersion, requiredString(sourceManifest.game, "packageVersion", "Source game"), "package version"],
  ] as const;
  for (const [runtimeValue, sourceValue, label] of comparisons) {
    if (runtimeValue !== sourceValue) throw new Error(`Runtime evidence ${label} does not match the source acquisition.`);
  }

  const outputRoot = resolve(options.outputRoot);
  await mkdir(outputRoot, { recursive: true });
  const prefix = join(outputRoot, `${timestamp((options.now ?? (() => new Date()))())}-incomplete-`);
  let currentDirectory = await mkdtemp(prefix);
  try {
    const tablesDirectory = join(currentDirectory, "tables");
    await mkdir(tablesDirectory);
    const nodeIds = new Set<number>();
    const references = new Set<number>();
    for (const entry of runtimeManifest.files) {
      const file = await readStableRegularFile(join(runtimeRoot, entry.file));
      if (file.sha256 !== entry.sha256) throw new Error(`Runtime evidence hash mismatch: ${entry.file}`);
      validateProcessedTable(JSON.parse(file.content.toString("utf8")), entry.tableName, nodeIds, references);
      await writeFinalFile(tablesDirectory, entry.file, file.content);
    }
    if (nodeIds.size !== runtimeManifest.totalNodeCount) {
      throw new Error(`Runtime evidence node count mismatch: expected ${runtimeManifest.totalNodeCount}, received ${nodeIds.size}.`);
    }
    for (const reference of references) {
      if (!nodeIds.has(reference)) throw new Error(`Runtime evidence references missing shared node ${reference}.`);
    }
    const identity = {
      schema: "neodes2-evidence-archive-manifest-2" as const,
      sourceAcquisitionId,
      sourceManifestSha256: sourceManifestFile.sha256,
      exporterVersion: runtimeManifest.exporterVersion,
      game: runtimeManifest.game,
      sourceFileCount: Array.isArray(sourceManifest.sources) ? sourceManifest.sources.length : 0,
      processedTables: runtimeManifest.files,
      totalNodeCount: runtimeManifest.totalNodeCount,
      deniedPlayerStateTables: runtimeManifest.deniedPlayerStateTables,
      excludedRuntimeNamespaces: runtimeManifest.excludedRuntimeNamespaces,
    };
    const acquisitionId = `sha256:${sha256(Buffer.from(JSON.stringify(identity), "utf8"))}`;
    const manifestContent = jsonBytes({ ...identity, acquisitionId });
    await writeFinalFile(currentDirectory, "manifest.json", manifestContent);
    const suffix = basename(currentDirectory).slice(basename(prefix).length);
    const finalDirectory = join(outputRoot, `${timestamp((options.now ?? (() => new Date()))())}-${acquisitionId.slice(7, 19)}-${suffix}`);
    await rename(currentDirectory, finalDirectory);
    currentDirectory = finalDirectory;
    await writeFinalFile(finalDirectory, "complete.json", jsonBytes({
      schema: "neodes2-evidence-archive-completion-2",
      acquisitionId,
      manifestSha256: sha256(manifestContent),
    }));
    return { acquisitionId, directory: finalDirectory, tableCount: runtimeManifest.files.length };
  } catch (error) {
    await writeFile(join(currentDirectory, "failure.json"), jsonBytes({
      schema: "neodes2-evidence-archive-failure-1",
      message: error instanceof Error ? error.message : "Unknown evidence archive failure.",
    })).catch(() => undefined);
    throw error;
  }
}
