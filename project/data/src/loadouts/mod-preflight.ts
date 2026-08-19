import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { auditLoadoutSources, type LoadoutSourceAudit } from "./source-audit.js";

export interface LoadoutExporterPreflightIssue {
  readonly code:
    | "fatal-error-propagation"
    | "manifest-version-mismatch"
    | "missing-base-type-handler"
    | "missing-format-handler"
    | "missing-runtime-schema"
    | "player-state-access";
  readonly file: string;
  readonly detail: string;
}

export interface LoadoutExporterPreflight {
  readonly schema: "neodes2-loadout-exporter-preflight-1";
  readonly exporterVersion: string;
  readonly sourceAudit: LoadoutSourceAudit;
  readonly issues: readonly LoadoutExporterPreflightIssue[];
  readonly complete: boolean;
}

function literalBranch(source: string, field: "base_type" | "format", value: string): boolean {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(`\\b${field}\\s*==\\s*"${escaped}"`, "u").test(source);
}

export async function preflightLoadoutExporter(
  modDirectory: string,
  sourceAcquisitionDirectory: string,
): Promise<LoadoutExporterPreflight> {
  const resolvedModDirectory = resolve(modDirectory);
  const [mainSource, loadoutSource, manifestSource, sourceAudit] = await Promise.all([
    readFile(join(resolvedModDirectory, "main.lua"), "utf8"),
    readFile(join(resolvedModDirectory, "loadouts.lua"), "utf8"),
    readFile(join(resolvedModDirectory, "manifest.json"), "utf8"),
    auditLoadoutSources(sourceAcquisitionDirectory),
  ]);
  const manifest: unknown = JSON.parse(manifestSource);
  if (typeof manifest !== "object" || manifest === null || Array.isArray(manifest)) {
    throw new Error("Exporter manifest must be an object.");
  }
  const version = /^local EXPORTER_VERSION\s*=\s*"([^"]+)"/mu.exec(mainSource)?.[1];
  if (version === undefined) throw new Error("main.lua does not declare EXPORTER_VERSION.");
  const issues: LoadoutExporterPreflightIssue[] = [];
  if (mainSource.includes("rom.log.error")) {
    issues.push({
      code: "fatal-error-propagation",
      file: "main.lua",
      detail: "Exporter failures must not call rom.log.error because it raises into game loading.",
    });
  }
  const manifestVersion = (manifest as Readonly<Record<string, unknown>>).version_number;
  if (manifestVersion !== version) {
    issues.push({
      code: "manifest-version-mismatch",
      file: "manifest.json",
      detail: `Manifest version ${String(manifestVersion)} does not match ${version}.`,
    });
  }
  if (
    !mainSource.includes('"neodes2-loadout-runtime-manifest-1"') ||
    !loadoutSource.includes('schema = "neodes2-loadout-runtime-1"')
  ) {
    issues.push({
      code: "missing-runtime-schema",
      file: "main.lua or loadouts.lua",
      detail: "Loadout-system runtime report or finalization schema is absent.",
    });
  }
  for (const token of ["CurrentRun", "GameState.", "GetHeroTrait", "GetTotalHeroTraitValue", "CalculateHealingMultiplier"]) {
    if (loadoutSource.includes(token)) {
      issues.push({
        code: "player-state-access",
        file: "loadouts.lua",
        detail: `Loadout exporter accesses player-specific state through ${token}.`,
      });
    }
  }
  for (const format of sourceAudit.extractionFormats) {
    if (!literalBranch(mainSource, "format", format)) {
      issues.push({
        code: "missing-format-handler",
        file: "main.lua",
        detail: `No deterministic or explicit contextual sample handler exists for ${format}.`,
      });
    }
  }
  for (const baseType of sourceAudit.extractionBaseTypes) {
    if (!literalBranch(mainSource, "base_type", baseType)) {
      issues.push({
        code: "missing-base-type-handler",
        file: "main.lua",
        detail: `No static base-data handler exists for ${baseType}.`,
      });
    }
  }
  if (!sourceAudit.complete) {
    issues.push({
      code: "missing-runtime-schema",
      file: "source acquisition",
      detail: "The authoritative static loadout-system source audit is incomplete.",
    });
  }
  return {
    schema: "neodes2-loadout-exporter-preflight-1",
    exporterVersion: version,
    sourceAudit,
    issues,
    complete: issues.length === 0,
  };
}
