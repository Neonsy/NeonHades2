import type { JsonObject, JsonValue, RuntimeBoonSample } from "../boons/runtime-schema.js";
import type {
  RuntimeAspect,
  RuntimeCost,
  RuntimeHammer,
  RuntimeWeaponReport,
} from "./runtime-schema.js";

export interface NormalizedWeaponDataset {
  readonly schema: "neodes2-weapons-1";
  readonly source: {
    readonly acquisitionId: string;
    readonly exporterVersion: string;
    readonly steamBuildId: string;
    readonly executableVersion: string;
    readonly packageVersion: string;
  };
  readonly weapons: readonly {
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly unlockCosts: readonly RuntimeCost[];
    readonly unlockRequirements: JsonValue;
    readonly linkedWeaponIds: readonly string[];
    readonly linkedIdsWithoutWeaponData: readonly string[];
    readonly weaponDataIds: readonly string[];
    readonly weaponData: JsonObject;
    readonly evidence: readonly string[];
  }[];
  readonly aspects: readonly {
    readonly id: string;
    readonly weaponId: string;
    readonly name: string;
    readonly description: string;
    readonly baseAspect: boolean;
    readonly ranks: RuntimeAspect["ranks"];
    readonly rankEffects: readonly RuntimeBoonSample[];
    readonly mechanics: JsonObject;
    readonly evidence: readonly string[];
  }[];
  readonly hammers: readonly {
    readonly id: string;
    readonly weaponId: string;
    readonly name: string;
    readonly description: string;
    readonly requirements: JsonValue;
    readonly compatibility: RuntimeHammer["compatibility"];
    readonly effects: readonly RuntimeBoonSample[];
    readonly mechanics: JsonObject;
    readonly evidence: readonly string[];
  }[];
}

export interface WeaponCoverageIssue {
  readonly recordType: "aspect" | "hammer" | "weapon";
  readonly recordId: string;
  readonly code:
    | "failed-runtime-sample"
    | "missing-description"
    | "missing-rank-sample"
    | "missing-runtime-sample"
    | "missing-tooltip-value"
    | "missing-weapon-data";
  readonly detail: string;
}

export interface WeaponCoverageReport {
  readonly schema: "neodes2-weapon-coverage-1";
  readonly acquisitionId: string;
  readonly weaponCount: number;
  readonly aspectCount: number;
  readonly hammerCount: number;
  readonly rankCount: number;
  readonly failedSampleCount: number;
  readonly resolvedValueCount: number;
  readonly contextualValueCount: number;
  readonly attackPatternsPendingObservation: readonly string[];
  readonly issues: readonly WeaponCoverageIssue[];
  readonly complete: boolean;
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalize(value: JsonValue): JsonValue {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  const objectValue = value as JsonObject;
  const result: Record<string, JsonValue> = {};
  for (const key of Object.keys(objectValue).sort()) {
    const entry = objectValue[key];
    if (entry !== undefined) {
      result[key] = canonicalize(entry);
    }
  }
  return result;
}

function canonicalObject(value: JsonObject): JsonObject {
  return canonicalize(value) as JsonObject;
}

function canonicalizeSample(sample: RuntimeBoonSample): RuntimeBoonSample {
  if (sample.result.status === "error") {
    return sample;
  }
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

function extractTooltipValueIds(description: string): readonly string[] {
  return [
    ...new Set(
      [...description.matchAll(/\$TooltipData\.ExtractData\.([A-Za-z0-9_]+)/gu)].map(
        (match) => match[1] as string,
      ),
    ),
  ].sort(compareStrings);
}

function collectSampleCounts(samples: readonly RuntimeBoonSample[]): {
  readonly failed: number;
  readonly resolved: number;
  readonly contextual: number;
} {
  let failed = 0;
  let resolved = 0;
  let contextual = 0;
  for (const sample of samples) {
    if (sample.result.status === "error") {
      failed += 1;
      continue;
    }
    for (const value of sample.result.values) {
      if (value.resolution.kind === "contextual") {
        contextual += 1;
      } else {
        resolved += 1;
      }
    }
  }
  return { failed, resolved, contextual };
}

function successfulValueIds(
  samples: readonly RuntimeBoonSample[],
  rarity?: string,
): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const sample of samples) {
    if (
      sample.result.status === "ok" &&
      (rarity === undefined || sample.rarity.toLowerCase() === rarity.toLowerCase())
    ) {
      for (const value of sample.result.values) {
        ids.add(value.id);
      }
    }
  }
  return ids;
}

function validateTooltipCoverage(
  recordType: "aspect" | "hammer",
  recordId: string,
  description: string,
  samples: readonly RuntimeBoonSample[],
  issues: WeaponCoverageIssue[],
): void {
  const valueIds = successfulValueIds(samples);
  for (const id of extractTooltipValueIds(description)) {
    if (!valueIds.has(id)) {
      issues.push({
        recordType,
        recordId,
        code: "missing-tooltip-value",
        detail: `Official description references TooltipData.ExtractData.${id}, but no successful sample exports it.`,
      });
    }
  }
}

function copyCosts(costs: readonly RuntimeCost[]): readonly RuntimeCost[] {
  return costs.map((cost) => ({ ...cost }));
}

export function normalizeRuntimeWeapons(report: RuntimeWeaponReport): {
  readonly dataset: NormalizedWeaponDataset;
  readonly coverage: WeaponCoverageReport;
} {
  const issues: WeaponCoverageIssue[] = [];
  let failedSampleCount = 0;
  let resolvedValueCount = 0;
  let contextualValueCount = 0;

  const weapons = report.weapons.map((weapon) => {
    if (Object.keys(weapon.weaponData).length === 0) {
      issues.push({
        recordType: "weapon",
        recordId: weapon.id,
        code: "missing-weapon-data",
        detail: "No processed weapon data was exported for this weapon family.",
      });
    }
    return {
      id: weapon.id,
      name: weapon.displayName,
      description: weapon.description,
      unlockCosts: copyCosts(weapon.unlockCosts),
      unlockRequirements: canonicalize(weapon.unlockRequirements),
      linkedWeaponIds: [...weapon.linkedWeaponIds],
      linkedIdsWithoutWeaponData: [...weapon.linkedIdsWithoutWeaponData],
      weaponDataIds: [...weapon.weaponDataIds],
      weaponData: canonicalObject(weapon.weaponData),
      evidence: [...weapon.evidence.runtimePaths, weapon.evidence.localizationPath].sort(
        compareStrings,
      ),
    };
  });

  const aspects = report.aspects.map((aspect) => {
    if (aspect.description.trim() === "") {
      issues.push({
        recordType: "aspect",
        recordId: aspect.id,
        code: "missing-description",
        detail: "No official English description was exported.",
      });
    }
    for (const rank of aspect.ranks) {
      const rankSamples = aspect.samples.filter(
        (sample) => sample.rarity.toLowerCase() === rank.rarity.toLowerCase(),
      );
      if (rankSamples.length === 0 || rankSamples.every((sample) => sample.result.status === "error")) {
        issues.push({
          recordType: "aspect",
          recordId: aspect.id,
          code: "missing-rank-sample",
          detail: `Rank ${rank.rank} (${rank.rarity}) has no successful runtime sample.`,
        });
      }
    }
    for (const sample of aspect.samples) {
      if (sample.result.status === "error") {
        issues.push({
          recordType: "aspect",
          recordId: aspect.id,
          code: "failed-runtime-sample",
          detail: `${sample.rarity} ${sample.endpoint} level ${sample.level}: ${sample.result.message}`,
        });
      }
    }
    validateTooltipCoverage("aspect", aspect.id, aspect.description, aspect.samples, issues);
    const counts = collectSampleCounts(aspect.samples);
    failedSampleCount += counts.failed;
    resolvedValueCount += counts.resolved;
    contextualValueCount += counts.contextual;
    return {
      id: aspect.id,
      weaponId: aspect.weaponId,
      name: aspect.displayName,
      description: aspect.description,
      baseAspect: aspect.baseAspect,
      ranks: aspect.ranks.map((rank) => ({
        ...rank,
        costs: copyCosts(rank.costs),
        requirements: canonicalize(rank.requirements),
      })),
      rankEffects: aspect.samples.map(canonicalizeSample),
      mechanics: canonicalObject(aspect.mechanics),
      evidence: [...aspect.evidence.runtimePaths, aspect.evidence.localizationPath].sort(
        compareStrings,
      ),
    };
  });

  const hammers = report.hammers.map((hammer) => {
    if (hammer.description.trim() === "") {
      issues.push({
        recordType: "hammer",
        recordId: hammer.id,
        code: "missing-description",
        detail: "No official English description was exported.",
      });
    }
    if (hammer.samples.length === 0 || hammer.samples.every((sample) => sample.result.status === "error")) {
      issues.push({
        recordType: "hammer",
        recordId: hammer.id,
        code: "missing-runtime-sample",
        detail: "No successful runtime sample was exported.",
      });
    }
    for (const sample of hammer.samples) {
      if (sample.result.status === "error") {
        issues.push({
          recordType: "hammer",
          recordId: hammer.id,
          code: "failed-runtime-sample",
          detail: `${sample.rarity} ${sample.endpoint} level ${sample.level}: ${sample.result.message}`,
        });
      }
    }
    validateTooltipCoverage("hammer", hammer.id, hammer.description, hammer.samples, issues);
    const counts = collectSampleCounts(hammer.samples);
    failedSampleCount += counts.failed;
    resolvedValueCount += counts.resolved;
    contextualValueCount += counts.contextual;
    return {
      id: hammer.id,
      weaponId: hammer.weaponId,
      name: hammer.displayName,
      description: hammer.description,
      requirements: canonicalize(hammer.requirements),
      compatibility: {
        allowedAspectIds: [...hammer.compatibility.allowedAspectIds],
        excludedAspectIds: [...hammer.compatibility.excludedAspectIds],
        requiredAspectIds: [...hammer.compatibility.requiredAspectIds],
        incompatibleHammerIds: [...hammer.compatibility.incompatibleHammerIds],
      },
      effects: hammer.samples.map(canonicalizeSample),
      mechanics: canonicalObject(hammer.mechanics),
      evidence: [...hammer.evidence.runtimePaths, hammer.evidence.localizationPath].sort(
        compareStrings,
      ),
    };
  });

  issues.sort((left, right) => {
    const typeOrder = compareStrings(left.recordType, right.recordType);
    if (typeOrder !== 0) return typeOrder;
    const idOrder = compareStrings(left.recordId, right.recordId);
    return idOrder !== 0 ? idOrder : compareStrings(left.code, right.code);
  });

  const coverage: WeaponCoverageReport = {
    schema: "neodes2-weapon-coverage-1",
    acquisitionId: report.game.acquisitionId,
    weaponCount: weapons.length,
    aspectCount: aspects.length,
    hammerCount: hammers.length,
    rankCount: aspects.reduce((count, aspect) => count + aspect.ranks.length, 0),
    failedSampleCount,
    resolvedValueCount,
    contextualValueCount,
    attackPatternsPendingObservation: weapons.map((weapon) => weapon.id),
    issues,
    complete: issues.length === 0,
  };

  return {
    dataset: {
      schema: "neodes2-weapons-1",
      source: {
        acquisitionId: report.game.acquisitionId,
        exporterVersion: report.exporterVersion,
        steamBuildId: report.game.steamBuildId,
        executableVersion: report.game.executableVersion,
        packageVersion: report.game.packageVersion,
      },
      weapons,
      aspects,
      hammers,
    },
    coverage,
  };
}

function markdownText(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

export function renderWeaponCoverageReport(coverage: WeaponCoverageReport): string {
  const lines = [
    "# Weapon acquisition coverage",
    "",
    `- Acquisition: \`${coverage.acquisitionId}\``,
    `- Weapons: ${coverage.weaponCount}`,
    `- Aspects: ${coverage.aspectCount}`,
    `- Aspect ranks: ${coverage.rankCount}`,
    `- Daedalus Hammers: ${coverage.hammerCount}`,
    `- Failed runtime samples: ${coverage.failedSampleCount}`,
    `- Resolved values: ${coverage.resolvedValueCount}`,
    `- Context-dependent values: ${coverage.contextualValueCount}`,
    `- Phase 3 exporter coverage complete: ${coverage.complete ? "yes" : "no"}`,
    "",
    "Attack-pattern observation remains a Phase 5 task for every weapon.",
    "",
  ];
  if (coverage.issues.length === 0) {
    lines.push("No weapon exporter coverage issues were found.", "");
  } else {
    lines.push("## Issues", "", "| Record | Code | Detail |", "| --- | --- | --- |");
    for (const issue of coverage.issues) {
      lines.push(
        `| ${issue.recordType}:${markdownText(issue.recordId)} | ${issue.code} | ${markdownText(issue.detail)} |`,
      );
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}
