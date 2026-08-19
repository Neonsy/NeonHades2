import type {
  JsonObject,
  JsonValue,
  RuntimeBoon,
  RuntimeBoonReport,
  RuntimeBoonSample,
} from "./runtime-schema.js";

export interface NormalizedBoonDataset {
  readonly schema: "neodes2-boons-2";
  readonly source: {
    readonly acquisitionId: string;
    readonly exporterVersion: string;
    readonly steamBuildId: string;
    readonly executableVersion: string;
    readonly packageVersion: string;
  };
  readonly gods: readonly {
    readonly id: string;
    readonly name: string;
    readonly boonIds: readonly string[];
    readonly evidence: readonly string[];
  }[];
  readonly boons: readonly {
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly godIds: readonly string[];
    readonly kind: RuntimeBoon["kind"];
    readonly elements: readonly string[];
    readonly rarityBehavior: JsonObject;
    readonly levelScaling: readonly RuntimeBoonSample[];
    readonly prerequisites: JsonObject | null;
    readonly effects: JsonObject;
    readonly evidence: readonly string[];
  }[];
}

export interface BoonCoverageReport {
  readonly schema: "neodes2-boon-coverage-2";
  readonly acquisitionId: string;
  readonly godCount: number;
  readonly boonCount: number;
  readonly kindCounts: Readonly<Record<RuntimeBoon["kind"], number>>;
  readonly boonsWithDescriptions: number;
  readonly boonsWithSuccessfulSamples: number;
  readonly failedSampleCount: number;
  readonly resolvedValueCount: number;
  readonly contextualValueCount: number;
  readonly boonsWithContextualValues: number;
  readonly issues: readonly {
    readonly boonId: string;
    readonly code:
      | "failed-runtime-sample"
      | "missing-description"
      | "missing-player-visible-reference"
      | "missing-runtime-sample"
      | "missing-special-prerequisites";
    readonly detail: string;
  }[];
  readonly complete: boolean;
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

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
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
            ? {
                kind: "resolved" as const,
                value: canonicalize(entry.resolution.value),
              }
            : {
                ...entry.resolution,
                inputIds: [...entry.resolution.inputIds],
              },
      })),
    },
  };
}

export function normalizeRuntimeBoons(report: RuntimeBoonReport): {
  readonly dataset: NormalizedBoonDataset;
  readonly coverage: BoonCoverageReport;
} {
  const issues: BoonCoverageReport["issues"][number][] = [];
  let boonsWithDescriptions = 0;
  let boonsWithSuccessfulSamples = 0;
  let failedSampleCount = 0;
  let resolvedValueCount = 0;
  let contextualValueCount = 0;
  let boonsWithContextualValues = 0;
  const kindCounts: Record<RuntimeBoon["kind"], number> = {
    duo: 0,
    infusion: 0,
    legendary: 0,
    normal: 0,
  };
  const boonsById = new Map(report.boons.map((boon) => [boon.id, boon]));

  const boons = report.boons.map((boon) => {
    kindCounts[boon.kind] += 1;
    if (boon.description.trim() === "") {
      issues.push({
        boonId: boon.id,
        code: "missing-description",
        detail: "No official English description was exported.",
      });
    } else {
      boonsWithDescriptions += 1;
    }

    const successfulSamples = boon.samples.filter((sample) => sample.result.status === "ok");
    const failedSamples = boon.samples.filter((sample) => sample.result.status === "error");
    const successfulValues = successfulSamples.flatMap((sample) =>
      sample.result.status === "ok" ? sample.result.values : [],
    );
    const contextualValues = successfulValues.filter(
      (value) => value.resolution.kind === "contextual",
    );
    resolvedValueCount += successfulValues.length - contextualValues.length;
    contextualValueCount += contextualValues.length;
    if (contextualValues.length > 0) {
      boonsWithContextualValues += 1;
    }
    if (successfulSamples.length === 0) {
      issues.push({
        boonId: boon.id,
        code: "missing-runtime-sample",
        detail: "No rarity and level sample completed successfully.",
      });
    } else {
      boonsWithSuccessfulSamples += 1;
    }

    const tooltipValueIds = new Set(
      [...boon.description.matchAll(/\$TooltipData\.ExtractData\.([A-Za-z0-9_]+)/gu)].map(
        (match) => match[1]!,
      ),
    );
    for (const valueId of tooltipValueIds) {
      const missingSampleCount = successfulSamples.filter(
        (sample) =>
          sample.result.status === "ok" &&
          !sample.result.values.some((value) => value.id === valueId),
      ).length;
      if (missingSampleCount > 0) {
        issues.push({
          boonId: boon.id,
          code: "missing-player-visible-reference",
          detail: `Official description value TooltipData.ExtractData.${valueId} is absent from ${missingSampleCount} successful samples.`,
        });
      }
    }

    const traitFieldReferences = new Set(
      [...boon.description.matchAll(/\$TraitData\.([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)/gu)].map(
        (match) => `${match[1]}.${match[2]}`,
      ),
    );
    for (const reference of traitFieldReferences) {
      const separator = reference.indexOf(".");
      const traitId = reference.slice(0, separator);
      const field = reference.slice(separator + 1);
      const target = boonsById.get(traitId);
      if (target === undefined || !Object.hasOwn(target.mechanics, field)) {
        issues.push({
          boonId: boon.id,
          code: "missing-player-visible-reference",
          detail: `Official description reference TraitData.${reference} is absent from exported mechanics.`,
        });
      }
    }

    for (const sample of failedSamples) {
      if (sample.result.status !== "error") {
        continue;
      }
      failedSampleCount += 1;
      issues.push({
        boonId: boon.id,
        code: "failed-runtime-sample",
        detail: `${sample.rarity} ${sample.endpoint} level ${sample.level}: ${sample.result.message}`,
      });
    }
    if ((boon.kind === "duo" || boon.kind === "legendary") && !boon.hasPrerequisites) {
      issues.push({
        boonId: boon.id,
        code: "missing-special-prerequisites",
        detail: `${boon.kind} boon has no exported prerequisite expression.`,
      });
    }

    return {
      id: boon.id,
      name: boon.name,
      description: boon.description,
      godIds: [...boon.ownerIds],
      kind: boon.kind,
      elements: [...boon.elements],
      rarityBehavior: canonicalObject(boon.rarityLevels),
      levelScaling: [...boon.samples]
        .sort(
          (left, right) =>
            compareStrings(left.rarity, right.rarity) ||
            compareStrings(left.endpoint, right.endpoint) ||
            left.level - right.level,
        )
        .map(canonicalizeSample),
      prerequisites: boon.hasPrerequisites
        ? canonicalObject(boon.prerequisites)
        : null,
      effects: canonicalObject(boon.mechanics),
      evidence: [
        ...boon.evidence.runtimePaths,
        boon.evidence.localizationPath,
      ].toSorted(),
    };
  });

  const dataset: NormalizedBoonDataset = {
    schema: "neodes2-boons-2",
    source: {
      acquisitionId: report.game.acquisitionId,
      exporterVersion: report.exporterVersion,
      steamBuildId: report.game.steamBuildId,
      executableVersion: report.game.executableVersion,
      packageVersion: report.game.packageVersion,
    },
    gods: report.lootSources.map((loot) => ({
      id: loot.id,
      name: loot.displayName,
      boonIds: [...loot.boonIds],
      evidence: [loot.runtimePath, loot.localizationPath].toSorted(),
    })),
    boons,
  };

  const coverage: BoonCoverageReport = {
    schema: "neodes2-boon-coverage-2",
    acquisitionId: report.game.acquisitionId,
    godCount: report.lootSources.length,
    boonCount: report.boons.length,
    kindCounts,
    boonsWithDescriptions,
    boonsWithSuccessfulSamples,
    failedSampleCount,
    resolvedValueCount,
    contextualValueCount,
    boonsWithContextualValues,
    issues: issues.toSorted(
      (left, right) =>
        compareStrings(left.boonId, right.boonId) ||
        compareStrings(left.code, right.code) ||
        compareStrings(left.detail, right.detail),
    ),
    complete: issues.length === 0,
  };

  return { dataset, coverage };
}

function markdownText(value: string): string {
  return value.replaceAll("\r", " ").replaceAll("\n", " ").replaceAll("`", "'");
}

export function renderBoonCoverageReport(coverage: BoonCoverageReport): string {
  const lines = [
    "# Boon coverage",
    "",
    `Source acquisition: \`${coverage.acquisitionId}\``,
    "",
    `Status: ${coverage.complete ? "complete" : "incomplete"}`,
    "",
    `God and loot sources: ${coverage.godCount}`,
    "",
    `Boons: ${coverage.boonCount}`,
    "",
    `Boons with official descriptions: ${coverage.boonsWithDescriptions}`,
    "",
    `Boons with successful runtime samples: ${coverage.boonsWithSuccessfulSamples}`,
    "",
    `Failed runtime samples: ${coverage.failedSampleCount}`,
    "",
    `Resolved sample values: ${coverage.resolvedValueCount}`,
    "",
    `Contextual sample values: ${coverage.contextualValueCount}`,
    "",
    `Boons with contextual values: ${coverage.boonsWithContextualValues}`,
    "",
    "## Kinds",
    "",
    `- Normal: ${coverage.kindCounts.normal}`,
    `- Duo: ${coverage.kindCounts.duo}`,
    `- Legendary: ${coverage.kindCounts.legendary}`,
    `- Infusion: ${coverage.kindCounts.infusion}`,
    "",
    "## Issues",
    "",
  ];
  if (coverage.issues.length === 0) {
    lines.push("No coverage issues.", "");
  } else {
    for (const issue of coverage.issues) {
      lines.push(
        `- \`${issue.boonId}\` \`${issue.code}\`: ${markdownText(issue.detail)}`,
      );
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}
