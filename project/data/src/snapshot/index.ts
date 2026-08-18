export {
  discoverGameInstallation,
  discoverSteamRoots,
  parseSteamAppManifest,
  parseSteamLibraryFolders,
} from "./discovery.js";
export type {
  DiscoveryOptions,
  GameInstallation,
  SteamAppManifest,
} from "./discovery.js";
export {
  getRequiredContractSourcePatterns,
  matchesSourcePattern,
  sourcePolicy,
  validateSourcePolicy,
} from "./source-policy.js";
export type { SourcePolicy, SourcePolicyRule } from "./source-policy.js";
export {
  assertLocalOutputPath,
  createSourceSnapshot,
  readWindowsExecutableVersion,
} from "./snapshot.js";
export type {
  ExecutableEvidence,
  ExecutableVersion,
  FileEvidence,
  SnapshotOptions,
  SnapshotResult,
  SourceManifest,
} from "./snapshot.js";
export { parseValveKeyValues } from "./vdf.js";
export type { VdfObject, VdfValue } from "./vdf.js";
