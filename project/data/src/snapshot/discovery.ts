import { execFileSync } from "node:child_process";
import { access, readFile, realpath } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import { acquisitionContract } from "../contract/index.js";
import {
  isVdfObject,
  parseValveKeyValues,
  requireVdfObject,
  requireVdfString,
} from "./vdf.js";

export interface SteamAppManifest {
  readonly appId: string;
  readonly installDir: string;
  readonly buildId: string;
  readonly targetBuildId: string | null;
  readonly stateFlags: number;
}

export interface GameInstallation {
  readonly libraryRoot: string;
  readonly appManifestPath: string;
  readonly gameRoot: string;
  readonly manifest: SteamAppManifest;
}

export interface DiscoveryOptions {
  readonly manifestPath?: string;
  readonly steamRoots?: readonly string[];
}

function comparePaths(left: string, right: string): number {
  const normalizedLeft = process.platform === "win32" ? left.toLowerCase() : left;
  const normalizedRight = process.platform === "win32" ? right.toLowerCase() : right;
  return normalizedLeft < normalizedRight ? -1 : normalizedLeft > normalizedRight ? 1 : 0;
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

function parseStateFlags(value: string): number {
  const stateFlags = Number(value);
  if (!Number.isSafeInteger(stateFlags) || stateFlags < 0) {
    throw new Error("Steam app manifest has invalid state flags.");
  }
  if ((stateFlags & 4) !== 4) {
    throw new Error("Hades II is not in Steam's fully installed state.");
  }
  return stateFlags;
}

export function parseSteamAppManifest(source: string): SteamAppManifest {
  const root = parseValveKeyValues(source);
  const appState = requireVdfObject(root, "AppState");
  const appId = requireVdfString(appState, "appid");
  const installDir = requireVdfString(appState, "installdir");
  const buildId = requireVdfString(appState, "buildid");
  const targetBuildIdValue = appState.TargetBuildID;
  const targetBuildId = typeof targetBuildIdValue === "string" ? targetBuildIdValue : null;

  if (appId !== acquisitionContract.game.steamAppId) {
    throw new Error(`Steam app manifest is for unexpected app ${appId}.`);
  }

  if (
    installDir === "." ||
    installDir === ".." ||
    installDir.includes("/") ||
    installDir.includes("\\") ||
    isAbsolute(installDir)
  ) {
    throw new Error("Steam app manifest contains an unresolved install directory.");
  }

  if (targetBuildId !== null && targetBuildId !== buildId) {
    throw new Error("Steam app manifest describes mixed installed and target builds.");
  }

  return {
    appId,
    installDir,
    buildId,
    targetBuildId,
    stateFlags: parseStateFlags(requireVdfString(appState, "StateFlags")),
  };
}

export function parseSteamLibraryFolders(source: string): readonly string[] {
  const root = parseValveKeyValues(source);
  const folders = requireVdfObject(root, "libraryfolders");
  const paths: string[] = [];

  for (const value of Object.values(folders)) {
    if (!isVdfObject(value)) {
      continue;
    }
    const candidate = value.path;
    if (typeof candidate === "string" && candidate !== "") {
      if (!isAbsolute(candidate)) {
        throw new Error("Steam library configuration contains a relative path.");
      }
      paths.push(candidate);
    }
  }

  return paths;
}

function readRegistryValue(key: string, name: string): string | null {
  if (process.platform !== "win32") {
    return null;
  }

  try {
    const output = execFileSync("reg.exe", ["query", key, "/v", name], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true,
    });
    const line = output
      .split(/\r?\n/u)
      .find((candidate) => candidate.includes(name) && candidate.includes("REG_"));
    const match = line?.match(/REG_\w+\s+(.+)$/u);
    return match?.[1]?.trim() ?? null;
  } catch {
    return null;
  }
}

async function canonicalExistingDirectories(candidates: readonly string[]): Promise<readonly string[]> {
  const resolved = new Map<string, string>();

  for (const candidate of candidates) {
    try {
      const canonical = await realpath(resolve(candidate));
      const key = process.platform === "win32" ? canonical.toLowerCase() : canonical;
      resolved.set(key, canonical);
    } catch {
      // Stale Steam registry and default paths are expected and are ignored.
    }
  }

  return [...resolved.values()].sort(comparePaths);
}

export async function discoverSteamRoots(): Promise<readonly string[]> {
  const candidates: string[] = [];
  const registryValues = [
    readRegistryValue("HKCU\\Software\\Valve\\Steam", "SteamPath"),
    readRegistryValue("HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam", "InstallPath"),
    readRegistryValue("HKLM\\SOFTWARE\\Valve\\Steam", "InstallPath"),
  ];

  for (const candidate of registryValues) {
    if (candidate !== null) {
      candidates.push(candidate);
    }
  }

  const programFilesX86 = process.env["ProgramFiles(x86)"];
  const programFiles = process.env.ProgramFiles;
  const home = process.env.HOME;

  if (programFilesX86 !== undefined) {
    candidates.push(join(programFilesX86, "Steam"));
  }
  if (programFiles !== undefined) {
    candidates.push(join(programFiles, "Steam"));
  }
  if (home !== undefined) {
    candidates.push(join(home, ".steam", "steam"), join(home, ".local", "share", "Steam"));
  }

  return canonicalExistingDirectories(candidates);
}

async function collectLibraryRoots(steamRoots: readonly string[]): Promise<readonly string[]> {
  const candidates: string[] = [...steamRoots];

  for (const steamRoot of steamRoots) {
    const libraryFile = join(steamRoot, "steamapps", "libraryfolders.vdf");
    try {
      const source = await readFile(libraryFile, "utf8");
      candidates.push(...parseSteamLibraryFolders(source));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw new Error(`Unable to read Steam library configuration at ${libraryFile}.`, {
          cause: error,
        });
      }
    }
  }

  return canonicalExistingDirectories(candidates);
}

async function installationFromManifest(manifestPath: string): Promise<GameInstallation> {
  if (!isAbsolute(manifestPath)) {
    throw new Error("The Steam app manifest override must be an absolute path.");
  }

  const appManifestPath = await realpath(manifestPath);
  const steamAppsRoot = dirname(appManifestPath);
  const libraryRoot = dirname(steamAppsRoot);
  const commonRoot = await realpath(join(steamAppsRoot, "common"));
  const manifest = parseSteamAppManifest(await readFile(appManifestPath, "utf8"));
  const unresolvedGameRoot = join(commonRoot, manifest.installDir);
  const gameRoot = await realpath(unresolvedGameRoot);

  if (!isWithin(commonRoot, gameRoot)) {
    throw new Error("Resolved Hades II installation escapes the Steam common directory.");
  }

  return { libraryRoot, appManifestPath, gameRoot, manifest };
}

export async function discoverGameInstallation(
  options: DiscoveryOptions = {},
): Promise<GameInstallation> {
  if (options.manifestPath !== undefined) {
    return installationFromManifest(options.manifestPath);
  }

  const steamRoots =
    options.steamRoots === undefined
      ? await discoverSteamRoots()
      : await canonicalExistingDirectories(options.steamRoots);

  if (steamRoots.length === 0) {
    throw new Error("No Steam installation was found.");
  }

  const libraryRoots = await collectLibraryRoots(steamRoots);
  const manifests = new Map<string, string>();

  for (const libraryRoot of libraryRoots) {
    const candidate = join(
      libraryRoot,
      "steamapps",
      `appmanifest_${acquisitionContract.game.steamAppId}.acf`,
    );
    try {
      await access(candidate);
      const canonical = await realpath(candidate);
      const key = process.platform === "win32" ? canonical.toLowerCase() : canonical;
      manifests.set(key, canonical);
    } catch {
      // Libraries without Hades II are expected.
    }
  }

  const candidates = [...manifests.values()].sort(comparePaths);
  if (candidates.length === 0) {
    throw new Error("No installed Hades II Steam app manifest was found.");
  }
  if (candidates.length > 1) {
    throw new Error(
      "Multiple Hades II Steam app manifests were found. Pass --manifest with the intended absolute path.",
    );
  }

  const manifestPath = candidates[0];
  if (manifestPath === undefined) {
    throw new Error("Hades II Steam app manifest discovery failed.");
  }
  return installationFromManifest(manifestPath);
}
