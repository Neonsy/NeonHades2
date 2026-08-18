export { normalizeRuntimeWeapons, renderWeaponCoverageReport } from "./normalize.js";
export type {
  NormalizedWeaponDataset,
  WeaponCoverageIssue,
  WeaponCoverageReport,
} from "./normalize.js";
export { createRuntimeWeaponAcquisition } from "./runtime-acquisition.js";
export type {
  WeaponRuntimeAcquisitionOptions,
  WeaponRuntimeAcquisitionResult,
} from "./runtime-acquisition.js";
export { validateRuntimeWeaponReport } from "./runtime-schema.js";
export type {
  RuntimeAspect,
  RuntimeAspectRank,
  RuntimeCost,
  RuntimeEvidence,
  RuntimeHammer,
  RuntimeHammerCompatibility,
  RuntimeWeapon,
  RuntimeWeaponReport,
} from "./runtime-schema.js";
export { auditWeaponSources, renderWeaponSourceAudit } from "./source-audit.js";
export type {
  WeaponSourceAudit,
  WeaponSourceAuditIssue,
  WeaponSourceAuditRecord,
} from "./source-audit.js";
export { preflightWeaponExporter } from "./mod-preflight.js";
export type {
  WeaponExporterPreflight,
  WeaponExporterPreflightIssue,
} from "./mod-preflight.js";
