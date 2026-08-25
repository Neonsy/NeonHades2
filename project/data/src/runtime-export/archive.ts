import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { mkdir, mkdtemp, readdir, rename, writeFile } from "node:fs/promises";

import { jsonBytes, readStableRegularFile, sha256 } from "../boons/runtime-acquisition.js";
import { assertLocalOutputPath } from "../snapshot/index.js";

interface ArchivedFile {
  readonly path: string;
  readonly size: number;
  readonly sha256: string;
}

export interface RuntimeExportArchiveOptions {
  readonly runtimeRun: string;
  readonly outputRoot: string;
  readonly now?: () => Date;
}

export interface RuntimeExportArchiveResult {
  readonly acquisitionId: string;
  readonly directory: string;
  readonly fileCount: number;
  readonly byteCount: number;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: Readonly<Record<string, unknown>>, key: string, label: string): string {
  const candidate = value[key];
  if (typeof candidate !== "string" || candidate === "") throw new Error(`${label}.${key} is missing.`);
  return candidate;
}

function portablePath(path: string): string {
  return path.split(sep).join("/");
}

async function listRegularFiles(root: string, directory = root): Promise<string[]> {
  const paths: string[] = [];
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const absolute = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Runtime export contains a symbolic link: ${portablePath(relative(root, absolute))}`);
    if (entry.isDirectory()) paths.push(...await listRegularFiles(root, absolute));
    else if (entry.isFile()) paths.push(portablePath(relative(root, absolute)));
    else throw new Error(`Runtime export contains an unsupported filesystem entry: ${portablePath(relative(root, absolute))}`);
  }
  return paths.sort();
}

async function finalizedReportFiles(root: string, directory: string): Promise<readonly string[]> {
  const prefix = directory === "" ? "" : `${directory}/`;
  const manifestPath = `${prefix}manifest.json`;
  const completionPath = `${prefix}complete.json`;
  const [manifestFile, completionFile] = await Promise.all([
    readStableRegularFile(join(root, ...manifestPath.split("/"))),
    readStableRegularFile(join(root, ...completionPath.split("/"))),
  ]);
  const manifest: unknown = JSON.parse(manifestFile.content.toString("utf8"));
  const completion: unknown = JSON.parse(completionFile.content.toString("utf8"));
  if (!isRecord(manifest) || !isRecord(completion)) throw new Error(`Runtime report metadata is invalid: ${prefix || "root"}`);
  const reportName = requiredString(manifest, "reportFile", `${prefix}manifest`);
  if (reportName !== "runtime-report.json") throw new Error(`Runtime report has an unexpected filename: ${prefix}${reportName}`);
  const reportPath = `${prefix}${reportName}`;
  const reportFile = await readStableRegularFile(join(root, ...reportPath.split("/")));
  const expectedHash = requiredString(manifest, "reportSha256", `${prefix}manifest`);
  if (reportFile.sha256 !== expectedHash || completion.reportSha256 !== expectedHash) {
    throw new Error(`Runtime report hash mismatch: ${reportPath}`);
  }
  return [manifestPath, completionPath, reportPath];
}

async function evidenceFiles(root: string): Promise<{
  readonly paths: readonly string[];
  readonly exporterVersion: string;
  readonly game: Readonly<Record<string, unknown>>;
}> {
  const manifestPath = "evidence/manifest.json";
  const completionPath = "evidence/complete.json";
  const [manifestFile, completionFile] = await Promise.all([
    readStableRegularFile(join(root, "evidence", "manifest.json")),
    readStableRegularFile(join(root, "evidence", "complete.json")),
  ]);
  const manifest: unknown = JSON.parse(manifestFile.content.toString("utf8"));
  const completion: unknown = JSON.parse(completionFile.content.toString("utf8"));
  if (!isRecord(manifest) || !isRecord(manifest.game) || !Array.isArray(manifest.files) || !isRecord(completion)) {
    throw new Error("Runtime evidence metadata is invalid.");
  }
  if (!["neodes2-runtime-evidence-manifest-1", "neodes2-runtime-evidence-manifest-2"].includes(String(manifest.schema))) {
    throw new Error("Unknown runtime evidence manifest schema.");
  }
  if (completion.manifestSha256 !== manifestFile.sha256) throw new Error("Runtime evidence manifest hash mismatch.");
  const paths = [manifestPath, completionPath];
  for (const [index, entry] of manifest.files.entries()) {
    if (!isRecord(entry)) throw new Error(`Runtime evidence file ${index} is invalid.`);
    const name = requiredString(entry, "file", `Runtime evidence file ${index}`);
    if (!/^table-[0-9]{5}\.json$/u.test(name)) throw new Error(`Unsafe runtime evidence filename: ${name}`);
    const path = `evidence/${name}`;
    const file = await readStableRegularFile(join(root, "evidence", name));
    if (file.sha256 !== requiredString(entry, "sha256", `Runtime evidence file ${index}`)) {
      throw new Error(`Runtime evidence hash mismatch: ${path}`);
    }
    paths.push(path);
  }
  return {
    paths,
    exporterVersion: requiredString(manifest, "exporterVersion", "Runtime evidence manifest"),
    game: manifest.game,
  };
}

async function writeFinalFile(path: string, content: Buffer): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, content, { flag: "wx" });
  await rename(temporary, path);
}

function timestamp(date: Date): string {
  return date.toISOString().replace(/[-:.]/gu, "");
}

export async function createRuntimeExportArchive(options: RuntimeExportArchiveOptions): Promise<RuntimeExportArchiveResult> {
  assertLocalOutputPath(options.outputRoot);
  const runtimeRoot = resolve(options.runtimeRun);
  const outputRoot = resolve(options.outputRoot);
  const expected = new Set<string>();
  for (const directory of ["", "weapons", "arcana", "loadouts", "guide"]) {
    for (const path of await finalizedReportFiles(runtimeRoot, directory)) expected.add(path);
  }
  const evidence = await evidenceFiles(runtimeRoot);
  for (const path of evidence.paths) expected.add(path);
  const actual = await listRegularFiles(runtimeRoot);
  const missing = [...expected].filter((path) => !actual.includes(path));
  const unexpected = actual.filter((path) => !expected.has(path));
  if (missing.length > 0 || unexpected.length > 0) {
    throw new Error(`Runtime export file set mismatch. Missing: ${missing.join(", ") || "none"}. Unexpected: ${unexpected.join(", ") || "none"}.`);
  }

  await mkdir(outputRoot, { recursive: true });
  const date = (options.now ?? (() => new Date()))();
  const prefix = join(outputRoot, `${timestamp(date)}-incomplete-`);
  let currentDirectory = await mkdtemp(prefix);
  try {
    const files: ArchivedFile[] = [];
    let byteCount = 0;
    for (const path of actual) {
      const source = await readStableRegularFile(join(runtimeRoot, ...path.split("/")));
      await writeFinalFile(join(currentDirectory, "raw", ...path.split("/")), source.content);
      files.push({ path, size: source.content.length, sha256: source.sha256 });
      byteCount += source.content.length;
    }
    const identity = {
      schema: "neodes2-runtime-export-archive-manifest-1" as const,
      rawRunId: basename(runtimeRoot),
      exporterVersion: evidence.exporterVersion,
      game: evidence.game,
      files,
    };
    const acquisitionId = `sha256:${sha256(Buffer.from(JSON.stringify(identity), "utf8"))}`;
    const manifestContent = jsonBytes({ ...identity, acquisitionId });
    await writeFinalFile(join(currentDirectory, "manifest.json"), manifestContent);
    const suffix = basename(currentDirectory).slice(basename(prefix).length);
    const finalDirectory = join(outputRoot, `${timestamp(date)}-${acquisitionId.slice(7, 19)}-${suffix}`);
    await rename(currentDirectory, finalDirectory);
    currentDirectory = finalDirectory;
    await writeFinalFile(join(finalDirectory, "complete.json"), jsonBytes({
      schema: "neodes2-runtime-export-archive-completion-1",
      acquisitionId,
      manifestSha256: sha256(manifestContent),
    }));
    return { acquisitionId, directory: finalDirectory, fileCount: files.length, byteCount };
  } catch (error) {
    await writeFile(join(currentDirectory, "failure.json"), jsonBytes({
      schema: "neodes2-runtime-export-archive-failure-1",
      message: error instanceof Error ? error.message : "Unknown runtime export archive failure.",
    })).catch(() => undefined);
    throw error;
  }
}
