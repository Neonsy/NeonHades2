import type { JsonObject, JsonValue, RuntimeBoonSample } from "../boons/runtime-schema.js";
import type {
  RuntimeArcanaCard,
  RuntimeArcanaCost,
  RuntimeArcanaReport,
} from "./runtime-schema.js";

export interface NormalizedArcanaDataset {
  readonly schema: "neodes2-arcana-1";
  readonly source: {
    readonly acquisitionId: string;
    readonly exporterVersion: string;
    readonly steamBuildId: string;
    readonly executableVersion: string;
    readonly packageVersion: string;
  };
  readonly unlockModel: RuntimeArcanaReport["unlockModel"];
  readonly layout: RuntimeArcanaReport["layout"];
  readonly grasp: RuntimeArcanaReport["grasp"];
  readonly cards: readonly {
    readonly id: string;
    readonly row: number;
    readonly column: number;
    readonly name: string;
    readonly description: string;
    readonly traitId: string;
    readonly type: string | null;
    readonly graspCost: number;
    readonly unlockCosts: readonly RuntimeArcanaCost[];
    readonly ranks: RuntimeArcanaCard["ranks"];
    readonly rankEffects: readonly RuntimeBoonSample[];
    readonly autoActivationRequirements: JsonObject;
    readonly autoActivationText: string | null;
    readonly relatedCardIds: readonly string[];
    readonly unlock: RuntimeArcanaCard["unlock"];
    readonly mechanics: JsonObject;
    readonly evidence: readonly string[];
  }[];
}

export interface ArcanaCoverageIssue {
  readonly recordId: string;
  readonly code:
    | "failed-runtime-sample"
    | "missing-rank-sample"
    | "missing-tooltip-value";
  readonly detail: string;
}

export interface ArcanaCoverageReport {
  readonly schema: "neodes2-arcana-coverage-1";
  readonly acquisitionId: string;
  readonly cardCount: number;
  readonly rankCount: number;
  readonly automaticCardCount: number;
  readonly graspLevelCount: number;
  readonly maximumGrasp: number;
  readonly failedSampleCount: number;
  readonly resolvedValueCount: number;
  readonly contextualValueCount: number;
  readonly issues: readonly ArcanaCoverageIssue[];
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

function canonicalObject(value: JsonObject): JsonObject {
  return canonicalize(value) as JsonObject;
}

function canonicalizeSample(sample: RuntimeBoonSample): RuntimeBoonSample {
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

function tooltipExtractIds(description: string): readonly string[] {
  return [
    ...new Set(
      [...description.matchAll(/\$TooltipData\.ExtractData\.([A-Za-z0-9_]+)/gu)].map(
        (match) => match[1] as string,
      ),
    ),
  ].sort(compareStrings);
}

function successfulValueIds(samples: readonly RuntimeBoonSample[]): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const sample of samples) {
    if (sample.result.status !== "ok") continue;
    for (const value of sample.result.values) ids.add(value.id);
  }
  return ids;
}

function copyCosts(costs: readonly RuntimeArcanaCost[]): readonly RuntimeArcanaCost[] {
  return costs.map((cost) => ({ ...cost }));
}

export function normalizeRuntimeArcana(report: RuntimeArcanaReport): {
  readonly dataset: NormalizedArcanaDataset;
  readonly coverage: ArcanaCoverageReport;
} {
  const issues: ArcanaCoverageIssue[] = [];
  let failedSampleCount = 0;
  let resolvedValueCount = 0;
  let contextualValueCount = 0;
  const cards = report.cards.map((card) => {
    const valueIds = successfulValueIds(card.rankEffects);
    for (const id of tooltipExtractIds(card.description)) {
      if (!valueIds.has(id)) {
        issues.push({
          recordId: card.id,
          code: "missing-tooltip-value",
          detail: `Official description references TooltipData.ExtractData.${id}, but no successful rank sample exports it.`,
        });
      }
    }
    for (const rank of card.ranks) {
      const rankSamples = card.rankEffects.filter((sample) => sample.rarity === rank.rarity);
      if (rankSamples.length === 0 || rankSamples.every((sample) => sample.result.status === "error")) {
        issues.push({
          recordId: card.id,
          code: "missing-rank-sample",
          detail: `Rank ${rank.rank} (${rank.rarity}) has no successful runtime sample.`,
        });
      }
    }
    for (const sample of card.rankEffects) {
      if (sample.result.status === "error") {
        failedSampleCount += 1;
        issues.push({
          recordId: card.id,
          code: "failed-runtime-sample",
          detail: `${sample.rarity} ${sample.endpoint}: ${sample.result.message}`,
        });
        continue;
      }
      for (const value of sample.result.values) {
        if (value.resolution.kind === "contextual") contextualValueCount += 1;
        else resolvedValueCount += 1;
      }
    }
    return {
      id: card.id,
      row: card.row,
      column: card.column,
      name: card.displayName,
      description: card.description,
      traitId: card.traitId,
      type: card.type,
      graspCost: card.graspCost,
      unlockCosts: copyCosts(card.unlockCosts),
      ranks: card.ranks.map((rank) => ({
        ...rank,
        upgradeFromPreviousCosts: copyCosts(rank.upgradeFromPreviousCosts),
      })),
      rankEffects: card.rankEffects.map(canonicalizeSample),
      autoActivationRequirements: canonicalObject(card.autoActivationRequirements),
      autoActivationText: card.autoActivationText,
      relatedCardIds: [...card.relatedCardIds],
      unlock: {
        initiallyRevealable: card.unlock.initiallyRevealable,
        adjacentCardIds: [...card.unlock.adjacentCardIds],
      },
      mechanics: canonicalObject(card.mechanics),
      evidence: [...card.evidence.runtimePaths, card.evidence.localizationPath].sort(compareStrings),
    };
  });
  issues.sort(
    (left, right) =>
      compareStrings(left.recordId, right.recordId) || compareStrings(left.code, right.code),
  );
  const lastGraspLevel = report.grasp.levels.at(-1);
  const coverage: ArcanaCoverageReport = {
    schema: "neodes2-arcana-coverage-1",
    acquisitionId: report.game.acquisitionId,
    cardCount: cards.length,
    rankCount: cards.reduce((count, card) => count + card.ranks.length, 0),
    automaticCardCount: cards.filter(
      (card) => Object.keys(card.autoActivationRequirements).length > 0,
    ).length,
    graspLevelCount: report.grasp.levels.length,
    maximumGrasp: lastGraspLevel?.cumulativeCapacity ?? report.grasp.startingCapacity,
    failedSampleCount,
    resolvedValueCount,
    contextualValueCount,
    issues,
    complete: issues.length === 0,
  };
  return {
    dataset: {
      schema: "neodes2-arcana-1",
      source: {
        acquisitionId: report.game.acquisitionId,
        exporterVersion: report.exporterVersion,
        steamBuildId: report.game.steamBuildId,
        executableVersion: report.game.executableVersion,
        packageVersion: report.game.packageVersion,
      },
      unlockModel: { ...report.unlockModel },
      layout: report.layout.map((entry) => ({ ...entry })),
      grasp: {
        ...report.grasp,
        levels: report.grasp.levels.map((level) => ({
          ...level,
          costs: copyCosts(level.costs),
        })),
        evidence: {
          ...report.grasp.evidence,
          runtimePaths: [...report.grasp.evidence.runtimePaths],
        },
      },
      cards,
    },
    coverage,
  };
}

function markdownText(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

export function renderArcanaCoverageReport(coverage: ArcanaCoverageReport): string {
  const lines = [
    "# Arcana acquisition coverage",
    "",
    `- Acquisition: \`${coverage.acquisitionId}\``,
    `- Arcana Cards: ${coverage.cardCount}`,
    `- Card ranks: ${coverage.rankCount}`,
    `- Automatic Cards: ${coverage.automaticCardCount}`,
    `- Grasp upgrade levels: ${coverage.graspLevelCount}`,
    `- Maximum Grasp: ${coverage.maximumGrasp}`,
    `- Failed runtime samples: ${coverage.failedSampleCount}`,
    `- Resolved values: ${coverage.resolvedValueCount}`,
    `- Context-dependent values: ${coverage.contextualValueCount}`,
    `- Phase 3 Arcana coverage complete: ${coverage.complete ? "yes" : "no"}`,
    "",
  ];
  if (coverage.issues.length === 0) {
    lines.push("No Arcana exporter coverage issues were found.", "");
  } else {
    lines.push("## Issues", "", "| Card | Code | Detail |", "| --- | --- | --- |");
    for (const issue of coverage.issues) {
      lines.push(
        `| ${markdownText(issue.recordId)} | ${issue.code} | ${markdownText(issue.detail)} |`,
      );
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}
