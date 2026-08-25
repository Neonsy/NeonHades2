import type { JsonObject, JsonValue, RuntimeBoonSample } from "../boons/runtime-schema.js";
import type {
  RuntimeFamiliar,
  RuntimeHex,
  RuntimeIncantation,
  RuntimeKeepsake,
  RuntimeLoadoutReport,
} from "./runtime-schema.js";
import type { IncantationRevealPolicy, LoadoutSourceAudit } from "./source-audit.js";

export interface NormalizedLoadoutDataset {
  readonly schema: "neodes2-loadouts-2";
  readonly source: {
    readonly acquisitionId: string;
    readonly exporterVersion: string;
    readonly steamBuildId: string;
    readonly executableVersion: string;
    readonly packageVersion: string;
  };
  readonly keepsakes: readonly RuntimeKeepsake[];
  readonly familiars: readonly RuntimeFamiliar[];
  readonly hexes: readonly RuntimeHex[];
  readonly incantations: readonly RuntimeIncantation[];
  readonly automaticWorldUpgradeIds: readonly string[];
  readonly incantationRevealPolicy: IncantationRevealPolicy;
  readonly spellTalentConfiguration: JsonObject;
}

export interface LoadoutCoverageIssue {
  readonly recordType: "familiar-upgrade" | "hex" | "hex-talent" | "incantation" | "keepsake";
  readonly recordId: string;
  readonly code: "failed-runtime-sample" | "missing-effects" | "missing-rank-sample" | "missing-tooltip-value";
  readonly detail: string;
}

export interface LoadoutCoverageReport {
  readonly schema: "neodes2-loadout-coverage-1";
  readonly acquisitionId: string;
  readonly keepsakeCount: number;
  readonly familiarCount: number;
  readonly familiarUpgradeTrackCount: number;
  readonly familiarUpgradeRankCount: number;
  readonly hexCount: number;
  readonly hexTalentCount: number;
  readonly incantationCount: number;
  readonly automaticIncantationCount: number;
  readonly failedSampleCount: number;
  readonly resolvedValueCount: number;
  readonly contextualValueCount: number;
  readonly issues: readonly LoadoutCoverageIssue[];
  readonly complete: boolean;
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalize(value: JsonValue): JsonValue {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const objectValue = value as JsonObject;
  const result: Record<string, JsonValue> = {};
  for (const key of Object.keys(objectValue).sort()) {
    const entry = objectValue[key];
    if (entry !== undefined) result[key] = canonicalize(entry);
  }
  return result;
}

function canonicalSample(sample: RuntimeBoonSample): RuntimeBoonSample {
  if (sample.result.status === "error") return sample;
  return {
    ...sample,
    context: {
      ...sample.context,
      elementCounts: sample.context.elementCounts.map((entry) => ({ ...entry })),
    },
    result: {
      status: "ok",
      values: sample.result.values.map((entry) => ({
        ...entry,
        source:
          entry.source.kind === "context-value"
            ? { ...entry.source }
            : entry.source.kind === "processed-trait-variants"
              ? {
                  ...entry.source,
                  variants: entry.source.variants.map((variant) => ({
                    ...variant,
                    runtimePaths: [...variant.runtimePaths],
                    value: canonicalize(variant.value),
                  })),
                }
              : { ...entry.source, value: canonicalize(entry.source.value) },
        staticInputs: entry.staticInputs.map((input) => ({
          ...input,
          value: canonicalize(input.value),
        })),
        resolution:
          entry.resolution.kind === "resolved"
            ? { kind: "resolved", value: canonicalize(entry.resolution.value) }
            : { ...entry.resolution, inputIds: [...entry.resolution.inputIds] },
      })),
    },
  };
}

function sampleValueIds(samples: readonly RuntimeBoonSample[]): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const sample of samples) {
    if (sample.result.status !== "ok") continue;
    for (const value of sample.result.values) ids.add(value.id);
  }
  return ids;
}

function tooltipValueIds(description: string): readonly string[] {
  return [
    ...new Set(
      [...description.matchAll(/\$TooltipData\.ExtractData\.([A-Za-z0-9_]+)/gu)].map(
        (match) => match[1] as string,
      ),
    ),
  ].sort(compareStrings);
}

function inspectSamples(
  recordType: LoadoutCoverageIssue["recordType"],
  recordId: string,
  description: string,
  samples: readonly RuntimeBoonSample[],
  issues: LoadoutCoverageIssue[],
): { readonly failed: number; readonly resolved: number; readonly contextual: number } {
  let failed = 0;
  let resolved = 0;
  let contextual = 0;
  for (const sample of samples) {
    if (sample.result.status === "error") {
      failed += 1;
      issues.push({
        recordType,
        recordId,
        code: "failed-runtime-sample",
        detail: `${sample.rarity} ${sample.endpoint} level ${sample.level}: ${sample.result.message}`,
      });
      continue;
    }
    for (const value of sample.result.values) {
      if (value.resolution.kind === "contextual") contextual += 1;
      else resolved += 1;
    }
  }
  const values = sampleValueIds(samples);
  for (const id of tooltipValueIds(description)) {
    if (!values.has(id)) {
      issues.push({
        recordType,
        recordId,
        code: "missing-tooltip-value",
        detail: `Official description references TooltipData.ExtractData.${id}, but no successful runtime sample exports it.`,
      });
    }
  }
  return { failed, resolved, contextual };
}

export function normalizeRuntimeLoadouts(report: RuntimeLoadoutReport, sourceAudit: LoadoutSourceAudit): {
  readonly dataset: NormalizedLoadoutDataset;
  readonly coverage: LoadoutCoverageReport;
} {
  const issues: LoadoutCoverageIssue[] = [];
  let failedSampleCount = 0;
  let resolvedValueCount = 0;
  let contextualValueCount = 0;
  const addCounts = (counts: { readonly failed: number; readonly resolved: number; readonly contextual: number }): void => {
    failedSampleCount += counts.failed;
    resolvedValueCount += counts.resolved;
    contextualValueCount += counts.contextual;
  };

  for (const keepsake of report.keepsakes) {
    addCounts(inspectSamples("keepsake", keepsake.id, keepsake.description, keepsake.rankEffects, issues));
    for (const rarity of keepsake.naturalRanks) {
      if (!keepsake.rankEffects.some((sample) => sample.rarity === rarity && sample.result.status === "ok")) {
        issues.push({
          recordType: "keepsake",
          recordId: keepsake.id,
          code: "missing-rank-sample",
          detail: `${rarity} has no successful runtime sample.`,
        });
      }
    }
  }
  for (const familiar of report.familiars) {
    for (const upgrade of familiar.upgrades) {
      addCounts(inspectSamples("familiar-upgrade", upgrade.id, upgrade.description, upgrade.rankEffects, issues));
      for (let level = 1; level <= 3; level += 1) {
        if (!upgrade.rankEffects.some((sample) => sample.level === level && sample.result.status === "ok")) {
          issues.push({
            recordType: "familiar-upgrade",
            recordId: upgrade.id,
            code: "missing-rank-sample",
            detail: `Rank ${level} has no successful runtime sample.`,
          });
        }
      }
    }
  }
  for (const hex of report.hexes) {
    addCounts(inspectSamples("hex", hex.id, hex.description, hex.baseEffects, issues));
    for (const talent of hex.talents) {
      addCounts(inspectSamples("hex-talent", talent.id, talent.description, talent.effects, issues));
    }
  }
  for (const incantation of report.incantations) {
    if (Object.keys(incantation.effects).length === 0) {
      issues.push({
        recordType: "incantation",
        recordId: incantation.id,
        code: "missing-effects",
        detail: "No processed incantation behavior was exported.",
      });
    }
  }
  issues.sort(
    (left, right) =>
      compareStrings(left.recordType, right.recordType) ||
      compareStrings(left.recordId, right.recordId) ||
      compareStrings(left.code, right.code),
  );
  const familiarUpgradeTrackCount = report.familiars.reduce(
    (count, familiar) => count + familiar.upgrades.length,
    0,
  );
  const coverage: LoadoutCoverageReport = {
    schema: "neodes2-loadout-coverage-1",
    acquisitionId: report.game.acquisitionId,
    keepsakeCount: report.keepsakes.length,
    familiarCount: report.familiars.length,
    familiarUpgradeTrackCount,
    familiarUpgradeRankCount: report.familiars.reduce(
      (count, familiar) =>
        count + familiar.upgrades.reduce((subtotal, upgrade) => subtotal + upgrade.ranks.length, 0),
      0,
    ),
    hexCount: report.hexes.length,
    hexTalentCount: report.hexes.reduce((count, hex) => count + hex.talents.length, 0),
    incantationCount: report.incantations.length,
    automaticIncantationCount: report.automaticWorldUpgradeIds.length,
    failedSampleCount,
    resolvedValueCount,
    contextualValueCount,
    issues,
    complete: issues.length === 0,
  };
  const dataset: NormalizedLoadoutDataset = {
      schema: "neodes2-loadouts-2",
      source: {
        acquisitionId: report.game.acquisitionId,
        exporterVersion: report.exporterVersion,
        steamBuildId: report.game.steamBuildId,
        executableVersion: report.game.executableVersion,
        packageVersion: report.game.packageVersion,
      },
      keepsakes: report.keepsakes.map((keepsake) => ({
        ...keepsake,
        rankEffects: keepsake.rankEffects.map(canonicalSample),
      })),
      familiars: report.familiars.map((familiar) => ({
        ...familiar,
        upgrades: familiar.upgrades.map((upgrade) => ({
          ...upgrade,
          rankEffects: upgrade.rankEffects.map(canonicalSample),
        })),
      })),
      hexes: report.hexes.map((hex) => ({
        ...hex,
        baseEffects: hex.baseEffects.map(canonicalSample),
        talents: hex.talents.map((talent) => ({
          ...talent,
          effects: talent.effects.map(canonicalSample),
        })),
      })),
      incantations: report.incantations,
      automaticWorldUpgradeIds: report.automaticWorldUpgradeIds,
      incantationRevealPolicy: sourceAudit.incantationRevealPolicy,
      spellTalentConfiguration: report.spellTalentConfiguration,
    };
  return {
    dataset,
    coverage,
  };
}

function markdownText(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

export function renderLoadoutCoverageReport(coverage: LoadoutCoverageReport): string {
  const lines = [
    "# Loadout-system acquisition coverage",
    "",
    `- Acquisition: \`${coverage.acquisitionId}\``,
    `- Keepsakes: ${coverage.keepsakeCount}`,
    `- Familiars: ${coverage.familiarCount}`,
    `- Familiar upgrade tracks: ${coverage.familiarUpgradeTrackCount}`,
    `- Familiar upgrade ranks: ${coverage.familiarUpgradeRankCount}`,
    `- Hexes: ${coverage.hexCount}`,
    `- Path of Stars talents: ${coverage.hexTalentCount}`,
    `- Incantations: ${coverage.incantationCount}`,
    `- Automatic incantations: ${coverage.automaticIncantationCount}`,
    `- Failed runtime samples: ${coverage.failedSampleCount}`,
    `- Resolved values: ${coverage.resolvedValueCount}`,
    `- Context-dependent values: ${coverage.contextualValueCount}`,
    `- Coverage complete: ${coverage.complete ? "yes" : "no"}`,
    "",
  ];
  if (coverage.issues.length === 0) {
    lines.push("No loadout-system exporter coverage issues were found.", "");
  } else {
    lines.push("## Issues", "", "| Domain | Record | Code | Detail |", "| --- | --- | --- | --- |");
    for (const issue of coverage.issues) {
      lines.push(`| ${issue.recordType} | ${markdownText(issue.recordId)} | ${issue.code} | ${markdownText(issue.detail)} |`);
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}
