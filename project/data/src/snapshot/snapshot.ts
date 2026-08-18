import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";

import { acquisitionContract } from "../contract/index.js";
import {
  discoverGameInstallation,
  parseSteamAppManifest,
  type DiscoveryOptions,
  type GameInstallation,
  type SteamAppManifest,
} from "./discovery.js";
import {
  getRequiredContractSourcePatterns,
  matchesSourcePattern,
  sourcePolicy,
  validateSourcePolicy,
  type SourcePolicy,
} from "./source-policy.js";

const execFileAsync = promisify(execFile);

export interface FileEvidence {
  readonly relativePath: string;
  readonly size: number;
  readonly sha256: string;
}

export interface ExecutableEvidence extends FileEvidence {
  readonly fileVersion: string;
  readonly productVersion: string;
}

export interface SourceManifest {
  readonly schema: "neodes2-source-manifest-1";
  readonly acquisitionId: string;
  readonly contractSchema: string;
  readonly sourcePolicySchema: string;
  readonly sourcePolicySha256: string;
  readonly game: {
    readonly steamAppId: string;
    readonly steamBuildId: string;
    readonly targetSteamBuildId: string | null;
    readonly executableVersion: string;
    readonly packageVersion: string;
  };
  readonly installation: {
    readonly root: string;
    readonly appManifestPath: string;
  };
  readonly steamManifestFieldsSha256: string;
  readonly packageVersionFile: FileEvidence;
  readonly executables: readonly ExecutableEvidence[];
  readonly sources: readonly FileEvidence[];
}

export interface SnapshotResult {
  readonly acquisitionId: string;
  readonly directory: string;
  readonly manifestPath: string;
  readonly manifestSha256: string;
  readonly sourceCount: number;
}

export interface ExecutableVersion {
  readonly fileVersion: string;
  readonly productVersion: string;
}

export interface SnapshotOptions extends DiscoveryOptions {
  readonly outputRoot: string;
  readonly policy?: unknown;
  readonly requiredSourcePatterns?: readonly string[];
  readonly executableVersionReader?: (path: string) => Promise<ExecutableVersion>;
  readonly now?: () => Date;
}

interface StableFile {
  readonly content: Buffer;
  readonly size: number;
  readonly sha256: string;
}

function sha256(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

function jsonBytes(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function identityBytes(value: unknown): Buffer {
  return Buffer.from(JSON.stringify(value), "utf8");
}

function isWithin(parent: string, candidate: string): boolean {
  const pathFromParent = relative(parent, candidate);
  return (
    pathFromParent !== "" &&
    pathFromParent !== ".." &&
    !pathFromParent.startsWith(`..${sep}`) &&
    !isAbsolute(pathFromParent)
  );
}

function toNativePath(root: string, relativePath: string): string {
  return join(root, ...relativePath.split("/"));
}

async function readStableFile(path: string): Promise<StableFile> {
  const entry = await lstat(path);
  if (!entry.isFile() || entry.isSymbolicLink()) {
    throw new Error(`Snapshot input is not a regular file: ${path}`);
  }

  const before = await stat(path, { bigint: true });
  const content = await readFile(path);
  const after = await stat(path, { bigint: true });

  if (before.size !== after.size || before.mtimeNs !== after.mtimeNs) {
    throw new Error(`Snapshot input changed while it was being read: ${path}`);
  }

  return { content, size: Number(after.size), sha256: sha256(content) };
}

async function resolveFileInside(gameRoot: string, relativePath: string): Promise<string> {
  const unresolved = toNativePath(gameRoot, relativePath);
  let resolved: string;
  try {
    resolved = await realpath(unresolved);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Required snapshot input is missing: ${relativePath}`, { cause: error });
    }
    throw error;
  }
  if (!isWithin(gameRoot, resolved)) {
    throw new Error(`Snapshot source escapes the resolved game installation: ${relativePath}`);
  }
  return resolved;
}

async function enumerateSourcePaths(
  gameRoot: string,
  policy: SourcePolicy,
): Promise<readonly string[]> {
  const results = new Map<string, string>();

  for (const rule of policy.rules) {
    const unresolvedDirectory = toNativePath(gameRoot, rule.directory);
    let directory: string;
    try {
      directory = await realpath(unresolvedDirectory);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(`Required source directory is missing: ${rule.directory}`, {
          cause: error,
        });
      }
      throw error;
    }
    if (!isWithin(gameRoot, directory)) {
      throw new Error(`Source policy directory escapes the game installation: ${rule.directory}`);
    }

    const directoryEntry = await lstat(unresolvedDirectory);
    if (!directoryEntry.isDirectory() || directoryEntry.isSymbolicLink()) {
      throw new Error(`Source policy path is not a regular directory: ${rule.directory}`);
    }

    const entries = await readdir(directory, { withFileTypes: true });
    const selected =
      rule.files === "all"
        ? entries.filter(
            (entry) => entry.isFile() && extname(entry.name).toLowerCase() === rule.extension,
          )
        : rule.files.map((name) => {
            const entry = entries.find((candidate) => candidate.name === name);
            if (entry === undefined || !entry.isFile()) {
              throw new Error(`Required source file is missing: ${rule.directory}/${name}`);
            }
            return entry;
          });

    if (selected.length === 0) {
      throw new Error(`Source policy matched no files in ${rule.directory}.`);
    }

    for (const entry of selected) {
      if (entry.isSymbolicLink()) {
        throw new Error(`Symbolic source files are not allowed: ${rule.directory}/${entry.name}`);
      }
      const relativePath = `${rule.directory}/${entry.name}`;
      const key = process.platform === "win32" ? relativePath.toLowerCase() : relativePath;
      if (results.has(key)) {
        throw new Error(`Source policy selected a file more than once: ${relativePath}`);
      }
      results.set(key, relativePath);
    }
  }

  return [...results.values()].sort();
}

function validateRequiredPatterns(
  sourcePaths: readonly string[],
  requiredPatterns: readonly string[],
): void {
  for (const pattern of requiredPatterns) {
    if (!sourcePaths.some((relativePath) => matchesSourcePattern(relativePath, pattern))) {
      throw new Error(`Required contract source pattern matched no allowlisted files: ${pattern}`);
    }
  }
}

function manifestIdentity(input: Omit<SourceManifest, "acquisitionId" | "installation">): string {
  return `sha256:${sha256(identityBytes(input))}`;
}

function sameManifestState(left: SteamAppManifest, right: SteamAppManifest): boolean {
  return (
    left.appId === right.appId &&
    left.installDir === right.installDir &&
    left.buildId === right.buildId &&
    left.targetBuildId === right.targetBuildId &&
    left.stateFlags === right.stateFlags
  );
}

async function readManifestState(installation: GameInstallation): Promise<{
  readonly metadata: SteamAppManifest;
  readonly rawSha256: string;
}> {
  const file = await readStableFile(installation.appManifestPath);
  return {
    metadata: parseSteamAppManifest(file.content.toString("utf8")),
    rawSha256: file.sha256,
  };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function readWindowsExecutableVersion(path: string): Promise<ExecutableVersion> {
  if (process.platform !== "win32") {
    throw new Error("Automatic executable version capture is supported only on Windows.");
  }

  const script =
    "$item = Get-Item -LiteralPath $env:NEONHADES2_VERSION_TARGET; " +
    "[ordered]@{ fileVersion = $item.VersionInfo.FileVersion; productVersion = $item.VersionInfo.ProductVersion } | ConvertTo-Json -Compress";
  const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
    encoding: "utf8",
    env: { ...process.env, NEONHADES2_VERSION_TARGET: path },
    windowsHide: true,
  });
  const parsed: unknown = JSON.parse(stdout.trim());

  if (
    !isRecord(parsed) ||
    typeof parsed.fileVersion !== "string" ||
    parsed.fileVersion === "" ||
    typeof parsed.productVersion !== "string" ||
    parsed.productVersion === ""
  ) {
    throw new Error("Hades II executable has no readable version metadata.");
  }

  return { fileVersion: parsed.fileVersion, productVersion: parsed.productVersion };
}

async function captureExecutable(
  gameRoot: string,
  relativePath: string,
  versionReader: (path: string) => Promise<ExecutableVersion>,
): Promise<ExecutableEvidence> {
  const path = await resolveFileInside(gameRoot, relativePath);
  const [file, version] = await Promise.all([readStableFile(path), versionReader(path)]);
  return { relativePath, size: file.size, sha256: file.sha256, ...version };
}

function formatTimestamp(date: Date): string {
  return date.toISOString().replace(/[-:.]/gu, "");
}

async function writeFailure(directory: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : "Unknown snapshot failure.";
  const failure = {
    schema: "neodes2-snapshot-failure-1",
    message,
  };

  try {
    await writeFile(join(directory, "failure.json"), jsonBytes(failure), { flag: "wx" });
  } catch {
    // The original failure remains authoritative when a local failure report cannot be written.
  }
}

export async function createSourceSnapshot(options: SnapshotOptions): Promise<SnapshotResult> {
  assertLocalOutputPath(options.outputRoot);
  const installation = await discoverGameInstallation({
    ...(options.manifestPath === undefined ? {} : { manifestPath: options.manifestPath }),
    ...(options.steamRoots === undefined ? {} : { steamRoots: options.steamRoots }),
  });
  const gameRoot = await realpath(installation.gameRoot);
  const policy = validateSourcePolicy(options.policy ?? sourcePolicy);
  const requiredPatterns =
    options.requiredSourcePatterns ?? getRequiredContractSourcePatterns(acquisitionContract);
  const sourcePaths = await enumerateSourcePaths(gameRoot, policy);
  validateRequiredPatterns(sourcePaths, requiredPatterns);

  const initialManifest = await readManifestState(installation);
  if (!sameManifestState(initialManifest.metadata, installation.manifest)) {
    throw new Error("Steam app manifest changed during installation discovery.");
  }

  const outputRoot = resolve(options.outputRoot);
  await mkdir(outputRoot, { recursive: true });
  const timestamp = formatTimestamp((options.now ?? (() => new Date()))());
  const incompletePrefix = join(outputRoot, `${timestamp}-incomplete-`);
  let currentRunDirectory = await mkdtemp(incompletePrefix);

  try {
    const packageVersionRelativePath = "Content/packagever";
    const packageVersionPath = await resolveFileInside(gameRoot, packageVersionRelativePath);
    const packageVersionFile = await readStableFile(packageVersionPath);
    const packageVersion = packageVersionFile.content.toString("utf8").trim();
    if (packageVersion === "" || /[\r\n]/u.test(packageVersion)) {
      throw new Error("Hades II package version is missing or invalid.");
    }

    const versionReader = options.executableVersionReader ?? readWindowsExecutableVersion;
    const executables = await Promise.all(
      ["Release/Hades2.exe", "Ship/Hades2.exe"].map((relativePath) =>
        captureExecutable(gameRoot, relativePath, versionReader),
      ),
    );
    const executableVersions = new Set(executables.map((entry) => entry.fileVersion));
    const productVersions = new Set(executables.map((entry) => entry.productVersion));
    if (executableVersions.size !== 1 || productVersions.size !== 1) {
      throw new Error("Hades II executable variants report mixed versions.");
    }
    const executableVersion = executables[0]?.fileVersion;
    if (executableVersion === undefined) {
      throw new Error("Hades II executable evidence is missing.");
    }

    const sourceDirectory = join(currentRunDirectory, "sources");
    const sources: FileEvidence[] = [];
    for (const relativePath of sourcePaths) {
      const sourcePath = await resolveFileInside(gameRoot, relativePath);
      const source = await readStableFile(sourcePath);
      const destination = toNativePath(sourceDirectory, relativePath);
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, source.content, { flag: "wx" });
      const copy = await readStableFile(destination);
      if (copy.size !== source.size || copy.sha256 !== source.sha256) {
        throw new Error(`Copied source verification failed: ${relativePath}`);
      }
      sources.push({ relativePath, size: source.size, sha256: source.sha256 });
    }

    const finalManifestState = await readManifestState(installation);
    if (
      initialManifest.rawSha256 !== finalManifestState.rawSha256 ||
      !sameManifestState(initialManifest.metadata, finalManifestState.metadata)
    ) {
      throw new Error("Steam app manifest changed while the source snapshot was running.");
    }

    const sourcePolicySha256 = sha256(identityBytes(policy));
    const steamManifestFieldsSha256 = sha256(identityBytes(finalManifestState.metadata));
    const identity = {
      schema: "neodes2-source-manifest-1" as const,
      contractSchema: acquisitionContract.schema,
      sourcePolicySchema: policy.schema,
      sourcePolicySha256,
      game: {
        steamAppId: finalManifestState.metadata.appId,
        steamBuildId: finalManifestState.metadata.buildId,
        targetSteamBuildId: finalManifestState.metadata.targetBuildId,
        executableVersion,
        packageVersion,
      },
      steamManifestFieldsSha256,
      packageVersionFile: {
        relativePath: packageVersionRelativePath,
        size: packageVersionFile.size,
        sha256: packageVersionFile.sha256,
      },
      executables,
      sources,
    };
    const acquisitionId = manifestIdentity(identity);
    const manifest: SourceManifest = {
      ...identity,
      acquisitionId,
      installation: {
        root: gameRoot,
        appManifestPath: installation.appManifestPath,
      },
    };
    const manifestContent = jsonBytes(manifest);
    const manifestSha256 = sha256(manifestContent);
    const temporaryManifestPath = join(currentRunDirectory, "manifest.json.tmp");
    const manifestPathBeforeRename = join(currentRunDirectory, "manifest.json");
    await writeFile(temporaryManifestPath, manifestContent, { flag: "wx" });
    await rename(temporaryManifestPath, manifestPathBeforeRename);

    const randomSuffix = basename(currentRunDirectory).slice(
      basename(incompletePrefix).length,
    );
    const finalDirectory = join(
      outputRoot,
      `${timestamp}-${acquisitionId.slice("sha256:".length, "sha256:".length + 12)}-${randomSuffix}`,
    );
    await rename(currentRunDirectory, finalDirectory);
    currentRunDirectory = finalDirectory;

    const completion = {
      schema: "neodes2-source-snapshot-completion-1",
      acquisitionId,
      manifestSha256,
    };
    const temporaryCompletionPath = join(finalDirectory, "complete.json.tmp");
    const completionPath = join(finalDirectory, "complete.json");
    await writeFile(temporaryCompletionPath, jsonBytes(completion), { flag: "wx" });
    await rename(temporaryCompletionPath, completionPath);

    return {
      acquisitionId,
      directory: finalDirectory,
      manifestPath: join(finalDirectory, "manifest.json"),
      manifestSha256,
      sourceCount: sources.length,
    };
  } catch (error) {
    await writeFailure(currentRunDirectory, error);
    throw error;
  }
}

export function assertLocalOutputPath(path: string): void {
  const parts = resolve(path)
    .split(/[\\/]/u)
    .filter((part) => part !== "");
  if (!parts.some((part) => part.toLowerCase() === ".local")) {
    throw new Error("Snapshot output must be inside a .local directory.");
  }
}
